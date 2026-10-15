import { stellarNetwork } from "@stellar-scaffold/app-lib"
import * as clients from "@stellar-scaffold/app-lib/clients"

const network = stellarNetwork === "PUBLIC" ? "mainnet" : "testnet"

/**
 * Lists every contract Scaffold deployed + generated a client for (everything
 * exported by `@stellar-scaffold/app-lib/clients`), with links to inspect and
 * invoke them in Stellar Lab.
 */
export default function Debug() {
	const deployed = Object.entries(clients).flatMap(([name, client]) => {
		const contractId = (client as { options?: { contractId?: string } }).options
			?.contractId
		return contractId ? [{ name, contractId }] : []
	})

	return (
		<div className="debug">
			<h2>Contracts</h2>
			<p>
				Contracts deployed by <code>stellar scaffold watch</code> from{" "}
				<code>contracts/*</code> (see <code>environments.toml</code>). Import
				them in code with{" "}
				<code>
					{'import { name } from "@stellar-scaffold/app-lib/clients"'}
				</code>
				.
			</p>
			{deployed.length === 0 && (
				<p>
					Nothing deployed yet. Run <code>npm start</code> and wait for the
					&quot;stellar&quot; logs to finish.
				</p>
			)}
			<ul>
				{deployed.map(({ name, contractId }) => (
					<li key={name}>
						<strong>{name}</strong> <code>{contractId}</code>{" "}
						<a
							href={`https://lab.stellar.org/r/${network}/contract/${contractId}`}
							target="_blank"
							rel="noreferrer"
						>
							Invoke in Stellar Lab ↗
						</a>{" "}
						·{" "}
						<a
							href={`https://stellar.expert/explorer/${network}/contract/${contractId}`}
							target="_blank"
							rel="noreferrer"
						>
							Explorer ↗
						</a>
					</li>
				))}
			</ul>
		</div>
	)
}
