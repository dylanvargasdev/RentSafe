import { shortAddress } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import {
	type ActionDef,
	availableActions,
	useBookingFlow,
} from "../chain/useBookingFlow"
import { money } from "../config"
import { ownerById, useRentSafe } from "../store/useRentSafe"
import { type Booking } from "../types"
import { Button, Callout, Dialog } from "./ui"
import styles from "./BookingActions.module.css"

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
						Vas a depositar{" "}
						<strong>{money(booking.rent + booking.deposit)}</strong> (
						{money(booking.rent)} de alquiler + {money(booking.deposit)} de
						depósito) en un escrow nuevo.
						{booking.mode === "onchain" &&
							` Tu billetera te pedirá ${booking.registryId !== undefined && !booking.escrowLinked ? "3 firmas: crear el escrow, vincularlo a la reserva y depositar" : "2 firmas: crear el escrow y depositar"}.`}
					</Callout>
				)}
				{pending?.id === "releaseRent" && (
					<Callout tone="info">
						Recibirás {money(booking.rent)} menos la comisión del protocolo de
						Trustless Work (0,3%).
					</Callout>
				)}
				{pending?.input === "notes" && (
					<label className="field">
						<span>Estado en que recibiste el bien</span>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							maxLength={200}
							placeholder="Ej.: devuelto completo y limpio, sin daños"
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
								Para el propietario: {money(toOwner)} · Para el arrendatario:{" "}
								{money(Math.round((booking.deposit - toOwner) * 100) / 100)}
							</span>
							<input
								type="range"
								min={0}
								max={booking.deposit}
								step={booking.deposit >= 100 ? 5 : 1}
								value={toOwner}
								onChange={(e) => setToOwner(Number(e.target.value))}
								aria-label="Parte del depósito para el propietario"
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
