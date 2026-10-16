import {
	disconnectWallet,
	fetchBalances,
	type MappedBalances,
	networkPassphrase as appNetworkPassphrase,
	onWalletChange,
	signTransaction as extensionSignTransaction,
} from "@stellar-scaffold/app-lib"
import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { type SignTransactionFn, useCavosState } from "../cavos/context"

/**
 * A good-enough implementation of deepEqual.
 *
 * Used in this file to compare MappedBalances.
 *
 * Should maybe add & use a new dependency instead, if needed elsewhere.
 */
function deepEqual<T>(a: T, b: T): boolean {
	if (a === b) {
		return true
	}

	const bothAreObjects =
		a && b && typeof a === "object" && typeof b === "object"

	return Boolean(
		bothAreObjects &&
		Object.keys(a).length === Object.keys(b).length &&
		Object.entries(a).every(([k, v]) => deepEqual(v, b[k as keyof T])),
	)
}

/**
 * How the user is connected:
 * - "cavos": embedded wallet via email/Google login (no extension needed)
 * - "extension": a browser/mobile wallet via Stellar Wallets Kit (Freighter…)
 */
export type WalletConnector = "cavos" | "extension"

export interface WalletContextType {
	address?: string
	connector?: WalletConnector
	balances: MappedBalances
	isPending: boolean
	networkPassphrase?: string
	/** Works the same for both connectors: pass it to generated clients' signAndSend. */
	signTransaction: SignTransactionFn
	updateBalances: () => Promise<void>
	disconnect: () => Promise<void>
}

export const WalletContext = createContext<WalletContextType>({
	isPending: true,
	balances: {},
	updateBalances: async () => {},
	disconnect: async () => {},
	signTransaction: extensionSignTransaction,
})

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
	const cavos = useCavosState()
	const [balances, setBalances] = useState<MappedBalances>({})
	const [extensionAddress, setExtensionAddress] = useState<string>()
	const [extensionPassphrase, setExtensionPassphrase] = useState<string>()
	const [isPending, setIsPending] = useState(true)

	// A signed-in Cavos wallet that can sign on this device wins over an extension.
	const cavosSign = cavos?.signTransaction
	const cavosActive = Boolean(
		cavos?.address && cavosSign && !cavos.needsDeviceApproval,
	)
	const connector: WalletConnector | undefined = cavosActive
		? "cavos"
		: extensionAddress
			? "extension"
			: undefined
	const address = cavosActive ? cavos?.address : extensionAddress
	// Cavos signs for the app's network, so it can't be on the wrong one.
	const networkPassphrase = cavosActive
		? appNetworkPassphrase
		: extensionPassphrase
	const signTransaction: SignTransactionFn =
		cavosActive && cavosSign ? cavosSign : extensionSignTransaction

	const updateBalances = useCallback(async () => {
		if (!address) {
			setBalances({})
			return
		}

		const newBalances = await fetchBalances(address)
		setBalances((prev) => {
			if (deepEqual(newBalances, prev)) return prev
			return newBalances
		})
	}, [address])

	// Refetch on address change (via `updateBalances`' identity) and on network
	// change — the same address holds different balances per network.
	useEffect(() => {
		void updateBalances()
	}, [updateBalances, networkPassphrase])

	// Subscribe to the extension wallet. Gets values immediately and on every
	// subsequent change: connect, disconnect, and the wallet switching networks.
	useEffect(() => {
		return onWalletChange((state) => {
			setExtensionAddress(state.address)
			setExtensionPassphrase(state.networkPassphrase)
			setIsPending(false)
		})
	}, [])

	const disconnect = useCallback(async () => {
		if (connector === "cavos") cavos?.signOut()
		else if (connector === "extension") await disconnectWallet()
	}, [connector, cavos])

	const contextValue = useMemo(
		() => ({
			address,
			connector,
			networkPassphrase,
			balances,
			updateBalances,
			isPending: isPending || Boolean(cavos?.isLoading),
			signTransaction,
			disconnect,
		}),
		[
			address,
			connector,
			networkPassphrase,
			balances,
			updateBalances,
			isPending,
			cavos?.isLoading,
			signTransaction,
			disconnect,
		],
	)

	return <WalletContext value={contextValue}>{children}</WalletContext>
}
