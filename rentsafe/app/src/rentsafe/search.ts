import { isCategoryId } from "./categories"
import { addDays } from "./dates"
import { isFree, ratingOf } from "./pricing"
import {
	type Booking,
	type CategoryId,
	type Listing,
	type PriceUnit,
} from "./types"

/** Every filter lives in the URL, so results are shareable and Back works. */
export interface Filters {
	q: string
	location: string
	category?: CategoryId
	start: string
	end: string
	minPrice?: number
	maxPrice?: number
	onlyAvailable: boolean
	sort: "relevancia" | "precio_asc" | "precio_desc" | "valoracion"
	// category-specific
	guests?: number
	bedrooms?: number
	propertyType?: string
	vehicleType?: string
	transmission?: string
	deviceType?: string
	condition?: string
	equipmentType?: string
	unit?: PriceUnit
}

const num = (v: string | null) => {
	if (v === null || v === "") return undefined
	const n = Number(v)
	return Number.isFinite(n) ? n : undefined
}

export function parseFilters(params: URLSearchParams): Filters {
	const cat = params.get("cat") ?? undefined
	const sort = params.get("orden")
	return {
		q: params.get("q") ?? "",
		location: params.get("donde") ?? "",
		category: isCategoryId(cat) ? cat : undefined,
		start: params.get("desde") ?? "",
		end: params.get("hasta") ?? "",
		minPrice: num(params.get("min")),
		maxPrice: num(params.get("max")),
		onlyAvailable: params.get("disponible") === "1",
		sort:
			sort === "precio_asc" || sort === "precio_desc" || sort === "valoracion"
				? sort
				: "relevancia",
		guests: num(params.get("huespedes")),
		bedrooms: num(params.get("habitaciones")),
		propertyType: params.get("tipo_propiedad") ?? undefined,
		vehicleType: params.get("tipo_vehiculo") ?? undefined,
		transmission: params.get("transmision") ?? undefined,
		deviceType: params.get("dispositivo") ?? undefined,
		condition: params.get("estado") ?? undefined,
		equipmentType: params.get("tipo_equipo") ?? undefined,
		unit: (params.get("unidad") as PriceUnit | null) ?? undefined,
	}
}

/** URL param name for each filter key. */
export const PARAM: Record<keyof Filters, string> = {
	q: "q",
	location: "donde",
	category: "cat",
	start: "desde",
	end: "hasta",
	minPrice: "min",
	maxPrice: "max",
	onlyAvailable: "disponible",
	sort: "orden",
	guests: "huespedes",
	bedrooms: "habitaciones",
	propertyType: "tipo_propiedad",
	vehicleType: "tipo_vehiculo",
	transmission: "transmision",
	deviceType: "dispositivo",
	condition: "estado",
	equipmentType: "tipo_equipo",
	unit: "unidad",
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export function applyFilters(
	listings: Listing[],
	bookings: Booking[],
	f: Filters,
): Listing[] {
	const q = norm(f.q.trim())
	const loc = norm(f.location.trim())
	const hasDates = Boolean(f.start && f.end && f.start < f.end)
	const a = f

	const out = listings.filter((l) => {
		if (f.category && l.category !== f.category) return false
		if (q) {
			const hay = norm(
				`${l.title} ${l.description} ${l.features.join(" ")} ${l.location}`,
			)
			if (!q.split(/\s+/).every((w) => hay.includes(w))) return false
		}
		if (loc && !norm(`${l.location} ${l.region}`).includes(loc)) return false
		if (a.minPrice !== undefined && l.price < a.minPrice) return false
		if (a.maxPrice !== undefined && l.price > a.maxPrice) return false
		if (f.onlyAvailable && !l.available) return false
		if (hasDates && !isFree(l, bookings, f.start, f.end)) return false
		// Only a start date (gear, hourly rentals): free on that day.
		if (f.start && !f.end && !isFree(l, bookings, f.start, addDays(f.start, 1)))
			return false
		const at = l.attributes
		if (a.guests && (at.guests ?? 0) < a.guests) return false
		if (a.bedrooms && (at.bedrooms ?? 0) < a.bedrooms) return false
		if (a.propertyType && at.propertyType !== a.propertyType) return false
		if (a.vehicleType && at.vehicleType !== a.vehicleType) return false
		if (a.transmission && at.transmission !== a.transmission) return false
		if (a.deviceType && at.deviceType !== a.deviceType) return false
		if (a.condition && at.condition !== a.condition) return false
		if (a.equipmentType && at.equipmentType !== a.equipmentType) return false
		if (a.unit && l.unit !== a.unit) return false
		return true
	})

	const rating = (l: Listing) => ratingOf(l)?.avg ?? 0
	switch (f.sort) {
		case "precio_asc":
			return out.sort((x, y) => x.price - y.price)
		case "precio_desc":
			return out.sort((x, y) => y.price - x.price)
		case "valoracion":
			return out.sort((x, y) => rating(y) - rating(x))
		default:
			// available first, then rated, then newest
			return out.sort(
				(x, y) =>
					Number(y.available) - Number(x.available) ||
					rating(y) - rating(x) ||
					y.createdAt.localeCompare(x.createdAt),
			)
	}
}

export const activeFilterCount = (f: Filters) =>
	[
		f.q,
		f.location,
		f.start,
		f.end,
		f.minPrice,
		f.maxPrice,
		f.onlyAvailable || undefined,
		f.guests,
		f.bedrooms,
		f.propertyType,
		f.vehicleType,
		f.transmission,
		f.deviceType,
		f.condition,
		f.equipmentType,
		f.unit,
	].filter((v) => v !== undefined && v !== "").length
