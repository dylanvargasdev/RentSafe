import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ATTRIBUTE_LABELS, categoryById, unitLabel } from "../categories"
import { money } from "../config"
import {
	addDays,
	formatDate,
	formatDateLong,
	formatRange,
	today,
} from "../dates"
import { CostSummary } from "../components/CostSummary"
import { Icon } from "../components/Icon"
import { FavoriteButton } from "../components/ListingCard"
import { RequestDialog } from "../components/RequestDialog"
import {
	Avatar,
	Badge,
	BackLink,
	Callout,
	EmptyState,
	Photo,
	Rating,
} from "../components/ui"
import {
	BLOCKING,
	isFeatured,
	isFree,
	periodKind,
	quote,
	ratingOf,
} from "../pricing"
import { ME, ownerById, useRentSafe, useSession } from "../store/useRentSafe"
import { type Listing } from "../types"
import styles from "./ListingPage.module.css"

const attributeRows = (l: Listing): [string, string][] => {
	const a = l.attributes
	const rows: [string, string | undefined][] = [
		["Tipo", a.propertyType && ATTRIBUTE_LABELS.propertyType[a.propertyType]],
		["Huéspedes", a.guests ? `Hasta ${a.guests}` : undefined],
		["Habitaciones", a.bedrooms ? String(a.bedrooms) : undefined],
		["Vehículo", a.vehicleType && ATTRIBUTE_LABELS.vehicleType[a.vehicleType]],
		[
			"Transmisión",
			a.transmission && ATTRIBUTE_LABELS.transmission[a.transmission],
		],
		["Edad mínima", a.minDriverAge ? `${a.minDriverAge} años` : undefined],
		["Dispositivo", a.deviceType && ATTRIBUTE_LABELS.deviceType[a.deviceType]],
		["Estado", a.condition && ATTRIBUTE_LABELS.condition[a.condition]],
		[
			"Equipo",
			a.equipmentType && ATTRIBUTE_LABELS.equipmentType[a.equipmentType],
		],
		[
			"Mínimo",
			l.minUnits > 1
				? `${l.minUnits} ${unitLabel(l.unit, l.minUnits)}`
				: undefined,
		],
	]
	return rows.filter((r): r is [string, string] => Boolean(r[1]))
}

const Gallery = ({ listing }: { listing: Listing }) => {
	const [i, setI] = useState(0)
	const imgs = listing.images.length ? listing.images : [""]
	return (
		<div className={styles.gallery}>
			<div className={styles.galleryMain}>
				<Photo
					src={imgs[i]}
					alt={`${listing.title}, foto ${i + 1} de ${imgs.length}`}
					category={listing.category}
					className={styles.galleryImg}
					eager
				/>
				{imgs.length > 1 && (
					<>
						<button
							className={`icon-btn ${styles.prev}`}
							aria-label="Foto anterior"
							onClick={() => setI((i - 1 + imgs.length) % imgs.length)}
						>
							<Icon name="chevronLeft" size={18} />
						</button>
						<button
							className={`icon-btn ${styles.next}`}
							aria-label="Foto siguiente"
							onClick={() => setI((i + 1) % imgs.length)}
						>
							<Icon name="chevronRight" size={18} />
						</button>
						<span className={styles.counter}>
							{i + 1} / {imgs.length}
						</span>
					</>
				)}
			</div>
			{imgs.length > 1 && (
				<div className={styles.thumbs} role="tablist" aria-label="Fotos">
					{imgs.map((src, idx) => (
						<button
							key={src + idx}
							role="tab"
							aria-selected={idx === i}
							aria-label={`Ver foto ${idx + 1}`}
							className={styles.thumb}
							onClick={() => setI(idx)}
						>
							<Photo
								src={src}
								alt=""
								category={listing.category}
								className={styles.thumbImg}
							/>
						</button>
					))}
				</div>
			)}
		</div>
	)
}

