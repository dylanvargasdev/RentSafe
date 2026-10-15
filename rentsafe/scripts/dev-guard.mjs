// Runs as the root `prestart` hook (before `npm start`):
//   1. Verify the Stellar CLI + Scaffold plugin are installed (fatal if not).
//   2. Create app/.env from app/.env.example on first run.
//   3. Warn (non-fatal) if the Trustless Work API key is missing.
// For a full diagnosis run `npm run doctor`.
import { execSync } from "node:child_process"
import { copyFileSync, existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envFile = resolve(root, "app/.env")
const envExample = resolve(root, "app/.env.example")

const TOOLS = [
	{
		name: "Stellar CLI",
		check: "stellar --version",
		install:
			"brew install stellar-cli   (or: cargo install --locked stellar-cli)",
	},
	{
		name: "Stellar Scaffold CLI plugin",
		check: "stellar scaffold --version",
		install:
			"cargo binstall stellar-scaffold-cli   (or: cargo install --locked stellar-scaffold-cli)",
	},
]

const has = (cmd) => {
	try {
		execSync(cmd, { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

const missing = TOOLS.filter((t) => !has(t.check))
if (missing.length) {
	console.error(
		[
			"",
			"Cannot start: install the required Stellar tools first:",
			...missing.map((t) => `  - ${t.name}\n      ${t.install}`),
			"",
			"Fastest: `npm run setup:tools` (downloads prebuilt binaries).",
			"Then run `npm run doctor` to check everything else.",
			"",
		].join("\n"),
	)
	process.exit(1)
}

if (!existsSync(envFile)) {
	copyFileSync(envExample, envFile)
	console.log("Created app/.env from app/.env.example (testnet).")
}

const env = readFileSync(envFile, "utf8")
if (!/^PUBLIC_TRUSTLESS_WORK_API_KEY=["']?[^"'\s#]+/m.test(env)) {
	console.warn(
		"\nℹ️  No Trustless Work API key: only needed if your app uses escrows.\n" +
			"   Add PUBLIC_TRUSTLESS_WORK_API_KEY to app/.env (https://dapp.trustlesswork.com)\n",
	)
}
