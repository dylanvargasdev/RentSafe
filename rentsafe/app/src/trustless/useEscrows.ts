import { useQuery } from "@tanstack/react-query"
import {
	type GetEscrowsFromIndexerResponse,
	type Role,
	useGetEscrowFromIndexerByContractIds,
	useGetEscrowsFromIndexerByRole,
	useGetEscrowsFromIndexerBySigner,
} from "@trustless-work/escrow"
import { isTrustlessWorkConfigured } from "./config"

export type Escrow = GetEscrowsFromIndexerResponse

/** Roles we look up to find "my escrows" (in addition to the ones I deployed). */
const LOOKUP_ROLES: Role[] = ["approver", "serviceProvider"]

/**
 * Every escrow where `address` is the deployer, approver or service provider,
 * from the Trustless Work indexer. Newest first. Refetch with
 * `queryClient.invalidateQueries({ queryKey: ["escrows"] })`.
 *
 * The API allows ~50 requests/minute per key, so keep refetching modest.
 */
export function useMyEscrows(address: string | undefined) {
	const { getEscrowsBySigner } = useGetEscrowsFromIndexerBySigner()
	const { getEscrowsByRole } = useGetEscrowsFromIndexerByRole()

	return useQuery({
		queryKey: ["escrows", "mine", address],
		enabled: Boolean(address) && isTrustlessWorkConfigured,
		staleTime: 15_000,
		queryFn: async () => {
			const lists = await Promise.all([
				getEscrowsBySigner({
					signer: address!,
					orderBy: "createdAt",
					orderDirection: "desc",
				}),
				...LOOKUP_ROLES.map((role) =>
					getEscrowsByRole({
						role,
						roleAddress: address!,
						orderBy: "createdAt",
						orderDirection: "desc",
					}),
				),
			])
			const byId = new Map<string, Escrow>()
			for (const e of lists.flat()) if (e.contractId) byId.set(e.contractId, e)
			return [...byId.values()].sort(
				(a, b) => (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0),
			)
		},
	})
}

/** One escrow by contract id (C...), validated against the chain. */
export function useEscrow(contractId: string | undefined) {
	const { getEscrowByContractIds } = useGetEscrowFromIndexerByContractIds()
	return useQuery({
		queryKey: ["escrows", "byId", contractId],
		enabled: Boolean(contractId) && isTrustlessWorkConfigured,
		queryFn: async () => {
			const [escrow] = await getEscrowByContractIds({
				contractIds: [contractId!],
				validateOnChain: true,
			})
			return escrow ?? null
		},
	})
}
