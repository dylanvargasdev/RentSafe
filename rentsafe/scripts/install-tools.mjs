#!/usr/bin/env node
// `npm run setup:tools`: installs the Stellar CLI and the Scaffold plugin from their
// prebuilt GitHub release binaries (no Rust compilation, ~1 minute), plus the Rust
// wasm target. Skips anything already installed. macOS, Linux and Windows (x64/arm64).
//
// Binaries go to ~/.cargo/bin (created by rustup and already on PATH).
import { execSync } from "node:child_process"
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"

const STELLAR_CLI = "28.1.0"
const SCAFFOLD_CLI = "0.0.27"

const has = (cmd) => {
	try {
		execSync(cmd, { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

const triples = {
	"darwin-arm64": "aarch64-apple-darwin",
	"darwin-x64": "x86_64-apple-darwin",
	"linux-x64": "x86_64-unknown-linux-gnu",
	"linux-arm64": "aarch64-unknown-linux-gnu",
	"win32-x64": "x86_64-pc-windows-msvc",
	"win32-arm64": "aarch64-pc-windows-msvc",
}
const triple = triples[`${process.platform}-${process.arch}`]
if (!triple) {
	console.error(
		`Unsupported platform ${process.platform}-${process.arch}. Install manually (see README).`,
	)
	process.exit(1)
}
const exe = process.platform === "win32" ? ".exe" : ""
const binDir = join(homedir(), ".cargo", "bin")
mkdirSync(binDir, { recursive: true })

async function install(name, url, binary) {
	console.log(`↓ ${name}: ${url}`)
	const res = await fetch(url)
	if (!res.ok) throw new Error(`${res.status} downloading ${url}`)
	const work = mkdtempSync(join(tmpdir(), "stellar-tools-"))
	const archive = join(work, url.split("/").pop())
	writeFileSync(archive, Buffer.from(await res.arrayBuffer()))
	// bsdtar/GNU tar ship with macOS, Linux and Windows 10+ (and read .zip on Windows).
	execSync(`tar -xf "${archive}" -C "${work}"`)
	const found = findFile(work, binary + exe)
	if (!found) throw new Error(`${binary}${exe} not found in ${archive}`)
	const dest = join(binDir, binary + exe)
	// copy (not rename): tmp and home can be on different filesystems
	copyFileSync(found, dest)
	if (!exe) chmodSync(dest, 0o755)
	rmSync(work, { recursive: true, force: true })
	console.log(`✓ ${name} → ${dest}`)
}

function findFile(dir, file) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name)
		if (e.isDirectory()) {
			const f = findFile(p, file)
			if (f) return f
		} else if (e.name === file) return p
	}
	return null
}

if (has("stellar --version")) console.log("✓ Stellar CLI already installed")
else if (triple === "aarch64-pc-windows-msvc") {
	console.log(
		"Stellar CLI has no Windows ARM build: use WSL2 or `cargo install --locked stellar-cli`",
	)
} else {
	await install(
		"Stellar CLI",
		`https://github.com/stellar/stellar-cli/releases/download/v${STELLAR_CLI}/stellar-cli-${STELLAR_CLI}-${triple}.tar.gz`,
		"stellar",
	)
}

if (has("stellar scaffold --version"))
	console.log("✓ Scaffold plugin already installed")
else {
	await install(
		"Scaffold plugin",
		`https://github.com/stellar-scaffold/cli/releases/download/stellar-scaffold-cli-v${SCAFFOLD_CLI}/stellar-scaffold-cli-v${SCAFFOLD_CLI}-${triple}.tar.gz`,
		"stellar-scaffold",
	)
}

if (has("rustup --version")) {
	execSync("rustup target add wasm32v1-none", { stdio: "inherit" })
} else if (has("cargo --version")) {
	console.log(
		"ℹ️  Rust found without rustup (Homebrew/Nix/distro). That works if it has the wasm32v1-none target and a wasm linker (lld); `npm run contracts:build` will tell you. No need to install rustup otherwise.",
	)
} else {
	console.log(
		"⚠️  Rust not found: install it from https://rustup.rs, then run this again.",
	)
}

// Only complain about PATH when the tools we just installed can't be found.
if (!has("stellar --version") || !has("stellar scaffold --version")) {
	console.log(
		`⚠️  The tools were installed in ${binDir}, which is not on your PATH. Add it (rustup normally does) and open a new terminal.`,
	)
}
console.log("\nNext: npm run doctor")
