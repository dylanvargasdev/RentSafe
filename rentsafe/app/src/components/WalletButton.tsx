import {
	connectWallet,
	profileModal,
	shortAddress,
} from "@stellar-scaffold/app-lib"
import { useCavosState } from "../cavos/context"
import { useWallet } from "../hooks/useWallet"

export const WalletButton = () => {
	const { address, connector, isPending, balances, disconnect } = useWallet()
	const cavos = useCavosState()

	// Signed in with Cavos on a browser that doesn't hold the wallet key yet.
	if (!address && cavos?.needsDeviceApproval) {
		return (
			<div className="wallet-connected">
				<button onClick={() => void cavos.approveDevice()}>
					Unlock wallet with passkey
				</button>
				<button onClick={cavos.signOut}>Sign out</button>
			</div>
		)
	}

	if (!address) {
		if (!cavos) {
			return (
				<button onClick={() => void connectWallet()} disabled={isPending}>
					{isPending ? "Loading..." : "Connect"}
				</button>
			)
		}
		return (
			<div className="wallet-connected">
				<button
					className="wallet-primary"
					onClick={cavos.signIn}
					disabled={cavos.isLoading}
					title="Email or Google: creates a Stellar wallet for you, no extension needed (Cavos)"
				>
					{cavos.isLoading ? "Signing in..." : "Sign in"}
				</button>
				<button
					onClick={() => void connectWallet()}
					title="Freighter, xBull, Lobstr… (Stellar Wallets Kit)"
				>
					Use a wallet
				</button>
			</div>
		)
	}

	return (
		<div className="wallet-connected" style={{ opacity: isPending ? 0.6 : 1 }}>
			<span className="wallet-balance">
				{balances?.xlm?.balance ?? "-"} XLM
			</span>

			{connector === "cavos" ? (
				<>
					<span className="wallet-balance" title={address}>
						{cavos?.email ?? shortAddress(address)}
					</span>
					<button
						className="wallet-profile"
						title="Copy address"
						onClick={() => void navigator.clipboard.writeText(address)}
					>
						{shortAddress(address)}
					</button>
					<button onClick={() => void disconnect()}>Sign out</button>
				</>
			) : (
				<button className="wallet-profile" onClick={() => void profileModal()}>
					{shortAddress(address)}
				</button>
			)}
		</div>
	)
}
