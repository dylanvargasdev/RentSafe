/**
 * RentSafe off-chain data: account, listings, bookings, favorites.
 *
 * MVP persistence = this browser's localStorage, behind a tiny store so it can
 * be swapped for a backend (Supabase, an API…) without touching the pages.
 * Money and the agreement itself are NOT here: they live on Stellar (escrow +
 * rental_registry contract). This mirror only keeps what the UI needs to list
 * and search, plus the references to the on-chain objects.
 */
import { RENTSAFE } from "../config"
import {
	ME,
	photoUrl,
	SEED_LISTINGS,
	SEED_OWNERS,
	seedBookings,
} from "../data/seed"
import {
	type Booking,
	type Listing,
	type Owner,
	type Session,
	type TxRecord,
} from "../types"

export interface Account extends Session {
	/** Wallet the user chose to receive rent payments with (public G… address). */
	payoutAddress?: string
}

export interface State {
	account?: Account
	loggedIn: boolean
	owners: Owner[]
	listings: Listing[]
	bookings: Booking[]
	favorites: string[]
}

const fresh = (): State => ({
	account: undefined,
	loggedIn: false,
	owners: SEED_OWNERS,
	listings: SEED_LISTINGS,
	bookings: seedBookings(new Date()),
	favorites: [],
})

/**
 * Demo listings are copied into localStorage on the first visit, so fixes to
 * their seed data don't reach browsers that already saved them. A demo
 * listing that still has its OLD photos (or title) gets the corrected ones
 * from data/seed.ts; a listing the user edited is left untouched.
 */
const OLD_SEED: Record<string, { images: string[]; title?: string }> = {
	"acc-escazu-loft": {
		images: [
			"1522708323590-d24dbb6b0267",
			"1502672260266-1c1ef2d93688",
			"1493809842364-78817add7ffb",
		],
	},
	"acc-tamarindo-cabana": {
		images: [
			"1499793983690-e29da59ef1c2",
			"1510798831971-661eb04b3739",
			"1505693416388-ac5ce068fe85",
		],
	},
	"acc-fortuna-room": {
		images: ["1505691938895-1758d7feb511", "1540518614846-7eded433c457"],
	},
	"acc-santaana-house": {
		images: [
			"1568605114967-8130f3a36994",
			"1512917774080-9991f1c4c750",
			"1564013799919-ab600027ffc6",
		],
	},
	"veh-suv-4x4": {
		images: ["1549317661-bd32c8ce0db2", "1533473359331-0135ef1b58bf"],
	},
	"veh-moto-tamarindo": {
		images: ["1558981806-ec527fa84c39", "1568772585407-9361f9bf3a87"],
		title: "Moto 150cc para recorrer la costa",
	},
	"veh-bici-fortuna": {
		images: ["1485965120184-e220f721d03e", "1532298229144-0ec0c57515c7"],
	},
	"veh-sedan-sj": { images: ["1503376780353-7e6692767b70"] },
	"veh-scooter-heredia": { images: ["1604868189265-219ba7bf7ea3"] },
	"tec-camara-mirrorless": {
		images: ["1516035069371-29a1b244cc32", "1502920917128-1aa500764cbd"],
	},
	"eq-andamio": { images: ["1541888946425-d81bb19240f5"] },
	"eq-hidrolavadora": { images: ["1581092160562-40aa08e78837"] },
	"eq-podadora": { images: ["1558904541-efa843a96f01"] },
	"eq-mezcladora": { images: ["1621905251189-08b45d6a269e"] },
}

function applySeedFixes(listings: State["listings"]): State["listings"] {
	const seed = new Map(SEED_LISTINGS.map((l) => [l.id, l]))
	return listings.map((l) => {
		const old = OLD_SEED[l.id]
		const s = seed.get(l.id)
		if (!old || !s) return l
		const oldImages = old.images.map(photoUrl)
		const sameImages =
			l.images.length === oldImages.length &&
			l.images.every((u, i) => u === oldImages[i])
		return {
			...l,
			images: sameImages ? s.images : l.images,
			title: old.title && l.title === old.title ? s.title : l.title,
		}
	})
}

function load(): State {
	try {
		const raw = localStorage.getItem(RENTSAFE.storageKey)
		if (raw) {
			const parsed = JSON.parse(raw) as State
			if (Array.isArray(parsed.listings) && Array.isArray(parsed.bookings))
				return {
					...fresh(),
					...parsed,
					listings: applySeedFixes(parsed.listings),
				}
		}
	} catch {
		// private mode / corrupted data: start fresh
	}
	return fresh()
}

let state: State = load()
const listeners = new Set<() => void>()

function persist() {
	try {
		localStorage.setItem(RENTSAFE.storageKey, JSON.stringify(state))
	} catch {
		// storage full or blocked: keep working in memory
	}
}

function set(next: (s: State) => State) {
	state = next(state)
	persist()
	listeners.forEach((l) => l())
}

export const store = {
	get: () => state,
	subscribe: (l: () => void) => {
		listeners.add(l)
		return () => listeners.delete(l)
	},
	set,
	reset: () =>
		set(() => ({
			...fresh(),
			account: state.account,
			loggedIn: state.loggedIn,
		})),
}

// Keep tabs in sync (two identities in two tabs of the same browser).
if (typeof window !== "undefined") {
	window.addEventListener("storage", (e) => {
		if (e.key === RENTSAFE.storageKey) {
			state = load()
			listeners.forEach((l) => l())
		}
	})
}

