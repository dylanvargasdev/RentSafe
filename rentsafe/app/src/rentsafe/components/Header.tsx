/**
 * Top bar: logo, search box, category nav, account menu and wallet menu.
 *
 * The account menu adds "Panel de árbitro" only when the connected wallet is
 * the platform address (`PUBLIC_TRUSTLESS_PLATFORM_ADDRESS`), which is also
 * the dispute resolver of every escrow. `Logo` is reused by the footer.
 */
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useWallet } from "../../hooks/useWallet"
import { platformAddress } from "../../trustless/config"
import { CATEGORIES } from "../categories"
import { actions, useRentSafe, useSession } from "../store/useRentSafe"
import styles from "./Header.module.css"
import { Icon } from "./Icon"
import { Avatar } from "./ui"
import { WalletMenu } from "./WalletMenu"

/**
 * RentSafe mark: a block (blockchain) with a keyhole on its front face, the
 * deposit locked on-chain. The three faces are separated by real gaps, so it
 * reads on any background. Same drawing as app/public/rentsafe.svg.
 */
const LogoMark = ({ size = 32 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
		<polygon points="32,8.8 50.4,19.5 32,30.2 13.6,19.5" fill="#8fdcb8" />
		<polygon points="12.7,20.9 31.3,31.6 31.3,54.8 12.7,43.1" fill="#0e5a43" />
		<polygon points="32.7,31.6 51.3,20.9 51.3,43.1 32.7,54.8" fill="#083b2c" />
		<circle cx="22" cy="34.5" r="3.6" fill="#fff" />
		<path d="M20.3 37 19.3 44h5.4l-1-7z" fill="#fff" />
	</svg>
)

export const Logo = () => (
	<Link to="/" className={styles.logo} aria-label="RentSafe, inicio">
		<LogoMark size={34} />
		<span>
			Rent<span className={styles.logoAccent}>Safe</span>
		</span>
	</Link>
)

const AccountMenu = () => {
	const session = useSession()
	const { bookings } = useRentSafe()
	const { address } = useWallet()
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

	const isArbiter = Boolean(platformAddress && address === platformAddress)
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
					{isArbiter && (
						<Link role="menuitem" to="/arbitro">
							Disputas (árbitro)
						</Link>
					)}
					<hr />
					<button
						role="menuitem"
						onClick={() => {
							actions.signOut()
							void navigate("/")
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
		void navigate(
			q.trim() ? `/buscar?q=${encodeURIComponent(q.trim())}` : "/buscar",
		)
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
