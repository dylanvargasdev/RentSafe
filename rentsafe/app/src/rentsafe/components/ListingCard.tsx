import { Link } from "react-router-dom"
import { unitLabel } from "../categories"
import { money } from "../config"
import { isFeatured, ratingOf } from "../pricing"
import { actions, useRentSafe } from "../store/useRentSafe"
import { type Listing } from "../types"
import { Icon } from "./Icon"
import { Badge, Photo } from "./ui"
import styles from "./ListingCard.module.css"

export const FavoriteButton = ({
	listingId,
	floating,
}: {
	listingId: string
	floating?: boolean
}) => {
	const { favorites } = useRentSafe()
	const on = favorites.includes(listingId)
	return (
		<button
			type="button"
			className={floating ? styles.favFloating : "icon-btn"}
			aria-pressed={on}
			aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
			title={on ? "Quitar de favoritos" : "Guardar en favoritos"}
			onClick={(e) => {
				e.preventDefault()
				e.stopPropagation()
				actions.toggleFavorite(listingId)
			}}
		>
			<Icon name="heart" size={floating ? 22 : 18} filled={on} />
		</button>
	)
}

export const ListingCard = ({
	listing,
	note,
	eager,
}: {
	listing: Listing
	/** Optional context line, e.g. "Alquilado hace 2 días". */
	note?: string
	eager?: boolean
}) => {
	const rating = ratingOf(listing)
	const featured = isFeatured(listing)
	return (
		<article className={styles.card}>
			<Link to={`/bien/${listing.id}`} className={styles.link}>
				<div className={styles.media}>
					<Photo
						src={listing.images[0]}
						alt={listing.title}
						category={listing.category}
						className={styles.img}
						eager={eager}
					/>
					<div className={styles.tags}>
						{featured && (
							<Badge
								tone="success"
								title="Valoración media de 4,8 o más con al menos 3 reseñas"
							>
								Destacado
							</Badge>
						)}
						{!listing.available && <Badge>No disponible</Badge>}
					</div>
				</div>
				<div className={styles.body}>
					<div className={styles.titleRow}>
						<h3 className={styles.title}>{listing.title}</h3>
						{rating && (
							<span
								className={styles.rating}
								aria-label={`Valoración ${rating.avg} de 5, ${rating.count} reseñas`}
							>
								<Icon name="star" size={13} filled />
								<span className="num">{rating.avg.toFixed(1)}</span>
								<span className="muted">({rating.count})</span>
							</span>
						)}
					</div>
					<p className={styles.meta}>{listing.location}</p>
					{note && <p className={styles.meta}>{note}</p>}
					<p className={styles.price}>
						<strong className="num">{money(listing.price)}</strong>
						<span> / {unitLabel(listing.unit, 1)}</span>
					</p>
					<p className={styles.deposit}>
						{listing.deposit > 0 ? (
							<>
								<Icon name="shield" size={14} />
								Depósito en garantía {money(listing.deposit)}
							</>
						) : (
							"Sin depósito"
						)}
					</p>
				</div>
			</Link>
			<FavoriteButton listingId={listing.id} floating />
		</article>
	)
}

export const ListingCardSkeleton = () => (
	<div aria-hidden>
		<div className="skeleton" style={{ aspectRatio: "4 / 3.2" }} />
		<div
			className="skeleton"
			style={{ height: 14, marginTop: 12, width: "80%" }}
		/>
		<div
			className="skeleton"
			style={{ height: 12, marginTop: 8, width: "50%" }}
		/>
	</div>
)
