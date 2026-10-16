/**
 * Owner panel (`/propietario`): earnings summary (released, pending and held
 * in escrow, from `bookingStatus.ts`) and four tabs: requests to answer,
 * ongoing rentals, history and my listings.
 *
 * Shows bookings where the current user is the owner, including on-chain
 * bookings imported by the chain sync (`SyncNote` shows its state). The
 * header keeps a fixed layout so nothing moves when the sync runs.
 */
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useWallet } from "../../hooks/useWallet"
import { heldInEscrow, ownerEarned, ownerPending } from "../bookingStatus"
import { categoryById, unitLabel } from "../categories"
import { BookingRow } from "../components/BookingRow"
import { Icon } from "../components/Icon"
import { SyncNote } from "../components/SyncNote"
import { Badge, Callout, EmptyState, Photo } from "../components/ui"
import { money } from "../config"
import { actions, ME, useRentSafe, useSession } from "../store/useRentSafe"
import styles from "./OwnerDashboard.module.css"

type Tab = "solicitudes" | "en_curso" | "publicaciones" | "historial"

export const OwnerDashboard = () => {
	const state = useRentSafe()
	const session = useSession()!
	const { address } = useWallet()
	const [tab, setTab] = useState<Tab>("solicitudes")

	const myListings = state.listings.filter((l) => l.ownerId === ME)
	// Bookings where you are the owner: by account, or by wallet for on-chain demos.
	const myBookings = useMemo(
		() =>
			state.bookings
				.filter(
					(b) =>
						b.ownerId === ME ||
						(address &&
							b.mode === "onchain" &&
							b.ownerAddress === address &&
							b.tenantId !== ME),
				)
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
		[state.bookings, address],
	)
	const requests = myBookings.filter((b) => b.status === "requested")
	const ongoing = myBookings.filter((b) =>
		["accepted", "funded", "active", "return_review", "disputed"].includes(
			b.status,
		),
	)
	const history = myBookings.filter((b) =>
		["completed", "resolved", "rejected", "cancelled"].includes(b.status),
	)

	const earned = myBookings.reduce((s, b) => s + ownerEarned(b), 0)
	const pending = myBookings.reduce((s, b) => s + ownerPending(b), 0)
	const held = myBookings.reduce((s, b) => s + heldInEscrow(b), 0)
	const hasDemo = myBookings.some((b) => b.mode === "demo")

	const tabs: { id: Tab; label: string; count: number }[] = [
		{ id: "solicitudes", label: "Solicitudes", count: requests.length },
		{ id: "en_curso", label: "En curso", count: ongoing.length },
		{ id: "publicaciones", label: "Publicaciones", count: myListings.length },
		{ id: "historial", label: "Historial", count: history.length },
	]

	return (
		<div className="rs-container section">
			<div className="spread">
				<div style={{ flex: "1 1 320px", minWidth: 0 }}>
					<h1 style={{ fontSize: "1.8rem" }}>Panel de propietario</h1>
					<p className="muted" style={{ marginTop: 4 }}>
						Hola, {session.name.split(" ")[0]}. Administra tus bienes,
						solicitudes y cobros.
					</p>
					<SyncNote />
				</div>
				<Link to="/propietario/publicar" className="btn btn-primary">
					<Icon name="plus" size={18} />
					Publicar un bien
				</Link>
			</div>

			{!session.payoutAddress && (
				<div style={{ marginTop: 18 }}>
					<Callout tone="warning" icon="wallet">
						Aún no elegiste una billetera para cobrar. Tus bienes solo aceptan
						reservas simuladas hasta que la configures en{" "}
						<Link to="/perfil#billetera">Perfil y billetera</Link>.
					</Callout>
				</div>
			)}

			<dl className={styles.stats}>
				<div>
					<dt>Cobrado</dt>
					<dd className="num">{money(earned)}</dd>
					<span className="small muted">
						Alquileres liberados a tu billetera
					</span>
				</div>
				<div>
					<dt>Pendiente de cobro</dt>
					<dd className="num">{money(pending)}</dd>
					<span className="small muted">
						En escrow, a la espera de confirmación
					</span>
				</div>
				<div>
					<dt>En garantía ahora</dt>
					<dd className="num">{money(held)}</dd>
					<span className="small muted">Alquiler + depósitos custodiados</span>
				</div>
				<div>
					<dt>Publicaciones activas</dt>
					<dd className="num">
						{myListings.filter((l) => l.available).length}
						<span
							className="muted"
							style={{ fontSize: "0.9rem", fontWeight: 500 }}
						>
							{" "}
							/ {myListings.length}
						</span>
					</dd>
					<span className="small muted">Disponibles para reservar</span>
				</div>
			</dl>
			{hasDemo && (
				<p className="small muted">
					Las cifras se calculan a partir de tus reservas, incluidas las de
					demostración.
				</p>
			)}

			<div
				className={styles.tabs}
				role="tablist"
				aria-label="Secciones del panel"
			>
				{tabs.map((t) => (
					<button
						key={t.id}
						role="tab"
						aria-selected={tab === t.id}
						className={styles.tab}
						onClick={() => setTab(t.id)}
					>
						{t.label}
						<span className={styles.tabCount}>{t.count}</span>
					</button>
				))}
			</div>

			<div role="tabpanel" style={{ marginTop: 18 }}>
				{tab === "solicitudes" &&
					(requests.length ? (
						<div className="stack" style={{ gap: 10 }}>
							<p className="small muted">
								Abre cada solicitud para aceptarla o rechazarla. Al aceptar, las
								fechas quedan bloqueadas.
							</p>
							{requests.map((b) => (
								<BookingRow key={b.id} booking={b} perspective="owner" />
							))}
						</div>
					) : (
						<EmptyState icon="calendar" title="No hay solicitudes pendientes">
							Cuando alguien quiera alquilar uno de tus bienes, aparecerá aquí.
						</EmptyState>
					))}
				{tab === "en_curso" &&
					(ongoing.length ? (
						<div className="stack" style={{ gap: 10 }}>
							{ongoing.map((b) => (
								<BookingRow key={b.id} booking={b} perspective="owner" />
							))}
						</div>
					) : (
						<EmptyState icon="clock" title="Nada en curso" />
					))}
				{tab === "historial" &&
					(history.length ? (
						<div className="stack" style={{ gap: 10 }}>
							{history.map((b) => (
								<BookingRow key={b.id} booking={b} perspective="owner" />
							))}
						</div>
					) : (
						<EmptyState
							icon="receipt"
							title="Sin alquileres terminados todavía"
						/>
					))}
				{tab === "publicaciones" &&
					(myListings.length ? (
						<table className="table">
							<thead>
								<tr>
									<th>Bien</th>
									<th>Precio</th>
									<th>Depósito</th>
									<th>Reservas</th>
									<th>Estado</th>
									<th>
										<span className="sr-only">Acciones</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{myListings.map((l) => {
									const n = state.bookings.filter(
										(b) => b.listingId === l.id,
									).length
									return (
										<tr key={l.id}>
											<td data-label="Bien">
												<Link
													to={`/bien/${l.id}`}
													className={styles.listingCell}
												>
													<span className={styles.mini}>
														<Photo
															src={l.images[0]}
															alt=""
															category={l.category}
															className={styles.miniImg}
														/>
													</span>
													<span>
														<strong>{l.title}</strong>
														<span className="small muted">
															{categoryById(l.category)?.label}
														</span>
													</span>
												</Link>
											</td>
											<td data-label="Precio" className="num">
												{money(l.price)} / {unitLabel(l.unit, 1)}
											</td>
											<td data-label="Depósito" className="num">
												{money(l.deposit)}
											</td>
											<td data-label="Reservas" className="num">
												{n}
											</td>
											<td data-label="Estado">
												<Badge tone={l.available ? "success" : "neutral"} dot>
													{l.available ? "Disponible" : "Pausado"}
												</Badge>
											</td>
											<td data-label="Acciones">
												<div
													className="row"
													style={{ gap: 6, justifyContent: "flex-end" }}
												>
													<Link
														to={`/propietario/editar/${l.id}`}
														className="btn btn-sm"
													>
														Editar
													</Link>
													<button
														className="btn btn-sm btn-ghost"
														onClick={() =>
															actions.setListingAvailable(l.id, !l.available)
														}
													>
														{l.available ? "Pausar" : "Activar"}
													</button>
												</div>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					) : (
						<EmptyState
							icon="plus"
							title="Aún no publicaste nada"
							action={
								<Link to="/propietario/publicar" className="btn btn-primary">
									Publicar un bien
								</Link>
							}
						>
							Publica tu primer bien en un par de minutos.
						</EmptyState>
					))}
			</div>
		</div>
	)
}
