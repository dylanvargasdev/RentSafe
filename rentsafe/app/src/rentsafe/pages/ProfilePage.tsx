import {
	connectWallet,
	fundAccount,
	shortAddress,
	stellarNetwork,
} from "@stellar-scaffold/app-lib"
import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useCavosState } from "../../cavos/context"
import { useNotification } from "../../hooks/useNotification"
import { useWallet } from "../../hooks/useWallet"
import { errorMessage } from "../../lib/errors"
import {
	isTrustlessWorkConfigured,
	platformAddress,
	USDC_BALANCE_KEY,
} from "../../trustless/config"
import { addUsdcTrustline, swapXlmForUsdc } from "../../trustless/usdc"
import { registry } from "../chain/registry"
import { Icon } from "../components/Icon"
import { TxRef } from "../components/TxHistory"
import { Avatar, Badge, Button, Callout } from "../components/ui"
import { formatDateLong } from "../dates"
import { store } from "../store/store"
import { actions, useSession } from "../store/useRentSafe"
import styles from "./ProfilePage.module.css"

/**
 * Wallet → test XLM → USDC trustline → test USDC, in Spanish. Also shown
 * inside the booking request dialog when the wallet can't pay the escrow yet.
 */
export const WalletSetup = () => {
	const { address, balances, updateBalances, signTransaction, connector } =
		useWallet()
	const cavos = useCavosState()
	const { addNotification } = useNotification()
	const [busy, setBusy] = useState<string | null>(null)
	const xlm = balances.xlm?.balance
	const usdc = balances[USDC_BALANCE_KEY]?.balance
	const testnet = stellarNetwork === "TESTNET"

	const act = async (label: string, fn: () => Promise<unknown>) => {
		setBusy(label)
		try {
			await fn()
			await updateBalances()
			addNotification(`${label}: listo`, "success")
		} catch (e) {
			addNotification(`${label}: ${errorMessage(e)}`, "error")
		} finally {
			setBusy(null)
		}
	}

	const steps = [
		{
			done: Boolean(address),
			label: "Conectar una billetera Stellar",
			detail: address
				? `${connector === "cavos" ? "Billetera Cavos" : "Extensión"} · ${shortAddress(address)}`
				: "Con correo o Google (Cavos) o con Freighter en Testnet.",
			action: !address && (
				<div className="row">
					{cavos && (
						<button
							className="btn btn-sm btn-primary"
							onClick={
								cavos.needsDeviceApproval ? cavos.signInAgain : cavos.signIn
							}
						>
							Con correo o Google
						</button>
					)}
					<button className="btn btn-sm" onClick={() => void connectWallet()}>
						Con una extensión
					</button>
				</div>
			),
		},
		{
			done: Boolean(xlm),
			label: "Activar la cuenta con XLM de prueba",
			detail: xlm
				? `${xlm} XLM para pagar comisiones de red`
				: "Friendbot crea tu cuenta en testnet con 10.000 XLM de prueba.",
			action: address && !xlm && testnet && (
				<Button
					size="sm"
					loading={busy === "Activar cuenta"}
					onClick={() =>
						void act("Activar cuenta", async () => {
							const r = await fundAccount(address)
							if (!r.ok) throw new Error(r.message)
						})
					}
				>
					Activar con Friendbot
				</Button>
			),
		},
		{
			done: usdc !== undefined,
			label: "Habilitar USDC (trustline)",
			detail: "Permite a tu cuenta recibir y guardar USDC. Reserva 0,5 XLM.",
			action: address && xlm && usdc === undefined && (
				<Button
					size="sm"
					loading={busy === "Habilitar USDC"}
					onClick={() =>
						void act("Habilitar USDC", () =>
							addUsdcTrustline(address, signTransaction),
						)
					}
				>
					Habilitar USDC
				</Button>
			),
		},
		{
			done: usdc !== undefined && Number(usdc.replace(/,/g, "")) > 0,
			label: "Conseguir USDC de prueba",
			detail:
				usdc !== undefined
					? `Saldo: ${usdc} USDC`
					: "Necesario para depositar en garantía.",
			action: address && usdc !== undefined && testnet && (
				<div className="row">
					<Button
						size="sm"
						loading={busy === "Cambiar XLM por USDC"}
						onClick={() =>
							void act("Cambiar XLM por USDC", () =>
								swapXlmForUsdc(address, signTransaction, "500"),
							)
						}
					>
						Cambiar 500 XLM por USDC
					</Button>
					<a
						className="small"
						href="https://faucet.circle.com"
						target="_blank"
						rel="noreferrer"
					>
						o usar el faucet de Circle
					</a>
				</div>
			),
		},
	]

	return (
		<ol className={styles.steps}>
			{steps.map((s, i) => (
				<li key={s.label} className={s.done ? styles.done : ""}>
					<span className={styles.stepNum}>
						{s.done ? <Icon name="check" size={14} /> : i + 1}
					</span>
					<div>
						<strong>{s.label}</strong>
						<p className="small muted">{s.detail}</p>
						{!s.done && s.action && (
							<div style={{ marginTop: 8 }}>{s.action}</div>
						)}
					</div>
				</li>
			))}
		</ol>
	)
}