const BookingWidget = ({ listing }: { listing: Listing }) => {
	const state = useRentSafe()
	const session = useSession()
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const kind = periodKind(listing)
	const tomorrow = addDays(today(), 1)
	const [start, setStart] = useState(tomorrow)
	const [end, setEnd] = useState(
		addDays(tomorrow, Math.max(listing.minUnits, 1)),
	)
	const [units, setUnits] = useState(Math.max(listing.minUnits, 1))
	const [open, setOpen] = useState(false)

	const q = useMemo(
		() =>
			kind === "range"
				? quote(listing, start, { end })
				: quote(listing, start, { units }),
		[kind, listing, start, end, units],
	)
	const free = q.error ? true : isFree(listing, state.bookings, q.start, q.end)
	const own = listing.ownerId === ME
	const error = !listing.available
		? "El propietario pausó este bien temporalmente."
		: own
			? "Este bien es tuyo: adminístralo desde tu panel de propietario."
			: (q.error ??
				(!free ? "Esas fechas ya están reservadas. Prueba otras." : undefined))

	const request = () => {
		if (!session) {
			navigate(`/entrar?siguiente=${encodeURIComponent(pathname)}`)
			return
		}
		setOpen(true)
	}

	return (
		<aside className={styles.widget} aria-label="Reservar">
			<p className={styles.widgetPrice}>
				<strong className="num">{money(listing.price)}</strong> /{" "}
				{unitLabel(listing.unit, 1)}
			</p>
			<div className={styles.pickers}>
				<label className="field">
					<span>
						{kind === "range"
							? listing.unit === "noche"
								? "Llegada"
								: "Recogida"
							: "Fecha de inicio"}
					</span>
					<input
						type="date"
						value={start}
						min={today()}
						onChange={(e) => {
							setStart(e.target.value)
							if (kind === "range" && e.target.value >= end)
								setEnd(addDays(e.target.value, Math.max(listing.minUnits, 1)))
						}}
					/>
				</label>
				{kind === "range" ? (
					<label className="field">
						<span>{listing.unit === "noche" ? "Salida" : "Devolución"}</span>
						<input
							type="date"
							value={end}
							min={addDays(start, 1)}
							onChange={(e) => setEnd(e.target.value)}
						/>
					</label>
				) : (
					<label className="field">
						<span>Duración ({unitLabel(listing.unit, 2)})</span>
						<input
							type="number"
							min={listing.minUnits}
							max={listing.unit === "hora" ? 12 : 60}
							value={units}
							onChange={(e) => setUnits(Number(e.target.value))}
						/>
					</label>
				)}
			</div>
			{kind === "duration" && !q.error && (
				<p className="small muted">
					{listing.unit === "hora"
						? `Recoges y devuelves el ${formatDateLong(q.start)}`
						: `Del ${formatRange(q.start, q.end)} (devolución el ${formatDate(q.end)})`}
				</p>
			)}
			{error ? (
				<Callout tone="warning" icon="alert">
					{error}
				</Callout>
			) : (
				<CostSummary quote={q} price={listing.price} unit={listing.unit} />
			)}
			{own ? (
				<Link
					className="btn btn-block"
					to={`/propietario/editar/${listing.id}`}
				>
					Editar publicación
				</Link>
			) : (
				<button
					className="btn btn-primary btn-lg btn-block"
					disabled={Boolean(error)}
					onClick={request}
				>
					Solicitar alquiler
				</button>
			)}
			<p className="small muted" style={{ textAlign: "center" }}>
				No se cobra nada hasta que el propietario acepte.
			</p>
			{!error && (
				<RequestDialog
					open={open}
					onClose={() => setOpen(false)}
					listing={listing}
					quote={q}
				/>
			)}
		</aside>
	)
}

