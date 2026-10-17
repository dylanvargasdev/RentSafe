import { createContext, use } from "react"

/** Same shape as the Stellar Wallets Kit signer, so every flow can use either. */
export type SignTransactionFn = (
	xdr: string,
	opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>

/**
 * The parts of a Cavos session the rest of the app needs, independent of the
 * Cavos SDK. Provided by CavosRoot; `null` when Cavos isn't configured.
 */
export interface CavosState {
	isLoading: boolean
	isAuthenticated: boolean
	/** Stellar `G…` address of the embedded wallet (known before it exists on-chain). */
	address?: string
	email?: string
	/** Signed in on a browser that doesn't hold the wallet key yet. */
	needsDeviceApproval: boolean
	/**
	 * The session was restored from storage without its login token. Cavos keeps
	 * that token per tab (sessionStorage), so a new tab or a browser restart
	 * reconnects "blind": the wallet registry can't be read and the wallet looks
	 * locked. Unlocking can't fix it; logging in again does.
	 */
	sessionExpired: boolean
	/** A passkey exists for this wallet, so `approveDevice` can unlock it here. */
	hasPasskey: boolean
	error: string | null
	/** Opens the Cavos login modal (email code / Google). */
	signIn: () => void
	/** Logs out and opens the login modal again, to get a fresh login token. */
	signInAgain: () => void
	signOut: () => void
	/** Unlock the wallet on this device with a passkey added earlier. */
	approveDevice: () => Promise<void>
	/** Add a passkey so the wallet can be opened on other devices (optional). */
	addPasskey?: () => Promise<void>
	/** Signs any Stellar/Soroban transaction XDR with the embedded wallet. */
	signTransaction?: SignTransactionFn
}

export const CavosContext = createContext<CavosState | null>(null)

/** Cavos session state, or `null` when Cavos isn't configured for this app. */
export const useCavosState = () => use(CavosContext)
