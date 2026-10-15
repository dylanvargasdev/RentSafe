import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { CATEGORIES } from "../categories"
import { actions, useRentSafe, useSession } from "../store/useRentSafe"
import { Icon } from "./Icon"
import { Avatar } from "./ui"
import { WalletMenu } from "./WalletMenu"
import styles from "./Header.module.css"

export const Logo = () => (
	<Link to="/" className={styles.logo} aria-label="RentSafe, inicio">
		<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
			<rect width="32" height="32" rx="9" fill="var(--pine)" />
			<path
				d="M8 15.2 16 8.5l8 6.7V23a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"
				fill="none"
				stroke="#fff"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="m12.6 17.6 2.4 2.4 4.6-4.6"
				fill="none"
				stroke="#9fe0c2"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
		<span>RentSafe</span>
	</Link>
)

const AccountMenu = () => {
	const session = useSession()
	const { bookings } = useRentSafe()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const navigate = useNavigate()

	useEffect(() => {
		if (!open) return
		const close = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("mousedown", close)
		document.addEventListener("keydown", esc)
		return () => {
			document.removeEventListener("mousedown", close)
			document.removeEventListener("keydown", esc)
		}
	}, [open])

	if (!session)
		return (
			<Link to="/entrar" className={`btn btn-sm ${styles.loginBtn}`}>
				<Icon name="user" size={18} />
				<span>Entrar</span>
			</Link>
		)

	const pendingForMe = bookings.filter(
		(b) => b.ownerId === session.userId && b.status === "requested",
	).length
	const initials = session.name
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase()

	return (
		<div className={styles.menuWrap} ref={ref}>
			<button
				type="button"
				className={styles.accountBtn}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={`Menú de ${session.name}`}
				onClick={() => setOpen((o) => !o)}
			>
				<Icon name="menu" size={18} />
				<Avatar initials={initials} size={30} />
				{pendingForMe > 0 && (
					<span
						className={styles.notif}
						aria-label={`${pendingForMe} solicitudes pendientes`}
					>
						{pendingForMe}
					</span>
				)}
			</button>
			{open && (
				<div
					className={`${styles.popover} ${styles.menu}`}
					role="menu"
					onClick={() => setOpen(false)}
				>
					<p className={styles.popTitle}>{session.name}</p>
					<Link role="menuitem" to="/reservas">
						Mis reservas
					</Link>
					<Link role="menuitem" to="/favoritos">
						Favoritos
					</Link>
					<Link role="menuitem" to="/propietario">
						Panel de propietario
						{pendingForMe > 0 && (
							<span className="badge badge-warning">{pendingForMe}</span>
						)}
					</Link>
					<Link role="menuitem" to="/propietario/publicar">
						Publicar un bien
					</Link>
					<Link role="menuitem" to="/perfil">
						Perfil y billetera
					</Link>
					<hr />
					<button
						role="menuitem"
						onClick={() => {
							actions.signOut()
							navigate("/")
						}}
					>
						Cerrar sesión
					</button>
				</div>
			)}
		</div>
	)
}

const HeaderSearch = () => {
	const navigate = useNavigate()
	const [q, setQ] = useState("")
	const submit = (e: FormEvent) => {
		e.preventDefault()
		navigate(q.trim() ? `/buscar?q=${encodeURIComponent(q.trim())}` : "/buscar")
	}
	return (
		<form className={styles.search} onSubmit={submit} role="search">
			<label className="sr-only" htmlFor="header-q">
				Buscar por palabra clave
			</label>
			<input
				id="header-q"
				value={q}
				onChange={(e) => setQ(e.target.value)}
				placeholder="Busca casas, autos, cámaras, taladros…"
			/>
			<button type="submit" aria-label="Buscar">
				<Icon name="search" size={16} />
			</button>
		</form>
	)
}

export const Header = () => {
	const { favorites } = useRentSafe()
	const { pathname } = useLocation()
	const isHome = pathname === "/"

	return (
		<header className={styles.header}>
			<div className={`rs-container ${styles.top}`}>
				<Logo />
				{!isHome && <HeaderSearch />}
				<div className={styles.right}>
					<Link
						to="/propietario/publicar"
						className={`btn btn-sm btn-ghost ${styles.publish}`}
					>
						<Icon name="plus" size={18} />
						<span>Publicar un bien</span>
					</Link>
					<Link
						to="/favoritos"
						className={styles.iconLink}
						aria-label={`Favoritos (${favorites.length})`}
						title="Favoritos"
					>
						<Icon name="heart" size={20} />
						{favorites.length > 0 && (
							<span className={styles.count}>{favorites.length}</span>
						)}
					</Link>
					<WalletMenu />
					<AccountMenu />
				</div>
			</div>
			<nav className={`rs-container ${styles.cats}`} aria-label="Categorías">
				{CATEGORIES.map((c) => (
					<NavLink
						key={c.id}
						to={`/c/${c.id}`}
						className={({ isActive }) =>
							`${styles.cat} ${isActive ? styles.catActive : ""}`
						}
					>
						<Icon name={c.icon} size={22} />
						<span className={styles.catLong}>{c.label}</span>
						<span className={styles.catShort}>{c.short}</span>
					</NavLink>
				))}
			</nav>
		</header>
	)
}
