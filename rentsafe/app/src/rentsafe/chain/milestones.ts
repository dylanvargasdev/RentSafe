/**
 * Milestones of a RentSafe escrow (Trustless Work multi-release). The order is
 * fixed and checked on-chain by `rental_registry.link_escrow`:
 *
 *   0  "Alquiler"              → owner
 *   1  "Depósito de garantía"  → tenant   (only if deposit > 0)
 *   n  "Comisión RentSafe"     → platform (only if fee > 0)
 */
import { type Booking } from "../types"

type Amounts = Pick<Booking, "rent" | "deposit" | "fee">

export const RENT_INDEX = 0

export const depositIndex = (b: Amounts) => (b.deposit > 0 ? 1 : undefined)

export const feeIndex = (b: Amounts) =>
	b.fee > 0 ? (b.deposit > 0 ? 2 : 1) : undefined

/** Everything the tenant deposits in the escrow. */
export const escrowTotal = (b: Amounts) =>
	Math.round((b.rent + b.deposit + b.fee) * 1e7) / 1e7

/** Milestones a non-delivery dispute freezes (everything not yet released). */
export const deliveryDisputeMilestones = (b: Booking) =>
	[RENT_INDEX, depositIndex(b), feeIndex(b)].filter(
		(i): i is number => i !== undefined,
	)

/** Amount held by one milestone. */
export const milestoneAmount = (b: Amounts, index: number) =>
	index === RENT_INDEX
		? b.rent
		: index === depositIndex(b)
			? b.deposit
			: index === feeIndex(b)
				? b.fee
				: 0
