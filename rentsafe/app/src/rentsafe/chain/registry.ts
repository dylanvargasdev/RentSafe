/**
 * Access to the `rental_registry` Soroban contract (contracts/rental-registry)
 * through the client Scaffold generates on `npm start` / `npm run contracts:build`.
 *
 * The client is looked up at runtime so the app keeps working (in simulation)
 * if the contract hasn't been deployed yet on this machine.
 */
import * as clients from "@stellar-scaffold/app-lib/clients"
import { type SignTransactionFn } from "../../cavos/context"

interface ContractResult<T> {
	isOk(): boolean
	isErr(): boolean
	unwrap(): T
	unwrapErr(): { message: string }
}

interface Sent {
	result?: unknown
	sendTransactionResponse?: { hash?: string }
	getTransactionResponse?: { txHash?: string }
}

interface Assembled {
	result: unknown
	signAndSend(o: { signTransaction: SignTransactionFn }): Promise<Sent>
}

type Method = (
	args: Record<string, unknown>,
	opts?: { publicKey?: string },
) => Promise<Assembled>

/** Writes: signed by the user's wallet. */
type WriteMethod =
	| "request"
	| "accept"
	| "reject"
	| "cancel"
	| "link_escrow"
	| "complete"
	| "open_dispute"
	| "resolve_dispute"
	| "review"

/** Reads: free simulations, no wallet needed. */
type ReadMethod =
	| "get_booking"
	| "bookings_of"
	| "get_review"
	| "reviews_of"
	| "score_of"

type RegistryClient = { options: { contractId: string } } & Record<
	WriteMethod | ReadMethod,
	Method
>

/** On-chain status names (`Status` enum in the contract). */
export type ChainStatus =
	| "Requested"
	| "Accepted"
	| "Rejected"
	| "Cancelled"
	| "EscrowLinked"
	| "Completed"
	| "Disputed"
	| "Resolved"

/** `Booking` struct of the contract, as the generated client decodes it. */
export interface ChainBooking {
	id: number
	listing_id: string
	tenant: string
	owner: string
	start: bigint
	end: bigint
	rent: bigint
	deposit: bigint
	fee: bigint
	status: { tag: ChainStatus } | ChainStatus
	escrow?: string
	arbiter?: string
	created_at: bigint
	updated_at: bigint
}

export interface ChainReview {
	booking_id: number
	reviewer: string
	subject: string
	rating: number
	comment: string
	timestamp: bigint
}

export interface ChainScore {
	count: number
	total: number
}

const isResult = (v: unknown): v is ContractResult<unknown> =>
	Boolean(
		v &&
		typeof v === "object" &&
		"isErr" in v &&
		typeof (v as { isErr: unknown }).isErr === "function",
	)

export const registry: RegistryClient | undefined = (
	clients as unknown as Record<string, unknown>
)["rentalRegistry"] as RegistryClient | undefined

export const registryContractId = registry?.options.contractId

/** Status of a decoded booking, whatever shape the client used for the enum. */
export const statusOf = (b: ChainBooking): ChainStatus =>
	typeof b.status === "string" ? b.status : b.status.tag

/**
 * Simulate → check contract errors (before any wallet popup) → sign with the
 * user's wallet → send. Returns the tx hash and the function's return value.
 */
export async function callRegistry<T = unknown>(
	method: WriteMethod,
	args: Record<string, unknown>,
	publicKey: string,
	signTransaction: SignTransactionFn,
): Promise<{ hash?: string; value?: T }> {
	if (!registry)
		throw new Error(
			"El contrato rental_registry no está desplegado en esta red.",
		)
	const tx = await registry[method](args, { publicKey })
	if (isResult(tx.result) && tx.result.isErr())
		throw new Error(tx.result.unwrapErr().message)
	const sent = await tx.signAndSend({ signTransaction })
	const hash =
		sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash
	const value = isResult(sent.result)
		? (sent.result.unwrap() as T)
		: (sent.result as T)
	return { hash, value }
}

/** Read-only call (a simulation): no signature, no fee. */
export async function readRegistry<T>(
	method: ReadMethod,
	args: Record<string, unknown>,
): Promise<T> {
	if (!registry)
		throw new Error(
			"El contrato rental_registry no está desplegado en esta red.",
		)
	const tx = await registry[method](args)
	if (isResult(tx.result)) {
		if (tx.result.isErr()) throw new Error(tx.result.unwrapErr().message)
		return tx.result.unwrap() as T
	}
	return tx.result as T
}
