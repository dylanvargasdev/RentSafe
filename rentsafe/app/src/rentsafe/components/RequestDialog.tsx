import { networkPassphrase } from "@stellar-scaffold/app-lib"
import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useWallet } from "../../hooks/useWallet"
import { errorMessage } from "../../lib/errors"
import { onchainChecks } from "../chain/readiness"
import { useCreateRequest } from "../chain/useBookingFlow"
import { formatDateLong } from "../dates"
import { type Quote } from "../pricing"
import { ownerById, useRentSafe } from "../store/useRentSafe"
import { type Listing } from "../types"
import { CostSummary } from "./CostSummary"
import { Icon } from "./Icon"
import { Button, Callout, Dialog } from "./ui"
import styles from "./RequestDialog.module.css"

/** Step 4–5 of the flow: review conditions, pick a mode, confirm. */
export const RequestDialog = ({
	open,
	onClose,
	listing,
	quote,
}: {
	open: boolean
	onClose: () => void
	listing: Listing
	quote: Quote
}) => {
	const state = useRentSafe()
	const owner = ownerById(state, listing.ownerId)
	const { address, balances, networkPassphrase: walletPassphrase } = useWallet()
	const { create, busy } = useCreateRequest()
	const navigate = useNavigate()
	const [mode, setMode] = useState<"onchain" | "simulated">("onchain")
	const [accepted, setAccepted] = useState(false)
	const [message, setMessage] = useState("")
	const [error, setError] = useState("")

	const checks = useMemo(
		() =>
			onchainChecks({
				address,
				walletPassphrase,
				appPassphrase: networkPassphrase,
				balances,
				owner,
				amount: quote.rent + quote.deposit,
			}),
		[address, walletPassphrase, balances, owner, quote.rent, quote.deposit],
	)
	const onchainReady = checks.every((c) => c.ok || !c.required)

	const submit = async () => {
		setError("")
		if (!accepted) {
			setError("Debes aceptar los requisitos y condiciones del alquiler.")
			return
		}
		if (mode === "onchain" && !onchainReady) {
			setError("Completa los requisitos del modo on-chain o usa la simulación.")
			return
		}
		try {
			const id = await create(listing, quote, mode, message)
			onClose()
			navigate(`/reservas/${id}`)
		} catch (e) {
			setError(errorMessage(e))
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Revisa y confirma tu solicitud"
			footer={
				<>
					<button className="btn" onClick={onClose} disabled={busy}>
						Volver
					</button>
					<Button
						variant="primary"
						loading={busy}
						onClick={() => void submit()}
					>
						{busy && mode === "onchain"
							? "Confirma en tu billetera…"
							: "Enviar solicitud"}
					</Button>
				</>
			}
		>
			<div className={styles.summary}>
				<strong>{listing.title}</strong>
				<span className="small muted">
					{formatDateLong(quote.start)} → {formatDateLong(quote.end)}
				</span>
			</div>
			<CostSummary quote={quote} price={listing.price} unit={listing.unit} />
			<Callout tone="info" icon="lock">
				No pagas nada todavía. Si {owner?.name ?? "el propietario"} acepta,
				depositarás <strong>{quote.rent + quote.deposit} USDC</strong> en un
				escrow. El propietario cobra cuando confirmas la entrega; el depósito
				vuelve a ti tras la devolución.
			</Callout>

			<fieldset className={styles.modes}>
				<legend className="field-label">
					¿Cómo quieres hacer esta reserva?
				</legend>
				<label
					className={`${styles.mode} ${mode === "onchain" ? styles.modeOn : ""}`}
				>
					<input
						type="radio"
						name="mode"
						checked={mode === "onchain"}
						onChange={() => setMode("onchain")}
					/>
					<span>
						<strong>On-chain en Stellar testnet</strong>
						<span className="small muted">
							Transacciones reales con USDC de prueba, firmadas con tu
							billetera.
						</span>
					</span>
				</label>
				<label
					className={`${styles.mode} ${mode === "simulated" ? styles.modeOn : ""}`}
				>
					<input
						type="radio"
						name="mode"
						checked={mode === "simulated"}
						onChange={() => setMode("simulated")}
					/>
					<span>
						<strong>Simulación</strong>
						<span className="small muted">
							Mismo flujo sin blockchain. Ninguna transacción es real.
						</span>
					</span>
				</label>
			</fieldset>

			{mode === "onchain" && (
				<ul className={styles.checks} aria-label="Requisitos del modo on-chain">
					{checks.map((c) => (
						<li
							key={c.label}
							className={
								c.ok ? styles.ok : c.required ? styles.bad : styles.warn
							}
						>
							<Icon
								name={c.ok ? "check" : c.required ? "x" : "alert"}
								size={16}
							/>
							{c.label}
						</li>
					))}
					{!onchainReady && (
						<li className={styles.hint}>
							<Link to="/perfil#billetera" onClick={onClose}>
								Preparar mi billetera
							</Link>
						</li>
					)}
				</ul>
			)}

			{listing.requirements.length > 0 && (
				<div>
					<p className="field-label">Requisitos del propietario</p>
					<ul className={styles.reqs}>
						{listing.requirements.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>
				</div>
			)}
			<label className="field">
				<span>Mensaje para el propietario (opcional)</span>
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					maxLength={500}
					placeholder="Cuéntale para qué lo necesitas o a qué hora llegas"
				/>
			</label>
			<label className="check">
				<input
					type="checkbox"
					checked={accepted}
					onChange={(e) => setAccepted(e.target.checked)}
				/>
				Acepto los requisitos y las{" "}
				<Link to="/legal/cancelaciones" target="_blank">
					reglas de cancelación y disputas
				</Link>
			</label>
			{error && (
				<Callout tone="danger" icon="alert">
					{error}
				</Callout>
			)}
		</Dialog>
	)
}
