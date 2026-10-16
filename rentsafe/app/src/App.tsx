import { useEffect } from "react"
import { Outlet, Route, Routes, useLocation } from "react-router-dom"
import { ChainSyncContext } from "./rentsafe/chain/syncContext"
import { useChainSync } from "./rentsafe/chain/useChainSync"
import { Footer } from "./rentsafe/components/Footer"
import { Header } from "./rentsafe/components/Header"
import {
	AuthPage,
	FavoritesPage,
	RequireAuth,
	TripsPage,
} from "./rentsafe/pages/AccountPages"
import { ArbiterPage } from "./rentsafe/pages/ArbiterPage"
import { BookingPage } from "./rentsafe/pages/BookingPage"
import { HomePage } from "./rentsafe/pages/HomePage"
import {
	HowItWorksPage,
	LegalPage,
	NotFoundPage,
} from "./rentsafe/pages/InfoPages"
import { ListingFormPage } from "./rentsafe/pages/ListingFormPage"
import { ListingPage } from "./rentsafe/pages/ListingPage"
import { OwnerDashboard } from "./rentsafe/pages/OwnerDashboard"
import { ProfilePage } from "./rentsafe/pages/ProfilePage"
import { SearchPage } from "./rentsafe/pages/SearchPage"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<HomePage />} />
				<Route path="/buscar" element={<SearchPage />} />
				<Route path="/c/:category" element={<SearchPage />} />
				<Route path="/bien/:id" element={<ListingPage />} />
				<Route path="/entrar" element={<AuthPage />} />
				<Route path="/favoritos" element={<FavoritesPage />} />
				<Route path="/como-funciona" element={<HowItWorksPage />} />
				<Route path="/legal/:doc" element={<LegalPage />} />
				<Route
					path="/reservas"
					element={
						<RequireAuth>
							<TripsPage />
						</RequireAuth>
					}
				/>
				<Route
					path="/reservas/:id"
					element={
						<RequireAuth>
							<BookingPage />
						</RequireAuth>
					}
				/>
				<Route
					path="/arbitro"
					element={
						<RequireAuth>
							<ArbiterPage />
						</RequireAuth>
					}
				/>
				<Route
					path="/perfil"
					element={
						<RequireAuth>
							<ProfilePage />
						</RequireAuth>
					}
				/>
				<Route
					path="/propietario"
					element={
						<RequireAuth>
							<OwnerDashboard />
						</RequireAuth>
					}
				/>
				<Route
					path="/propietario/publicar"
					element={
						<RequireAuth>
							<ListingFormPage />
						</RequireAuth>
					}
				/>
				<Route
					path="/propietario/editar/:id"
					element={
						<RequireAuth>
							<ListingFormPage />
						</RequireAuth>
					}
				/>
				{/* Starter tools, kept for developers (not in the main navigation) */}
				<Route path="*" element={<NotFoundPage />} />
			</Route>
		</Routes>
	)
}

const ScrollToTop = () => {
	const { pathname } = useLocation()
	useEffect(() => {
		window.scrollTo(0, 0)
	}, [pathname])
	return null
}

const AppLayout = () => {
	// On-chain bookings are read back from Stellar for the connected wallet.
	const sync = useChainSync()
	return (
		<ChainSyncContext.Provider value={sync}>
			<Shell />
		</ChainSyncContext.Provider>
	)
}

const Shell = () => (
	<div className="rs-app">
		<a href="#contenido" className="rs-skip">
			Saltar al contenido
		</a>
		<ScrollToTop />
		<div className="rs-demo-bar" role="note">
			Prototipo en Stellar testnet: los datos marcados como demostración son
			ficticios y ningún pago usa dinero real.
		</div>
		<Header />
		<main id="contenido" className="rs-main">
			<Outlet />
		</main>
		<Footer />
	</div>
)

export default App
