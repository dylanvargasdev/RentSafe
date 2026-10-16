import { createContext, useContext } from "react"
import { type useChainSync } from "./useChainSync"

export type ChainSyncState = ReturnType<typeof useChainSync>

export const ChainSyncContext = createContext<ChainSyncState | undefined>(
	undefined,
)

/** Sync state shared by every page (the sync itself runs once, in the layout). */
export const useChainSyncState = () => useContext(ChainSyncContext)
