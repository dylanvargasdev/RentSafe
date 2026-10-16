#!/usr/bin/env node
// `npm run contracts:e2e`: tests rental_registry against the REAL Trustless
// Work multi-release escrow contract (API V1), not a mock.
//
// The Trustless Work source has no license file, so it is not vendored: this
// script downloads it at a pinned commit into target/escrow-e2e (gitignored),
// builds a throwaway Cargo workspace with both contracts plus
// tests/escrow-e2e/e2e.rs, and runs `cargo test`. Needs git, cargo and network.
import { execFileSync } from "node:child_process"
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const TW_REPO =
	"https://github.com/Trustless-Work/trustlesswork-smart-contract-stellar.git"
// multi-release-main, the V1 contract the Trustless Work API deploys.
const TW_COMMIT = "d5cfc2ee0341141ab0a348388771afe71c8c28d2"
const SOROBAN = "26.1.0"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const work = join(root, "target", "escrow-e2e")
const tw = join(work, "tw-src")
const run = (cmd, args, cwd = root) =>
	execFileSync(cmd, args, { cwd, stdio: "inherit" })
const patch = (file, edits) => {
	let s = readFileSync(file, "utf8")
	for (const [from, to] of edits) {
		if (!s.includes(from)) throw new Error(`${file}: "${from}" not found`)
		s = s.replaceAll(from, to)
	}
	writeFileSync(file, s)
}

// 1. Trustless Work source at the pinned commit (cached between runs).
if (!existsSync(join(tw, "contracts", "escrow"))) {
	console.log(`Downloading Trustless Work escrow @ ${TW_COMMIT.slice(0, 7)}…`)
	rmSync(tw, { recursive: true, force: true })
	mkdirSync(tw, { recursive: true })
	run("git", ["init", "-q"], tw)
	run("git", ["fetch", "-q", "--depth", "1", TW_REPO, TW_COMMIT], tw)
	run("git", ["checkout", "-q", "FETCH_HEAD"], tw)
}

// 2. Fresh copies, linkable as Rust libraries.
for (const dir of ["tw-escrow", "rental-registry", "e2e"])
	rmSync(join(work, dir), { recursive: true, force: true })
cpSync(join(tw, "contracts", "escrow"), join(work, "tw-escrow"), {
	recursive: true,
})
cpSync(
	join(root, "contracts", "rental-registry"),
	join(work, "rental-registry"),
	{ recursive: true },
)
patch(join(work, "tw-escrow", "Cargo.toml"), [
	['crate-type = ["cdylib"]', 'crate-type = ["rlib"]'],
	["soroban-sdk = { workspace = true }", `soroban-sdk = "${SOROBAN}"`],
	["soroban-token-sdk = { workspace = true }", 'soroban-token-sdk = "26.0.0"'],
	[
		'soroban-sdk = { workspace = true, features = ["testutils"] }',
		`soroban-sdk = { version = "${SOROBAN}", features = ["testutils"] }`,
	],
])
// The test builds escrows with Trustless Work's own types and client.
patch(join(work, "tw-escrow", "src", "lib.rs"), [
	["\nmod contract;", "\npub mod contract;"],
	["\nmod storage {", "\npub mod storage {"],
])
patch(join(work, "rental-registry", "Cargo.toml"), [
	['crate-type = ["cdylib"]', 'crate-type = ["rlib"]'],
])

// 3. Throwaway workspace + test crate.
writeFileSync(
	join(work, "Cargo.toml"),
	`[workspace]
members = ["tw-escrow", "rental-registry", "e2e"]
resolver = "2"

[workspace.package]
edition = "2024"
license = "Apache-2.0"
repository = "https://github.com/bitfalt/scaffold-stellar-agentic"
version = "0.0.2"

[workspace.dependencies]
soroban-sdk = "${SOROBAN}"
`,
)
mkdirSync(join(work, "e2e", "src"), { recursive: true })
writeFileSync(
	join(work, "e2e", "Cargo.toml"),
	`[package]
name = "e2e"
version = "0.0.0"
edition = "2024"
publish = false

[dependencies]
soroban-sdk = { version = "${SOROBAN}", features = ["testutils"] }
escrow = { path = "../tw-escrow" }
rental-registry = { path = "../rental-registry" }
`,
)
cpSync(
	join(root, "tests", "escrow-e2e", "e2e.rs"),
	join(work, "e2e", "src", "lib.rs"),
)
if (!existsSync(join(work, "Cargo.lock")))
	cpSync(join(root, "Cargo.lock"), join(work, "Cargo.lock"))

// 4. Run (from the repo root, so rust-toolchain.toml applies).
run("cargo", ["test", "--manifest-path", join(work, "Cargo.toml"), "-p", "e2e"])
