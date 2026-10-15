import {
	Asset,
	BASE_FEE,
	Horizon,
	Operation,
	TransactionBuilder,
} from "@stellar/stellar-sdk"
import {
	horizonUrl,
	networkPassphrase,
	stellarNetwork,
} from "@stellar-scaffold/app-lib"
import { type SignTransactionFn } from "../cavos/context"
import { USDC } from "./config"

/**
 * Classic Stellar helpers for the escrow asset (USDC).
 *
 * On Stellar, an account must opt in to hold a non-XLM asset by adding a
 * "trustline" (costs 0.5 XLM of reserve). Anyone who FUNDS or RECEIVES from an
 * escrow needs a USDC trustline.
 *
 * `sign` is `useWallet().signTransaction`, so these work with an extension
 * wallet or a Cavos embedded wallet alike.
 */
const horizon = new Horizon.Server(horizonUrl, {
	allowHttp: stellarNetwork === "LOCAL",
})
const usdcAsset = new Asset(USDC.symbol, USDC.address)

async function signAndSubmit(
	address: string,
	sign: SignTransactionFn,
	build: (b: TransactionBuilder) => TransactionBuilder,
) {
	const account = await horizon.loadAccount(address)
	const tx = build(
		new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase }),
	)
		.setTimeout(60)
		.build()
	const { signedTxXdr } = await sign(tx.toXDR(), {
		address,
		networkPassphrase,
	})
	return horizon.submitTransaction(
		TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase),
	)
}

/** Add a USDC trustline to the connected wallet. */
export function addUsdcTrustline(address: string, sign: SignTransactionFn) {
	return signAndSubmit(address, sign, (b) =>
		b.addOperation(Operation.changeTrust({ asset: usdcAsset })),
	)
}

/**
 * TESTNET ONLY: swap XLM for USDC on the Stellar DEX (path payment to yourself).
 * Friendbot gives 10,000 test XLM, so this is the fastest way to get test USDC
 * for a whole room (Circle's faucet only gives 20 USDC every 2 hours).
 */
export async function swapXlmForUsdc(
	address: string,
	sign: SignTransactionFn,
	xlmAmount = "100",
) {
	if (stellarNetwork !== "TESTNET") throw new Error("Only available on testnet")
	const { records } = await horizon
		.strictSendPaths(Asset.native(), xlmAmount, [usdcAsset])
		.call()
	const best = records[0]
	if (!best)
		throw new Error("No XLM→USDC liquidity on the testnet DEX right now")
	// Accept up to 5% slippage.
	const destMin = (Number(best.destination_amount) * 0.95).toFixed(7)
	return signAndSubmit(address, sign, (b) =>
		b.addOperation(
			Operation.pathPaymentStrictSend({
				sendAsset: Asset.native(),
				sendAmount: xlmAmount,
				destination: address,
				destAsset: usdcAsset,
				destMin,
				path: best.path.map((p) =>
					p.asset_type === "native"
						? Asset.native()
						: new Asset(p.asset_code as string, p.asset_issuer as string),
				),
			}),
		),
	)
}
