import { networkPassphrase } from "@stellar-scaffold/app-lib"
import { useQueryClient } from "@tanstack/react-query"
import {
	type EscrowRequestResponse,
	useSendTransaction,
} from "@trustless-work/escrow"
import { useCallback, useState } from "react"
import { useNotification } from "../hooks/useNotification"
import { useWallet } from "../hooks/useWallet"
import { errorMessage } from "../lib/errors"
import { isTrustlessWorkConfigured } from "./config"

/**
 * THE pattern for every Trustless Work write (deploy, fund, approve, release…):
 *
 *   1. Ask the Trustless Work API to BUILD the transaction → unsigned XDR
 *   2. The user's wallet SIGNS it (Stellar Wallets Kit)
 *   3. Send the signed XDR back through the API (it submits + indexes it)
 *
 * Usage:
 *   const { run, pending } = useEscrowTx()
 *   const { fundEscrow } = useFundEscrow()
 *   await run("Fund escrow", () => fundEscrow({ contractId, amount, signer: address! }, "multi-release"))
 *
 * `run` returns the API response of step 3 (for deploys it includes `contractId`),
 * or `undefined` if something failed (the user already saw a notification).
 */
export function useEscrowTx() {
	const { address, signTransaction, updateBalances } = useWallet()
	const { sendTransaction } = useSendTransaction()
	const { addNotification } = useNotification()
	const queryClient = useQueryClient()
	const [pending, setPending] = useState<string | null>(null)

	const run = useCallback(
		async (
			label: string,
			build: () => Promise<EscrowRequestResponse>,
		): Promise<
			| (Awaited<ReturnType<typeof sendTransaction>> & { contractId?: string })
			| undefined
		> => {
			if (!isTrustlessWorkConfigured) {
				addNotification(
					"Falta PUBLIC_TRUSTLESS_WORK_API_KEY en app/.env",
					"warning",
				)
				return
			}
			if (!address) {
				addNotification("Conecta tu billetera primero", "warning")
				return
			}
			setPending(label)
			try {
				const { unsignedTransaction, status } = await build()
				if (status !== "SUCCESS" || !unsignedTransaction) {
					throw new Error(`${label}: la API no pudo construir la transacción`)
				}
				const { signedTxXdr } = await signTransaction(unsignedTransaction, {
					address,
					networkPassphrase,
				})
				const res = await sendTransaction(signedTxXdr)
				if (res.status !== "SUCCESS") throw new Error(res.message)
				addNotification(`${label} ✓`, "success")
				await queryClient.invalidateQueries({ queryKey: ["escrows"] })
				void updateBalances()
				return res
			} catch (e) {
				console.error(label, e)
				addNotification(`${label}: falló. ${errorMessage(e)}`, "error")
			} finally {
				setPending(null)
			}
		},
		[
			address,
			signTransaction,
			sendTransaction,
			addNotification,
			queryClient,
			updateBalances,
		],
	)

	return { run, pending }
}
