import { categoryById } from "./categories"
import { RENTSAFE } from "./config"
import { addDays, daysBetween, overlaps } from "./dates"
import { type Booking, type BookingStatus, type Listing } from "./types"

/**
 * "range": the user picks start and end dates (nights / days).
 * "duration": the user picks a start date and an amount of units
 * (hours, weeks, or days for gear that doesn't need an end date).
 */
export type PeriodKind = "range" | "duration"

export const periodKind = (listing: Listing): PeriodKind => {
	if (listing.unit === "noche") return "range"
	if (
		listing.unit === "dia" &&
		categoryById(listing.category)?.dateMode === "range"
	)
		return "range"
	return "duration"
}

/** End date (exclusive) that a booking of `units` occupies on the calendar. */
export const endFor = (listing: Listing, start: string, units: number) => {
	switch (listing.unit) {
		case "hora":
			return addDays(start, 1)
		case "semana":
			return addDays(start, 7 * units)
		default:
			return addDays(start, units)
	}
}

export interface Quote {
	units: number
	start: string
	end: string
	rent: number
	deposit: number
	fee: number
	total: number
	/** Amount that goes into the escrow (rent + deposit + fee). */
	escrowAmount: number
	error?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function quote(
	listing: Listing,
	start: string,
	endOrUnits: { end: string } | { units: number },
): Quote {
	const units =
		"units" in endOrUnits
			? Math.max(0, Math.floor(endOrUnits.units))
			: daysBetween(start, endOrUnits.end)
	const end =
		"end" in endOrUnits ? endOrUnits.end : endFor(listing, start, units)
	const rent = round2(listing.price * Math.max(units, 0))
	const fee = round2((rent * RENTSAFE.serviceFeePercent) / 100)
	const deposit = listing.deposit
	let error: string | undefined
	if (!start) error = "Elige una fecha de inicio"
	else if (units <= 0) error = "La duración debe ser de al menos 1"
	else if (units < listing.minUnits)
		error = `El mínimo para este bien es ${listing.minUnits}`
	return {
		units,
		start,
		end,
		rent,
		deposit,
		fee,
		total: round2(rent + fee + deposit),
		escrowAmount: round2(rent + deposit + fee),
		error,
	}
}

/** Statuses that hold the dates on the calendar. */
export const BLOCKING: BookingStatus[] = [
	"accepted",
	"funded",
	"active",
	"return_review",
	"disputed",
]

/** Is the listing free between start and end (exclusive)? */
export function isFree(
	listing: Listing,
	bookings: Booking[],
	start: string,
	end: string,
	ignoreBookingId?: string,
) {
	if (!listing.available) return false
	if (listing.blocked.some((b) => overlaps(start, end, b.start, b.end)))
		return false
	return !bookings.some(
		(b) =>
			b.listingId === listing.id &&
			b.id !== ignoreBookingId &&
			BLOCKING.includes(b.status) &&
			overlaps(start, end, b.start, b.end),
	)
}

/**
 * First start date (from tomorrow, up to ~4 months ahead) where a booking of
 * `units` fits: the booking widget opens on free dates instead of on a
 * conflict. Falls back to tomorrow.
 */
export function firstFreeStart(
	listing: Listing,
	bookings: Booking[],
	units: number,
	from: string,
) {
	for (let i = 0; i < 120; i++) {
		const start = addDays(from, i)
		if (isFree(listing, bookings, start, endFor(listing, start, units)))
			return start
	}
	return from
}

/** Earned label: rating ≥ 4.8 with at least 3 reviews. */
export const ratingOf = (listing: Listing) => {
	const n = listing.reviews.length
	if (!n) return undefined
	const avg = listing.reviews.reduce((s, r) => s + r.rating, 0) / n
	return { avg: Math.round(avg * 100) / 100, count: n }
}

export const isFeatured = (listing: Listing) => {
	const r = ratingOf(listing)
	return Boolean(r && r.count >= 3 && r.avg >= 4.8)
}
