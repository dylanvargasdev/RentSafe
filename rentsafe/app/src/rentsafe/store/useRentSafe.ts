import { useSyncExternalStore } from "react"
import { ME } from "../data/seed"
import { type State, store } from "./store"

export { actions, meAsOwner, ownerById } from "./store"
export { ME }

/** Subscribe to the whole RentSafe state (small, so selecting is cheap). */
export function useRentSafe(): State {
	return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/** The signed-in account, or undefined. */
export function useSession() {
	const s = useRentSafe()
	return s.loggedIn ? s.account : undefined
}
