import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
	Link,
	Navigate,
	useLocation,
	useNavigate,
	useSearchParams,
} from "react-router-dom"
import { BookingRow } from "../components/BookingRow"
import { ListingCard } from "../components/ListingCard"
import { SyncNote } from "../components/SyncNote"
import { Callout, EmptyState } from "../components/ui"
import { actions, ME, useRentSafe, useSession } from "../store/useRentSafe"
import { type Booking } from "../types"

/** Pages that need a RentSafe account redirect to /entrar and come back. */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
	const session = useSession()
	const { pathname } = useLocation()
	if (!session)
		return (
			<Navigate
				to={`/entrar?siguiente=${encodeURIComponent(pathname)}`}
				replace
			/>
		)
	return children
}

export const AuthPage = () => {
	const state = useRentSafe()
	const navigate = useNavigate()
	const [params] = useSearchParams()
	const next = params.get("siguiente") || "/"
	const [tab, setTab] = useState<"signup" | "signin">(
		state.account ? "signin" : "signup",
	)
	const [name, setName] = useState("")
	const [email, setEmail] = useState(state.account?.email ?? "")
	const [city, setCity] = useState("")
	const [errors, setErrors] = useState<Record<string, string>>({})

	const submit = (e: FormEvent) => {
		e.preventDefault()
		const err: Record<string, string> = {}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
			err.email = "Escribe un correo válido."
		if (tab === "signup") {
			if (name.trim().length < 2) err.name = "Escribe tu nombre."
			if (city.trim().length < 2) err.city = "Indica tu ciudad o zona."
		}
		setErrors(err)
		if (Object.keys(err).length) return
		if (tab === "signup") actions.signUp({ name, email, city })
		else if (!actions.signIn(email)) {
			setErrors({
				email: "No hay una cuenta con ese correo en este navegador. Crea una.",
			})
			return
		}
		void navigate(next.startsWith("/") ? next : "/", { replace: true })
	}

	return (
		<div className="rs-container section" style={{ maxWidth: 520 }}>
			<div className="panel stack">
				<div>
					<h1 style={{ fontSize: "1.6rem" }}>
						{tab === "signup" ? "Crea tu cuenta" : "Inicia sesión"}
					</h1>
					<p className="muted" style={{ marginTop: 6 }}>
						Una sola cuenta para alquilar y para publicar tus bienes.
					</p>
				</div>
				<div className="row" role="tablist">
					<button
						role="tab"
						className="chip"
						aria-pressed={tab === "signup"}
						aria-selected={tab === "signup"}
						onClick={() => setTab("signup")}
					>
						Crear cuenta
					</button>
					<button
						role="tab"
						className="chip"
						aria-pressed={tab === "signin"}
						aria-selected={tab === "signin"}
						onClick={() => setTab("signin")}
					>
						Ya tengo cuenta
					</button>
				</div>
				<form className="stack" onSubmit={submit} noValidate>
					{tab === "signup" && (
						<label className="field">
							<span>Nombre</span>
							<input
								value={name}
								onChange={(e) => setName(e.target.value)}
								autoComplete="name"
								aria-invalid={Boolean(errors.name) || undefined}
							/>
							{errors.name && <span className="error-text">{errors.name}</span>}
						</label>
					)}
					<label className="field">
						<span>Correo electrónico</span>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							aria-invalid={Boolean(errors.email) || undefined}
						/>
						{errors.email && <span className="error-text">{errors.email}</span>}
					</label>
					{tab === "signup" && (
						<label className="field">
							<span>Ciudad o zona</span>
							<input
								value={city}
								onChange={(e) => setCity(e.target.value)}
								placeholder="Ej.: Heredia"
								aria-invalid={Boolean(errors.city) || undefined}
							/>
							{errors.city && <span className="error-text">{errors.city}</span>}
						</label>
					)}
					<button className="btn btn-primary btn-lg btn-block" type="submit">
						{tab === "signup" ? "Crear cuenta" : "Entrar"}
					</button>
				</form>
				<Callout icon="info">
					Prototipo: tu cuenta de RentSafe se guarda solo en este navegador, sin
					servidor ni contraseña. Tu billetera Stellar es independiente: la
					conectas después, desde tu perfil, para pagar y cobrar.
				</Callout>
			</div>
		</div>
	)
}

const groups = (bookings: Booking[]) => ({
	action: bookings.filter((b) =>
		[
			"requested",
			"accepted",
			"funded",
			"active",
			"return_review",
			"disputed",
		].includes(b.status),
	),
	past: bookings.filter((b) =>
		["completed", "resolved", "rejected", "cancelled"].includes(b.status),
	),
})

export const TripsPage = () => {
	const { bookings } = useRentSafe()
	const mine = useMemo(
		() =>
			bookings
				.filter((b) => b.tenantId === ME)
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
		[bookings],
	)
	const g = groups(mine)
	return (
		<div className="rs-container section">
			<h1 style={{ fontSize: "1.8rem" }}>Mis reservas</h1>
			<p className="muted" style={{ marginTop: 4 }}>
				Solicitudes, alquileres en curso y tu historial como arrendatario.
			</p>
			<SyncNote />
			{mine.length === 0 ? (
				<div style={{ marginTop: 24 }}>
					<EmptyState
						icon="calendar"
						title="Aún no tienes reservas"
						action={
							<Link to="/buscar" className="btn btn-primary">
								Explorar bienes
							</Link>
						}
					>
						Cuando solicites un alquiler, aquí verás su estado, el escrow y cada
						transacción.
					</EmptyState>
				</div>
			) : (
				<>
					<h2 style={{ margin: "28px 0 12px", fontSize: "1.15rem" }}>
						En curso ({g.action.length})
					</h2>
					<div className="stack" style={{ gap: 10 }}>
						{g.action.length ? (
							g.action.map((b) => (
								<BookingRow key={b.id} booking={b} perspective="tenant" />
							))
						) : (
							<p className="muted">Nada en curso.</p>
						)}
					</div>
					<h2 style={{ margin: "28px 0 12px", fontSize: "1.15rem" }}>
						Historial ({g.past.length})
					</h2>
					<div className="stack" style={{ gap: 10 }}>
						{g.past.length ? (
							g.past.map((b) => (
								<BookingRow key={b.id} booking={b} perspective="tenant" />
							))
						) : (
							<p className="muted">Sin alquileres terminados.</p>
						)}
					</div>
				</>
			)}
		</div>
	)
}

export const FavoritesPage = () => {
	const { favorites, listings } = useRentSafe()
	const items = listings.filter((l) => favorites.includes(l.id))
	return (
		<div className="rs-container section">
			<h1 style={{ fontSize: "1.8rem" }}>Favoritos</h1>
			<p className="muted" style={{ marginTop: 4, marginBottom: 24 }}>
				Guardados en este navegador.
			</p>
			{items.length ? (
				<div className="listing-grid">
					{items.map((l) => (
						<ListingCard key={l.id} listing={l} />
					))}
				</div>
			) : (
				<EmptyState
					icon="heart"
					title="Todavía no guardaste nada"
					action={
						<Link to="/buscar" className="btn btn-primary">
							Explorar bienes
						</Link>
					}
				>
					Toca el corazón de cualquier bien para guardarlo y compararlo después.
				</EmptyState>
			)}
		</div>
	)
}
