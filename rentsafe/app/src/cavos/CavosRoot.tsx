import { CavosProvider, useCavos } from "@cavos/kit/react"
import { type ReactNode, useCallback, useMemo } from "react"
import {
	CAVOS_APP_SALT,
	cavosAppId,
	cavosEnvironment,
	cavosNetwork,
	isCavosConfigured,
} from "./config"
import { CavosContext, type CavosState } from "./context"

/**
 * Mounts Cavos (embedded wallets) when PUBLIC_CAVOS_APP_ID is set, and exposes
 * its state through `useCavosState()`. WalletProvider turns it into the same
 * `useWallet()` API the rest of the app already uses.
 */
export const CavosRoot = ({ children }: { children: ReactNode }) => {
	if (!isCavosConfigured || !cavosNetwork) return children

	return (
		<CavosProvider
			config={{
				appId: cavosAppId,
				environment: cavosEnvironment,
				chains: ["stellar"],
				defaultChain: "stellar",
				network: cavosNetwork,
				appSalt: CAVOS_APP_SALT,
				// One chain + passkey restore: works without enabling social
				// recovery in the dashboard. Signing up never asks for a passkey.
				deviceApproval: "passkey",
				// NOTE: @cavos/kit 0.4.2's modal ignores this for Google and returns
				// to the page where login started (origin + pathname). RentSafe only
				// starts Cavos login from "/" or "/perfil" (see WalletMenu), so
				// register `<origin>/` and `<origin>/perfil` as Callback URLs.
				redirectUri: window.location.origin,
			}}
			modal={{
				appName: "RentSafe",
				providers: ["email", "google"],
				primaryColor: "#0e5a43",
			}}
		>
			<CavosBridge>{children}</CavosBridge>
		</CavosProvider>
	)
}

/** Where @cavos/kit 0.4.2 keeps this tab's login token (CavosAuth.authTokenKey). */
const TOKEN_KEY = `cavos-kit:token:${cavosAppId || "default"}`
const hasLoginToken = () => {
	try {
		return Boolean(window.sessionStorage.getItem(TOKEN_KEY))
	} catch {
		return false
	}
}

const CavosBridge = ({ children }: { children: ReactNode }) => {
	const cavos = useCavos()
	const wallet = cavos.wallet?.chain === "stellar" ? cavos.wallet : null
	const { needsDeviceApproval, hasPasskey } = cavos.walletStatus
	const { openModal, clearAuthError, logout } = cavos
	// A restored session without its token can't reach the wallet registry
	// ("registry lookup skipped: no login token"): the wallet then looks locked,
	// and unlocking just reconnects without a token again, in a loop.
	const sessionExpired =
		cavos.isAuthenticated && needsDeviceApproval && !hasLoginToken()

	// Errors from a silent reconnect are stale by the time the user opens the
	// modal; don't greet them with "registry lookup skipped".
	const signIn = useCallback(() => {
		clearAuthError()
		openModal()
	}, [clearAuthError, openModal])

	// Logging out only forgets this session; the wallet key stays on the
	// device, and a fresh login (with its token) reconnects the same wallet.
	const signInAgain = useCallback(() => {
		logout()
		setTimeout(() => {
			clearAuthError()
			openModal()
		}, 0)
	}, [logout, clearAuthError, openModal])

	const value = useMemo<CavosState>(
		() => ({
			isLoading: cavos.isLoading,
			isAuthenticated: cavos.isAuthenticated,
			address: wallet?.address,
			email: cavos.user?.email,
			needsDeviceApproval,
			sessionExpired,
			hasPasskey,
			error: cavos.authError,
			signIn,
			signInAgain,
			signOut: cavos.logout,
			approveDevice: cavos.approveDeviceWithPasskey,
			addPasskey:
				cavos.passkeySupported && !hasPasskey
					? cavos.enrollPasskeyDefault
					: undefined,
			// `signXdr` is Cavos' drop-in for a wallet's signTransaction: it signs
			// classic txs and this account's Soroban auth entries, without submitting.
			signTransaction: wallet
				? async (xdr) => ({
						signedTxXdr: await wallet.signXdr(xdr),
						signerAddress: wallet.address,
					})
				: undefined,
		}),
		[
			cavos,
			wallet,
			needsDeviceApproval,
			sessionExpired,
			hasPasskey,
			signIn,
			signInAgain,
		],
	)

	return <CavosContext value={value}>{children}</CavosContext>
}
