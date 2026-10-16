/**
 * Presentation of the booking lifecycle (the states themselves are in
 * `types.ts`; transitions in `chain/useBookingFlow.ts`).
 *
 * - `STATUS` / `MODE`: label, badge tone and one-line help for each state and
 *   for "on-chain" vs "demo" bookings.
 * - `TIMELINE`: the steps shown on the booking page and when each is reached.
 * - `heldInEscrow`, `ownerEarned`, `ownerPending`: money figures for the
 *   dashboards, derived only from the booking's recorded state.
 */
import { type Booking, type BookingMode, type BookingStatus } from "./types"

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

export const STATUS: Record<
	BookingStatus,
	{ label: string; tone: Tone; help: string }
> = {
	requested: {
		label: "Pendiente de aceptación",
		tone: "warning",
		help: "El propietario debe aceptar o rechazar la solicitud.",
	},
	accepted: {
		label: "Esperando depósito",
		tone: "info",
		help: "Aceptada. El arrendatario debe depositar alquiler + garantía en el escrow.",
	},
	rejected: {
		label: "Rechazada",
		tone: "neutral",
		help: "El propietario rechazó la solicitud. No se movió dinero.",
	},
	cancelled: {
		label: "Cancelada",
		tone: "neutral",
		help: "Cancelada antes de depositar fondos. No se movió dinero.",
	},
	funded: {
		label: "Fondos en garantía",
		tone: "info",
		help: "El dinero está en el escrow. El propietario marca la entrega y el arrendatario la confirma.",
	},
	active: {
		label: "Alquiler activo",
		tone: "success",
		help: "El arrendatario confirmó la entrega. El propietario ya puede cobrar el alquiler.",
	},
	return_review: {
		label: "Devolución en revisión",
		tone: "warning",
		help: "El propietario registró la devolución. Si todo está bien, libera el depósito.",
	},
	completed: {
		label: "Completada",
		tone: "success",
		help: "Alquiler pagado al propietario y depósito devuelto al arrendatario.",
	},
	disputed: {
		label: "Disputa abierta",
		tone: "danger",
		help: "Los fondos quedan bloqueados hasta que el árbitro de la plataforma decida el reparto.",
	},
	resolved: {
		label: "Disputa resuelta",
		tone: "neutral",
		help: "El árbitro repartió los fondos en garantía.",
	},
}

export const MODE: Record<
	BookingMode,
	{ label: string; tone: Tone; help: string }
> = {
	onchain: {
		label: "On-chain · Testnet",
		tone: "success",
		help: "Cada paso es una transacción real en Stellar testnet, verificable en el explorador.",
	},
	simulated: {
		label: "Simulación",
		tone: "warning",
		help: "Mismo flujo sin blockchain: ninguna transacción es real. Las referencias empiezan por SIM-.",
	},
	demo: {
		label: "Datos de demostración",
		tone: "neutral",
		help: "Reserva de ejemplo para mostrar los paneles.",
	},
}

/** Ordered steps for the progress tracker. */
export const TIMELINE: {
	key: string
	label: string
	reached: (b: Booking) => boolean
}[] = [
	{ key: "req", label: "Solicitud", reached: () => true },
	{
		key: "acc",
		label: "Aceptada",
		reached: (b) => !["requested", "rejected", "cancelled"].includes(b.status),
	},
	{
		key: "fund",
		label: "Depósito en escrow",
		reached: (b) =>
			[
				"funded",
				"active",
				"return_review",
				"completed",
				"disputed",
				"resolved",
			].includes(b.status),
	},
	{
		key: "act",
		label: "Entrega",
		reached: (b) =>
			["active", "return_review", "completed"].includes(b.status) ||
			b.approved[0],
	},
	{
		key: "ret",
		label: "Devolución",
		reached: (b) => ["return_review", "completed"].includes(b.status),
	},
	{
		key: "done",
		label: "Fondos liberados",
		reached: (b) => b.status === "completed" || b.status === "resolved",
	},
]

/** Money that is (still) held in the escrow according to our records. */
export const heldInEscrow = (b: Booking) => {
	if (!["funded", "active", "return_review", "disputed"].includes(b.status))
		return 0
	return (
		(b.rentReleased ? 0 : b.rent) +
		(b.depositReleased ? 0 : b.deposit) +
		(b.feeReleased ? 0 : b.fee)
	)
}

/** Owner earnings derived from booking states (never invented). */
export const ownerEarned = (b: Booking) => {
	const rent = b.rentReleased ? b.rent : 0
	return b.status === "resolved" ? rent + (b.resolution?.toOwner ?? 0) : rent
}
export const ownerPending = (b: Booking) =>
	["funded", "active", "return_review", "disputed"].includes(b.status) &&
	!b.rentReleased
		? b.rent
		: 0
