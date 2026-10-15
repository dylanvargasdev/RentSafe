// Runs before typecheck/build: the app imports the GENERATED contract clients
// (app-lib/clients, gitignored), which only exist after the first Scaffold build.
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
if (!existsSync(resolve(root, "app-lib/clients/index.ts"))) {
	console.error(
		[
			"",
			"Contract clients aren't generated yet (app-lib/clients/index.ts is missing),",
			"so TypeScript can't resolve '@stellar-scaffold/app-lib/clients' (TS2307).",
			"This is expected on a fresh clone. Generate them once (deploys to testnet):",
			"",
			"  npm run contracts:build     (or keep `npm start` running)",
			"",
		].join("\n"),
	)
	process.exit(1)
}
