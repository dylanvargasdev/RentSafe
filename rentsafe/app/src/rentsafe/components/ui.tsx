/**
 * Small design-system primitives shared by every RentSafe page: badges
 * (generic, booking status, booking mode), buttons with a busy state, callouts,
 * empty states, avatars, ratings, photos with fallback, the modal `Dialog` and
 * the back link.
 *
 * Styles live in `styles/base.css` (global `rs-*` classes and tokens), so
 * these components stay markup-only.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { MODE, STATUS, type Tone } from "../bookingStatus"
import { categoryById } from "../categories"
import { type BookingMode, type BookingStatus, type CategoryId } from "../types"
import { Icon, type IconName } from "./Icon"

export const Badge = ({
	tone = "neutral",
	children,
	dot,
	title,
}: {
	tone?: Tone
	children: ReactNode
	dot?: boolean
	title?: string
}) => (
	<span
		className={`badge badge-${tone}${dot ? " badge-dot" : ""}`}
		title={title}
	>
		{children}
	</span>
)

export const StatusBadge = ({ status }: { status: BookingStatus }) => (
	<Badge tone={STATUS[status].tone} dot title={STATUS[status].help}>
		{STATUS[status].label}
	</Badge>
)

export const ModeBadge = ({ mode }: { mode: BookingMode }) => (
	<Badge tone={MODE[mode].tone} title={MODE[mode].help}>
		{MODE[mode].label}
	</Badge>
)

export const Spinner = () => <span className="spinner" aria-hidden />

export const Button = ({
	loading,
	children,
	variant,
	size,
	block,
	icon,
	...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	loading?: boolean
	variant?: "primary" | "danger" | "ghost"
	size?: "sm" | "lg"
	block?: boolean
	icon?: IconName
}) => (
	<button
		{...rest}
		type={rest.type ?? "button"}
		disabled={rest.disabled || loading}
		aria-busy={loading || undefined}
		className={[
			"btn",
			variant && `btn-${variant}`,
			size && `btn-${size}`,
			block && "btn-block",
			rest.className,
		]
			.filter(Boolean)
			.join(" ")}
	>
		{loading ? <Spinner /> : icon && <Icon name={icon} size={18} />}
		{children}
	</button>
)

export const Callout = ({
	tone,
	icon = "info",
	children,
}: {
	tone?: "warning" | "info" | "success" | "danger"
	icon?: IconName
	children: ReactNode
}) => (
	<div
		className={`callout${tone ? ` callout-${tone}` : ""}`}
		role={tone === "danger" ? "alert" : undefined}
	>
		<Icon name={icon} size={18} />
		<div>{children}</div>
	</div>
)

export const EmptyState = ({
	icon = "search",
	title,
	children,
	action,
}: {
	icon?: IconName
	title: string
	children?: ReactNode
	action?: ReactNode
}) => (
	<div className="empty">
		<div className="empty-icon">
			<Icon name={icon} size={22} />
		</div>
		<h3>{title}</h3>
		{children && (
			<p className="muted" style={{ maxWidth: 420 }}>
				{children}
			</p>
		)}
		{action}
	</div>
)

export const Avatar = ({
	initials,
	size = 44,
}: {
	initials: string
	size?: number
}) => (
	<span
		aria-hidden
		style={{
			width: size,
			height: size,
			borderRadius: "50%",
			background: "var(--pine-soft)",
			color: "var(--pine-strong)",
			display: "inline-grid",
			placeItems: "center",
			fontWeight: 750,
			fontSize: size * 0.36,
			flexShrink: 0,
		}}
	>
		{initials}
	</span>
)

export const Rating = ({ avg, count }: { avg: number; count: number }) => (
	<span
		className="row"
		style={{ gap: 4, fontSize: "0.88rem", fontWeight: 600 }}
	>
		<Icon name="star" size={14} filled />
		<span className="num">{avg.toFixed(2).replace(/\.?0+$/, "")}</span>
		<span className="muted" style={{ fontWeight: 400 }}>
			({count} {count === 1 ? "reseña" : "reseñas"})
		</span>
	</span>
)

/** Photo with a branded fallback if the remote image fails to load. */
export const Photo = ({
	src,
	alt,
	category,
	className,
	style,
	eager,
}: {
	src?: string
	alt: string
	category: CategoryId
	className?: string
	style?: React.CSSProperties
	eager?: boolean
}) => {
	const [failedSrc, setFailedSrc] = useState<string>()
	const failed = !src || failedSrc === src
	const cat = categoryById(category)
	if (failed)
		return (
			<div
				className={className}
				role="img"
				aria-label={alt}
				style={{
					...style,
					display: "grid",
					placeItems: "center",
					background: "linear-gradient(140deg, #e6f2ec, #f5f6f4)",
					color: "var(--pine)",
				}}
			>
				<Icon name={cat?.icon ?? "grid"} size={40} />
			</div>
		)
	return (
		<img
			src={src}
			alt={alt}
			className={className}
			style={{ objectFit: "cover", ...style }}
			loading={eager ? "eager" : "lazy"}
			decoding="async"
			onError={() => setFailedSrc(src)}
		/>
	)
}

/**
 * Modal built on a NON-modal <dialog> (`show()`) plus our own backdrop.
 *
 * Not `showModal()` on purpose: a modal dialog lives in the browser's top layer
 * and makes the rest of the page inert, so wallet UIs injected into the page
 * (the Cavos vault iframe that asks to approve a signature) would open hidden
 * behind it and the signature would never come back.
 */
export const Dialog = ({
	open,
	onClose,
	title,
	children,
	footer,
}: {
	open: boolean
	onClose: () => void
	title: string
	children: ReactNode
	footer?: ReactNode
}) => {
	const ref = useRef<HTMLDialogElement>(null)
	useEffect(() => {
		const d = ref.current
		if (!d) return
		if (open && !d.open) {
			d.show()
			d.querySelector<HTMLElement>(
				"input, textarea, select, button:not(.icon-btn)",
			)?.focus()
		}
		if (!open && d.open) d.close()
	}, [open])
	// Escape and scroll lock (a non-modal dialog doesn't do these by itself).
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		const overflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		document.addEventListener("keydown", onKey)
		return () => {
			document.body.style.overflow = overflow
			document.removeEventListener("keydown", onKey)
		}
	}, [open, onClose])
	return (
		<>
			{open && (
				<div className="rs-dialog-backdrop" onClick={onClose} aria-hidden />
			)}
			<dialog
				ref={ref}
				className="rs-dialog"
				aria-modal="true"
				aria-labelledby="rs-dialog-title"
			>
				{open && (
					<>
						<div className="rs-dialog-head">
							<h3 id="rs-dialog-title">{title}</h3>
							<button
								className="icon-btn"
								onClick={onClose}
								aria-label="Cerrar"
							>
								<Icon name="x" size={18} />
							</button>
						</div>
						<div className="rs-dialog-body">{children}</div>
						{footer && <div className="rs-dialog-foot">{footer}</div>}
					</>
				)}
			</dialog>
		</>
	)
}

export const BackLink = ({
	to,
	children,
}: {
	to: string
	children: ReactNode
}) => (
	<Link
		to={to}
		className="row small"
		style={{ gap: 4, textDecoration: "none", fontWeight: 600 }}
	>
		<Icon name="chevronLeft" size={16} />
		{children}
	</Link>
)
