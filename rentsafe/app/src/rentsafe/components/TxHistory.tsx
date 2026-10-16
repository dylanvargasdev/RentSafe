import { stellarNetwork } from "@stellar-scaffold/app-lib"
import { formatDateTime } from "../dates"
import { type TxRecord } from "../types"
import { Icon } from "./Icon"
import styles from "./TxHistory.module.css"
import { Badge } from "./ui"

const net = stellarNetwork === "PUBLIC" ? "public" : "testnet"

/** Explorer link for a tx hash, contract (C…) or account (G…). */
export const explorerFor = (ref: string) => {
	if (/^[0-9a-f]{64}$/i.test(ref))
		return `https://stellar.expert/explorer/${net}/tx/${ref}`
	if (/^C[A-Z0-9]{55}$/.test(ref))
		return `https://stellar.expert/explorer/${net}/contract/${ref}`
	if (/^G[A-Z0-9]{55}$/.test(ref))
		return `https://stellar.expert/explorer/${net}/account/${ref}`
	return undefined
}

export const shortRef = (ref: string) =>
	ref.length > 16 ? `${ref.slice(0, 6)}…${ref.slice(-6)}` : ref

export const TxRef = ({ value }: { value?: string }) => {
	if (!value) return null
	const href = explorerFor(value)
	if (!href)
		return (
			<code
				className={styles.ref}
				title="Referencia de simulación: no existe en ninguna blockchain"
			>
				{value}
			</code>
		)
	return (
		<a
			className={styles.ref}
			href={href}
			target="_blank"
			rel="noreferrer"
			title={`Ver ${value} en stellar.expert`}
		>
			{shortRef(value)}
			<Icon name="external" size={13} />
		</a>
	)
}

const STATUS = {
	pending: { tone: "warning", label: "Pendiente" },
	confirmed: { tone: "success", label: "Confirmada" },
	failed: { tone: "danger", label: "Fallida" },
} as const

const KIND = {
	escrow: "Escrow",
	registry: "Registro Soroban",
	simulated: "Simulación",
	offchain: "Fuera de cadena",
} as const

export const TxHistory = ({ items }: { items: TxRecord[] }) => {
	if (!items.length)
		return <p className="muted small">Sin operaciones todavía.</p>
	return (
		<ol className={styles.list}>
			{[...items].reverse().map((t) => (
				<li key={t.id} className={styles.item}>
					<span className={`${styles.dot} ${styles[t.status]}`} aria-hidden />
					<div className={styles.body}>
						<div className={styles.top}>
							<strong>{t.label}</strong>
							<Badge tone={STATUS[t.status].tone}>
								{STATUS[t.status].label}
							</Badge>
						</div>
						<div className={styles.meta}>
							<span>{KIND[t.kind]}</span>
							<span>{formatDateTime(t.at)}</span>
							<TxRef value={t.ref} />
						</div>
						{t.error && <p className={styles.error}>{t.error}</p>}
					</div>
				</li>
			))}
		</ol>
	)
}
