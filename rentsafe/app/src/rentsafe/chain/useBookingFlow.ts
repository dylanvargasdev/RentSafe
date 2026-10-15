/**
 * Every booking transition, for the three modes:
 *
 * - onchain: Trustless Work multi-release escrow (2 milestones) + the
 *   rental_registry Soroban contract. Every write is signed by the user's
 *   wallet through useWallet().signTransaction (Cavos or extension).
 * - simulated / demo: same transitions, no blockchain, refs start with "SIM-".
 *
 * Escrow design (per booking):
 *   milestone 0 "Alquiler"  → receiver = owner
 *   milestone 1 "Depósito"  → receiver = tenant (refund)
 *   approver        = tenant  (confirms receipt / agrees to the refund)
 *   serviceProvider = owner   (registers the return, with notes as evidence)
 *   releaseSigner   = owner   (releases each approved milestone)
 *   disputeResolver = platform (PUBLIC_PLATFORM_ADDRESS, or tenant in demo mode)
 * So the owner can't collect rent without the tenant's approval, and the
 * deposit refund needs the tenant's approval plus the owner's release; any
 * disagreement goes to the platform arbiter, who splits the deposit.
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
import { platformAddress, platformOr, USDC } from "../../trustless/config"
import { useEscrowTx } from "../../trustless/useEscrowTx"
import { RENTSAFE } from "../config"
import { toUnix } from "../dates"
import { type Quote } from "../pricing"
import {
	actions,
	ME,
	ownerById,
	useRentSafe,
	useSession,
} from "../store/useRentSafe"
import { store } from "../store/store"
import {
	type Booking,
	type BookingMode,
	type Listing,
	type TxRecord,
} from "../types"
import { callRegistry, registry } from "./registry"

const stroops = (n: number) => BigInt(Math.round(n * 1e7))
const simRef = () =>
	`SIM-${Math.random().toString(16).slice(2, 10).toUpperCase()}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const TYPE = "multi-release" as const

export type ActionId =
	| "accept"
	| "reject"
	| "cancel"
	| "fund"
	| "confirmReceipt"
	| "releaseRent"
	| "registerReturn"
	| "approveDeposit"
	| "releaseDeposit"
	| "dispute"
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
	if (s === "requested" || s === "accepted") {
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
			label: "Depositar en garantía",
			help: "Crea el escrow y deposita alquiler + depósito. El propietario aún no recibe nada.",
			variant: "primary",
		})
	if (s === "funded")
		out.push({
			id: "confirmReceipt",
			role: "tenant",
			label: "Confirmar que recibí el bien",
			help: "Aprueba el pago del alquiler. El propietario podrá cobrarlo.",
			variant: "primary",
		})
	if (
		["active", "return_review", "disputed"].includes(s) &&
		b.approved[0] &&
		!b.rentReleased
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
	if (
		["active", "return_review"].includes(s) &&
		b.deposit > 0 &&
		!b.approved[1]
	)
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
			help: "Reparte el depósito entre propietario y arrendatario.",
			variant: "primary",
			input: "split",
		})
	return out
}

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
			const b = store.get().bookings.find((x) => x.id === booking.id) ?? booking
			const onchain = b.mode === "onchain"
			const useRegistry = onchain && registry && b.registryId !== undefined
			const regId = b.registryId
			const contractId = b.escrowId
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
						if (onchain) {
							let escrowId = b.escrowId
							if (!escrowId) {
								const deployed = await escrowStep(
									b.id,
									"Escrow creado en Stellar",
									() =>
										deployEscrow(
											{
												signer: address!,
												engagementId: `rentsafe-${b.id}`,
												title: `RentSafe · ${listingTitle(b)}`.slice(0, 100),
												description: `Alquiler ${b.start} → ${b.end}. Hito 1: alquiler al propietario. Hito 2: depósito de garantía de vuelta al arrendatario.`,
												roles: {
													approver: b.tenantAddress!,
													serviceProvider: b.ownerAddress!,
													releaseSigner: b.ownerAddress!,
													disputeResolver: b.resolverAddress!,
													platformAddress: b.resolverAddress!,
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
									"Escrow vinculado a la reserva on-chain",
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
								`Depósito de ${b.rent + b.deposit} USDC en el escrow`,
								() =>
									fundEscrow(
										{
											contractId: escrowId!,
											amount: b.rent + b.deposit,
											signer: address!,
										},
										TYPE,
									),
								escrowId,
							)
						} else
							await simStep(
								b.id,
								`Depósito de ${b.rent + b.deposit} ${RENTSAFE.currency} en el escrow (simulado)`,
							)
						actions.updateBooking(b.id, { status: "funded" })
						break
					}
					case "confirmReceipt": {
						if (onchain)
							await escrowStep(
								b.id,
								"Entrega confirmada (hito de alquiler aprobado)",
								() =>
									approveMilestone(
										{
											contractId: contractId!,
											milestoneIndex: "0",
											approver: address!,
										},
										TYPE,
									),
							)
						else await simStep(b.id, "Entrega confirmada (simulado)")
						actions.updateBooking(b.id, {
							status: "active",
							approved: [true, b.approved[1]],
						})
						break
					}
					case "releaseRent": {
						if (onchain)
							await escrowStep(
								b.id,
								`Alquiler de ${b.rent} USDC liberado al propietario`,
								() =>
									releaseFunds(
										{
											contractId: contractId!,
											releaseSigner: address!,
											milestoneIndex: "0",
										},
										TYPE,
									),
							)
						else
							await simStep(b.id, `Alquiler liberado al propietario (simulado)`)
						const done =
							b.status === "return_review" &&
							(b.depositReleased || b.deposit === 0)
						actions.updateBooking(b.id, {
							rentReleased: true,
							...(done ? { status: "completed" } : {}),
						})
						if (done && useRegistry)
							await registryStep(
								b.id,
								"Reserva completada on-chain",
								"complete",
								{ owner: address, id: regId },
							)
						break
					}
					case "registerReturn": {
						const notes = input.notes?.trim() || "Bien devuelto"
						if (onchain && b.deposit > 0)
							await escrowStep(b.id, "Devolución registrada en el escrow", () =>
								changeMilestoneStatus(
									{
										contractId: contractId!,
										milestoneIndex: "1",
										newStatus: "devuelto",
										newEvidence: notes.slice(0, 200),
										serviceProvider: address!,
									},
									TYPE,
								),
							)
						else if (!onchain)
							await simStep(b.id, "Devolución registrada (simulado)")
						const done = b.deposit === 0 && b.rentReleased
						actions.updateBooking(b.id, {
							status: done ? "completed" : "return_review",
							returnNotes: notes,
						})
						if (done && useRegistry)
							await registryStep(
								b.id,
								"Reserva completada on-chain",
								"complete",
								{ owner: address, id: regId },
							)
						break
					}
					case "approveDeposit": {
						if (onchain)
							await escrowStep(
								b.id,
								"Devolución del depósito aprobada por el arrendatario",
								() =>
									approveMilestone(
										{
											contractId: contractId!,
											milestoneIndex: "1",
											approver: address!,
										},
										TYPE,
									),
							)
						else
							await simStep(b.id, "Devolución del depósito aprobada (simulado)")
						actions.updateBooking(b.id, { approved: [b.approved[0], true] })
						break
					}
					case "releaseDeposit": {
						if (onchain)
							await escrowStep(
								b.id,
								`Depósito de ${b.deposit} USDC devuelto al arrendatario`,
								() =>
									releaseFunds(
										{
											contractId: contractId!,
											releaseSigner: address!,
											milestoneIndex: "1",
										},
										TYPE,
									),
							)
						else
							await simStep(
								b.id,
								"Depósito devuelto al arrendatario (simulado)",
							)
						const done = b.rentReleased
						actions.updateBooking(b.id, {
							depositReleased: true,
							...(done ? { status: "completed" } : {}),
						})
						if (done && useRegistry)
							await registryStep(
								b.id,
								"Reserva completada on-chain",
								"complete",
								{ owner: address, id: regId },
							)
						break
					}
					case "dispute": {
						const reason = input.reason?.trim()
						if (!reason) throw new Error("Describe el motivo de la disputa.")
						if (onchain) {
							await escrowStep(
								b.id,
								"Disputa abierta en el escrow (depósito bloqueado)",
								() =>
									startDispute(
										{
											contractId: contractId!,
											milestoneIndex: "1",
											signer: address!,
										},
										TYPE,
									),
							)
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
							disputeReason: `${role === "owner" ? "Propietario" : "Arrendatario"}: ${reason}`,
						})
						break
					}
					case "resolve": {
						const toOwner = Math.min(Math.max(input.toOwner ?? 0, 0), b.deposit)
						const toTenant = Math.round((b.deposit - toOwner) * 100) / 100
						if (onchain)
							await escrowStep(
								b.id,
								`Disputa resuelta: ${toOwner} al propietario, ${toTenant} al arrendatario`,
								() =>
									resolveDispute(
										{
											contractId: contractId!,
											milestoneIndex: "1",
											disputeResolver: address!,
											distributions: [
												{ address: b.ownerAddress!, amount: toOwner },
												{ address: b.tenantAddress!, amount: toTenant },
											].filter((d) => d.amount > 0),
										},
										TYPE,
									),
							)
						else
							await simStep(
								b.id,
								`Disputa resuelta: ${toOwner} al propietario, ${toTenant} al arrendatario (simulado)`,
							)
						actions.updateBooking(b.id, {
							status: "resolved",
							depositReleased: true,
							resolution: { toOwner, toTenant },
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
				const id = actions.createBooking({
					...base,
					tenantAddress: address,
					ownerAddress: owner.payoutAddress,
					resolverAddress: platformOr(address),
				})
				if (!platformAddress)
					actions.logTx(id, {
						label:
							"Modo demo: sin PUBLIC_PLATFORM_ADDRESS, tu billetera actúa como árbitro",
						kind: "offchain",
						status: "confirmed",
					})
				if (registry) {
					const txId = actions.logTx(id, {
						label: "Solicitud registrada on-chain",
						kind: "registry",
						status: "pending",
					})
					try {
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
							},
							address,
							signTransaction,
						)
						actions.updateBooking(id, { registryId: Number(res.value) })
						actions.logTx(id, {
							id: txId,
							label: "Solicitud registrada on-chain",
							kind: "registry",
							status: "confirmed",
							ref: res.hash,
						})
					} catch (e) {
						actions.logTx(id, {
							id: txId,
							label: "Solicitud registrada on-chain",
							kind: "registry",
							status: "failed",
							error: errorMessage(e),
						})
						actions.updateBooking(id, { status: "cancelled" })
						throw e
					}
				} else {
					actions.logTx(id, {
						label:
							"Solicitud creada (rental_registry no desplegado: sin registro on-chain)",
						kind: "offchain",
						status: "confirmed",
					})
				}
				return id
			} finally {
				setBusy(false)
			}
		},
		[address, signTransaction, state],
	)

	return { create, busy, networkPassphrase }
}
