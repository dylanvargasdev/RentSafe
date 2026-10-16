/**
 * Search results (`/buscar?…`) and category pages (`/c/:category`).
 *
 * Filters are read from the URL (`search.ts` parses and applies them), so
 * every search is shareable and the back button works. A category route
 * fixes the category filter; an unknown category shows an empty state.
 */
import { useMemo } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { categoryById, isCategoryId } from "../categories"
import { FilterPanel } from "../components/FilterPanel"
import { ListingCard } from "../components/ListingCard"
import { SearchBar } from "../components/SearchBar"
import { EmptyState } from "../components/ui"
import { formatRange, formatDate } from "../dates"
import { applyFilters, parseFilters } from "../search"
import { useRentSafe } from "../store/useRentSafe"

export const SearchPage = () => {
	const { category: routeCat } = useParams()
	const [params] = useSearchParams()
	const { listings, bookings } = useRentSafe()
	const fixed = isCategoryId(routeCat) ? routeCat : undefined
	const filters = useMemo(() => {
		const f = parseFilters(params)
		return fixed ? { ...f, category: fixed } : f
	}, [params, fixed])
	const results = useMemo(
		() => applyFilters(listings, bookings, filters),
		[listings, bookings, filters],
	)
	const cat = categoryById(filters.category)

	if (routeCat && !fixed)
		return (
			<div className="rs-container section">
				<EmptyState
					title="Esa categoría no existe"
					action={
						<Link to="/buscar" className="btn">
							Ver todo
						</Link>
					}
				/>
			</div>
		)

	const summary = [
		filters.location && `en ${filters.location}`,
		filters.start && filters.end
			? `del ${formatRange(filters.start, filters.end)}`
			: filters.start
				? `desde el ${formatDate(filters.start)}`
				: "",
		filters.q && `que coinciden con “${filters.q}”`,
	]
		.filter(Boolean)
		.join(" ")

	return (
		<div className="rs-container" style={{ paddingTop: 24 }}>
			<div className="stack" style={{ gap: 20 }}>
				<div>
					<h1 style={{ fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2rem)" }}>
						{cat ? cat.label : "Todos los bienes"}
					</h1>
					<p className="muted" style={{ marginTop: 4 }}>
						{cat
							? cat.tagline
							: "Alojamiento, vehículos, tecnología y equipo de trabajo"}
					</p>
				</div>
				<SearchBar
					key={`${params.toString()}-${filters.category ?? ""}`}
					initial={filters}
					compact
				/>
				<FilterPanel filters={filters} fixedCategory={Boolean(fixed)} />
				<p aria-live="polite" style={{ fontWeight: 650 }}>
					{results.length} {results.length === 1 ? "resultado" : "resultados"}{" "}
					{summary}
				</p>
			</div>
			<div style={{ marginTop: 20 }}>
				{results.length ? (
					<div className="listing-grid">
						{results.map((l, i) => (
							<ListingCard key={l.id} listing={l} eager={i < 4} />
						))}
					</div>
				) : (
					<EmptyState
						title="No hay bienes con esos filtros"
						action={
							<Link to={fixed ? `/c/${fixed}` : "/buscar"} className="btn">
								Quitar filtros
							</Link>
						}
					>
						Prueba con otras fechas, amplía el rango de precio o busca en otra
						ciudad.
					</EmptyState>
				)}
			</div>
		</div>
	)
}
