import {
	connectWallet,
	fundAccount,
	stellarNetwork,
} from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { useCavosState } from "../../cavos/context"
import { useNotification } from "../../hooks/useNotification"
import { useWallet } from "../../hooks/useWallet"
import { errorMessage } from "../../lib/errors"
import { isTrustlessWorkConfigured, USDC_BALANCE_KEY } from "../config"
import styles from "../escrow.module.css"
import { addUsdcTrustline, swapXlmForUsdc } from "../usdc"

/**
 * Everything a brand-new user needs before touching an escrow, in order:
 * wallet → test XLM → USDC trustline → test USDC → Trustless Work API key.
 */
export const SetupChecklist = () => {
	const { address, balances, updateBalances, signTransaction } = useWallet()
	const cavos = useCavosState()
	const { addNotification } = useNotification()
	const [busy, setBusy] = useState<string | null>(null)

	const xlm = balances.xlm?.balance
	const usdc = balances[USDC_BALANCE_KEY]?.balance
	const isTestnet = stellarNetwork === "TESTNET"

	const act = async (label: string, fn: () => Promise<unknown>) => {
		setBusy(label)
		try {
			await fn()
			await updateBalances()
			addNotification(`${label} ✓`, "success")
		} catch (e) {
			addNotification(`${label} failed: ${errorMessage(e)}`, "error")
		} finally {
			setBusy(null)
		}
	}

	const steps = [
		{
			done: Boolean(address),
			label: cavos
				? "Sign in with email/Google (wallet created for you) or connect a Stellar wallet on Testnet"
				: "Connect a Stellar wallet (Freighter works great) set to Testnet",
			action: !address && (
				<>
					{cavos && <button onClick={cavos.signIn}>Sign in</button>}
					<button onClick={() => void connectWallet()}>
						{cavos ? "Use a wallet" : "Connect"}
					</button>
				</>
			),
		},
		{
			done: Boolean(xlm),
			label: `Get test XLM to pay fees${xlm ? ` · ${xlm} XLM` : ""}`,
			action: address && !xlm && isTestnet && (
				<button
					disabled={!!busy}
					onClick={() =>
						void act("Fund with Friendbot", async () => {
							const r = await fundAccount(address)
							if (!r.ok) throw new Error(r.message)
						})
					}
				>
					Friendbot
				</button>
			),
		},
		{
			done: usdc !== undefined,
			label: "Add a USDC trustline (lets your account hold USDC)",
			action: address && xlm && usdc === undefined && (
				<button
					disabled={!!busy}
					onClick={() =>
						void act("Add USDC trustline", () =>
							addUsdcTrustline(address, signTransaction),
						)
					}
				>
					Add trustline
				</button>
			),
		},
		{
			done: usdc !== undefined && Number(usdc.replace(/,/g, "")) > 0,
			label: `Get test USDC${usdc !== undefined ? ` · ${usdc} USDC` : ""}`,
			action: address && usdc !== undefined && isTestnet && (
				<>
					<button
						disabled={!!busy}
						onClick={() =>
							void act("Swap 100 XLM → USDC", () =>
								swapXlmForUsdc(address, signTransaction, "100"),
							)
						}
					>
						Swap 100 XLM → USDC
					</button>
					<a href="https://faucet.circle.com" target="_blank" rel="noreferrer">
						or Circle faucet
					</a>
				</>
			),
		},
		{
			done: isTrustlessWorkConfigured,
			label:
				"Trustless Work API key in app/.env (PUBLIC_TRUSTLESS_WORK_API_KEY)",
			action: !isTrustlessWorkConfigured && (
				<a
					href="https://dapp.trustlesswork.com"
					target="_blank"
					rel="noreferrer"
				>
					Get a key
				</a>
			),
		},
	]

	const allDone = steps.every((s) => s.done)

	return (
		<details className={`card ${styles.checklist}`} open={!allDone}>
			<summary>
				<strong>Setup</strong>{" "}
				{allDone
					? "✅ ready to escrow"
					: `(${steps.filter((s) => s.done).length}/${steps.length})`}
			</summary>
			<ol>
				{steps.map((s) => (
					<li key={s.label} className={s.done ? styles.done : undefined}>
						<span>{s.done ? "✅" : "⬜️"}</span>
						<span className={styles.stepLabel}>{s.label}</span>
						{!s.done && s.action}
					</li>
				))}
			</ol>
			{busy && <p className={styles.muted}>{busy}… confirm in your wallet</p>}
		</details>
	)
}
