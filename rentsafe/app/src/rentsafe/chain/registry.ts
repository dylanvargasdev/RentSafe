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

interface RegistryClient {
	options: { contractId: string }
	request: Method
	accept: Method
	reject: Method
	cancel: Method
	link_escrow: Method
	complete: Method
	open_dispute: Method
	get_booking: Method
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

/**
 * Simulate → check contract errors (before any wallet popup) → sign with the
 * user's wallet → send. Returns the tx hash and the function's return value.
 */
export async function callRegistry<T = unknown>(
	method: keyof Omit<RegistryClient, "options">,
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
