import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useWallet } from "../hooks/useWallet"
import { CreateEscrowForm } from "../trustless/components/CreateEscrowForm"
import { EscrowCard } from "../trustless/components/EscrowCard"
import { SetupChecklist } from "../trustless/components/SetupChecklist"
import { useEscrow, useMyEscrows } from "../trustless/useEscrows"
import styles from "./Escrows.module.css"

/**
 * Escrow Studio: the full Trustless Work lifecycle in one page.
 * create → fund → mark done → approve → release (or dispute → resolve) → review
 */
const Escrows = () => {
	const { address } = useWallet()
	const queryClient = useQueryClient()
	const mine = useMyEscrows(address)
	const [lookupInput, setLookupInput] = useState("")
	const [lookupId, setLookupId] = useState<string>()
	const lookedUp = useEscrow(lookupId)

	const refresh = () =>
		void queryClient.invalidateQueries({ queryKey: ["escrows"] })

	return (
		<div className={styles.page}>
			<header>
				<h1>Escrow Studio</h1>
				<p>
					Money held by a smart contract and released only when the work is
					approved, powered by{" "}
					<a
						href="https://docs.trustlesswork.com"
						target="_blank"
						rel="noreferrer"
					>
						Trustless Work
					</a>
					. Everything here is testnet: free fake money.
				</p>
			</header>

			<SetupChecklist />

			<div className={styles.columns}>
				<CreateEscrowForm onCreated={(id) => setLookupId(id)} />

				<section className={styles.list}>
					<div className={styles.listHeader}>
						<h2>Your escrows</h2>
						<button onClick={refresh} disabled={mine.isFetching}>
							{mine.isFetching ? "Loading…" : "Refresh"}
						</button>
					</div>

					<form
						className={styles.lookup}
						onSubmit={(e) => {
							e.preventDefault()
							setLookupId(lookupInput.trim() || undefined)
						}}
					>
						<input
							placeholder="Open an escrow by contract id (C…)"
							value={lookupInput}
							onChange={(e) => setLookupInput(e.target.value)}
						/>
						<button type="submit">Open</button>
					</form>

					{lookedUp.data && <EscrowCard escrow={lookedUp.data} />}
					{lookupId && lookedUp.isFetched && !lookedUp.data && (
						<p className={styles.empty}>
							No escrow found for {lookupId} (the indexer can take a few
							seconds).
						</p>
					)}

					{!address && (
						<p className={styles.empty}>
							Connect your wallet to see the escrows where you have a role.
						</p>
					)}
					{mine.error && (
						<p className={styles.empty}>
							Couldn't load escrows: {String(mine.error)}
						</p>
					)}
					{mine.data?.length === 0 && (
						<p className={styles.empty}>No escrows yet. Create one! 👈</p>
					)}
					{mine.data
						?.filter((e) => e.contractId !== lookedUp.data?.contractId)
						.map((e) => (
							<EscrowCard key={e.contractId} escrow={e} />
						))}
				</section>
			</div>
		</div>
	)
}

export default Escrows