export const ProfilePage = () => {
	const session = useSession()!
	const { address, balances } = useWallet()
	const { hash } = useLocation()
	const [name, setName] = useState(session.name)
	const [city, setCity] = useState(session.city)
	const xlm = balances.xlm?.balance

	useEffect(() => {
		if (hash)
			document
				.getElementById(hash.slice(1))
				?.scrollIntoView({ behavior: "smooth" })
	}, [hash])

	const initials = session.name
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase()

	return (
		<div className="rs-container section">
			<div className={styles.header}>
				<Avatar initials={initials} size={64} />
				<div>
					<h1 style={{ fontSize: "1.7rem" }}>{session.name}</h1>
					<p className="muted">
						En RentSafe desde el{" "}
						{formatDateLong(session.createdAt.slice(0, 10))}
					</p>
				</div>
			</div>

			<div className={styles.grid}>
				<section className="panel stack">
					<h2 className={styles.h2}>Identidad en RentSafe</h2>
					<p className="small muted">
						Tu perfil público como arrendatario y propietario. Nunca se publica
						en la blockchain.
					</p>
					<label className="field">
						<span>Nombre</span>
						<input value={name} onChange={(e) => setName(e.target.value)} />
					</label>
					<label className="field">
						<span>Correo</span>
						<input value={session.email} disabled />
					</label>
					<label className="field">
						<span>Ciudad o zona</span>
						<input value={city} onChange={(e) => setCity(e.target.value)} />
					</label>
					<Button
						variant="primary"
						disabled={
							name.trim().length < 2 ||
							(name === session.name && city === session.city)
						}
						onClick={() =>
							actions.updateAccount({ name: name.trim(), city: city.trim() })
						}
					>
						Guardar cambios
					</Button>
					<Callout icon="info">
						Sesión local de demostración: la cuenta se guarda en este navegador.
						En producción se reemplaza por un backend con autenticación.
					</Callout>
				</section>

				<section className="panel stack" id="billetera">
					<div className="spread">
						<h2 className={styles.h2}>Billetera y cuenta Stellar</h2>
						<Badge tone={address ? "success" : "neutral"} dot>
							{address
								? xlm
									? "Cuenta activa en testnet"
									: "Conectada, cuenta sin activar"
								: "Sin conectar"}
						</Badge>
					</div>
					<p className="small muted">
						Conectar una billetera no crea una cuenta de RentSafe, y tu cuenta
						de RentSafe no crea una billetera. Las llaves privadas nunca pasan
						por RentSafe.
					</p>
					<WalletSetup />
					<div className={styles.payout}>
						<div>
							<strong>Billetera para cobrar alquileres</strong>
							<p className="small muted">
								{session.payoutAddress ? (
									<>
										Cobras en <TxRef value={session.payoutAddress} />
									</>
								) : (
									"Sin billetera de cobro: tus publicaciones solo aceptan reservas simuladas."
								)}
							</p>
						</div>
						{address && address !== session.payoutAddress && (
							<Button
								size="sm"
								variant="primary"
								onClick={() =>
									actions.updateAccount({ payoutAddress: address })
								}
							>
								Cobrar en {shortAddress(address)}
							</Button>
						)}
						{session.payoutAddress && (
							<Button
								size="sm"
								variant="ghost"
								onClick={() =>
									actions.updateAccount({ payoutAddress: undefined })
								}
							>
								Quitar
							</Button>
						)}
					</div>
				</section>

				<section className="panel stack">
					<h2 className={styles.h2}>Estado de la integración</h2>
					<ul className={styles.status}>
						<li>
							<Badge
								tone={stellarNetwork === "TESTNET" ? "success" : "warning"}
							>
								{stellarNetwork}
							</Badge>{" "}
							Red configurada
						</li>
						<li>
							<Badge tone={isTrustlessWorkConfigured ? "success" : "warning"}>
								{isTrustlessWorkConfigured ? "Configurado" : "Falta API key"}
							</Badge>
							Escrow Trustless Work
						</li>
						<li>
							<Badge tone={registry ? "success" : "warning"}>
								{registry ? "Desplegado" : "No desplegado"}
							</Badge>
							Contrato rental_registry{" "}
							{registry && <TxRef value={registry.options.contractId} />}
						</li>
						<li>
							<Badge tone={platformAddress ? "success" : "warning"}>
								{platformAddress ? "Configurado" : "Falta (solo simulación)"}
							</Badge>
							Árbitro de disputas (PUBLIC_PLATFORM_ADDRESS)
						</li>
					</ul>
					<hr className="divider" />
					<div>
						<strong>Datos de demostración</strong>
						<p className="small muted">
							Restablece publicaciones, reservas y favoritos de ejemplo. Tu
							cuenta se conserva.
						</p>
					</div>
					<Button
						variant="danger"
						onClick={() => {
							if (
								window.confirm(
									"¿Restablecer todos los datos de demostración? Se borran tus publicaciones y reservas locales.",
								)
							)
								store.reset()
						}}
					>
						Restablecer datos de demostración
					</Button>
				</section>
			</div>
		</div>
	)
}
