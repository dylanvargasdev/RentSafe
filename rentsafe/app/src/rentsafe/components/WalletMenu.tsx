import { connectWallet, shortAddress } from "@stellar-scaffold/app-lib"
import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useCavosState } from "../../cavos/context"
import { useWallet } from "../../hooks/useWallet"
import { USDC_BALANCE_KEY } from "../../trustless/config"
import { useSession } from "../store/useRentSafe"
import styles from "./Header.module.css"
import { Icon } from "./Icon"

/**
 * Wallet indicator for the header. Separate from the RentSafe account on
 * purpose: signing in to RentSafe doesn't create a wallet, and connecting a
 * wallet doesn't create a RentSafe account.
 */
export const WalletMenu = () => {
	const { address, connector, isPending, balances, disconnect } = useWallet()
	const cavos = useCavosState()
	const session = useSession()
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const close = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("mousedown", close)
		document.addEventListener("keydown", esc)
		return () => {
			document.removeEventListener("mousedown", close)
			document.removeEventListener("keydown", esc)
		}
	}, [open])

	const connecting = isPending || Boolean(cavos?.isLoading)
	const xlm = balances.xlm?.balance
	const usdc = balances[USDC_BALANCE_KEY]?.balance
	const state: "off" | "connecting" | "locked" | "on" = address
		? "on"
		: cavos?.needsDeviceApproval
			? "locked"
			: connecting
				? "connecting"
				: "off"

	const label =
		state === "on"
			? shortAddress(address!)
			: state === "locked"
				? "Desbloquear billetera"
				: state === "connecting"
					? "Conectando…"
					: "Conectar billetera"

	return (
		<div className={styles.menuWrap} ref={ref}>
			<button
				type="button"
				className={`${styles.walletBtn} ${state === "on" ? styles.walletOn : ""}`}
				aria-expanded={open}
				aria-haspopup="true"
				onClick={() => setOpen((o) => !o)}
			>
				<span
					className={`${styles.dot} ${styles[`dot_${state}`]}`}
					aria-hidden
				/>
				<Icon name="wallet" size={18} />
				<span className={styles.walletLabel}>{label}</span>
			</button>
			{open && (
				<div className={styles.popover} role="dialog" aria-label="Billetera">
					{state === "on" ? (
						<>
							<p className={styles.popTitle}>Billetera conectada</p>
							<p className="small muted">
								{connector === "cavos"
									? `Billetera Cavos${cavos?.email ? ` de ${cavos.email}` : ""}`
									: "Billetera de extensión (Freighter u otra)"}
							</p>
							<code className={styles.addr}>{address}</code>
							<dl className={styles.balances}>
								<div>
									<dt>XLM</dt>
									<dd className="num">{xlm ?? "Cuenta sin activar"}</dd>
								</div>
								<div>
									<dt>USDC</dt>
									<dd className="num">{usdc ?? "Sin trustline"}</dd>
								</div>
							</dl>
							<div className={styles.popActions}>
								<Link
									className="btn btn-sm"
									to="/perfil#billetera"
									onClick={() => setOpen(false)}
								>
									Preparar para pagos
								</Link>
								<button
									className="btn btn-sm btn-ghost"
									onClick={() => void navigator.clipboard?.writeText(address!)}
								>
									Copiar dirección
								</button>
								<button
									className="btn btn-sm btn-danger"
									onClick={() => {
										void disconnect()
										setOpen(false)
									}}
								>
									Desconectar
								</button>
							</div>
						</>
					) : state === "locked" ? (
						<>
							<p className={styles.popTitle}>
								Este navegador aún no tiene tu llave
							</p>
							<p className="small muted">
								Desbloquea la billetera con la passkey que creaste antes.
							</p>
							<div className={styles.popActions}>
								<button
									className="btn btn-sm btn-primary"
									onClick={() => void cavos?.approveDevice()}
								>
									Desbloquear con passkey
								</button>
								<button className="btn btn-sm" onClick={cavos?.signOut}>
									Salir
								</button>
							</div>
						</>
					) : (
						<>
							<p className={styles.popTitle}>Conecta una billetera Stellar</p>
							<p className="small muted">
								Se usa para firmar el depósito en garantía y recibir pagos.
								RentSafe nunca ve tus llaves privadas.
							</p>
							<div className={styles.popActions}>
								{cavos && (
									<button
										className="btn btn-sm btn-primary"
										disabled={connecting}
										onClick={() => {
											setOpen(false)
											// Cavos sends Google back to the page the login started
											// on, and only accepts URLs registered in its dashboard:
											// start it from the profile (or home, without a RentSafe
											// account) so there are just two URLs to register.
											const loginPath = session ? "/perfil" : "/"
											if (pathname !== loginPath) void navigate(loginPath)
											setTimeout(() => cavos.signIn(), 0)
										}}
									>
										Con correo o Google
									</button>
								)}
								<button
									className={`btn btn-sm ${cavos ? "" : "btn-primary"}`}
									disabled={connecting}
									onClick={() => {
										void connectWallet()
										setOpen(false)
									}}
								>
									Con Freighter u otra extensión
								</button>
							</div>
							{!cavos && (
								<p className="small muted">
									El acceso con correo (Cavos) se activa al configurar{" "}
									<code>PUBLIC_CAVOS_APP_ID</code>.
								</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	)
}
