import { stellarNetwork } from "@stellar-scaffold/app-lib"

/**
 * Cavos (https://docs.cavos.xyz): embedded, self-custodial Stellar wallets with
 * email / Google login. Users get a normal `G…` account without installing a
 * wallet extension. Optional: when PUBLIC_CAVOS_APP_ID is empty the app only
 * offers extension wallets (Stellar Wallets Kit).
 *
 * Setup: https://cavos.xyz/dashboard → create an app → copy its App ID into
 * app/.env as PUBLIC_CAVOS_APP_ID, and add http://localhost:5173 to the app's
 * allowed web origins (and callback URLs, for Google login).
 *
 * Docs for agents: .agents/skills/cavos/SKILL.md
 */
export const cavosAppId: string =
	(import.meta.env.PUBLIC_CAVOS_APP_ID as string | undefined)?.trim() ?? ""

/** Cavos only runs on Stellar testnet and mainnet. */
export const cavosNetwork =
	stellarNetwork === "PUBLIC"
		? "mainnet"
		: stellarNetwork === "TESTNET"
			? "testnet"
			: null

export const isCavosConfigured = cavosAppId.length > 0 && cavosNetwork !== null

/** Cavos console environment (separate gas pool, origins, keys). */
export const cavosEnvironment: "development" | "production" =
	import.meta.env.PUBLIC_CAVOS_ENVIRONMENT === "production"
		? "production"
		: "development"

/**
 * NEVER change this after real users have signed in. On native Stellar it is
 * the HKDF salt of the spend key, and Cavos keeps one registry row per
 * (userId, appId, chain, network): a new salt derives a different address that
 * no longer matches that row. Set to "rentsafe" (it was the scaffold default
 * "scaffold-stellar-agentic"), so use a Cavos app (PUBLIC_CAVOS_APP_ID) created
 * for RentSafe, not one already used with the old salt.
 * Docs: https://docs.cavos.xyz/llms-full.txt
 */
export const CAVOS_APP_SALT = "rentsafe"
