import {
	type EscrowType,
	type InitializeMultiReleaseEscrowPayload,
	type InitializeSingleReleaseEscrowPayload,
	useInitializeEscrow,
} from "@trustless-work/escrow"
import { useState } from "react"
import { useWallet } from "../../hooks/useWallet"
import { USDC } from "../config"
import styles from "../escrow.module.css"
import { useEscrowTx } from "../useEscrowTx"

type MilestoneDraft = { description: string; amount: string; receiver: string }

const ROLE_FIELDS = [
	["approver", "Approver — approves each milestone (the client)"],
	[
		"serviceProvider",
		"Service provider — does the work, marks milestones done",
	],
	["releaseSigner", "Release signer — releases the money"],
	["disputeResolver", "Dispute resolver — decides who gets paid in a dispute"],
	["platformAddress", "Platform — receives the platform fee"],
	["receiver", "Receiver — gets paid (single-release only)"],
] as const

type RoleKey = (typeof ROLE_FIELDS)[number][0]

/**
 * Deploys a new escrow contract through Trustless Work.
 * Multi-release = each milestone is paid separately (freelance, bounties, grants).
 * Single-release = one payout when every milestone is approved (purchases, deposits).
 */
export const CreateEscrowForm = ({
	onCreated,
}: {
	onCreated?: (contractId: string) => void
}) => {
	const { address } = useWallet()
	const { deployEscrow } = useInitializeEscrow()
	const { run, pending } = useEscrowTx()

	const [type, setType] = useState<EscrowType>("multi-release")
	const [title, setTitle] = useState("Landing page for my startup")
	const [description, setDescription] = useState(
		"Design + build, paid per milestone",
	)
	const [amount, setAmount] = useState("10") // single-release total
	const [platformFee, setPlatformFee] = useState("1")
	const [roles, setRoles] = useState<Partial<Record<RoleKey, string>>>({})
	const [milestones, setMilestones] = useState<MilestoneDraft[]>([
		{ description: "Wireframes", amount: "5", receiver: "" },
		{ description: "Final website", amount: "10", receiver: "" },
	])

	const me = address ?? ""
	const role = (k: RoleKey) => roles[k]?.trim() || me

	const setMilestone = (i: number, patch: Partial<MilestoneDraft>) =>
		setMilestones((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))

	const submit = async () => {
		if (!address) return
		const common = {
			signer: address,
			engagementId: `workshop-${Date.now()}`,
			title,
			description,
			platformFee: Number(platformFee),
			trustline: { address: USDC.address, symbol: USDC.symbol },
		}
		const baseRoles = {
			approver: role("approver"),
			serviceProvider: role("serviceProvider"),
			releaseSigner: role("releaseSigner"),
			disputeResolver: role("disputeResolver"),
			platformAddress: role("platformAddress"),
		}

		const payload =
			type === "multi-release"
				? ({
						...common,
						roles: baseRoles,
						milestones: milestones.map((m) => ({
							description: m.description,
							amount: Number(m.amount),
							receiver: m.receiver.trim() || baseRoles.serviceProvider,
						})),
					} satisfies InitializeMultiReleaseEscrowPayload)
				: ({
						...common,
						amount: Number(amount),
						roles: { ...baseRoles, receiver: role("receiver") },
						milestones: milestones.map((m) => ({ description: m.description })),
					} satisfies InitializeSingleReleaseEscrowPayload)

		const res = await run("Create escrow", () => deployEscrow(payload, type))
		if (res?.contractId) onCreated?.(res.contractId)
	}

	return (
		<div className="card">
			<h2>New escrow</h2>
			<div className={styles.form}>
				<label>
					Type
					<select
						value={type}
						onChange={(e) => setType(e.target.value as EscrowType)}
					>
						<option value="multi-release">
							Multi-release · pay per milestone
						</option>
						<option value="single-release">
							Single-release · one payout at the end
						</option>
					</select>
				</label>
				<label>
					Title
					<input value={title} onChange={(e) => setTitle(e.target.value)} />
				</label>
				<label>
					Description
					<input
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</label>
				{type === "single-release" && (
					<label>
						Total amount (USDC)
						<input
							type="number"
							min="0"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
					</label>
				)}

				<fieldset>
					<legend>Milestones</legend>
					{milestones.map((m, i) => (
						<div
							key={i}
							className={`${styles.milestoneRow} ${type === "multi-release" ? styles.withAmount : ""}`}
						>
							<input
								placeholder="What gets delivered"
								value={m.description}
								onChange={(e) =>
									setMilestone(i, { description: e.target.value })
								}
							/>
							{type === "multi-release" && (
								<>
									<input
										type="number"
										min="0"
										placeholder="USDC"
										value={m.amount}
										onChange={(e) =>
											setMilestone(i, { amount: e.target.value })
										}
									/>
								</>
							)}
							<button
								type="button"
								aria-label="Remove milestone"
								disabled={milestones.length === 1}
								onClick={() =>
									setMilestones((ms) => ms.filter((_, j) => j !== i))
								}
							>
								✕
							</button>
							{type === "multi-release" && (
								<input
									className={styles.receiver}
									placeholder="Receiver G… (default: service provider)"
									value={m.receiver}
									onChange={(e) =>
										setMilestone(i, { receiver: e.target.value })
									}
								/>
							)}
						</div>
					))}
					<button
						type="button"
						onClick={() =>
							setMilestones((ms) => [
								...ms,
								{ description: "", amount: "1", receiver: "" },
							])
						}
					>
						+ Milestone
					</button>
				</fieldset>

				<details>
					<summary>
						Roles (default: your wallet plays every role, great for testing
						alone)
					</summary>
					{ROLE_FIELDS.filter(
						([k]) => type === "single-release" || k !== "receiver",
					).map(([k, label]) => (
						<label key={k}>
							{label}
							<input
								placeholder={me || "G…"}
								value={roles[k] ?? ""}
								onChange={(e) =>
									setRoles((r) => ({ ...r, [k]: e.target.value }))
								}
							/>
						</label>
					))}
					<label>
						Platform fee (%)
						<input
							type="number"
							min="0"
							max="99"
							value={platformFee}
							onChange={(e) => setPlatformFee(e.target.value)}
						/>
					</label>
				</details>

				<button
					className={styles.primary}
					disabled={!address || !!pending}
					onClick={() => void submit()}
				>
					{pending ?? (address ? "Create escrow" : "Connect your wallet first")}
				</button>
			</div>
		</div>
	)
}
