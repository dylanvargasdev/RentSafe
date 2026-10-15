import { type MappedBalances, stellarNetwork } from "@stellar-scaffold/app-lib"
import {
	isTrustlessWorkConfigured,
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
			ok: Boolean(opts.owner?.payoutAddress),
			label: "El propietario tiene una billetera para cobrar",
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
			ok: Boolean(registry),
			label:
				"Contrato rental_registry desplegado (registro público del acuerdo)",
			required: false,
		},
	]
}
