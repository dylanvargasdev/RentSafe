import { Link } from "react-router-dom"
import { ReputationPanel } from "../components/ReputationPanel"
import { useWallet } from "../hooks/useWallet"
import styles from "./Home.module.css"

const PROMPTS = [
	"Build a voting app for my community: anyone creates a poll, each person votes once, live results. No escrows needed.",
	"Build a freelance gig board: clients post a job, a freelancer accepts it, and the payment goes into a multi-release escrow per milestone.",
	"Make a rental deposit app: the tenant funds a single-release escrow, and the landlord approves the refund at the end of the lease.",
	"Create a hackathon bounty page: each bounty is a milestone with its own receiver, and judges approve and release prizes.",
	"Add a Soroban contract that lists public profiles (name, skills, links) and show each profile's reputation score next to escrows.",
]

const Home = () => {
	const { address } = useWallet()

	return (
		<div className={styles.Home}>
			<section>
				<h1>Prompt your dApp into existence ✨</h1>
				<p>
					This starter is built on <strong>Scaffold Stellar</strong> (Soroban
					smart contracts + a React app that auto-generates typed clients for
					them) wired up with <strong>Trustless Work</strong> escrows,{" "}
					<strong>Cavos</strong> wallets (sign in with email, no extension) and
					a set of <strong>agent skills</strong> so any coding agent (Claude
					Code, Codex, Cursor, OpenCode, Copilot, Gemini…) knows how to build on
					it.
				</p>
			</section>

			<section className={styles.cards}>
				<div className="card">
					<h2>1 · Sign in without a wallet</h2>
					<p>
						With <strong>Cavos</strong>, people sign in with their email or
						Google and get their own Stellar account: no extension, no seed
						phrase. Prefer Freighter? &quot;Use a wallet&quot; still works.
					</p>
				</div>
				<div className="card">
					<h2>2 · Escrows</h2>
					<p>
						Lock USDC in a contract and release it per milestone. Create, fund,
						approve, release and dispute in the{" "}
						<Link to="/escrows">Escrow Studio</Link>.
					</p>
				</div>
				<div className="card">
					<h2>3 · Your own contract</h2>
					<p>
						<code>contracts/reputation</code> is a Soroban contract deployed by
						Scaffold on every save. Try it in the{" "}
						<Link to="/debug">Contracts</Link> page or leave a review after an
						escrow is released.
					</p>
				</div>
				<div className="card">
					<h2>4 · Your agent</h2>
					<p>
						Open this repo in your coding agent and describe your idea. It reads{" "}
						<code>AGENTS.md</code> and the skills in <code>.agents/skills</code>{" "}
						to build it.
					</p>
				</div>
			</section>

			<section className="card">
				<h2>Prompts to try</h2>
				<ul className={styles.prompts}>
					{PROMPTS.map((p) => (
						<li key={p}>
							<code>{p}</code>
						</li>
					))}
				</ul>
				<p>
					Or start with <code>/build-dapp</code> (Claude Code, Cursor) or{" "}
					<code>$build-dapp</code> (Codex) and let the agent interview you.
				</p>
			</section>

			{address && (
				<section className="card">
					<h2>Your on-chain reputation</h2>
					<p>
						Read live from <code>contracts/reputation</code> through the
						generated client <code>@stellar-scaffold/app-lib/clients</code>.
					</p>
					<ReputationPanel subject={address} />
				</section>
			)}
		</div>
	)
}

export default Home
