import { Link } from "react-router-dom"
import { money } from "../config"
import { formatRange } from "../dates"
import { ownerById, useRentSafe } from "../store/useRentSafe"
import { type Booking } from "../types"
import { ModeBadge, Photo, StatusBadge } from "./ui"
import styles from "./BookingRow.module.css"

/** Compact booking card used by "Mis reservas" and the owner dashboard. */
export const BookingRow = ({
	booking,
	perspective,
}: {
	booking: Booking
	perspective: "tenant" | "owner"
}) => {
	const state = useRentSafe()
	const listing = state.listings.find((l) => l.id === booking.listingId)
	const other = ownerById(
		state,
		perspective === "tenant" ? booking.ownerId : booking.tenantId,
	)
	return (
		<Link to={`/reservas/${booking.id}`} className={styles.row}>
			<div className={styles.thumb}>
				{listing && (
					<Photo
						src={listing.images[0]}
						alt=""
						category={listing.category}
						className={styles.img}
					/>
				)}
			</div>
			<div className={styles.main}>
				<strong className={styles.title}>
					{listing?.title ?? "Bien eliminado"}
				</strong>
				<span className="small muted">
					{formatRange(booking.start, booking.end)} ·{" "}
					{perspective === "tenant" ? "con" : "para"} {other?.name ?? "—"}
				</span>
				<span className={styles.badges}>
					<StatusBadge status={booking.status} />
					<ModeBadge mode={booking.mode} />
				</span>
			</div>
			<div className={styles.amount}>
				<strong className="num">
					{money(perspective === "owner" ? booking.rent : booking.total)}
				</strong>
				<span className="small muted">
					{perspective === "owner" ? "alquiler" : "total"}
				</span>
			</div>
		</Link>
	)
}
