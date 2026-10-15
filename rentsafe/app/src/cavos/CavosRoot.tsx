import { CavosProvider, useCavos } from "@cavos/kit/react"
import { type ReactNode, useMemo } from "react"
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
				// Google login returns here: register this exact URL in the dashboard.
				redirectUri: window.location.origin,
			}}
			modal={{
				appName: "Scaffold Pura Vida",
				providers: ["email", "google"],
				emailMode: "otp",
				primaryColor: "#7b61ff",
			}}
		>
			<CavosBridge>{children}</CavosBridge>
		</CavosProvider>
	)
}

const CavosBridge = ({ children }: { children: ReactNode }) => {
	const cavos = useCavos()
	const wallet = cavos.wallet?.chain === "stellar" ? cavos.wallet : null
	const { needsDeviceApproval, hasPasskey } = cavos.walletStatus

	const value = useMemo<CavosState>(
		() => ({
			isLoading: cavos.isLoading,
			isAuthenticated: cavos.isAuthenticated,
			address: wallet?.address,
			email: cavos.user?.email,
			needsDeviceApproval,
			error: cavos.authError,
			signIn: cavos.openModal,
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
		[cavos, wallet, needsDeviceApproval, hasPasskey],
	)

	return <CavosContext value={value}>{children}</CavosContext>
}
