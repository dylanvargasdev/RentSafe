import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@stellar-scaffold/app-lib/styles.css"
import "./rentsafe/styles/base.css"
import "./rentsafe/styles/layout.css"
import App from "./App.tsx"
import { CavosRoot } from "./cavos/CavosRoot.tsx"
import { NotificationProvider } from "./providers/NotificationProvider.tsx"
import { WalletProvider } from "./providers/WalletProvider.tsx"
import { TrustlessWorkProvider } from "./trustless/TrustlessWorkProvider.tsx"

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
		},
	},
})

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<NotificationProvider>
			{/* Trustless Work escrow API client for the SDK hooks (src/trustless) */}
			<TrustlessWorkProvider>
				<QueryClientProvider client={queryClient}>
					{/* Cavos embedded wallets (email/Google login), optional: src/cavos */}
					<CavosRoot>
						<WalletProvider>
							<BrowserRouter>
								<App />
							</BrowserRouter>
						</WalletProvider>
					</CavosRoot>
				</QueryClientProvider>
			</TrustlessWorkProvider>
		</NotificationProvider>
	</StrictMode>,
)
