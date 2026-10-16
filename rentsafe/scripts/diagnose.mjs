#!/usr/bin/env node
// `npm run diagnose`: runs every setup/verification step in order and writes
// everything to diagnostico.log (repo root), continuing after failures, so the
// whole picture can be reviewed in one go.
import { spawnSync } from "node:child_process"
import { appendFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const log = join(root, "diagnostico.log")
const npm = process.platform === "win32" ? "npm.cmd" : "npm"
const write = (s) => {
	appendFileSync(log, s)
	process.stdout.write(s)
}

const steps = [
	["Versiones", "node", ["-v"]],
	["npm", npm, ["-v"]],
	["cargo", "cargo", ["--version"]],
	["stellar", "stellar", ["--version"]],
	["Dependencias (npm install)", npm, ["install"]],
	["Tests de contratos", npm, ["run", "contracts:test"]],
	["Formato Rust", npm, ["run", "fmt:check"]],
	["Compilar y desplegar contratos", npm, ["run", "contracts:build"]],
	["Typecheck", npm, ["run", "typecheck"]],
	["Lint", npm, ["run", "lint"]],
	["Formato", npm, ["run", "format:check"]],
	[
		"Integración con el escrow de Trustless Work",
		npm,
		["run", "contracts:e2e"],
	],
]

writeFileSync(log, `RentSafe · diagnóstico ${new Date().toISOString()}\n`)
const summary = []
for (const [name, cmd, args] of steps) {
	write(`\n\n===== ${name}: ${cmd} ${args.join(" ")} =====\n`)
	const r = spawnSync(cmd, args, {
		cwd: root,
		encoding: "utf8",
		shell: process.platform === "win32",
		maxBuffer: 64 * 1024 * 1024,
	})
	write(r.stdout ?? "")
	write(r.stderr ?? "")
	if (r.error) write(`\n[error] ${r.error.message}\n`)
	const ok = r.status === 0
	summary.push(`${ok ? "OK   " : "FALLA"}  ${name} (código ${r.status})`)
}
write(`\n\n===== RESUMEN =====\n${summary.join("\n")}\n`)
