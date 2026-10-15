import { shortAddress } from "@stellar-scaffold/app-lib"
import {
	type MultiReleaseMilestone,
	type SingleReleaseMilestone,
	type SingleReleaseResolveDisputePayload,
	useApproveMilestone,
	useChangeMilestoneStatus,
	useFundEscrow,
	useReleaseFunds,
	useResolveDispute,
	useStartDispute,
} from "@trustless-work/escrow"
import { useState } from "react"
import { ReputationPanel } from "../../components/ReputationPanel"
import { useWallet } from "../../hooks/useWallet"
import { escrowViewerUrl, explorerUrl } from "../config"
import styles from "../escrow.module.css"
import { type Escrow } from "../useEscrows"
import { useEscrowTx } from "../useEscrowTx"

type Distribution = SingleReleaseResolveDisputePayload["distributions"]

/**
 * One escrow + every action the connected wallet is allowed to take on it.
 * Buttons only appear for the role that can sign them — the contract would
 * reject anyone else anyway.
 */
export const EscrowCard = ({
	escrow,
	doneStatus = "completed",
	doneLabel = "Mark done",
	evidencePlaceholder = "Evidence (link, note…)",
}: {
	escrow: Escrow
	/** Status the service provider sets on a milestone, e.g. "shipped", "delivered". */
	doneStatus?: string
	/** Button label for that action, e.g. "Mark shipped". */
	doneLabel?: string
	/** Hint for the evidence field, e.g. "Tracking number". */
	evidencePlaceholder?: string
}) => {
	const { address } = useWallet()
	const { run, pending } = useEscrowTx()
	const { fundEscrow } = useFundEscrow()
	const { changeMilestoneStatus } = useChangeMilestoneStatus()
	const { approveMilestone } = useApproveMilestone()
	const { releaseFunds } = useReleaseFunds()
	const { startDispute } = useStartDispute()
	const { resolveDispute } = useResolveDispute()
	const [fundAmount, setFundAmount] = useState("")
	const [evidence, setEvidence] = useState("")
	const [providerShare, setProviderShare] = useState(50)

	const contractId = escrow.contractId!
	const { type, roles } = escrow
	const isMulti = type === "multi-release"
	const me = address ?? ""
	const is = (role: keyof typeof roles) => me !== "" && roles[role] === me
	const myRoles = Object.entries(roles)
		.filter(([, addr]) => addr === me)
		.map(([role]) => role)

	const singleFlags = escrow.flags ?? {}
	const milestones = escrow.milestones as (SingleReleaseMilestone &
		MultiReleaseMilestone)[]
	const total = isMulti
		? milestones.reduce((s, m) => s + Number(m.amount ?? 0), 0)
		: escrow.amount
	const balance = escrow.balance ?? 0
	const approved = (m: SingleReleaseMilestone & MultiReleaseMilestone) =>
		isMulti ? Boolean(m.flags?.approved) : Boolean(m.approved)
	const anyReleased = isMulti
		? milestones.some((m) => m.flags?.released)
		: Boolean(singleFlags.released)
	const receiverOf = (m: MultiReleaseMilestone) =>
		isMulti ? m.receiver : (roles as { receiver: string }).receiver

	/** Split `amount` between the provider/receiver and the approver (refund). */
	const split = (amount: number, receiver: string): Distribution => {
		const toProvider = Math.round(amount * providerShare) / 100
		const parts = [
			{ address: receiver, amount: toProvider },
			{
				address: roles.approver,
				amount: Math.round((amount - toProvider) * 100) / 100,
			},
		].filter((d) => d.amount > 0)
		if (receiver === roles.approver)
			return [{ address: receiver, amount }] as Distribution
		return parts as unknown as Distribution
	}

	const idx = (i: number) => String(i)

	return (
		<article className={`card ${styles.escrow}`}>
			<header className={styles.escrowHeader}>
				<div>
					<h3>{escrow.title}</h3>
					<p className={styles.muted}>{escrow.description}</p>
				</div>
				<div className={styles.amounts}>
					<strong>
						{balance} / {total} {escrow.trustline?.symbol ?? "USDC"}
					</strong>
					<span className={styles.muted}>funded</span>
				</div>
			</header>

			<p className={styles.meta}>
				<span className={styles.badge}>{type}</span>
				{singleFlags.disputed && (
					<span className={`${styles.badge} ${styles.warn}`}>disputed</span>
				)}
				{singleFlags.released && (
					<span className={`${styles.badge} ${styles.ok}`}>released</span>
				)}
				{singleFlags.resolved && <span className={styles.badge}>resolved</span>}
				<a href={escrowViewerUrl(contractId)} target="_blank" rel="noreferrer">
					{shortAddress(contractId)} ↗
				</a>
				<a href={explorerUrl(contractId)} target="_blank" rel="noreferrer">
					explorer ↗
				</a>
				{myRoles.length > 0 && (
					<span className={styles.muted}>you: {myRoles.join(", ")}</span>
				)}
			</p>

			{/* Funding: anyone can deposit */}
			<div className={styles.actions}>
				<input
					type="number"
					min="0"
					placeholder={`Amount (needed: ${Math.max(total - balance, 0)})`}
					value={fundAmount}
					onChange={(e) => setFundAmount(e.target.value)}
				/>
				<button
					disabled={!me || !!pending || !Number(fundAmount)}
					onClick={() =>
						void run("Fund escrow", () =>
							fundEscrow(
								{ contractId, amount: Number(fundAmount), signer: me },
								type,
							),
						).then(() => setFundAmount(""))
					}
				>
					Fund
				</button>
			</div>

			<ol className={styles.milestones}>
				{milestones.map((m, i) => {
					const flags = isMulti ? (m.flags ?? {}) : {}
					const done = approved(m)
					const disputed = isMulti ? flags.disputed : singleFlags.disputed
					const released = isMulti ? flags.released : singleFlags.released
					return (
						<li key={i}>
							<div className={styles.milestoneHead}>
								<span>
									{done ? "✅" : "⏳"} {m.description}
									{isMulti && <strong> · {m.amount} USDC</strong>}
								</span>
								<span className={styles.muted}>
									{m.status ?? "pending"}
									{m.evidence ? ` · ${m.evidence}` : ""}
									{released ? " · paid" : ""}
									{disputed ? " · disputed" : ""}
								</span>
							</div>
							<div className={styles.actions}>
								{is("serviceProvider") && !done && !released && (
									<>
										<input
											placeholder={evidencePlaceholder}
											value={evidence}
											onChange={(e) => setEvidence(e.target.value)}
										/>
										<button
											disabled={!!pending}
											onClick={() =>
												void run("Mark milestone done", () =>
													changeMilestoneStatus(
														{
															contractId,
															milestoneIndex: idx(i),
															newStatus: doneStatus,
															newEvidence: evidence || undefined,
															serviceProvider: me,
														},
														type,
													),
												)
											}
										>
											{doneLabel}
										</button>
									</>
								)}
								{is("approver") && !done && (
									<button
										disabled={!!pending}
										onClick={() =>
											void run("Approve milestone", () =>
												approveMilestone(
													{ contractId, milestoneIndex: idx(i), approver: me },
													type,
												),
											)
										}
									>
										Approve
									</button>
								)}
								{isMulti &&
									is("releaseSigner") &&
									done &&
									!released &&
									!disputed && (
										<button
											disabled={!!pending}
											onClick={() =>
												void run("Release milestone", () =>
													releaseFunds(
														{
															contractId,
															milestoneIndex: idx(i),
															releaseSigner: me,
														},
														type,
													),
												)
											}
										>
											Release {m.amount} USDC
										</button>
									)}
								{isMulti &&
									myRoles.length > 0 &&
									!is("disputeResolver") &&
									!released &&
									!disputed && (
										<button
											disabled={!!pending}
											onClick={() =>
												void run("Open dispute", () =>
													startDispute(
														{ contractId, milestoneIndex: idx(i), signer: me },
														type,
													),
												)
											}
										>
											Dispute
										</button>
									)}
								{isMulti &&
									is("disputeResolver") &&
									disputed &&
									!flags.resolved && (
										<ResolveControls
											share={providerShare}
											setShare={setProviderShare}
											disabled={!!pending}
											onResolve={() =>
												void run("Resolve dispute", () =>
													resolveDispute(
														{
															contractId,
															milestoneIndex: idx(i),
															disputeResolver: me,
															distributions: split(
																Number(m.amount),
																receiverOf(m),
															),
														},
														type,
													),
												)
											}
										/>
									)}
							</div>
						</li>
					)
				})}
			</ol>

			{/* Single-release: one payout / dispute for the whole escrow */}
			{!isMulti && (
				<div className={styles.actions}>
					{is("releaseSigner") &&
						milestones.every(approved) &&
						!singleFlags.released &&
						!singleFlags.disputed && (
							<button
								disabled={!!pending}
								onClick={() =>
									void run("Release funds", () =>
										releaseFunds({ contractId, releaseSigner: me }, type),
									)
								}
							>
								Release {escrow.amount} USDC
							</button>
						)}
					{myRoles.length > 0 &&
						!is("disputeResolver") &&
						!singleFlags.released &&
						!singleFlags.disputed && (
							<button
								disabled={!!pending}
								onClick={() =>
									void run("Open dispute", () =>
										startDispute({ contractId, signer: me }, type),
									)
								}
							>
								Dispute
							</button>
						)}
					{is("disputeResolver") &&
						singleFlags.disputed &&
						!singleFlags.resolved && (
							<ResolveControls
								share={providerShare}
								setShare={setProviderShare}
								disabled={!!pending}
								onResolve={() =>
									void run("Resolve dispute", () =>
										resolveDispute(
											{
												contractId,
												disputeResolver: me,
												distributions: split(
													balance,
													(roles as { receiver: string }).receiver,
												),
											},
											type,
										),
									)
								}
							/>
						)}
				</div>
			)}

			{pending && (
				<p className={styles.muted}>{pending}… confirm in your wallet</p>
			)}

			{/* Scaffold Stellar contract + Trustless Work escrow, together */}
			{anyReleased && (
				<ReputationPanel
					subject={is("approver") ? roles.serviceProvider : roles.approver}
					escrowId={contractId}
				/>
			)}
		</article>
	)
}

const ResolveControls = ({
	share,
	setShare,
	disabled,
	onResolve,
}: {
	share: number
	setShare: (n: number) => void
	disabled: boolean
	onResolve: () => void
}) => (
	<span className={styles.resolve}>
		<label>
			{share}% to provider · {100 - share}% refund
			<input
				type="range"
				min={0}
				max={100}
				step={5}
				value={share}
				onChange={(e) => setShare(Number(e.target.value))}
			/>
		</label>
		<button disabled={disabled} onClick={onResolve}>
			Resolve
		</button>
	</span>
)
