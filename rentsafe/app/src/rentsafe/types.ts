/**
 * RentSafe domain model. Every page, filter, card and price calculation reads
 * these types from the same store (src/rentsafe/store).
 */

export type CategoryId = "alojamiento" | "vehiculos" | "tecnologia" | "equipo"

/** How a listing is priced. Drives the date/duration picker and the totals. */
export type PriceUnit = "noche" | "dia" | "hora" | "semana"

export interface Owner {
	id: string
	name: string
	/** City/area only. Never an exact private address. */
	city: string
	joined: string
	bio: string
	avatar: string
	/** Identity checked by RentSafe. Only `true` for the signed-in user once
	 * they connect a wallet; seed owners are never shown as verified. */
	verified: boolean
	/** Stellar address that receives the rent (needed for real escrows). */
	payoutAddress?: string
	isDemo: boolean
}

export interface Review {
	id: string
	author: string
	rating: number
	date: string
	text: string
	/** Seed reviews are always demo data and labelled as such in the UI. */
	isDemo: boolean
}

/** Category-specific attributes, used by the category filters. */
export interface ListingAttributes {
	// alojamiento
	guests?: number
	bedrooms?: number
	propertyType?: "casa" | "apartamento" | "habitacion" | "cabana"
	// vehiculos
	vehicleType?: "auto" | "moto" | "bicicleta" | "scooter"
	transmission?: "automatica" | "manual"
	minDriverAge?: number
	// tecnologia
	deviceType?: "laptop" | "camara" | "consola" | "telefono" | "audio" | "dron"
	condition?: "nuevo" | "como_nuevo" | "buen_estado"
	// equipo
	equipmentType?: "herramienta" | "maquinaria" | "construccion" | "jardineria"
}

export interface Listing {
	id: string
	category: CategoryId
	title: string
	description: string
	/** City / neighbourhood: approximate location only. */
	location: string
	region: string
	price: number
	unit: PriceUnit
	/** Minimum number of units per booking. */
	minUnits: number
	deposit: number
	images: string[]
	ownerId: string
	features: string[]
	requirements: string[]
	attributes: ListingAttributes
	/** Temporarily paused by the owner (not bookable). */
	available: boolean
	/** Blocked date ranges (ISO yyyy-mm-dd, end exclusive). */
	blocked: { start: string; end: string }[]
	reviews: Review[]
	/** "Destacado" is earned from data: rating ≥ 4.8 with ≥ 3 reviews. */
	createdAt: string
	isDemo: boolean
}

/**
 * Booking lifecycle (mirrors the escrow + the on-chain registry):
 *
 * requested → accepted → funded → active → return_review → completed
 *           ↘ rejected   ↘ cancelled (only before funds are in escrow)
 * funded/active/return_review → disputed → resolved
 */
export type BookingStatus =
	| "requested"
	| "accepted"
	| "rejected"
	| "cancelled"
	| "funded"
	| "active"
	| "return_review"
	| "completed"
	| "disputed"
	| "resolved"

/**
 * - `onchain`: every step is a real Stellar testnet transaction.
 * - `simulated`: same flow, no blockchain. References start with "SIM-".
 * - `demo`: seed data to populate dashboards.
 */
export type BookingMode = "onchain" | "simulated" | "demo"

export interface TxRecord {
	id: string
	label: string
	/** Tx hash, contract id or "SIM-…" for simulations. */
	ref?: string
	kind: "escrow" | "registry" | "simulated" | "offchain"
	status: "pending" | "confirmed" | "failed"
	at: string
	error?: string
}

export interface Booking {
	id: string
	listingId: string
	tenantId: string
	ownerId: string
	/** Wallets involved (on-chain mode). */
	tenantAddress?: string
	ownerAddress?: string
	/** Escrow dispute resolver (platform address, or the tenant in demo mode). */
	resolverAddress?: string
	start: string
	end: string
	units: number
	rent: number
	deposit: number
	fee: number
	total: number
	status: BookingStatus
	mode: BookingMode
	/** Trustless Work escrow contract (C…). */
	escrowId?: string
	escrowLinked?: boolean
	/** Booking id in the rental_registry contract. */
	registryId?: number
	rentReleased: boolean
	depositReleased: boolean
	/** Milestone approvals by the tenant: [rent, deposit]. */
	approved: [boolean, boolean]
	returnNotes?: string
	disputeReason?: string
	resolution?: { toOwner: number; toTenant: number }
	message?: string
	history: TxRecord[]
	createdAt: string
	updatedAt: string
}

export interface Session {
	userId: string
	name: string
	email: string
	city: string
	createdAt: string
}
