import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { CATEGORIES, categoryById } from "../categories"
import { today } from "../dates"
import { type Filters, PARAM } from "../search"
import { type CategoryId } from "../types"
import { Icon } from "./Icon"
import styles from "./SearchBar.module.css"

/**
 * Main search. Writes every value to the URL; results pages read them back.
 * Gear categories (duration-based) only ask for a pickup date.
 */
export const SearchBar = ({
	initial,
	compact,
}: {
	initial?: Partial<Filters>
	compact?: boolean
}) => {
	const navigate = useNavigate()
	const [location, setLocation] = useState(initial?.location ?? "")
	const [category, setCategory] = useState<CategoryId | "">(
		initial?.category ?? "",
	)
	const [start, setStart] = useState(initial?.start ?? "")
	const [end, setEnd] = useState(initial?.end ?? "")
	const [maxPrice, setMaxPrice] = useState(
		initial?.maxPrice !== undefined ? String(initial.maxPrice) : "",
	)
	const [onlyAvailable, setOnlyAvailable] = useState(
		initial?.onlyAvailable ?? false,
	)
	const [error, setError] = useState("")

	const cat = categoryById(category || undefined)
	const needsEnd = !cat || cat.dateMode === "range"

	const submit = (e: FormEvent) => {
		e.preventDefault()
		if (needsEnd && start && end && end <= start) {
			setError("La fecha de finalización debe ser posterior a la de inicio.")
			return
		}
		setError("")
		const p = new URLSearchParams()
		if (location.trim()) p.set(PARAM.location, location.trim())
		if (start) p.set(PARAM.start, start)
		if (needsEnd && end) p.set(PARAM.end, end)
		if (maxPrice) p.set(PARAM.maxPrice, maxPrice)
		if (onlyAvailable) p.set(PARAM.onlyAvailable, "1")
		const qs = p.toString()
		navigate(
			category
				? `/c/${category}${qs ? `?${qs}` : ""}`
				: `/buscar${qs ? `?${qs}` : ""}`,
		)
	}

	return (
		<form
			className={`${styles.bar} ${compact ? styles.compact : ""}`}
			onSubmit={submit}
			role="search"
			aria-label="Buscar bienes en alquiler"
		>
			<div className={styles.fields}>
				<label className={styles.cell}>
					<span>Dónde</span>
					<input
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="Ciudad o zona"
						autoComplete="off"
					/>
				</label>
				<label className={styles.cell}>
					<span>Categoría</span>
					<select
						value={category}
						onChange={(e) => setCategory(e.target.value as CategoryId | "")}
					>
						<option value="">Todas</option>
						{CATEGORIES.map((c) => (
							<option key={c.id} value={c.id}>
								{c.label}
							</option>
						))}
					</select>
				</label>
				<label className={styles.cell}>
					<span>{needsEnd ? "Desde" : "Fecha de recogida"}</span>
					<input
						type="date"
						value={start}
						min={today()}
						onChange={(e) => setStart(e.target.value)}
					/>
				</label>
				{needsEnd && (
					<label className={styles.cell}>
						<span>Hasta</span>
						<input
							type="date"
							value={end}
							min={start || today()}
							onChange={(e) => setEnd(e.target.value)}
							aria-invalid={Boolean(error) || undefined}
						/>
					</label>
				)}
				<label className={styles.cell}>
					<span>Precio máximo</span>
					<input
						type="number"
						inputMode="decimal"
						min={0}
						value={maxPrice}
						onChange={(e) => setMaxPrice(e.target.value)}
						placeholder="Sin límite"
					/>
				</label>
			</div>
			<div className={styles.actions}>
				<label className="check small">
					<input
						type="checkbox"
						checked={onlyAvailable}
						onChange={(e) => setOnlyAvailable(e.target.checked)}
					/>
					Solo disponibles
				</label>
				<button type="submit" className={`btn btn-primary ${styles.submit}`}>
					<Icon name="search" size={18} />
					Buscar
				</button>
			</div>
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
		</form>
	)
}
