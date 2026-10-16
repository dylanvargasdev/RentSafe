import { shortAddress } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { escrowTotal, milestoneAmount } from "../chain/milestones"
import {
	type ActionDef,
	availableActions,
	disputedMain,
	useBookingFlow,
} from "../chain/useBookingFlow"
import { money } from "../config"
import { ownerById, useRentSafe } from "../store/useRentSafe"
import { type Booking } from "../types"
import styles from "./BookingActions.module.css"
import { Button, Callout, Dialog } from "./ui"

const ROLE_NAME = {
	tenant: "arrendatario",
	owner: "propietario",
	resolver: "árbitro",
} as const

/**
 * Next steps for this booking. Each button only appears for the party who can
 * sign it; in simulations you can also play the other party to demo the flow.
 */
export const BookingActions = ({ booking }: { booking: Booking }) => {
	const state = useRentSafe()
	const { execute, busy, can } = useBookingFlow(booking)
	const [pending, setPending] = useState<ActionDef | null>(null)
	const [notes, setNotes] = useState("")
	const [reason, setReason] = useState("")
	const [toOwner, setToOwner] = useState(0)

	const defs = availableActions(booking)
	const mine = defs.filter((d) => can(d.role) === "yes")
	const simulated = defs.filter((d) => can(d.role) === "simulate")
	const blocked = defs.filter((d) => can(d.role) === "no")

	const nameOf = (role: ActionDef["role"]) => {
		if (role === "resolver") return "el árbitro de la plataforma"
		const id = role === "tenant" ? booking.tenantId : booking.ownerId
		return ownerById(state, id)?.name ?? ROLE_NAME[role]
	}

	const confirm = (d: ActionDef) => {
		setNotes("")
		setReason("")
		setToOwner(0)
		setPending(d)
	}

	const run = async () => {
		if (!pending) return
		const d = pending
		setPending(null)
		await execute(d.id, d.role, { notes, reason, toOwner })
	}

	const moves =
		pending &&
		["fund", "releaseRent", "releaseDeposit", "resolve"].includes(pending.id)
	/** Amount the arbiter splits (deposit, or the rent in a delivery dispute). */
	const splitAmount = milestoneAmount(booking, disputedMain(booking))
	const fundSignatures =
		(booking.escrowId ? 0 : 1) + (booking.escrowLinked ? 0 : 1) + 1

	return (
		<div className={styles.wrap}>
			{mine.length === 0 && simulated.length === 0 && (
				<p className="muted small">
					{blocked.length
						? booking.mode === "onchain"
							? `Esperando a ${[...new Set(blocked.map((d) => nameOf(d.role)))].join(" o ")}. Si eres esa parte, conecta la billetera con la que se creó la reserva.`
							: `Esperando a ${[...new Set(blocked.map((d) => nameOf(d.role)))].join(" o ")}.`
						: "No hay acciones pendientes en esta reserva."}
				</p>
			)}
			{mine.map((d) => (
				<div key={`${d.id}-${d.role}`} className={styles.action}>
					<Button
						variant={d.variant}
						block
						loading={busy === d.id}
						disabled={Boolean(busy)}
						onClick={() => confirm(d)}
					>
						{d.label}
					</Button>
					<span className="small muted">{d.help}</span>
				</div>
			))}
			{simulated.length > 0 && (
				<div className={styles.sim}>
					<p className="small">
						<strong>Simular a la otra parte</strong>
						<span className="muted">
							{" "}
							· solo disponible en reservas simuladas o de demostración
						</span>
					</p>
					{simulated.map((d) => (
						<Button
							key={`${d.id}-${d.role}`}
							size="sm"
							block
							loading={busy === d.id}
							disabled={Boolean(busy)}
							onClick={() => confirm(d)}
						>
							{d.label} (como {nameOf(d.role)})
						</Button>
					))}
				</div>
			)}

			<Dialog
				open={Boolean(pending)}
				onClose={() => setPending(null)}
				title={pending?.label ?? ""}
				footer={
					<>
						<button className="btn" onClick={() => setPending(null)}>
							Volver
						</button>
						<Button
							variant={pending?.variant === "danger" ? "danger" : "primary"}
							disabled={pending?.input === "reason" && !reason.trim()}
							onClick={() => void run()}
						>
							{booking.mode === "onchain" ? "Confirmar y firmar" : "Confirmar"}
						</Button>
					</>
				}
			>
				<p>{pending?.help}</p>
				{pending?.id === "fund" && (
					<Callout tone="info" icon="lock">
						Vas a depositar <strong>{money(escrowTotal(booking))}</strong> (
						{money(booking.rent)} de alquiler + {money(booking.deposit)} de
						depósito
						{booking.fee > 0 ? ` + ${money(booking.fee)} de comisión` : ""}) en
						un escrow.
						{booking.mode === "onchain" &&
							` Tu billetera te pedirá ${fundSignatures} ${fundSignatures === 1 ? "firma" : "firmas"}${fundSignatures === 3 ? ": crear el escrow, verificarlo y vincularlo a la reserva, y depositar" : ""}.`}
					</Callout>
				)}
				{pending?.id === "releaseRent" && (
					<Callout tone="info">
						Recibirás {money(booking.rent)} menos la comisión del protocolo de
						Trustless Work (0,3%).
						{booking.fee > 0 &&
							` También liberas la comisión de ${money(booking.fee)} a la plataforma (una firma más).`}
					</Callout>
				)}
				{pending?.id === "confirmReceipt" &&
					booking.fee > 0 &&
					booking.mode === "onchain" && (
						<Callout tone="info">
							Firmarás dos aprobaciones: el alquiler y la comisión de la
							plataforma.
						</Callout>
					)}
				{pending?.id === "markDelivered" &&
					booking.fee > 0 &&
					booking.mode === "onchain" && (
						<Callout tone="info">
							Firmarás dos veces: la entrega del alquiler y la de la comisión de
							la plataforma.
						</Callout>
					)}
				{pending?.id === "disputeDelivery" && (
					<Callout tone="danger" icon="alert">
						El árbitro decidirá cuánto del alquiler corresponde al propietario.
						El depósito
						{booking.fee > 0 ? " y la comisión vuelven" : " vuelve"}{" "}
						íntegramente a ti.
					</Callout>
				)}
				{pending?.input === "notes" && (
					<label className="field">
						<span>
							{pending.id === "markDelivered"
								? "Detalles de la entrega (opcional)"
								: "Estado en que recibiste el bien"}
						</span>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							maxLength={200}
							placeholder={
								pending.id === "markDelivered"
									? "Ej.: entregado en mano con cargador y control"
									: "Ej.: devuelto completo y limpio, sin daños"
							}
						/>
						<span className="hint">
							Queda como evidencia en el escrow
							{booking.mode === "onchain"
								? " (público en la blockchain: no incluyas datos personales)"
								: ""}
							.
						</span>
					</label>
				)}
				{pending?.input === "reason" && (
					<label className="field">
						<span>Motivo de la disputa</span>
						<textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							maxLength={300}
							placeholder="Describe qué pasó"
							aria-invalid={!reason.trim() || undefined}
						/>
						<span className="hint">
							El depósito queda bloqueado hasta que el árbitro decida el
							reparto.
						</span>
					</label>
				)}
				{pending?.input === "split" && (
					<div className="stack" style={{ gap: 10 }}>
						{booking.disputeReason && (
							<Callout tone="danger" icon="alert">
								{booking.disputeReason}
							</Callout>
						)}
						<label className="field">
							<span>
								{booking.disputeKind === "delivery" ? "Alquiler" : "Depósito"}{" "}
								para el propietario: {money(toOwner)} · Para el arrendatario:{" "}
								{money(Math.round((splitAmount - toOwner) * 100) / 100)}
							</span>
							<input
								type="range"
								min={0}
								max={splitAmount}
								step={splitAmount >= 100 ? 5 : 1}
								value={toOwner}
								onChange={(e) => setToOwner(Number(e.target.value))}
								aria-label="Parte en disputa para el propietario"
								style={{ accentColor: "var(--pine)" }}
							/>
						</label>
					</div>
				)}
				{moves && booking.mode === "onchain" && (
					<p className="small muted">
						Se moverán USDC de prueba en Stellar testnet. La operación no se
						puede deshacer.
					</p>
				)}
				{booking.mode === "onchain" && (
					<p className="small muted">
						Firmarás con{" "}
						{booking.ownerAddress && pending?.role === "owner"
							? shortAddress(booking.ownerAddress)
							: booking.tenantAddress && pending?.role === "tenant"
								? shortAddress(booking.tenantAddress)
								: "tu billetera"}
						.
					</p>
				)}
				{booking.mode !== "onchain" && (
					<p className="small muted">
						Simulación: no se envía ninguna transacción.
					</p>
				)}
			</Dialog>
		</div>
	)
}
