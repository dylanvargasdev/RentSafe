#!/usr/bin/env node
// `npm run contracts:build`: one-off `stellar scaffold build --build-clients`
// (build → deploy to testnet → generate TS clients), run from app/ so its .env
// applies. Scaffold exits 0 even when a client fails to generate, so this
// wrapper scans the output and exits 1 in that case, with a hint.
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../app")
const child = spawn("stellar", ["scaffold", "build", "--build-clients"], {
	cwd: app,
	stdio: ["inherit", "pipe", "pipe"],
})

const failures = []
const scan = (chunk, out) => {
	out.write(chunk)
	for (const line of chunk.toString().split("\n")) {
		if (/❌|Failed to generate client/.test(line)) failures.push(line.trim())
	}
}
child.stdout.on("data", (c) => scan(c, process.stdout))
child.stderr.on("data", (c) => scan(c, process.stderr))

child.on("close", (code) => {
	if (code !== 0) process.exit(code ?? 1)
	if (failures.length) {
		console.error(
			[
				"",
				"contracts:build finished, but some steps failed:",
				...failures.map((f) => `  ${f}`),
				"",
				"Hints: a contract function argument named `options` breaks the generated",
				"client (TS2300 Duplicate identifier); constructor_args must match the Rust",
				"parameter names; see .agents/skills/scaffold-stellar/references/troubleshooting.md",
				"",
			].join("\n"),
		)
		process.exit(1)
	}
})
