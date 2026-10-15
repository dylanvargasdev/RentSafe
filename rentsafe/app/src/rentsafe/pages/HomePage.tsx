import { useMemo } from "react"
import { Link } from "react-router-dom"
import { CATEGORIES } from "../categories"
import { daysBetween, today } from "../dates"
import { FundsFlow } from "../components/FundsFlow"
import { Icon } from "../components/Icon"
import { ListingCard } from "../components/ListingCard"
import { SearchBar } from "../components/SearchBar"
import { isFeatured, ratingOf } from "../pricing"
import { useRentSafe } from "../store/useRentSafe"
import styles from "./HomePage.module.css"

const ago = (iso: string) => {
	const d = daysBetween(iso.slice(0, 10), today())
	if (d <= 0) return "hoy"
	if (d === 1) return "ayer"
	return `hace ${d} días`
}

export const HomePage = () => {
	const { listings, bookings } = useRentSafe()

	const featured = useMemo(
		() => listings.filter((l) => l.available && isFeatured(l)).slice(0, 4),
		[listings],
	)

	const popular = useMemo(() => {
		const count = new Map<string, number>()
		for (const b of bookings)
			count.set(b.listingId, (count.get(b.listingId) ?? 0) + 1)
		const score = (id: string) =>
			(count.get(id) ?? 0) * 2 +
			(ratingOf(listings.find((l) => l.id === id)!)?.count ?? 0)
		return listings
			.filter((l) => l.available && !featured.includes(l))
			.sort((a, b) => score(b.id) - score(a.id))
			.slice(0, 8)
	}, [listings, bookings, featured])

	const recent = useMemo(() => {
		const seen = new Set<string>()
		return bookings
			.filter((b) =>
				["active", "completed", "funded", "return_review"].includes(b.status),
			)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.flatMap((b) => {
				const l = listings.find((x) => x.id === b.listingId)
				if (!l || seen.has(l.id)) return []
				seen.add(l.id)
				return [
					{
						listing: l,
						when: ago(b.start <= today() ? b.start : b.createdAt),
						demo: b.mode === "demo",
					},
				]
			})
			.slice(0, 4)
	}, [bookings, listings])

	return (
		<>
			<section className={styles.hero}>
				<div className="rs-container">
					<div className={styles.heroText}>
						<h1>Alquila lo que necesitas. Tu depósito queda protegido.</h1>
						<p>
							Casas, vehículos, tecnología y herramientas de personas y
							empresas. El pago espera en un escrow en Stellar hasta que ambas
							partes cumplen.
						</p>
					</div>
					<SearchBar />
				</div>
			</section>

			<div className="rs-container">
				<section className="section" aria-labelledby="h-featured">
					<div className="section-head">
						<div>
							<h2 id="h-featured">Destacados</h2>
							<p>Valoración media de 4,8 o más con al menos 3 reseñas.</p>
						</div>
						<Link to="/buscar?orden=valoracion" className="btn btn-sm">
							Ver mejor valorados
						</Link>
					</div>
					<div className="listing-grid">
						{featured.map((l, i) => (
							<ListingCard key={l.id} listing={l} eager={i < 4} />
						))}
					</div>
				</section>

				<section
					className={styles.catStrip}
					aria-label="Explorar por categoría"
				>
					{CATEGORIES.map((c) => {
						const n = listings.filter(
							(l) => l.category === c.id && l.available,
						).length
						return (
							<Link key={c.id} to={`/c/${c.id}`} className={styles.catTile}>
								<span className={styles.catIcon}>
									<Icon name={c.icon} size={24} />
								</span>
								<span>
									<strong>{c.label}</strong>
									<span className="small muted">{n} disponibles</span>
								</span>
							</Link>
						)
					})}
				</section>

				<section className="section" aria-labelledby="h-popular">
					<div className="section-head">
						<div>
							<h2 id="h-popular">Populares esta semana</h2>
							<p>Los bienes con más reservas y reseñas.</p>
						</div>
						<Link to="/buscar" className="btn btn-sm">
							Ver todo
						</Link>
					</div>
					<div className="listing-grid">
						{popular.map((l) => (
							<ListingCard key={l.id} listing={l} />
						))}
					</div>
				</section>

				{recent.length > 0 && (
					<section className="section" aria-labelledby="h-recent">
						<div className="section-head">
							<div>
								<h2 id="h-recent">Alquilados recientemente</h2>
								<p>
									Basado en las reservas registradas
									{recent.some((r) => r.demo)
										? " (incluye datos de demostración)"
										: ""}
									.
								</p>
							</div>
						</div>
						<div className="listing-grid">
							{recent.map((r) => (
								<ListingCard
									key={r.listing.id}
									listing={r.listing}
									note={`Alquilado ${r.when}`}
								/>
							))}
						</div>
					</section>
				)}
			</div>

			<section className={styles.how} aria-labelledby="h-how">
				<div className="rs-container">
					<div className="section-head">
						<div>
							<h2 id="h-how">Cómo funciona</h2>
							<p>
								Cuatro pasos, sin efectivo de por medio y con reglas que nadie
								puede cambiar a mitad del camino.
							</p>
						</div>
						<Link to="/como-funciona" className="btn btn-sm">
							Ver el detalle
						</Link>
					</div>
					<ol className={styles.steps}>
						<li>
							<h3>Elige y solicita</h3>
							<p>
								Busca por categoría, fechas y precio. Ves el alquiler y el
								depósito por separado antes de pedir nada.
							</p>
						</li>
						<li>
							<h3>El propietario acepta</h3>
							<p>
								Revisa tu solicitud y la acepta. Las fechas quedan bloqueadas en
								un registro público en Stellar.
							</p>
						</li>
						<li>
							<h3>Depositas en garantía</h3>
							<p>
								Alquiler y depósito van a un escrow: un contrato que guarda el
								dinero. Ni RentSafe ni el propietario pueden tocarlo solos.
							</p>
						</li>
						<li>
							<h3>Se libera al cumplir</h3>
							<p>
								Confirmas la entrega y el propietario cobra. Al devolver el bien
								en buen estado, recuperas tu depósito.
							</p>
						</li>
					</ol>
				</div>
			</section>

			<section className="section" aria-labelledby="h-protect">
				<div className={`rs-container ${styles.protect}`}>
					<div className={styles.protectText}>
						<h2 id="h-protect">
							Tu depósito no se queda en el bolsillo de nadie
						</h2>
						<p>
							En un alquiler tradicional entregas el depósito y esperas que te
							lo devuelvan. En RentSafe el dinero espera en un contrato
							inteligente con reglas visibles para ambas partes.
						</p>
						<ul className={styles.checks}>
							<li>
								<Icon name="check" size={18} />
								El propietario no cobra hasta que confirmas que recibiste el
								bien.
							</li>
							<li>
								<Icon name="check" size={18} />
								El depósito vuelve a ti cuando el propietario aprueba la
								devolución.
							</li>
							<li>
								<Icon name="check" size={18} />
								Si hay daños o desacuerdo, cualquiera abre una disputa y un
								árbitro reparte el depósito.
							</li>
							<li>
								<Icon name="check" size={18} />
								Cada paso deja una transacción que puedes verificar en el
								explorador de Stellar.
							</li>
						</ul>
						<p className="small muted">
							Un contrato no puede ver si un bien volvió en buen estado: eso lo
							confirman las partes con su firma, o el árbitro si no hay acuerdo.
						</p>
					</div>
					<div className="panel">
						<p className="small muted" style={{ marginBottom: 12 }}>
							Ejemplo: cabaña 3 noches a 115 USDC con 250 USDC de depósito, a
							mitad del alquiler
						</p>
						<FundsFlow
							rent={345}
							deposit={250}
							funded
							rentReleased
							depositReleased={false}
						/>
					</div>
				</div>
			</section>

			<section className="rs-container" aria-labelledby="h-owners">
				<div className={styles.ownerCta}>
					<div>
						<h2 id="h-owners">¿Tienes algo que casi no usas?</h2>
						<p>
							Publica tu casa, tu auto, tu cámara o tu herramienta. Tú pones el
							precio, el depósito y las condiciones. Cobras en USDC directamente
							en tu billetera.
						</p>
					</div>
					<div className="row">
						<Link to="/propietario/publicar" className="btn btn-lg btn-primary">
							<Icon name="plus" size={18} />
							Publicar un bien
						</Link>
						<Link to="/propietario" className="btn btn-lg">
							Ir al panel de propietario
						</Link>
					</div>
				</div>
			</section>
		</>
	)
}
