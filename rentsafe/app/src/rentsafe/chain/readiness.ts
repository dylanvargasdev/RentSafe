import { type MappedBalances, stellarNetwork } from "@stellar-scaffold/app-lib"
import {
	isTrustlessWorkConfigured,
	platformAddress,
	USDC_BALANCE_KEY,
} from "../../trustless/config"
import { type Owner } from "../types"
import { registry } from "./registry"

export interface Check {
	ok: boolean
	label: string
	/** Blocking for on-chain mode (otherwise only a warning). */
	required: boolean
}

/** What the on-chain flow needs before the tenant can request a booking. */
export function onchainChecks(opts: {
	address?: string
	walletPassphrase?: string
	appPassphrase: string
	balances: MappedBalances
	owner?: Owner
	amount: number
	/** Fee charged to the tenant (the platform must be able to receive it). */
	fee?: number
	/** USDC trustline of the owner / platform (undefined = still checking). */
	ownerCanReceive?: boolean
	platformCanReceive?: boolean
}): Check[] {
	const usdcRaw = opts.balances[USDC_BALANCE_KEY]?.balance
	const usdc =
		usdcRaw === undefined ? undefined : Number(usdcRaw.replace(/,/g, ""))
	return [
		{
			ok: stellarNetwork === "TESTNET",
			label: "La app está configurada para Stellar testnet",
			required: true,
		},
		{
			ok: isTrustlessWorkConfigured,
			label:
				"API key de Trustless Work configurada (PUBLIC_TRUSTLESS_WORK_API_KEY)",
			required: true,
		},
		{ ok: Boolean(opts.address), label: "Billetera conectada", required: true },
		{
			ok:
				!opts.walletPassphrase || opts.walletPassphrase === opts.appPassphrase,
			label: "La billetera está en la misma red que la app",
			required: true,
		},
		{
			ok: Boolean(platformAddress),
			label:
				"Árbitro de disputas de la plataforma configurado (PUBLIC_PLATFORM_ADDRESS)",
			required: true,
		},
		{
			ok: Boolean(opts.owner?.payoutAddress),
			label: "El propietario tiene una billetera para cobrar",
			required: true,
		},
		{
			ok:
				!platformAddress ||
				(opts.address !== platformAddress &&
					opts.owner?.payoutAddress !== platformAddress),
			label: "Ni tú ni el propietario son el árbitro de la plataforma",
			required: true,
		},
		{
			ok: !opts.address || opts.address !== opts.owner?.payoutAddress,
			label: "Tu billetera es distinta de la del propietario",
			required: true,
		},
		{
			ok: usdc !== undefined && usdc >= opts.amount,
			label:
				usdc === undefined
					? "Trustline de USDC en tu billetera (se necesita al depositar)"
					: `Saldo suficiente: tienes ${usdcRaw} USDC (se necesitan al depositar)`,
			required: false,
		},
		{
			ok: opts.ownerCanReceive === true,
			label:
				opts.ownerCanReceive === undefined
					? "Comprobando que el propietario puede recibir USDC…"
					: "El propietario puede recibir USDC (billetera activa con trustline)",
			required: false,
		},
		...(opts.fee && opts.fee > 0
			? [
					{
						ok: opts.platformCanReceive === true,
						label:
							"La billetera de la plataforma puede recibir USDC (para la comisión)",
						required: false,
					},
				]
			: []),
		{
			ok: Boolean(registry),
			label:
				"Contrato rental_registry desplegado (registro público del acuerdo)",
			required: true,
		},
	]
}
