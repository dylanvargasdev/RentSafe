import { Link, useParams } from "react-router-dom"
import { escrowViewerUrl } from "../../trustless/config"
import { STATUS, TIMELINE } from "../bookingStatus"
import { unitLabel } from "../categories"
import { registryContractId } from "../chain/registry"
import { BookingActions } from "../components/BookingActions"
import { CostSummary } from "../components/CostSummary"
import { FundsFlow } from "../components/FundsFlow"
import { Icon } from "../components/Icon"
import { ReviewForm } from "../components/OnchainReviews"
import { TxHistory, TxRef } from "../components/TxHistory"
import {
	BackLink,
	Callout,
	EmptyState,
	ModeBadge,
	Photo,
	StatusBadge,
} from "../components/ui"
import { formatDateLong } from "../dates"
import { ME, ownerById, useRentSafe } from "../store/useRentSafe"
import styles from "./BookingPage.module.css"

export const BookingPage = () => {
	const { id } = useParams()
	const state = useRentSafe()
	const b = state.bookings.find((x) => x.id === id)
	if (!b)
		return (
			<div className="rs-container section">
				<EmptyState
					title="No encontramos esta reserva"
					action={
						<Link to="/reservas" className="btn">
							Ir a mis reservas
						</Link>
					}
				/>
			</div>
		)
	const listing = state.listings.find((l) => l.id === b.listingId)
	const owner = ownerById(state, b.ownerId)
	const tenant = ownerById(state, b.tenantId)
	const iAmOwner = b.ownerId === ME
	const funded = [
		"funded",
		"active",
		"return_review",
		"completed",
		"disputed",
		"resolved",
	].includes(b.status)
	const reached = TIMELINE.map((t) => t.reached(b))
	const closed = ["rejected", "cancelled"].includes(b.status)

	return (
		<div className="rs-container" style={{ paddingTop: 20 }}>
			<BackLink to={iAmOwner ? "/propietario" : "/reservas"}>
				{iAmOwner ? "Panel de propietario" : "Mis reservas"}
			</BackLink>

			<header className={styles.head}>
				{listing && (
					<Link
						to={`/bien/${listing.id}`}
						className={styles.thumb}
						aria-label={`Ver ${listing.title}`}
					>
						<Photo
							src={listing.images[0]}
							alt=""
							category={listing.category}
							className={styles.thumbImg}
						/>
					</Link>
				)}
				<div className={styles.headText}>
					<div className="row" style={{ gap: 8 }}>
						<StatusBadge status={b.status} />
						<ModeBadge mode={b.mode} />
					</div>
					<h1 className={styles.title}>
						{listing?.title ?? `Publicación ${b.listingId}`}
					</h1>
					<p className="muted">
						{formatDateLong(b.start)} → {formatDateLong(b.end)} · {b.units}{" "}
						{listing ? unitLabel(listing.unit, b.units) : ""} ·{" "}
						{iAmOwner
							? `Arrendatario: ${tenant?.name}`
							: `Propietario: ${owner?.name}`}
					</p>
				</div>
			</header>

			<Callout
				tone={
					STATUS[b.status].tone === "danger"
						? "danger"
						: STATUS[b.status].tone === "success"
							? "success"
							: "info"
				}
			>
				{STATUS[b.status].help}
			</Callout>

			{!closed && (
				<ol className={styles.timeline} aria-label="Progreso de la reserva">
					{TIMELINE.map((t, i) => (
						<li
							key={t.key}
							className={reached[i] ? styles.reached : ""}
							aria-current={reached[i] && !reached[i + 1] ? "step" : undefined}
						>
							<span className={styles.tick}>
								{reached[i] ? <Icon name="check" size={13} /> : i + 1}
							</span>
							<span>{t.label}</span>
						</li>
					))}
				</ol>
			)}

			<div className={styles.layout}>
				<div className="stack" style={{ gap: 20, minWidth: 0 }}>
					<section className="panel">
						<h2 className={styles.h2}>Dónde está el dinero</h2>
						<FundsFlow
							rent={b.rent}
							deposit={b.deposit}
							funded={funded}
							rentReleased={b.rentReleased}
							depositReleased={b.depositReleased}
							disputed={b.status === "disputed"}
							tenantLabel={b.tenantId === ME ? "Tú" : tenant?.name}
							ownerLabel={b.ownerId === ME ? "ti" : owner?.name}
						/>
						{b.resolution && (
							<p className="small" style={{ marginTop: 12 }}>
								Resolución del árbitro: {b.resolution.toOwner} USDC al
								propietario y {b.resolution.toTenant} USDC al arrendatario.
							</p>
						)}
					</section>

					{(b.message || b.returnNotes || b.disputeReason) && (
						<section className="panel stack" style={{ gap: 12 }}>
							{b.message && (
								<div>
									<p className="field-label">Mensaje del arrendatario</p>
									<p>{b.message}</p>
								</div>
							)}
							{b.returnNotes && (
								<div>
									<p className="field-label">
										Devolución registrada por el propietario
									</p>
									<p>{b.returnNotes}</p>
								</div>
							)}
							{b.disputeReason && (
								<div>
									<p className="field-label">Disputa</p>
									<p>{b.disputeReason}</p>
								</div>
							)}
						</section>
					)}

					<section className="panel">
						<h2 className={styles.h2}>Historial de operaciones</h2>
						<TxHistory items={b.history} />
					</section>
				</div>

				<aside className="stack" style={{ gap: 20, minWidth: 0 }}>
					<section className="panel">
						<h2 className={styles.h2}>Siguiente paso</h2>
						<BookingActions booking={b} />
					</section>
					{b.mode === "onchain" &&
						(b.status === "completed" || b.status === "resolved") && (
							<section className="panel">
								<h2 className={styles.h2}>Reseña verificada</h2>
								<ReviewForm booking={b} />
							</section>
						)}
					<section className="panel">
						<h2 className={styles.h2}>Resumen del coste</h2>
						{listing && (
							<CostSummary
								quote={b}
								price={listing.price}
								unit={listing.unit}
							/>
						)}
					</section>
					<section className="panel">
						<h2 className={styles.h2}>Referencias verificables</h2>
						<dl className={styles.refs}>
							<div>
								<dt>Modo</dt>
								<dd>
									<ModeBadge mode={b.mode} />
								</dd>
							</div>
							<div>
								<dt>Escrow (Trustless Work)</dt>
								<dd>
									{b.escrowId ? (
										<span className="row" style={{ gap: 8 }}>
											<TxRef value={b.escrowId} />
											<a
												href={escrowViewerUrl(b.escrowId)}
												target="_blank"
												rel="noreferrer"
												className="small"
											>
												Ver en el visor de escrows
											</a>
										</span>
									) : (
										<span className="muted small">
											{b.mode === "onchain"
												? "Se crea al depositar"
												: "No aplica"}
										</span>
									)}
								</dd>
							</div>
							<div>
								<dt>Registro on-chain</dt>
								<dd>
									{b.registryId !== undefined && registryContractId ? (
										<span className="row" style={{ gap: 8 }}>
											<span className="small">Reserva #{b.registryId} en</span>
											<TxRef value={registryContractId} />
										</span>
									) : (
										<span className="muted small">
											{b.mode === "onchain"
												? "Contrato no desplegado"
												: "No aplica"}
										</span>
									)}
								</dd>
							</div>
							{b.mode === "onchain" && (
								<>
									<div>
										<dt>Billetera del arrendatario</dt>
										<dd>
											<TxRef value={b.tenantAddress} />
										</dd>
									</div>
									<div>
										<dt>Billetera del propietario</dt>
										<dd>
											<TxRef value={b.ownerAddress} />
										</dd>
									</div>
									<div>
										<dt>Árbitro de disputas</dt>
										<dd>
											<TxRef value={b.resolverAddress} />
										</dd>
									</div>
								</>
							)}
						</dl>
						{b.mode !== "onchain" && (
							<p className="small muted" style={{ marginTop: 10 }}>
								Las referencias SIM-… son de simulación y no existen en ninguna
								blockchain.
							</p>
						)}
					</section>
				</aside>
			</div>
		</div>
	)
}
