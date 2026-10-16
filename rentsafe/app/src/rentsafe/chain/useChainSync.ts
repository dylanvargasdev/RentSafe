/**
 * The chain is the shared source of truth for on-chain bookings.
 *
 * Every 30 s (and whenever the wallet changes) this reads, for the connected
 * wallet, `rental_registry.bookings_of` + `get_booking`, and the state of each
 * linked escrow from the Trustless Work indexer. Then it:
 *
 * - imports bookings this browser didn't know about (so the owner, the tenant
 *   and the arbiter see the same booking from different browsers/devices);
 * - moves local bookings forward to what the chain says (never backwards:
 *   released/approved flags can't be undone on-chain, and the indexer may lag
 *   a few seconds behind a write made from this browser).
 *
 * Listings, photos and profiles are still local (see docs/RENTSAFE.md): an
 * imported booking for a listing published in another browser shows the
 * wallet addresses instead of names.
 */
import {
	type GetEscrowsFromIndexerResponse,
	useGetEscrowFromIndexerByContractIds,
} from "@trustless-work/escrow"
import { useCallback, useEffect, useRef, useState } from "react"
import { useWallet } from "../../hooks/useWallet"
import { isTrustlessWorkConfigured } from "../../trustless/config"
import { daysBetween, fromUnix } from "../dates"
import { store } from "../store/store"
import { actions, ME, walletPartyId } from "../store/useRentSafe"
import { type Booking, type BookingStatus } from "../types"
import { depositIndex, feeIndex, RENT_INDEX } from "./milestones"
import { type ChainBooking, readRegistry, registry, statusOf } from "./registry"

const INTERVAL_MS = 30_000
/** Never sync automatically more often than this (Trustless Work allows ~50 req/min). */
const MIN_AUTO_GAP_MS = 10_000
/** Only the most recent bookings of a wallet are synced. */
const MAX_SYNCED = 30

const fromStroops = (v: bigint) => Number(v) / 1e7
const round2 = (n: number) => Math.round(n * 100) / 100

/** Forward order of the happy path; other states are terminal or branches. */
const RANK: Record<BookingStatus, number> = {
	requested: 0,
	accepted: 1,
	funded: 2,
	active: 3,
	return_review: 4,
	disputed: 5,
	completed: 6,
	resolved: 6,
	rejected: 6,
	cancelled: 6,
}

interface MilestoneView {
	status?: string
	flags?: {
		approved?: boolean
		released?: boolean
		disputed?: boolean
		resolved?: boolean
	}
}

/** What the chain (registry + escrow) says about one booking. */
function derive(
	cb: ChainBooking,
	escrow: GetEscrowsFromIndexerResponse | undefined,
	local: Booking | undefined,
): Partial<Booking> {
	const amounts = {
		rent: fromStroops(cb.rent),
		deposit: fromStroops(cb.deposit),
		fee: fromStroops(cb.fee),
	}
	const patch: Partial<Booking> = {
		escrowId: cb.escrow ?? local?.escrowId,
		escrowLinked: Boolean(cb.escrow),
		resolverAddress: cb.arbiter ?? local?.resolverAddress,
	}
	const s = statusOf(cb)
	const simple: Partial<Record<typeof s, BookingStatus>> = {
		Requested: "requested",
		Accepted: "accepted",
		Rejected: "rejected",
		Cancelled: "cancelled",
		Completed: "completed",
		Disputed: "disputed",
		Resolved: "resolved",
	}
	let status = simple[s]

	if (escrow) {
		const ms = (escrow.milestones ?? []) as MilestoneView[]
		const m = (i: number | undefined) => (i === undefined ? undefined : ms[i])
		const rent = m(RENT_INDEX)
		const dep = m(depositIndex(amounts))
		const fee = m(feeIndex(amounts))
		const flagged = (
			pick: (f: NonNullable<MilestoneView["flags"]>) => unknown,
		) => ms.flatMap((x, i) => (x.flags && pick(x.flags) ? [i] : []))
		patch.approved = [
			Boolean(rent?.flags?.approved),
			Boolean(dep?.flags?.approved),
		]
		// The API creates milestones with status "pending": only the statuses
		// RentSafe sets ("entregado", "devuelto") mean the owner acted.
		patch.statusSet = ms.flatMap((x, i) =>
			x.status && x.status !== "pending" ? [i] : [],
		)
		patch.rentReleased = Boolean(rent?.flags?.released)
		patch.depositReleased = Boolean(
			dep?.flags?.released || dep?.flags?.resolved,
		)
		if (fee) {
			patch.feeApproved = Boolean(fee.flags?.approved)
			patch.feeReleased = Boolean(fee.flags?.released || fee.flags?.resolved)
		}
		const disputed = flagged((f) => f.disputed || f.resolved)
		if (disputed.length) {
			patch.disputedMilestones = disputed
			patch.resolvedMilestones = flagged((f) => f.resolved)
			patch.disputeKind = disputed.includes(RENT_INDEX) ? "delivery" : "deposit"
		}
		if (s === "EscrowLinked") {
			const funded =
				(escrow.balance ?? 0) > 0 || ms.some((x) => x.flags?.released)
			status = flagged((f) => f.disputed).length
				? "disputed"
				: dep?.status === "devuelto"
					? "return_review"
					: rent?.flags?.approved
						? "active"
						: funded
							? "funded"
							: "accepted"
		}
	} else if (s === "EscrowLinked") {
		// No indexer (no API key): at least "accepted, escrow linked".
		status = "accepted"
	}
	if (status) patch.status = status
	return patch
}

