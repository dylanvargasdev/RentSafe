import { useWallet } from "../../hooks/useWallet"
import { registry } from "../chain/registry"
import { useChainSyncState } from "../chain/syncContext"
import { formatDateTime } from "../dates"
import styles from "./SyncNote.module.css"

/**
 * "Synced with Stellar" line for the booking lists: on-chain bookings are read
 * from rental_registry, so they show up in any browser where the same wallet
 * is connected.
 *
 * Visually static on purpose: the text and the button never change, and the
 * sync state is only a fixed-size dot (+ tooltip). The sync runs in the
 * background every 30 s; nothing on the page may move when it does.
 */
export const SyncNote = () => {
	const { address } = useWallet()
	const sync = useChainSyncState()
	if (!registry) return null

	const state = !address
		? "off"
		: sync?.error
			? "error"
			: sync?.syncing || !sync?.lastSync
				? "busy"
				: "ok"
	const detail = !address
		? "Conecta tu billetera para ver tus reservas on-chain de otros dispositivos."
		: sync?.error
			? `No se pudo sincronizar con Stellar: ${sync.error}`
			: sync?.lastSync
				? `Última sincronización: ${formatDateTime(sync.lastSync.toISOString())}`
				: "Sincronizando con Stellar…"

	return (
		<p className={`small muted ${styles.note}`} title={detail}>
			<span className={`${styles.dot} ${styles[state]}`} aria-hidden />
			<span className={styles.text}>
				Reservas on-chain sincronizadas con Stellar
			</span>
			<span className="sr-only" aria-live="polite">
				{detail}
			</span>
			<button
				type="button"
				className={`btn btn-sm ${styles.button}`}
				onClick={() => void sync?.syncNow()}
				disabled={!address || !sync || sync.syncing}
				style={{ visibility: address ? "visible" : "hidden" }}
			>
				Actualizar
			</button>
		</p>
	)
}
