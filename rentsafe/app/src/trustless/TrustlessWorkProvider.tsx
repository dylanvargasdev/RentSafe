import { TrustlessWorkConfig } from "@trustless-work/escrow"
import { type ReactNode } from "react"
import { trustlessWorkApiKey, trustlessWorkApiUrl } from "./config"

/**
 * Makes the Trustless Work SDK hooks (useInitializeEscrow, useFundEscrow, …)
 * available to the whole app. The SDK creates one API client (sends the key as
 * the `x-api-key` header) when this mounts, so changing the key needs a reload.
 */
export const TrustlessWorkProvider = ({
	children,
}: {
	children: ReactNode
}) => (
	<TrustlessWorkConfig
		baseURL={trustlessWorkApiUrl}
		apiKey={trustlessWorkApiKey}
	>
		{children}
	</TrustlessWorkConfig>
)
