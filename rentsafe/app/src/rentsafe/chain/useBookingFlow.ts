/**
 * Every booking transition, for the three modes:
 *
 * - onchain: Trustless Work multi-release escrow + the rental_registry Soroban
 *   contract. Every write is signed by the user's wallet through
 *   useWallet().signTransaction (Cavos or extension).
 * - simulated / demo: same transitions, no blockchain, refs start with "SIM-".
 *
 * Escrow design (per booking, see milestones.ts):
 *   milestone 0 "Alquiler"           → receiver = owner
 *   milestone 1 "Depósito"           → receiver = tenant (refund)
 *   milestone n "Comisión RentSafe"  → receiver = platform (only if fee > 0)
 *   approver        = tenant   (confirms receipt / agrees to the refund)
 *   serviceProvider = owner    (registers the return, with notes as evidence)
 *   releaseSigner   = owner    (releases each approved milestone)
 *   disputeResolver = platform (PUBLIC_PLATFORM_ADDRESS, never a party)
 *   platformAddress = platform (platformFee 0: the fee is its own milestone)
 * rental_registry.link_escrow reads the escrow on-chain and rejects it if any
 * of this doesn't match the booking.
 *
 * Ordering rule: the chain goes first and the local mirror is only updated
 * after each on-chain step succeeded. Multi-step actions remember which steps
 * already happened, so retrying an action never repeats a signed step.
 */
import { networkPassphrase } from "@stellar-scaffold/app-lib"
import {
	useApproveMilestone,
	useChangeMilestoneStatus,
	useFundEscrow,
	useInitializeEscrow,
	useReleaseFunds,
	useResolveDispute,
	useStartDispute,
} from "@trustless-work/escrow"
import { useCallback, useState } from "react"
import { useNotification } from "../../hooks/useNotification"
import { useWallet } from "../../hooks/useWallet"
import { errorMessage } from "../../lib/errors"
import { platformAddress, USDC } from "../../trustless/config"
import { useEscrowTx } from "../../trustless/useEscrowTx"
import { RENTSAFE } from "../config"
import { toUnix } from "../dates"
import { type Quote } from "../pricing"
import { store } from "../store/store"
import {
	actions,
	ME,
	ownerById,
	useRentSafe,
	useSession,
} from "../store/useRentSafe"
import {
	type Booking,
	type BookingMode,
	type Listing,
	type TxRecord,
} from "../types"
import {
	deliveryDisputeMilestones,
	depositIndex,
	escrowTotal,
	feeIndex,
	milestoneAmount,
	RENT_INDEX,
} from "./milestones"
import { callRegistry, registry } from "./registry"