export const ListingPage = () => {
	const { id } = useParams()
	const state = useRentSafe()
	const listing = state.listings.find((l) => l.id === id)
	if (!listing)
		return (
			<div className="rs-container section">
				<EmptyState
					title="No encontramos este bien"
					action={
						<Link to="/buscar" className="btn">
							Explorar bienes
						</Link>
					}
				>
					Puede que el propietario lo haya retirado.
				</EmptyState>
			</div>
		)

	const owner = ownerById(state, listing.ownerId)
	const rating = ratingOf(listing)
	const cat = categoryById(listing.category)
	const upcoming = state.bookings
		.filter(
			(b) =>
				b.listingId === listing.id &&
				BLOCKING.includes(b.status) &&
				b.end > today(),
		)
		.sort((a, b) => a.start.localeCompare(b.start))
	const ownerListings = state.listings.filter(
		(l) => l.ownerId === listing.ownerId,
	).length

	return (
		<div className="rs-container" style={{ paddingTop: 20 }}>
			<div className="spread" style={{ marginBottom: 14 }}>
				<BackLink to={`/c/${listing.category}`}>{cat?.label}</BackLink>
				<FavoriteButton listingId={listing.id} />
			</div>
			<div className={styles.titleBlock}>
				<h1>{listing.title}</h1>
				<div className="row small" style={{ gap: 14 }}>
					{rating ? (
						<Rating avg={rating.avg} count={rating.count} />
					) : (
						<span className="muted">Sin reseñas todavía</span>
					)}
					<span className="row" style={{ gap: 4 }}>
						<Icon name="pin" size={15} /> {listing.location}
					</span>
					{isFeatured(listing) && <Badge tone="success">Destacado</Badge>}
					{!listing.available && (
						<Badge tone="warning">No disponible temporalmente</Badge>
					)}
					{listing.isDemo && <Badge>Publicación de demostración</Badge>}
				</div>
			</div>

			<Gallery listing={listing} />

			<div className={styles.layout}>
				<div className={styles.main}>
					<section className={styles.ownerRow}>
						<Avatar initials={owner?.avatar ?? "?"} size={52} />
						<div>
							<h2 className={styles.h2}>Ofrecido por {owner?.name}</h2>
							<p className="small muted">
								{owner?.city}
								{owner?.joined &&
									` · En RentSafe desde ${new Date(owner.joined).getFullYear()}`}
								{` · ${ownerListings} ${ownerListings === 1 ? "publicación" : "publicaciones"}`}
							</p>
						</div>
						{owner?.payoutAddress ? (
							<Badge tone="success" title={owner.payoutAddress}>
								Cobra en Stellar
							</Badge>
						) : (
							<Badge title="Este propietario aún no conectó una billetera: solo admite reservas simuladas">
								Sin billetera conectada
							</Badge>
						)}
					</section>
					{owner?.bio && <p className={styles.bio}>{owner.bio}</p>}

					<section className={styles.block}>
						<h2 className={styles.h2}>Descripción</h2>
						<p className={styles.desc}>{listing.description}</p>
					</section>

					<section className={styles.block}>
						<h2 className={styles.h2}>Características</h2>
						<dl className={styles.attrs}>
							{attributeRows(listing).map(([k, v]) => (
								<div key={k}>
									<dt>{k}</dt>
									<dd>{v}</dd>
								</div>
							))}
							<div>
								<dt>Cobro</dt>
								<dd>Por {unitLabel(listing.unit, 1)}</dd>
							</div>
						</dl>
						<ul className={styles.features}>
							{listing.features.map((f) => (
								<li key={f}>
									<Icon name="check" size={16} /> {f}
								</li>
							))}
						</ul>
					</section>

					<section className={styles.block}>
						<h2 className={styles.h2}>Requisitos y condiciones</h2>
						<ul className={styles.reqs}>
							{listing.requirements.map((r) => (
								<li key={r}>{r}</li>
							))}
							<li>
								Depósito de garantía de{" "}
								<strong>{money(listing.deposit)}</strong>, custodiado en un
								escrow y reembolsable al devolver el bien en buen estado.
							</li>
							<li>Cancelación gratuita hasta antes de depositar los fondos.</li>
						</ul>
					</section>

					<section className={styles.block}>
						<h2 className={styles.h2}>Disponibilidad</h2>
						{!listing.available ? (
							<p className="muted">
								El propietario pausó este bien. Guárdalo en favoritos y vuelve
								pronto.
							</p>
						) : upcoming.length ? (
							<>
								<p className="muted small">Fechas ya reservadas:</p>
								<ul className={styles.dates}>
									{upcoming.map((b) => (
										<li key={b.id}>
											<Icon name="calendar" size={15} />
											{formatRange(b.start, b.end)}
										</li>
									))}
								</ul>
							</>
						) : (
							<p className="muted">
								Sin reservas próximas: todas las fechas están libres.
							</p>
						)}
						<p className="small muted" style={{ marginTop: 8 }}>
							Ubicación aproximada: {listing.location}. La dirección exacta se
							comparte al confirmar el depósito.
						</p>
					</section>

					<section className={styles.block}>
						<div className="spread">
							<h2 className={styles.h2}>Reseñas</h2>
							{listing.reviews.some((r) => r.isDemo) && (
								<Badge>Reseñas de demostración</Badge>
							)}
						</div>
						{listing.reviews.length ? (
							<ul className={styles.reviews}>
								{listing.reviews.map((r) => (
									<li key={r.id}>
										<div className="row" style={{ gap: 10 }}>
											<Avatar initials={r.author.slice(0, 1)} size={34} />
											<div>
												<strong>{r.author}</strong>
												<p className="small muted">{formatDateLong(r.date)}</p>
											</div>
										</div>
										<p
											className="row small"
											style={{ gap: 2, color: "var(--ink)" }}
											aria-label={`${r.rating} de 5 estrellas`}
										>
											{Array.from({ length: 5 }, (_, k) => (
												<Icon
													key={k}
													name="star"
													size={13}
													filled={k < r.rating}
												/>
											))}
										</p>
										<p>{r.text}</p>
									</li>
								))}
							</ul>
						) : (
							<p className="muted">
								Todavía no hay reseñas. Las reseñas solo se publican tras un
								alquiler completado.
							</p>
						)}
					</section>
				</div>
				<BookingWidget listing={listing} key={listing.id} />
			</div>
		</div>
	)
}
