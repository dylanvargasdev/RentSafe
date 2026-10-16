/** Date helpers. Dates are ISO `yyyy-mm-dd` strings in local time. */

export const toISO = (d: Date) => {
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	return `${y}-${m}-${day}`
}

export const parseISO = (s: string) => {
	const [y, m, d] = s.split("-").map(Number)
	return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export const today = () => toISO(new Date())

export const addDays = (s: string, n: number) => {
	const d = parseISO(s)
	d.setDate(d.getDate() + n)
	return toISO(d)
}

/** Whole days between two ISO dates (end exclusive). */
export const daysBetween = (start: string, end: string) =>
	Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 86_400_000)

/** Half-open ranges [a, b) and [c, d) overlap. */
export const overlaps = (a: string, b: string, c: string, d: string) =>
	a < d && c < b

const fmt = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short" })
const fmtLong = new Intl.DateTimeFormat("es-CR", {
	day: "numeric",
	month: "long",
	year: "numeric",
})

export const formatDate = (s: string) => fmt.format(parseISO(s))
export const formatDateLong = (s: string) => fmtLong.format(parseISO(s))
export const formatRange = (start: string, end: string) =>
	`${formatDate(start)} – ${formatDate(end)}`
export const formatDateTime = (iso: string) =>
	new Date(iso).toLocaleString("es-CR", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	})

/** Unix seconds at local midnight (for the on-chain registry). */
export const toUnix = (s: string) =>
	BigInt(Math.floor(parseISO(s).getTime() / 1000))

/** Inverse of `toUnix`: unix seconds → local ISO date. */
export const fromUnix = (secs: bigint | number) =>
	toISO(new Date(Number(secs) * 1000))
