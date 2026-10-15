#!/usr/bin/env node
// `npm run tw:smoke`: end-to-end Trustless Work check on TESTNET, no browser needed.
//
// Uses the local deployer identity `me` (app/.config/stellar, created by `npm start`)
// for EVERY role, and signs with the Stellar CLI (the secret key never leaves the CLI):
//   trustline/USDC if needed → deploy multi-release escrow → fund → mark done → approve → release
//
// Also a reference for headless/backend usage of the REST API (build → sign → send).
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../app")
const env = Object.fromEntries(
	readFileSync(resolve(app, ".env"), "utf8")
		.split("\n")
		.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'#\n]*)["']?/))
		.filter(Boolean)
		.map((m) => [m[1], m[2].trim()]),
)
const API = "https://dev.api.trustlesswork.com"
const KEY = env.PUBLIC_TRUSTLESS_WORK_API_KEY
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const HORIZON = "https://horizon-testnet.stellar.org"

if (env.PUBLIC_STELLAR_NETWORK !== "TESTNET")
	throw new Error("tw:smoke only runs on TESTNET")
if (!KEY) {
	console.error(
		"Set PUBLIC_TRUSTLESS_WORK_API_KEY in app/.env first (https://dapp.trustlesswork.com)",
	)
	process.exit(1)
}

const sh = (cmd, input) =>
	execSync(cmd, { cwd: app, input, stdio: ["pipe", "pipe", "pipe"] })
		.toString()
		.trim()

const me = sh("stellar keys address me")
console.log(`Deployer / every role: ${me}`)

async function api(method, path, body) {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: { "content-type": "application/json", "x-api-key": KEY },
		body: body ? JSON.stringify(body) : undefined,
	})
	const json = await res.json().catch(() => ({}))
	if (!res.ok)
		throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`)
	return json
}

/** Build on the API → sign with the CLI → submit through the API. */
async function step(label, path, body, method = "POST") {
	process.stdout.write(`• ${label}… `)
	const { unsignedTransaction } = await api(method, path, body)
	const signed = sh(
		"stellar tx sign --sign-with-key me --network testnet",
		unsignedTransaction,
	)
	const res = await api("POST", "/helper/send-transaction", {
		signedXdr: signed,
	})
	if (res.status !== "SUCCESS")
		throw new Error(`${label}: ${JSON.stringify(res)}`)
	console.log("ok")
	return res
}

// 1. USDC trustline + balance for the deployer
const account = await (await fetch(`${HORIZON}/accounts/${me}`)).json()
const usdc = account.balances?.find(
	(b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
)
if (!usdc) {
	process.stdout.write("• Adding USDC trustline… ")
	sh(
		`stellar tx new change-trust --line USDC:${USDC_ISSUER} --source-account me --network testnet`,
	)
	console.log("ok")
}
if (!usdc || Number(usdc.balance) < 3) {
	process.stdout.write("• Swapping 20 XLM → USDC on the testnet DEX… ")
	sh(
		`stellar tx new path-payment-strict-send --send-asset native --send-amount 200000000 --destination ${me} --dest-asset USDC:${USDC_ISSUER} --dest-min 1 --source-account me --network testnet`,
	)
	console.log("ok")
}

// 2. Full multi-release lifecycle, one milestone of 2 USDC
const deployed = await step(
	"Deploy multi-release escrow",
	"/deployer/multi-release",
	{
		signer: me,
		engagementId: `smoke-${Date.now()}`,
		title: "tw:smoke test",
		description: "Automated end-to-end check from scaffold-stellar-agentic",
		roles: {
			approver: me,
			serviceProvider: me,
			releaseSigner: me,
			disputeResolver: me,
			platformAddress: me,
		},
		platformFee: 1,
		milestones: [{ description: "Smoke milestone", amount: 2, receiver: me }],
		trustline: { address: USDC_ISSUER, symbol: "USDC" },
	},
)
const contractId = deployed.contractId
console.log(`  contractId: ${contractId}`)

await step("Fund 2 USDC", "/escrow/multi-release/fund-escrow", {
	contractId,
	signer: me,
	amount: 2,
})
await step(
	"Mark milestone done",
	"/escrow/multi-release/change-milestone-status",
	{
		contractId,
		milestoneIndex: "0",
		newStatus: "completed",
		newEvidence: "https://example.com/evidence",
		serviceProvider: me,
	},
)
await step("Approve milestone", "/escrow/multi-release/approve-milestone", {
	contractId,
	milestoneIndex: "0",
	approver: me,
})
await step(
	"Release milestone",
	"/escrow/multi-release/release-milestone-funds",
	{
		contractId,
		milestoneIndex: "0",
		releaseSigner: me,
	},
)

const [escrow] = await api(
	"GET",
	`/helper/get-escrow-by-contract-ids?contractIds[]=${contractId}&validateOnChain=true`,
)
console.log(
	`  milestone flags: ${JSON.stringify(escrow?.milestones?.[0]?.flags)}`,
)
console.log(
	`\n✅ Trustless Work works end-to-end.\n   https://viewer.trustlesswork.com/testnet/v1/${contractId}\n`,
)
