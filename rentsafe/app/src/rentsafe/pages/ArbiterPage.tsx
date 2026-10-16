import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useWallet } from "../../hooks/useWallet"
import { platformAddress } from "../../trustless/config"
import { BookingRow } from "../components/BookingRow"
import { SyncNote } from "../components/SyncNote"
import { Callout, EmptyState } from "../components/ui"
import { useRentSafe } from "../store/useRentSafe"

/**
 * Disputes for the platform arbiter (PUBLIC_PLATFORM_ADDRESS). The bookings
 * come from the chain (rental_registry indexes them under the arbiter once the
 * escrow is linked), so this works from any browser with that wallet.
 */
export const ArbiterPage = () => {
	const { address } = useWallet()
	const { bookings } = useRentSafe()
	const mine = useMemo(
		() =>
			bookings
				.filter(
					(b) =>
						b.mode === "onchain" && address && b.resolverAddress === address,
				)
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
		[bookings, address],
	)
	const open = mine.filter((b) => b.status === "disputed")
	const rest = mine.filter((b) => b.status !== "disputed")

	return (
		<div className="rs-container section">
			<h1 style={{ fontSize: "1.8rem" }}>Disputas</h1>
			<p className="muted" style={{ marginTop: 4 }}>
				Reservas en las que tu billetera es el árbitro de la plataforma.
			</p>
			<SyncNote />
			{!platformAddress && (
				<Callout tone="warning" icon="alert">
					Falta PUBLIC_PLATFORM_ADDRESS en app/.env: sin árbitro no se pueden
					crear reservas on-chain.
				</Callout>
			)}
			{platformAddress && address !== platformAddress && (
				<Callout tone="info">
					Conecta la billetera del árbitro ({platformAddress.slice(0, 4)}…
					{platformAddress.slice(-4)}) para ver y resolver disputas.
				</Callout>
			)}
			<h2 style={{ margin: "28px 0 12px", fontSize: "1.15rem" }}>
				Por resolver ({open.length})
			</h2>
			<div className="stack" style={{ gap: 10 }}>
				{open.length ? (
					open.map((b) => (
						<BookingRow key={b.id} booking={b} perspective="owner" />
					))
				) : (
					<EmptyState icon="check" title="No hay disputas abiertas">
						Cuando una de las partes abra una disputa, aparecerá aquí.
					</EmptyState>
				)}
			</div>
			{rest.length > 0 && (
				<>
					<h2 style={{ margin: "28px 0 12px", fontSize: "1.15rem" }}>
						Otras reservas que arbitras ({rest.length})
					</h2>
					<div className="stack" style={{ gap: 10 }}>
						{rest.map((b) => (
							<BookingRow key={b.id} booking={b} perspective="owner" />
						))}
					</div>
				</>
			)}
			<p className="small muted" style={{ marginTop: 24 }}>
				<Link to="/como-funciona">Cómo funcionan las disputas</Link>
			</p>
		</div>
	)
}