export const stroops = (n: number) => BigInt(Math.round(n * 1e7))
const simRef = () =>
	`SIM-${Math.random().toString(16).slice(2, 10).toUpperCase()}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const round2 = (n: number) => Math.round(n * 100) / 100
const TYPE = "multi-release" as const

export type ActionId =
	| "accept"
	| "reject"
	| "cancel"
	| "fund"
	| "markDelivered"
	| "confirmReceipt"
	| "releaseRent"
	| "registerReturn"
	| "approveDeposit"
	| "releaseDeposit"
	| "complete"
	| "dispute"
	| "disputeDelivery"
	| "resolve"

export type Role = "tenant" | "owner" | "resolver"

export interface ActionDef {
	id: ActionId
	role: Role
	label: string
	help: string
	variant?: "primary" | "danger"
	input?: "notes" | "reason" | "split"
}

/** Everything that has to be paid out before the booking can be closed. */
const allReleased = (b: Booking) =>
	b.rentReleased &&
	(b.deposit === 0 || b.depositReleased) &&
	(b.fee === 0 || Boolean(b.feeReleased))

/** Actions that make sense in the booking's current state (any role). */
export function availableActions(b: Booking): ActionDef[] {
	const out: ActionDef[] = []
	const s = b.status
	if (s === "requested") {
		out.push(
			{
				id: "accept",
				role: "owner",
				label: "Aceptar solicitud",
				help: "Bloquea las fechas para este arrendatario.",
				variant: "primary",
			},
			{
				id: "reject",
				role: "owner",
				label: "Rechazar",
				help: "No se mueve dinero.",
				variant: "danger",
			},
		)
	}
	if ((s === "requested" || s === "accepted") && !b.escrowLinked) {
		out.push({
			id: "cancel",
			role: "tenant",
			label: "Cancelar solicitud",
			help: "Gratis: aún no hay fondos en garantía.",
			variant: "danger",
		})
		if (s === "accepted")
			out.push({
				id: "cancel",
				role: "owner",
				label: "Cancelar reserva",
				help: "Gratis: aún no hay fondos en garantía.",
				variant: "danger",
			})
	}
	if (s === "accepted")
		out.push({
			id: "fund",
			role: "tenant",
			label: b.escrowLinked ? "Completar el depósito" : "Depositar en garantía",
			help: "Crea el escrow y deposita alquiler + depósito. El propietario aún no recibe nada.",
			variant: "primary",
		})
	if (s === "funded") {
		if (!delivered(b))
			out.push({
				id: "markDelivered",
				role: "owner",
				label: "Marcar como entregado",
				help: "Indica que entregaste el bien. El arrendatario lo confirma y luego puedes cobrar.",
				variant: "primary",
				input: "notes",
			})
		else
			out.push({
				id: "confirmReceipt",
				role: "tenant",
				label: "Confirmar que recibí el bien",
				help: "Aprueba el pago del alquiler. El propietario podrá cobrarlo.",
				variant: "primary",
			})
		if (!b.approved[0])
			out.push({
				id: "disputeDelivery",
				role: "tenant",
				label: "No recibí el bien (disputa)",
				help: "Congela alquiler y depósito en el escrow hasta que el árbitro decida.",
				variant: "danger",
				input: "reason",
			})
	}
	if (
		["active", "return_review", "disputed"].includes(s) &&
		b.approved[0] &&
		(!b.rentReleased || (b.fee > 0 && !b.feeReleased)) &&
		b.disputeKind !== "delivery"
	)
		out.push({
			id: "releaseRent",
			role: "owner",
			label: "Cobrar el alquiler",
			help: "Libera el alquiler desde el escrow a tu billetera.",
			variant: "primary",
		})
	if (s === "active")
		out.push({
			id: "registerReturn",
			role: "owner",
			label: "Registrar devolución",
			help: "Deja constancia del estado en que recibiste el bien.",
			input: "notes",
		})
	if (s === "return_review" && b.deposit > 0 && !b.approved[1])
		out.push({
			id: "approveDeposit",
			role: "tenant",
			label: "Solicitar devolución del depósito",
			help: "Apruebas el reembolso. El propietario lo libera tras revisar el bien.",
		})
	if (
		s === "return_review" &&
		b.deposit > 0 &&
		b.approved[1] &&
		!b.depositReleased
	)
		out.push({
			id: "releaseDeposit",
			role: "owner",
			label: "Devolver depósito",
			help: "El bien volvió en buen estado: el depósito regresa al arrendatario.",
			variant: "primary",
		})
	if (s === "return_review" && b.mode === "onchain" && allReleased(b))
		out.push({
			id: "complete",
			role: "owner",
			label: "Cerrar la reserva on-chain",
			help: "Todos los fondos ya se liberaron: marca la reserva como completada en el registro.",
			variant: "primary",
		})
	if (
		["active", "return_review"].includes(s) &&
		b.deposit > 0 &&
		!b.depositReleased
	) {
		const d: Omit<ActionDef, "role"> = {
			id: "dispute",
			label: "Abrir disputa",
			help: "Bloquea el depósito hasta que el árbitro decida el reparto.",
			variant: "danger",
			input: "reason",
		}
		out.push(
			{ ...d, role: "owner", label: "Reportar daños (disputa)" },
			{ ...d, role: "tenant" },
		)
	}
	if (s === "disputed")
		out.push({
			id: "resolve",
			role: "resolver",
			label: "Resolver disputa",
			help:
				b.disputeKind === "delivery"
					? "Reparte el alquiler; el depósito y la comisión vuelven al arrendatario."
					: "Reparte el depósito entre propietario y arrendatario.",
			variant: "primary",
			input: "split",
		})
	return out
}

/** The owner set the delivery status on every milestone the tenant approves on receipt. */
export const delivered = (b: Booking) =>
	[RENT_INDEX, feeIndex(b)].every(
		(i) => i === undefined || Boolean(b.statusSet?.includes(i)),
	)

/** The milestone the arbiter splits (the others in a delivery dispute go back to the tenant). */
export const disputedMain = (b: Booking) =>
	b.disputeKind === "delivery" ? RENT_INDEX : (depositIndex(b) ?? RENT_INDEX)

export interface ActionInput {
	notes?: string
	reason?: string
	toOwner?: number
}

export function useBookingFlow(booking: Booking | undefined) {
	const { address, signTransaction } = useWallet()
	const session = useSession()
	const state = useRentSafe()
	const { addNotification } = useNotification()
	const { run } = useEscrowTx()
	const { deployEscrow } = useInitializeEscrow()
	const { fundEscrow } = useFundEscrow()
	const { approveMilestone } = useApproveMilestone()
	const { changeMilestoneStatus } = useChangeMilestoneStatus()
	const { releaseFunds } = useReleaseFunds()
	const { startDispute } = useStartDispute()
	const { resolveDispute } = useResolveDispute()
	const [busy, setBusy] = useState<ActionId | null>(null)

	/** Can the current user/wallet act as this role? */
	const can = useCallback(
		(role: Role): "yes" | "simulate" | "no" => {
			if (!booking) return "no"
			if (booking.mode === "onchain") {
				const target =
					role === "tenant"
						? booking.tenantAddress
						: role === "owner"
							? booking.ownerAddress
							: booking.resolverAddress
				return address && address === target ? "yes" : "no"
			}
			const me = session?.userId
			if (role === "tenant" && me && booking.tenantId === me) return "yes"
			if (role === "owner" && me && booking.ownerId === me) return "yes"
			// Simulations let you play the other party (and the arbiter) to demo the flow.
			return "simulate"
		},
		[booking, address, session],
	)

	/** Run one logged step. Never marks it confirmed before it really succeeded. */
	const step = useCallback(
		async (
			bookingId: string,
			label: string,
			kind: TxRecord["kind"],
			fn: () => Promise<string | undefined>,
		) => {
			const id = actions.logTx(bookingId, { label, kind, status: "pending" })
			try {
				const ref = await fn()
				actions.logTx(bookingId, { id, label, kind, status: "confirmed", ref })
				return ref
			} catch (e) {
				actions.logTx(bookingId, {
					id,
					label,
					kind,
					status: "failed",
					error: errorMessage(e),
				})
				throw e
			}
		},
		[],
	)

	const escrowStep = useCallback(
		async (
			bookingId: string,
			label: string,
			build: Parameters<typeof run>[1],
			fallbackRef?: string,
		) => {
			let contractId: string | undefined
			const ref = await step(bookingId, label, "escrow", async () => {
				const res = await run(label, build)
				if (!res)
					throw new Error(
						"La transacción no se completó (revisa la notificación).",
					)
				const r = res as { hash?: string; txHash?: string; contractId?: string }
				contractId = r.contractId
				return r.hash ?? r.txHash ?? r.contractId ?? fallbackRef
			})
			return { ref, contractId }
		},
		[run, step],
	)

	const registryStep = useCallback(
		async <T>(
			bookingId: string,
			label: string,
			method: Parameters<typeof callRegistry>[0],
			args: Record<string, unknown>,
		) => {
			let value: T | undefined
			await step(bookingId, label, "registry", async () => {
				const res = await callRegistry<T>(
					method,
					args,
					address!,
					signTransaction,
				)
				value = res.value
				return res.hash
			})
			return value
		},
		[address, signTransaction, step],
	)

	const simStep = useCallback(
		(bookingId: string, label: string) =>
			step(bookingId, label, "simulated", async () => {
				await sleep(650)
				return simRef()
			}),
		[step],
	)

	const execute = useCallback(
		async (id: ActionId, role: Role, input: ActionInput = {}) => {
			if (!booking) return
			/** Always act on the latest stored copy (retries see completed steps). */
			const latest = () =>
				store.get().bookings.find((x) => x.id === booking.id) ?? booking
			const b = latest()
			const onchain = b.mode === "onchain"
			const useRegistry = onchain && registry && b.registryId !== undefined
			const regId = b.registryId
			const contractId = b.escrowId
			const fee = feeIndex(b)
			const listingTitle = (x: Booking) =>
				state.listings.find((l) => l.id === x.listingId)?.title ?? x.listingId
			/** Transitions that don't move money: logged, simulated or off-chain. */
			const simOrNote = async (x: Booking, label: string) => {
				if (x.mode === "onchain") {
					actions.logTx(x.id, {
						label: `${label} (sin registro on-chain)`,
						kind: "offchain",
						status: "confirmed",
					})
					return
				}
				await simStep(x.id, `${label} (simulado)`)
			}
			const approve = (index: number) => () =>
				approveMilestone(
					{
						contractId: contractId!,
						milestoneIndex: String(index),
						approver: address!,
					},
					TYPE,
				)
			const release = (index: number) => () =>
				releaseFunds(
					{
						contractId: contractId!,
						releaseSigner: address!,
						milestoneIndex: String(index),
					},
					TYPE,
				)
			/**
			 * Close the booking once it was returned and every milestone was paid
			 * out. On-chain: the registry first, then the local mirror.
			 */
			const maybeComplete = async () => {
				const x = latest()
				if (x.status !== "return_review" || !allReleased(x)) return
				if (useRegistry)
					await registryStep(x.id, "Reserva completada on-chain", "complete", {
						owner: address,
						id: regId,
					})
				actions.updateBooking(x.id, { status: "completed" })
			}
			setBusy(id)
			try {
				switch (id) {
					case "accept": {
						if (useRegistry)
							await registryStep(
								b.id,
								"Aceptación registrada on-chain",
								"accept",
								{ owner: address, id: regId },
							)
						else await simOrNote(b, "Solicitud aceptada")
						actions.updateBooking(b.id, { status: "accepted" })
						break
					}
					case "reject": {
						if (useRegistry)
							await registryStep(
								b.id,
								"Rechazo registrado on-chain",
								"reject",
								{ owner: address, id: regId },
							)
						else await simOrNote(b, "Solicitud rechazada")
						actions.updateBooking(b.id, { status: "rejected" })
						break
					}
					case "cancel": {
						if (useRegistry)
							await registryStep(
								b.id,
								"Cancelación registrada on-chain",
								"cancel",
								{ caller: address, id: regId },
							)
						else await simOrNote(b, "Reserva cancelada")
						actions.updateBooking(b.id, { status: "cancelled" })
						break
					}
					case "fund": {
						const total = escrowTotal(b)
						if (onchain) {
							if (!b.resolverAddress)
								throw new Error(
									"Esta reserva no tiene árbitro de la plataforma (PUBLIC_PLATFORM_ADDRESS).",
								)
							let escrowId = b.escrowId
							if (!escrowId) {
								const platform = b.resolverAddress
								const deployed = await escrowStep(
									b.id,
									"Escrow creado en Stellar",
									() =>
										deployEscrow(
											{
												signer: address!,
												engagementId: `rentsafe-${regId ?? b.id}`,
												title: `RentSafe · ${listingTitle(b)}`.slice(0, 100),
												description: `Alquiler ${b.start} → ${b.end}. Hito 1: alquiler al propietario. Hito 2: depósito de garantía de vuelta al arrendatario.${b.fee > 0 ? " Hito 3: comisión de RentSafe." : ""}`,
												roles: {
													approver: b.tenantAddress!,
													serviceProvider: b.ownerAddress!,
													releaseSigner: b.ownerAddress!,
													disputeResolver: platform,
													platformAddress: platform,
												},
												platformFee: 0,
												trustline: {
													address: USDC.address,
													symbol: USDC.symbol,
												},
												milestones: [
													{
														description: "Alquiler",
														amount: b.rent,
														receiver: b.ownerAddress!,
													},
													...(b.deposit > 0
														? [
																{
																	description: "Depósito de garantía",
																	amount: b.deposit,
																	receiver: b.tenantAddress!,
																},
															]
														: []),
													...(b.fee > 0
														? [
																{
																	description: "Comisión RentSafe",
																	amount: b.fee,
																	receiver: platform,
																},
															]
														: []),
												],
											},
											TYPE,
										),
								)
								if (!deployed.contractId?.startsWith("C"))
									throw new Error("La API no devolvió el id del escrow.")
								escrowId = deployed.contractId
								actions.updateBooking(b.id, { escrowId })
							}
							if (useRegistry && !b.escrowLinked) {
								await registryStep(
									b.id,
									"Escrow verificado y vinculado a la reserva on-chain",
									"link_escrow",
									{
										tenant: address,
										id: regId,
										escrow: escrowId,
									},
								)
								actions.updateBooking(b.id, { escrowLinked: true })
							}
							await escrowStep(
								b.id,
								`Depósito de ${total} USDC en el escrow`,
								() =>
									fundEscrow(
										{
											contractId: escrowId!,
											amount: total,
											signer: address!,
										},
										TYPE,
									),
								escrowId,
							)
						} else
							await simStep(
								b.id,
								`Depósito de ${total} ${RENTSAFE.currency} en el escrow (simulado)`,
							)
						actions.updateBooking(b.id, { status: "funded" })
						break
					}
					case "markDelivered": {
						const notes = input.notes?.trim() || "Bien entregado"
						const targets = [RENT_INDEX, fee].filter(
							(i): i is number => i !== undefined,
						)
						if (onchain) {
							for (const index of targets) {
								if (latest().statusSet?.includes(index)) continue
								await escrowStep(
									b.id,
									index === RENT_INDEX
										? "Entrega registrada en el escrow"
										: "Comisión marcada como lista en el escrow",
									() =>
										changeMilestoneStatus(
											{
												contractId: contractId!,
												milestoneIndex: String(index),
												newStatus: "entregado",
												newEvidence: notes.slice(0, 200),
												serviceProvider: address!,
											},
											TYPE,
										),
								)
								actions.updateBooking(b.id, {
									statusSet: [...(latest().statusSet ?? []), index],
								})
							}
						} else await simStep(b.id, "Entrega registrada (simulado)")
						actions.updateBooking(b.id, {
							statusSet: [
								...new Set([...(latest().statusSet ?? []), ...targets]),
							],
						})
						break
					}
					case "confirmReceipt": {
						if (onchain) {
							if (!b.approved[0]) {
								await escrowStep(
									b.id,
									"Entrega confirmada (hito de alquiler aprobado)",
									approve(RENT_INDEX),
								)
								actions.updateBooking(b.id, {
									approved: [true, latest().approved[1]],
								})
							}
							if (fee !== undefined && !b.feeApproved) {
								await escrowStep(
									b.id,
									"Comisión de la plataforma aprobada",
									approve(fee),
								)
								actions.updateBooking(b.id, { feeApproved: true })
							}
						} else await simStep(b.id, "Entrega confirmada (simulado)")
						actions.updateBooking(b.id, {
							status: "active",
							approved: [true, latest().approved[1]],
							...(fee !== undefined ? { feeApproved: true } : {}),
						})
						break
					}
					case "releaseRent": {
						if (onchain) {
							if (!b.rentReleased) {
								await escrowStep(
									b.id,
									`Alquiler de ${b.rent} USDC liberado al propietario`,
									release(RENT_INDEX),
								)
								actions.updateBooking(b.id, { rentReleased: true })
							}
							if (fee !== undefined && !b.feeReleased) {
								await escrowStep(
									b.id,
									`Comisión de ${b.fee} USDC liberada a la plataforma`,
									release(fee),
								)
								actions.updateBooking(b.id, { feeReleased: true })
							}
						} else {
							await simStep(b.id, "Alquiler liberado al propietario (simulado)")
							actions.updateBooking(b.id, {
								rentReleased: true,
								...(fee !== undefined ? { feeReleased: true } : {}),
							})
						}
						await maybeComplete()
						break
					}
					case "registerReturn": {
						const notes = input.notes?.trim() || "Bien devuelto"
						const dep = depositIndex(b)
						if (onchain && dep !== undefined)
							await escrowStep(b.id, "Devolución registrada en el escrow", () =>
								changeMilestoneStatus(
									{
										contractId: contractId!,
										milestoneIndex: String(dep),
										newStatus: "devuelto",
										newEvidence: notes.slice(0, 200),
										serviceProvider: address!,
									},
									TYPE,
								),
							)
						else if (!onchain)
							await simStep(b.id, "Devolución registrada (simulado)")
						actions.updateBooking(b.id, {
							status: "return_review",
							returnNotes: notes,
							...(dep !== undefined
								? {
										statusSet: [
											...new Set([...(latest().statusSet ?? []), dep]),
										],
									}
								: {}),
						})
						await maybeComplete()
						break
					}
					case "approveDeposit": {
						const dep = depositIndex(b)
						if (onchain && dep !== undefined)
							await escrowStep(
								b.id,
								"Devolución del depósito aprobada por el arrendatario",
								approve(dep),
							)
						else
							await simStep(b.id, "Devolución del depósito aprobada (simulado)")
						actions.updateBooking(b.id, { approved: [b.approved[0], true] })
						break
					}
					case "releaseDeposit": {
						const dep = depositIndex(b)
						if (onchain && dep !== undefined)
							await escrowStep(
								b.id,
								`Depósito de ${b.deposit} USDC devuelto al arrendatario`,
								release(dep),
							)
						else
							await simStep(
								b.id,
								"Depósito devuelto al arrendatario (simulado)",
							)
						actions.updateBooking(b.id, { depositReleased: true })
						await maybeComplete()
						break
					}
					case "complete": {
						await maybeComplete()
						break
					}
					case "dispute":
					case "disputeDelivery": {
						const reason = input.reason?.trim()
						if (!reason) throw new Error("Describe el motivo de la disputa.")
						const kind = id === "disputeDelivery" ? "delivery" : "deposit"
						const targets =
							kind === "delivery"
								? deliveryDisputeMilestones(b)
								: [depositIndex(b)!]
						if (onchain) {
							for (const index of targets) {
								if (latest().disputedMilestones?.includes(index)) continue
								await escrowStep(
									b.id,
									`Disputa abierta en el escrow (hito ${index + 1} bloqueado)`,
									() =>
										startDispute(
											{
												contractId: contractId!,
												milestoneIndex: String(index),
												signer: address!,
											},
											TYPE,
										),
								)
								actions.updateBooking(b.id, {
									disputeKind: kind,
									disputedMilestones: [
										...(latest().disputedMilestones ?? []),
										index,
									],
								})
							}
							if (useRegistry)
								await registryStep(
									b.id,
									"Disputa registrada on-chain",
									"open_dispute",
									{ caller: address, id: regId },
								)
						} else await simStep(b.id, "Disputa abierta (simulado)")
						actions.updateBooking(b.id, {
							status: "disputed",
							disputeKind: kind,
							disputedMilestones: targets,
							disputeReason: `${role === "owner" ? "Propietario" : "Arrendatario"}: ${reason}`,
						})
						break
					}
					case "resolve": {
						const main = disputedMain(b)
						const mainAmount = milestoneAmount(b, main)
						const toOwner = round2(
							Math.min(Math.max(input.toOwner ?? 0, 0), mainAmount),
						)
						const toTenant = round2(mainAmount - toOwner)
						const targets = b.disputedMilestones?.length
							? b.disputedMilestones
							: [main]
						if (onchain) {
							for (const index of targets) {
								if (latest().resolvedMilestones?.includes(index)) continue
								const amount = milestoneAmount(b, index)
								// Only the main milestone is split; in a delivery dispute
								// the deposit and the fee simply go back to the tenant.
								const distributions = (
									index === main
										? [
												{ address: b.ownerAddress!, amount: toOwner },
												{ address: b.tenantAddress!, amount: toTenant },
											]
										: [{ address: b.tenantAddress!, amount }]
								).filter((d) => d.amount > 0)
								await escrowStep(
									b.id,
									index === main
										? `Disputa resuelta: ${toOwner} al propietario, ${toTenant} al arrendatario`
										: `Hito ${index + 1} devuelto al arrendatario (${amount} USDC)`,
									() =>
										resolveDispute(
											{
												contractId: contractId!,
												milestoneIndex: String(index),
												disputeResolver: address!,
												// The SDK 3.0.5 types declare a 1-tuple, but the API
												// accepts any number of distributions.
												distributions: distributions as unknown as [
													{ address: string; amount: number },
												],
											},
											TYPE,
										),
								)
								actions.updateBooking(b.id, {
									resolution: { toOwner, toTenant },
									resolvedMilestones: [
										...(latest().resolvedMilestones ?? []),
										index,
									],
								})
							}
							if (useRegistry)
								await registryStep(
									b.id,
									"Disputa cerrada en el registro on-chain",
									"resolve_dispute",
									{ caller: address, id: regId },
								)
						} else
							await simStep(
								b.id,
								`Disputa resuelta: ${toOwner} al propietario, ${toTenant} al arrendatario (simulado)`,
							)
						actions.updateBooking(b.id, {
							status: "resolved",
							depositReleased: true,
							resolution: { toOwner, toTenant },
							resolvedMilestones: targets,
						})
						break
					}
				}
				addNotification("Listo: la reserva se actualizó", "success")
			} catch (e) {
				addNotification(errorMessage(e), "error")
			} finally {
				setBusy(null)
			}
		},
		[
			booking,
			address,
			state.listings,
			addNotification,
			escrowStep,
			registryStep,
			simStep,
			deployEscrow,
			fundEscrow,
			approveMilestone,
			changeMilestoneStatus,
			releaseFunds,
			startDispute,
			resolveDispute,
		],
	)

	return { execute, busy, can }
}

/** Creates the rental request (step 5 of the flow). */
export function useCreateRequest() {
	const { address, signTransaction } = useWallet()
	const state = useRentSafe()
	const [busy, setBusy] = useState(false)

	const create = useCallback(
		async (
			listing: Listing,
			q: Quote,
			mode: Exclude<BookingMode, "demo">,
			message: string,
		) => {
			const owner = ownerById(state, listing.ownerId)
			if (!owner) throw new Error("No encontramos al propietario de este bien.")
			setBusy(true)
			try {
				const base = {
					listingId: listing.id,
					tenantId: ME,
					ownerId: listing.ownerId,
					start: q.start,
					end: q.end,
					units: q.units,
					rent: q.rent,
					deposit: q.deposit,
					fee: q.fee,
					total: q.total,
					status: "requested" as const,
					mode,
					rentReleased: false,
					depositReleased: false,
					approved: [false, false] as [boolean, boolean],
					message: message.trim() || undefined,
				}
				if (mode === "simulated") {
					const id = actions.createBooking(base)
					actions.logTx(id, {
						label: "Solicitud creada (simulación, sin blockchain)",
						kind: "simulated",
						status: "confirmed",
						ref: simRef(),
					})
					return id
				}
				if (!address)
					throw new Error("Conecta tu billetera para usar el modo on-chain.")
				if (!platformAddress)
					throw new Error(
						"Falta PUBLIC_PLATFORM_ADDRESS en app/.env: el modo on-chain necesita un árbitro de disputas independiente.",
					)
				if (!registry)
					throw new Error(
						"El contrato rental_registry no está desplegado: ejecuta npm run contracts:build.",
					)
				// Register on-chain FIRST: the local copy only exists once the
				// request is a real transaction.
				const res = await callRegistry<number>(
					"request",
					{
						tenant: address,
						owner: owner.payoutAddress,
						listing_id: listing.id.slice(0, 64),
						start: toUnix(q.start),
						end: toUnix(q.end),
						rent: stroops(q.rent),
						deposit: stroops(q.deposit),
						fee: stroops(q.fee),
					},
					address,
					signTransaction,
				)
				const id = actions.createBooking({
					...base,
					tenantAddress: address,
					ownerAddress: owner.payoutAddress,
					resolverAddress: platformAddress,
					registryId: Number(res.value),
				})
				actions.logTx(id, {
					label: "Solicitud registrada on-chain",
					kind: "registry",
					status: "confirmed",
					ref: res.hash,
				})
				return id
			} finally {
				setBusy(false)
			}
		},
		[address, signTransaction, state],
	)

	return { create, busy, networkPassphrase }
}
