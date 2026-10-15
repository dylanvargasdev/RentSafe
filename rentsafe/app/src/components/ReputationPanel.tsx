import { reputation } from "@stellar-scaffold/app-lib/clients"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNotification } from "../hooks/useNotification"
import { useWallet } from "../hooks/useWallet"
import { errorMessage } from "../lib/errors"
import styles from "./ReputationPanel.module.css"

/**
 * Reads and writes the `reputation` Soroban contract (contracts/reputation)
 * through the TypeScript client that Scaffold Stellar generates on every build.
 *
 * - Reads (`score_of`, `reviews_of`) are free simulations: no wallet needed.
 * - Writes (`review`) build a transaction, the wallet signs it, and it's sent.
 */
export const ReputationPanel = ({
	subject,
	escrowId,
}: {
	/** Address being reviewed (G...). */
	subject: string
	/** Escrow contract id (C...) the review is about. */
	escrowId?: string
}) => {
	const { address, signTransaction } = useWallet()
	const { addNotification } = useNotification()
	const queryClient = useQueryClient()
	const [rating, setRating] = useState(5)
	const [comment, setComment] = useState("")
	const [sending, setSending] = useState(false)

	const { data, isLoading } = useQuery({
		queryKey: ["reputation", subject],
		queryFn: async () => {
			const [score, reviews] = await Promise.all([
				reputation.score_of({ subject }),
				reputation.reviews_of({ subject }),
			])
			return { score: score.result, reviews: reviews.result }
		},
	})

	const canReview = Boolean(address && escrowId && address !== subject)

	const submit = async () => {
		if (!address || !escrowId) return
		setSending(true)
		try {
			const tx = await reputation.review(
				{ reviewer: address, subject, escrow: escrowId, rating, comment },
				{ publicKey: address },
			)
			// Contract errors (#[contracterror]) show up in the simulation: check
			// them BEFORE asking the wallet to sign. The message is the variant's
			// `///` doc comment in the Rust source.
			if (tx.result.isErr()) throw new Error(tx.result.unwrapErr().message)
			await tx.signAndSend({ signTransaction })
			addNotification("Review saved on-chain ⭐", "success")
			setComment("")
			await queryClient.invalidateQueries({ queryKey: ["reputation", subject] })
		} catch (e) {
			addNotification(errorMessage(e), "error")
		} finally {
			setSending(false)
		}
	}

	const score = data?.score
	const average =
		score && score.count > 0 ? (score.total / score.count).toFixed(1) : "–"

	return (
		<div className={styles.panel}>
			<div className={styles.header}>
				<strong>Reputation</strong>
				<span className={styles.score}>
					{isLoading ? "…" : `★ ${average} (${score?.count ?? 0} reviews)`}
				</span>
			</div>

			{data?.reviews.length ? (
				<ul className={styles.reviews}>
					{[...data.reviews].reverse().map((r) => (
						<li key={`${r.reviewer}-${r.escrow}`}>
							<span>{"★".repeat(r.rating)}</span>{" "}
							{r.comment || <em>no comment</em>}
						</li>
					))}
				</ul>
			) : null}

			{canReview && (
				<div className={styles.form}>
					<select
						value={rating}
						onChange={(e) => setRating(Number(e.target.value))}
						aria-label="Rating"
					>
						{[5, 4, 3, 2, 1].map((n) => (
							<option key={n} value={n}>
								{"★".repeat(n)}
							</option>
						))}
					</select>
					<input
						placeholder="Leave a short review (optional)"
						maxLength={280}
						value={comment}
						onChange={(e) => setComment(e.target.value)}
					/>
					<button onClick={() => void submit()} disabled={sending}>
						{sending ? "Signing…" : "Review"}
					</button>
				</div>
			)}
		</div>
	)
}
