#!/usr/bin/env node
// Keeps agent skills in sync across coding-agent harnesses.
//
// Source of truth: .agents/skills/<name>/SKILL.md  (open Agent Skills standard,
// read natively by Codex, Cursor, GitHub Copilot, Gemini/Antigravity, OpenCode…)
//
// Mirrors: harnesses that DON'T read .agents/skills get a per-skill symlink
// (or a real copy on Windows / with --copy). By default: .claude/skills (Claude Code).
//
//   node scripts/agents-sync.mjs                 # create/repair mirrors
//   node scripts/agents-sync.mjs --copy          # copy instead of symlink
//   node scripts/agents-sync.mjs --check         # exit 1 if mirrors are out of sync
//   node scripts/agents-sync.mjs --target .pi/skills --target .other/skills
//
// Runs automatically on `npm install` (postinstall) so a Windows checkout, where
// git turns symlinks into small text files, gets repaired into real copies.
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE = join(root, ".agents", "skills")
const MARKER = ".synced-from-agents-skills"

const args = process.argv.slice(2)
const check = args.includes("--check")
const forceCopy = args.includes("--copy") || process.platform === "win32"
const targets = args.flatMap((a, i) => (args[i - 1] === "--target" ? [a] : []))
if (targets.length === 0) targets.push(".claude/skills")

if (!existsSync(SOURCE)) {
	console.error(`No skills found at ${relative(root, SOURCE)}`)
	process.exit(check ? 1 : 0)
}

const skills = readdirSync(SOURCE, { withFileTypes: true })
	.filter(
		(d) => d.isDirectory() && existsSync(join(SOURCE, d.name, "SKILL.md")),
	)
	.map((d) => d.name)

const problems = []

for (const target of targets) {
	const targetDir = join(root, target)
	if (!check) mkdirSync(targetDir, { recursive: true })

	for (const name of skills) {
		const dest = join(targetDir, name)
		const linkTarget = relative(targetDir, join(SOURCE, name))
		const state = inspect(dest, linkTarget)
		if (state === "ok") continue
		if (check) {
			problems.push(`${relative(root, dest)}: ${state}`)
			continue
		}
		rmSync(dest, { recursive: true, force: true })
		if (forceCopy || !trySymlink(linkTarget, dest)) {
			cpSync(join(SOURCE, name), dest, { recursive: true })
			writeFileSync(
				join(dest, MARKER),
				"Generated copy. Edit .agents/skills instead.\n",
			)
		}
		console.log(`agents-sync: ${relative(root, dest)} (${state})`)
	}

	// Remove mirrors whose source skill was deleted (only ones we created).
	if (existsSync(targetDir)) {
		for (const entry of readdirSync(targetDir)) {
			if (skills.includes(entry)) continue
			const p = join(targetDir, entry)
			const managed =
				lstatSync(p).isSymbolicLink() || existsSync(join(p, MARKER))
			if (!managed) continue
			if (check) problems.push(`${relative(root, p)}: stale mirror`)
			else {
				rmSync(p, { recursive: true, force: true })
				console.log(`agents-sync: removed stale ${relative(root, p)}`)
			}
		}
	}
}

if (check && problems.length) {
	console.error(
		"Agent skill mirrors are out of sync. Run `npm run agents:sync`.\n  " +
			problems.join("\n  "),
	)
	process.exit(1)
}

function inspect(dest, linkTarget) {
	let st
	try {
		st = lstatSync(dest)
	} catch {
		return "missing"
	}
	if (st.isSymbolicLink()) {
		return readlinkSync(dest) === linkTarget && existsSync(dest)
			? "ok"
			: "wrong symlink"
	}
	if (st.isDirectory()) {
		return existsSync(join(dest, MARKER)) &&
			sameTree(join(SOURCE, dest.split(/[\\/]/).pop()), dest)
			? "ok"
			: "stale copy"
	}
	// A plain file: a symlink checked out on Windows without symlink support.
	return "broken symlink checkout"
}

function sameTree(a, b) {
	const list = (dir, base = dir) =>
		readdirSync(dir, { withFileTypes: true })
			.flatMap((e) =>
				e.isDirectory()
					? list(join(dir, e.name), base)
					: e.name === MARKER
						? []
						: [relative(base, join(dir, e.name))],
			)
			.sort()
	const fa = list(a)
	const fb = list(b)
	if (fa.join("\n") !== fb.join("\n")) return false
	return fa.every((f) => {
		const x = lstatSync(join(a, f))
		const y = lstatSync(join(b, f))
		return x.size === y.size
	})
}

function trySymlink(linkTarget, dest) {
	try {
		symlinkSync(linkTarget, dest, "dir")
		return true
	} catch {
		return false
	}
}