const now = () => new Date().toISOString()
const uid = (p: string) =>
	`${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The signed-in user as a public owner profile. */
export function meAsOwner(s: State): Owner | undefined {
	if (!s.account) return undefined
	return {
		id: ME,
		name: s.account.name,
		city: s.account.city,
		joined: s.account.createdAt.slice(0, 10),
		bio: "",
		avatar: s.account.name
			.split(/\s+/)
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
		verified: false,
		payoutAddress: s.account.payoutAddress,
		isDemo: false,
	}
}

/** Prefix for parties known only by their wallet (bookings synced from the chain). */
export const WALLET_PREFIX = "wallet:"
export const walletPartyId = (address: string) => `${WALLET_PREFIX}${address}`

export function ownerById(s: State, id: string): Owner | undefined {
	if (id.startsWith(WALLET_PREFIX)) {
		const address = id.slice(WALLET_PREFIX.length)
		return {
			id,
			name: `Billetera ${address.slice(0, 4)}…${address.slice(-4)}`,
			city: "",
			joined: "",
			bio: "",
			avatar: address.slice(0, 2),
			verified: false,
			payoutAddress: address,
			isDemo: false,
		}
	}
	if (id === ME)
		return (
			meAsOwner(s) ?? {
				id: ME,
				name: "Tu cuenta",
				city: "",
				joined: "",
				bio: "",
				avatar: "TÚ",
				verified: false,
				isDemo: true,
			}
		)
	const o = s.owners.find((x) => x.id === id)
	if (o && RENTSAFE.demoOwnerAddress && !o.payoutAddress)
		return { ...o, payoutAddress: RENTSAFE.demoOwnerAddress }
	return o
}

export const actions = {
	signUp(input: { name: string; email: string; city: string }) {
		set((s) => ({
			...s,
			loggedIn: true,
			account: {
				userId: ME,
				name: input.name.trim(),
				email: input.email.trim().toLowerCase(),
				city: input.city.trim(),
				createdAt: now(),
				payoutAddress: s.account?.payoutAddress,
			},
		}))
	},
	/** Returns false when no local account matches that email. */
	signIn(email: string) {
		const acc = state.account
		if (!acc || acc.email !== email.trim().toLowerCase()) return false
		set((s) => ({ ...s, loggedIn: true }))
		return true
	},
	signOut() {
		set((s) => ({ ...s, loggedIn: false }))
	},
	updateAccount(
		patch: Partial<Pick<Account, "name" | "city" | "payoutAddress">>,
	) {
		set((s) => (s.account ? { ...s, account: { ...s.account, ...patch } } : s))
	},
	toggleFavorite(id: string) {
		set((s) => ({
			...s,
			favorites: s.favorites.includes(id)
				? s.favorites.filter((f) => f !== id)
				: [...s.favorites, id],
		}))
	},
	saveListing(
		input: Omit<
			Listing,
			"id" | "createdAt" | "reviews" | "isDemo" | "ownerId"
		> & { id?: string },
	) {
		const id = input.id ?? uid("lst")
		set((s) => {
			const existing = s.listings.find((l) => l.id === id)
			const listing: Listing = existing
				? { ...existing, ...input, id }
				: {
						...input,
						id,
						ownerId: ME,
						reviews: [],
						createdAt: now(),
						isDemo: false,
					}
			return {
				...s,
				listings: existing
					? s.listings.map((l) => (l.id === id ? listing : l))
					: [listing, ...s.listings],
			}
		})
		return id
	},
	setListingAvailable(id: string, available: boolean) {
		set((s) => ({
			...s,
			listings: s.listings.map((l) => (l.id === id ? { ...l, available } : l)),
		}))
	},
	createBooking(
		b: Omit<Booking, "id" | "history" | "createdAt" | "updatedAt">,
	) {
		const id = uid("bk")
		const booking: Booking = {
			...b,
			id,
			history: [],
			createdAt: now(),
			updatedAt: now(),
		}
		set((s) => ({ ...s, bookings: [booking, ...s.bookings] }))
		return id
	},
	/** Add a booking found on-chain that this browser didn't know about. */
	importBooking(
		b: Omit<Booking, "id" | "history" | "createdAt" | "updatedAt">,
		createdAt: string,
	) {
		const id = uid("bk")
		const booking: Booking = {
			...b,
			id,
			history: [
				{
					id: uid("tx"),
					label: "Reserva sincronizada desde el registro on-chain",
					kind: "registry",
					status: "confirmed",
					at: now(),
				},
			],
			createdAt,
			updatedAt: now(),
		}
		set((s) => ({ ...s, bookings: [booking, ...s.bookings] }))
		return id
	},
	updateBooking(id: string, patch: Partial<Booking>) {
		set((s) => ({
			...s,
			bookings: s.bookings.map((b) =>
				b.id === id ? { ...b, ...patch, updatedAt: now() } : b,
			),
		}))
	},
	/** Append (or update by id) an entry in the booking's operation history. */
	logTx(bookingId: string, tx: Omit<TxRecord, "id" | "at"> & { id?: string }) {
		const id = tx.id ?? uid("tx")
		set((s) => ({
			...s,
			bookings: s.bookings.map((b) => {
				if (b.id !== bookingId) return b
				const exists = b.history.some((h) => h.id === id)
				const entry: TxRecord = { ...tx, id, at: now() }
				return {
					...b,
					history: exists
						? b.history.map((h) => (h.id === id ? { ...h, ...entry } : h))
						: [...b.history, entry],
				}
			}),
		}))
		return id
	},
}
