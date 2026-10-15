import { stellarNetwork } from "@stellar-scaffold/app-lib"
import { development, mainNet } from "@trustless-work/escrow"

/**
 * Trustless Work (escrow-as-a-service) configuration.
 *
 * - API V1 (stable). SDK pinned: @trustless-work/escrow@3.0.5
 * - Testnet API: https://dev.api.trustlesswork.com  ·  Mainnet: https://api.trustlesswork.com
 * - Get an API key at https://dapp.trustlesswork.com (connect wallet → profile → API Keys)
 *   and put it in app/.env as PUBLIC_TRUSTLESS_WORK_API_KEY.
 *
 * Docs for agents: .agents/skills/trustless-work/SKILL.md
 */
export const isMainnet = stellarNetwork === "PUBLIC"

export const trustlessWorkApiUrl = isMainnet ? mainNet : development

export const trustlessWorkApiKey: string =
	(
		import.meta.env.PUBLIC_TRUSTLESS_WORK_API_KEY as string | undefined
	)?.trim() ?? ""

export const isTrustlessWorkConfigured = trustlessWorkApiKey.length > 0

/**
 * The app operator's address (YOUR wallet as the builder): receives the
 * platform fee and resolves disputes in multi-user apps (marketplaces, gig
 * boards…) where the person creating the escrow is a buyer/client, not you.
 * Set PUBLIC_PLATFORM_ADDRESS in app/.env to your Freighter or Cavos address.
 * Never use the CLI deployer `me`: it can't sign in a browser.
 */
export const platformAddress: string | undefined =
	(import.meta.env.PUBLIC_PLATFORM_ADDRESS as string | undefined)?.trim() ||
	undefined

/**
 * Platform/arbiter for a new escrow: PUBLIC_PLATFORM_ADDRESS, or (demo mode)
 * the connected wallet. In demo mode a buyer could resolve their own dispute:
 * show a warning in the UI when `platformAddress` is undefined.
 */
export const platformOr = (connected: string) => platformAddress ?? connected

/**
 * The asset escrows hold. Trustless Work expects the CLASSIC asset issuer (G...)
 * plus the symbol, not the Soroban contract (C...) of the asset.
 */
export const USDC = isMainnet
	? {
			symbol: "USDC",
			address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
		}
	: {
			symbol: "USDC",
			address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
		}

/** Key used by `fetchBalances` (app-lib/wallet.ts) for this asset. */
export const USDC_BALANCE_KEY = `${USDC.symbol}:${USDC.address}`

const networkSlug = isMainnet ? "mainnet" : "testnet"

/** Trustless Work's escrow viewer. */
export const escrowViewerUrl = (contractId: string) =>
	`https://viewer.trustlesswork.com/${networkSlug}/v1/${contractId}`

/** Block explorer for any contract (C...) or account (G...). */
export const explorerUrl = (id: string) =>
	`https://stellar.expert/explorer/${networkSlug}/${id.startsWith("C") ? "contract" : "account"}/${id}`
