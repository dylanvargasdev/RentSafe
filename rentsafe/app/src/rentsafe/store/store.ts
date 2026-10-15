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
import { ME, SEED_LISTINGS, SEED_OWNERS, seedBookings } from "../data/seed"
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

function load(): State {
	try {
		const raw = localStorage.getItem(RENTSAFE.storageKey)
		if (raw) {
			const parsed = JSON.parse(raw) as State
			if (Array.isArray(parsed.listings) && Array.isArray(parsed.bookings))
				return { ...fresh(), ...parsed }
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

export function ownerById(s: State, id: string): Owner | undefined {
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
