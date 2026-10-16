import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNotification } from "../../hooks/useNotification"
import { useWallet } from "../../hooks/useWallet"
import { errorMessage } from "../../lib/errors"
import {
	callRegistry,
	type ChainReview,
	type ChainScore,
	readRegistry,
	registry,
} from "../chain/registry"
import { formatDateLong } from "../dates"
import { actions } from "../store/useRentSafe"
import { type Booking } from "../types"
import { Icon } from "./Icon"
import { Button, Rating } from "./ui"

const MAX_COMMENT_BYTES = 280
const bytes = (s: string) => new TextEncoder().encode(s).length

/**
 * Verified reputation of a wallet, read from rental_registry: only the other
 * party of a closed booking can leave a review, once per booking.
 */
export const WalletReputation = ({
	address,
	showReviews = 3,
}: {
	address: string
	showReviews?: number
}) => {
	const { data } = useQuery({
		queryKey: ["registry-reputation", address],
		enabled: Boolean(registry),
		staleTime: 60_000,
		queryFn: async () => {
			const [score, reviews] = await Promise.all([
				readRegistry<ChainScore>("score_of", { who: address }),
				readRegistry<ChainReview[]>("reviews_of", { who: address }),
			])
			return { score, reviews: [...reviews].reverse() }
		},
	})
	if (!registry || !data) return null
	const { score, reviews } = data
	if (!score.count)
		return (
			<p className="small muted">Sin reseñas verificadas on-chain todavía.</p>
		)
	return (
		<div className="stack" style={{ gap: 8 }}>
			<p className="row small" style={{ gap: 8 }}>
				<Rating avg={score.total / score.count} count={score.count} />
				<span className="badge badge-success">
					<Icon name="check" size={12} /> Verificadas en Stellar
				</span>
			</p>
			{reviews.slice(0, showReviews).map((r) => (
				<blockquote
					key={`${r.booking_id}-${r.reviewer}`}
					className="small"
					style={{ margin: 0 }}
				>
					<strong>{"★".repeat(r.rating)}</strong>{" "}
					{r.comment || <span className="muted">Sin comentario</span>}
					<span className="muted">
						{" "}
						·{" "}
						{formatDateLong(
							new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 10),
						)}
					</span>
				</blockquote>
			))}
		</div>
	)
}

/** After a closed on-chain booking: each party reviews the other, on-chain. */
export const ReviewForm = ({ booking }: { booking: Booking }) => {
	const { address, signTransaction } = useWallet()
	const { addNotification } = useNotification()
	const queryClient = useQueryClient()
	const [rating, setRating] = useState(5)
	const [comment, setComment] = useState("")
	const [sending, setSending] = useState(false)

	const party =
		address &&
		(address === booking.tenantAddress || address === booking.ownerAddress)
	const closed = booking.status === "completed" || booking.status === "resolved"
	const regId = booking.registryId
	const enabled = Boolean(
		registry &&
		booking.mode === "onchain" &&
		regId !== undefined &&
		party &&
		closed,
	)

	const { data: existing, isLoading } = useQuery({
		queryKey: ["registry-review", regId, address],
		enabled,
		queryFn: () =>
			readRegistry<ChainReview | undefined>("get_review", {
				id: regId,
				reviewer: address,
			}),
	})

	if (!enabled || isLoading) return null
	const subject =
		address === booking.tenantAddress ? "al propietario" : "al arrendatario"

	if (existing)
		return (
			<p className="small">
				<Icon name="check" size={14} /> Ya dejaste tu reseña on-chain (
				{"★".repeat(existing.rating)}).
			</p>
		)

	const tooLong = bytes(comment) > MAX_COMMENT_BYTES
	const submit = async () => {
		if (!address || regId === undefined || tooLong) return
		setSending(true)
		const txId = actions.logTx(booking.id, {
			label: "Reseña publicada on-chain",
			kind: "registry",
			status: "pending",
		})
		try {
			const res = await callRegistry(
				"review",
				{ reviewer: address, id: regId, rating, comment: comment.trim() },
				address,
				signTransaction,
			)
			actions.logTx(booking.id, {
				id: txId,
				label: "Reseña publicada on-chain",
				kind: "registry",
				status: "confirmed",
				ref: res.hash,
			})
			actions.updateBooking(booking.id, { reviewed: true })
			addNotification("Reseña guardada en Stellar", "success")
			await queryClient.invalidateQueries({ queryKey: ["registry-review"] })
			await queryClient.invalidateQueries({
				queryKey: ["registry-reputation"],
			})
		} catch (e) {
			actions.logTx(booking.id, {
				id: txId,
				label: "Reseña publicada on-chain",
				kind: "registry",
				status: "failed",
				error: errorMessage(e),
			})
			addNotification(errorMessage(e), "error")
		} finally {
			setSending(false)
		}
	}

	return (
		<div className="stack" style={{ gap: 10 }}>
			<p className="small">
				Califica {subject}. La reseña queda en Stellar vinculada a esta reserva
				y solo puede dejarla quien participó en ella.
			</p>
			<div
				className="row"
				role="radiogroup"
				aria-label="Calificación"
				style={{ gap: 4 }}
			>
				{[1, 2, 3, 4, 5].map((n) => (
					<button
						key={n}
						type="button"
						role="radio"
						aria-checked={rating === n}
						aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
						className="btn btn-sm"
						onClick={() => setRating(n)}
						style={{ minWidth: 36 }}
					>
						<Icon name="star" size={16} filled={n <= rating} />
					</button>
				))}
			</div>
			<label className="field">
				<span>Comentario (opcional)</span>
				<textarea
					value={comment}
					onChange={(e) => setComment(e.target.value)}
					placeholder="¿Cómo fue el alquiler?"
					aria-invalid={tooLong || undefined}
				/>
				<span className="hint">
					{bytes(comment)}/{MAX_COMMENT_BYTES} bytes · público en la blockchain:
					no incluyas datos personales.
				</span>
			</label>
			<Button
				variant="primary"
				loading={sending}
				disabled={tooLong}
				onClick={() => void submit()}
			>
				Publicar reseña on-chain
			</Button>
		</div>
	)
}
