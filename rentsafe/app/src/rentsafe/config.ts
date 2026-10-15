/**
 * RentSafe demo parameters. They are NOT final business policies: every value
 * shown to users from this file is labelled "parámetro de demostración".
 */
export const RENTSAFE = {
	/** Currency of every price and of the escrow (Trustless Work holds USDC). */
	currency: "USDC",
	/**
	 * RentSafe service fee charged to the tenant, in percent.
	 * Kept at 0 in the demo: Trustless Work would deduct a platform fee from
	 * EVERY release, including the deposit refund to the tenant.
	 */
	serviceFeePercent: Number(import.meta.env.PUBLIC_RENTSAFE_FEE_PERCENT ?? 0),
	/** Trustless Work protocol fee, deducted from each release (not added on top). */
	protocolFeePercent: 0.3,
	/** localStorage key (bump the version to reset everyone's demo data). */
	storageKey: "rentsafe:v1",
	/**
	 * Optional: a testnet address that receives rent for the SEED listings, so
	 * the on-chain flow can be tried on them (e.g. your second wallet).
	 */
	demoOwnerAddress:
		(import.meta.env.PUBLIC_DEMO_OWNER_ADDRESS as string | undefined)?.trim() ||
		undefined,
} as const

export const money = (n: number) =>
	`${n.toLocaleString("es-CR", {
		minimumFractionDigits: n % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	})} ${RENTSAFE.currency}`