/** Apply only what moves the local booking forward. */
function forwardOnly(
	local: Booking,
	chain: Partial<Booking>,
): Partial<Booking> {
	const out: Partial<Booking> = {}
	if (chain.escrowId && chain.escrowId !== local.escrowId)
		out.escrowId = chain.escrowId
	if (chain.escrowLinked && !local.escrowLinked) out.escrowLinked = true
	if (chain.resolverAddress && chain.resolverAddress !== local.resolverAddress)
		out.resolverAddress = chain.resolverAddress
	if (chain.status && RANK[chain.status] > RANK[local.status])
		out.status = chain.status
	for (const k of [
		"rentReleased",
		"depositReleased",
		"feeApproved",
		"feeReleased",
	] as const)
		if (chain[k] && !local[k]) out[k] = true
	if (chain.approved) {
		const a: [boolean, boolean] = [
			local.approved[0] || chain.approved[0],
			local.approved[1] || chain.approved[1],
		]
		if (a[0] !== local.approved[0] || a[1] !== local.approved[1])
			out.approved = a
	}
	for (const k of [
		"statusSet",
		"disputedMilestones",
		"resolvedMilestones",
	] as const) {
		const merged = [...new Set([...(local[k] ?? []), ...(chain[k] ?? [])])]
		if (merged.length > (local[k]?.length ?? 0)) out[k] = merged
	}
	if (chain.disputeKind && !local.disputeKind)
		out.disputeKind = chain.disputeKind
	return out
}

export function useChainSync() {
	const { address } = useWallet()
	// The Trustless Work SDK hooks return a NEW function on every render. Keep
	// it in a ref: as a dependency it would recreate `syncNow` on each render
	// and the effect below would start a new sync right after every sync.
	const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
	const getEscrows = useRef(getEscrowByContractIds)
	useEffect(() => {
		getEscrows.current = getEscrowByContractIds
	})
	const [syncing, setSyncing] = useState(false)
	const [lastSync, setLastSync] = useState<Date>()
	const [error, setError] = useState<string>()
	const running = useRef(false)

	const lastRun = useRef(0)

	/** `auto` runs are throttled; the "Actualizar" button always runs. */
	const syncNow = useCallback(
		async (auto = false) => {
			if (!address || !registry || running.current) return
			if (auto && Date.now() - lastRun.current < MIN_AUTO_GAP_MS) return
			lastRun.current = Date.now()
			running.current = true
			setSyncing(true)
			try {
				const ids = (
					await readRegistry<number[]>("bookings_of", { who: address })
				).slice(-MAX_SYNCED)
				const chain = await Promise.all(
					ids.map((id) => readRegistry<ChainBooking>("get_booking", { id })),
				)
				const contractIds = chain.flatMap((c) => (c.escrow ? [c.escrow] : []))
				const escrows =
					isTrustlessWorkConfigured && contractIds.length
						? await getEscrows
								.current({
									contractIds,
									validateOnChain: true,
								})
								.catch(() => [] as GetEscrowsFromIndexerResponse[])
						: []
				const byId = new Map(escrows.map((e) => [e.contractId, e]))

				for (const cb of chain) {
					const { bookings, listings } = store.get()
					const local = bookings.find(
						(b) => b.mode === "onchain" && b.registryId === Number(cb.id),
					)
					const patch = derive(
						cb,
						cb.escrow ? byId.get(cb.escrow) : undefined,
						local,
					)
					if (local) {
						const fwd = forwardOnly(local, patch)
						if (Object.keys(fwd).length) actions.updateBooking(local.id, fwd)
						continue
					}
					// New to this browser: rebuild it from the chain.
					const listing = listings.find((l) => l.id === cb.listing_id)
					const rent = fromStroops(cb.rent)
					const deposit = fromStroops(cb.deposit)
					const fee = fromStroops(cb.fee)
					const start = fromUnix(cb.start)
					const end = fromUnix(cb.end)
					const ownerId =
						listing && (listing.ownerId !== ME || cb.owner === address)
							? listing.ownerId
							: cb.owner === address
								? ME
								: walletPartyId(cb.owner)
					actions.importBooking(
						{
							listingId: cb.listing_id,
							tenantId: cb.tenant === address ? ME : walletPartyId(cb.tenant),
							ownerId,
							tenantAddress: cb.tenant,
							ownerAddress: cb.owner,
							start,
							end,
							units: listing
								? Math.max(1, Math.round(rent / listing.price))
								: daysBetween(start, end),
							rent,
							deposit,
							fee,
							total: round2(rent + deposit + fee),
							mode: "onchain",
							registryId: Number(cb.id),
							rentReleased: false,
							depositReleased: false,
							approved: [false, false],
							status: "requested",
							...patch,
						},
						new Date(Number(cb.created_at) * 1000).toISOString(),
					)
				}
				setError(undefined)
				setLastSync(new Date())
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e))
			} finally {
				running.current = false
				setSyncing(false)
			}
		},
		[address],
	)

	useEffect(() => {
		if (!address || !registry) return
		void syncNow(true)
		const t = setInterval(() => {
			if (document.visibilityState === "visible") void syncNow(true)
		}, INTERVAL_MS)
		return () => clearInterval(t)
	}, [address, syncNow])

	return { syncing, lastSync, error, syncNow }
}
