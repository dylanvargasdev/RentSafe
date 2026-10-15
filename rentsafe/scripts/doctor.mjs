#!/usr/bin/env node
// `npm run doctor`: checks everything this workshop needs and says how to fix it.
import { execSync } from "node:child_process"
import net from "node:net"
import { copyFileSync, existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const app = resolve(root, "app")
let failed = false

const ok = (msg) => console.log(`✅ ${msg}`)
const warn = (msg, fix) =>
	console.log(`⚠️  ${msg}${fix ? `\n    → ${fix}` : ""}`)
const fail = (msg, fix) => {
	failed = true
	console.log(`❌ ${msg}${fix ? `\n    → ${fix}` : ""}`)
}
const run = (cmd, opts = {}) => {
	try {
		return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], ...opts })
			.toString()
			.trim()
	} catch {
		return null
	}
}

console.log("\nScaffold Stellar × Trustless Work: doctor\n")

// ── Tools ───────────────────────────────────────────────────────────────────
const nodeMajor = Number(process.versions.node.split(".")[0])
nodeMajor >= 22
	? ok(`Node ${process.versions.node}`)
	: fail(`Node ${process.versions.node} (need 22+)`, "https://nodejs.org")

const stellar = run("stellar --version")
stellar
	? ok(stellar.split("\n")[0])
	: fail(
			"Stellar CLI not found",
			"npm run setup:tools  (or: brew install stellar-cli)",
		)

const scaffold = run("stellar scaffold --version")
scaffold
	? ok(scaffold.split("\n")[0])
	: fail(
			"Scaffold plugin not found",
			"npm run setup:tools  (or: cargo install --locked stellar-scaffold-cli)",
		)

const cargo = run("cargo --version")
cargo ? ok(cargo) : fail("Rust/cargo not found", "https://rustup.rs")

if (run("rustup --version")) {
	const targets = run("rustup target list --installed", { cwd: root }) ?? ""
	targets.includes("wasm32v1-none")
		? ok("Rust target wasm32v1-none")
		: warn(
				"Rust target wasm32v1-none not installed yet",
				"rustup target add wasm32v1-none  (rustup also installs it from rust-toolchain.toml on first build)",
			)
} else if (cargo) {
	warn(
		"rustup not found: make sure your Rust has the wasm32v1-none target and a wasm linker (lld)",
	)
}

// ── app/.env ────────────────────────────────────────────────────────────────
const envFile = resolve(app, ".env")
if (!existsSync(envFile)) {
	copyFileSync(resolve(app, ".env.example"), envFile)
	ok("Created app/.env from app/.env.example")
}
const env = Object.fromEntries(
	readFileSync(envFile, "utf8")
		.split("\n")
		.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'#\n]*)["']?/))
		.filter(Boolean)
		.map((m) => [m[1], m[2].trim()]),
)
const network = env.PUBLIC_STELLAR_NETWORK
;["TESTNET", "PUBLIC", "FUTURENET", "LOCAL"].includes(network)
	? ok(`app/.env network: ${network}`)
	: fail(
			`app/.env PUBLIC_STELLAR_NETWORK="${network}" is invalid`,
			'use "TESTNET"',
		)
if (network === "PUBLIC") warn("You are on MAINNET (real money)")

// ── Network reachability ────────────────────────────────────────────────────
const rpcUrl = env.PUBLIC_STELLAR_RPC_URL
try {
	const r = await fetch(rpcUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
	})
	const j = await r.json()
	j.result?.status === "healthy"
		? ok(`RPC ${rpcUrl} healthy`)
		: warn(`RPC ${rpcUrl} answered: ${JSON.stringify(j).slice(0, 120)}`)
} catch (e) {
	fail(`Can't reach RPC ${rpcUrl}: ${e.message}`, "check your internet / proxy")
}

// ── Trustless Work ──────────────────────────────────────────────────────────
const twKey = env.PUBLIC_TRUSTLESS_WORK_API_KEY
const twUrl =
	network === "PUBLIC"
		? "https://api.trustlesswork.com"
		: "https://dev.api.trustlesswork.com"
if (!twKey) {
	warn(
		"No Trustless Work API key (only needed if your app uses escrows)",
		"https://dapp.trustlesswork.com → connect wallet → Settings (fill 'Use case') → API Keys → Testnet → put it in app/.env as PUBLIC_TRUSTLESS_WORK_API_KEY",
	)
} else {
	try {
		const r = await fetch(
			`${twUrl}/helper/get-escrows-by-signer?signer=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`,
			{ headers: { "x-api-key": twKey } },
		)
		r.ok
			? ok(`Trustless Work API key works (${twUrl})`)
			: r.status === 401
				? fail(
						"Trustless Work API key rejected (401)",
						"copy it again from https://dapp.trustlesswork.com (Testnet tab)",
					)
				: warn(`Trustless Work API answered ${r.status}`)
	} catch (e) {
		fail(`Can't reach ${twUrl}: ${e.message}`)
	}
}

// ── Cavos (optional) ────────────────────────────────────────────────────────
if (env.PUBLIC_CAVOS_APP_ID) {
	;["TESTNET", "PUBLIC"].includes(network)
		? ok(
				`Cavos App ID set (${env.PUBLIC_CAVOS_ENVIRONMENT || "development"}): email/Google sign-in enabled. Make sure http://localhost:5173 is an allowed web origin in the Cavos dashboard`,
			)
		: warn(
				"Cavos only works on TESTNET or PUBLIC; it's disabled on this network",
			)
} else {
	warn(
		"No Cavos App ID (optional): users must connect a wallet extension",
		"for email/Google sign-in without a wallet: https://cavos.xyz/dashboard → create app → PUBLIC_CAVOS_APP_ID in app/.env",
	)
}

// ── Port ────────────────────────────────────────────────────────────────────
const probe = (host) =>
	new Promise((done) => {
		const sock = net.connect({ port: 5173, host })
		sock.once("connect", () => {
			sock.destroy()
			done(true)
		})
		sock.once("error", () => done(false))
		sock.setTimeout(800, () => {
			sock.destroy()
			done(false)
		})
	})
// Vite binds "localhost", which is ::1 on macOS and 127.0.0.1 elsewhere.
const portInUse = (await probe("127.0.0.1")) || (await probe("::1"))
portInUse
	? warn(
			"Port 5173 is already in use (another dev server?)",
			"npm start needs exactly http://localhost:5173 (Cavos allows only registered origins). Stop the other server first, unless it is this project already running",
		)
	: ok("Port 5173 is free for npm start")

// ── Project state ───────────────────────────────────────────────────────────
existsSync(resolve(app, ".config/stellar/identity/me.toml"))
	? ok("Deployer identity `me` exists (app/.config/stellar)")
	: warn(
			"Deployer identity not created yet",
			"it's created + funded automatically on the first `npm start`",
		)
existsSync(resolve(root, "app-lib/clients/index.ts"))
	? ok("Contract clients generated (app-lib/clients)")
	: warn(
			"Contract clients not generated yet",
			"run `npm start` (or `npm run contracts:build`) and wait for the stellar logs",
		)

const skills = run("node scripts/agents-sync.mjs --check", { cwd: root })
skills !== null
	? ok("Agent skills mirrors in sync (.agents/skills → .claude/skills)")
	: warn("Agent skill mirrors out of sync", "npm run agents:sync")

console.log(
	failed
		? "\nFix the ❌ items above, then run `npm run doctor` again.\n"
		: "\nReady to `npm start` (http://localhost:5173) 🚀  ⚠️ items are optional or get created on the first start.\n",
)
process.exit(failed ? 1 : 0)
