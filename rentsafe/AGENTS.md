# AGENTS.md

<!-- template: bitfalt/scaffold-stellar-agentic (keep this line: it lets the template author count projects built from it) -->

Instructions for any AI coding agent working in this repo (Claude Code, Codex,
Cursor, OpenCode, Copilot, Gemini/Antigravity, Pi, Windsurf, Aider…). Humans:
see `README.md`.

## What this is

A starter for building **any** Stellar dApp **by prompting**, on **testnet**.
The people using it are often brand new to web3. The base is **Scaffold
Stellar** (Soroban contracts in Rust + Vite/React app + auto-generated
TypeScript clients). On top, two optional building blocks already wired in:

- **Trustless Work** escrows: USDC held in a per-deal contract and released by
  roles/milestones. Only for apps where money must **wait for a condition**
  (deliveries, milestones, deposits, bounties).
- **Cavos** embedded wallets: sign in with email/Google, no wallet extension.
  Useful for any app with non-crypto users.

**Pick building blocks by need.** A poll, registry, guestbook or NFT app is just
a Soroban contract + pages: no escrow. Direct payments (tips, donations) don't
need an escrow either. The `build-dapp` skill walks through this choice.

Always reply in the user's language, and write the app's UI text (and contract
error messages) in that language too. Explain on-chain concepts in one or two
plain sentences when they matter, then keep building.

## Skills (read before working on that area)

Skills live in `.agents/skills/<name>/SKILL.md` (open Agent Skills format;
mirrored to `.claude/skills/`). If your tool doesn't load skills automatically,
**open and read the matching SKILL.md yourself before starting**: they contain
verified, version-specific facts that differ from your training data.

| Skill               | Read it when                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `build-dapp`        | The user describes an app idea or wants to build something (any kind). Start here.                         |
| `trustless-work`    | Only when funds must be held until a condition: escrows, milestones, deposits, disputes                    |
| `scaffold-stellar`  | Adding/deploying contracts, `environments.toml`, `app/.env`, generated clients, dev server or build errors |
| `cavos`             | Login with email/Google, "no wallet" onboarding, anything that signs transactions or touches `useWallet`   |
| `soroban-contracts` | Writing/testing/reviewing Rust contracts in `contracts/`                                                   |
| `stellar-basics`    | Explaining Stellar concepts, decoding transaction errors, test money                                       |

## Golden rules

1. **Testnet only** unless the user explicitly asks for mainnet.
2. **Use only the building blocks the idea needs.** No Trustless Work escrow (or
   its API key) unless money must wait for a condition. Remove nav links to demo
   pages the app doesn't use.
3. **Don't assume everything goes on-chain.** Decide per piece of data; when
   it's a real choice (privacy, cost, effort), explain the trade-off to the user
   and ask (`build-dapp` skill, step 2b). Personal data never goes on-chain.
4. **Never** ask for, print, store or commit secret keys (`S…`) or seed phrases.
   Users sign with their wallet; the agent never signs for them. `app/.env` is
   different: it only holds public config (`PUBLIC_*` values are public by
   design), so you may read and edit it, but never commit it.
5. Don't edit generated code: `app-lib/clients/*` (Scaffold regenerates it) and
   `.agents/skills/trustless-work/references/official/` (vendored).
6. Scaffold config is **v1** (`environments.toml`). Don't migrate to
   `scaffold.yml` v2.
7. Trustless Work is **API V1** with `@trustless-work/escrow@3.0.5`. Don't
   upgrade to the 5.x beta or mix V2 payloads.
8. Reuse what exists before writing new code: `contracts/rental-registry`
   (contract patterns, tests with a Trustless Work mock),
   `app/src/rentsafe/chain/registry.ts` (contract reads/writes from React),
   `useEscrowTx` (every escrow write) and `app/src/trustless/usdc.ts`
   (trustline + test USDC). The template's demo pages and example contracts were
   removed; see the upstream scaffold if you need them.
9. **Every signature goes through `useWallet().signTransaction`** (works for
   Cavos and extension wallets alike). Never import Stellar Wallets Kit or Cavos
   directly in features.
10. Work in small steps and verify each one (`cargo test`, `npm run typecheck`,
    `npm run check`). You can't click wallet popups: hand the user a short
    manual test script instead.
11. Edit skills only in `.agents/skills/` (then `npm run agents:sync`), never in
    `.claude/skills/`.

12. Ignore `npm audit` warnings from `npm install` and **never** run
    `npm audit fix --force`: it upgrades pinned SDKs (`@trustless-work/escrow`,
    `@cavos/kit`) and breaks the app.

## Commands (repo root)

| Command                              | What it does                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                        | install deps (+ syncs skill mirrors)                                                                                        |
| `npm run doctor`                     | checks tools, `app/.env`, network, Trustless Work key; creates `app/.env` if missing                                        |
| `npm start`                          | dev loop: `stellar scaffold watch --build-clients` (build → deploy to testnet → TS clients) + Vite on http://localhost:5173 |
| `npm run contracts:build`            | one-off build + deploy + client generation (exits 1 if a client fails to generate)                                          |
| `npm run contracts:test`             | `cargo test` for all contracts                                                                                              |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint for the app                                                                                             |
| `npm run check`                      | contracts:test + Rust/TS formatting + typecheck + lint (run before saying "done")                                           |
| `npm run tw:smoke`                   | end-to-end Trustless Work test (deploy→fund→approve→release) signed by the local deployer key                               |

Scaffold/Stellar CLI commands must run from `app/` (its `.env` sets a relative
config dir). On a fresh clone, run `npm run contracts:build` once before
`typecheck`/`check`/`build`: the app imports the generated contract clients.

## Layout

```
contracts/rental-registry/  RentSafe: bookings registry + escrow verification + reviews
app/src/rentsafe/         RentSafe app (pages, components, store, chain/ = on-chain flow)
docs/RENTSAFE.md          RentSafe technical guide (architecture, escrow, lifecycle, testnet)
tests/escrow-e2e/         registry + real Trustless Work escrow integration tests
environments.toml         contracts per environment (development = testnet)
app/src/trustless/        Trustless Work integration (config, provider, useEscrowTx, USDC helpers)
app/src/cavos/            Cavos embedded wallets (optional, PUBLIC_CAVOS_APP_ID)
app/src/providers/        WalletProvider: one useWallet() for Cavos + extension wallets
app/src/hooks/            useWallet, useNotification
app-lib/                  network env, wallet kit, friendbot, events (shared TS lib)
app-lib/clients/          GENERATED contract clients (gitignored)
scripts/                  doctor, tw-smoke, agents-sync, dev-guard
docs/AGENT-SETUP.md       per-agent setup and optional MCP servers
```

## Code conventions

- TypeScript strict, React 19 function components, React Query for async state,
  CSS Modules using the tokens in `app-lib/styles.css` (`var(--color-accent)`
  etc.). Tabs, no semicolons (Prettier config `@theahaco/ts-config/prettier`).
- Frontend env vars must start with `PUBLIC_` (`import.meta.env.PUBLIC_*`).
- Contract client names: crate `my-contract` → env key `my_contract` →
  `import { myContract } from "@stellar-scaffold/app-lib/clients"`.
- Rust: `#![no_std]`, soroban-sdk 26 (workspace pin), `#[contractevent]` for
  events, explicit `#[contracterror]` enums, tests in `src/test.rs`.

## Live docs (when skills aren't enough)

- Stellar: https://developers.stellar.org/llms.txt (append `.md` to any docs
  page URL)
- Trustless Work: https://docs.trustlesswork.com/trustless-work/llms.txt ·
  Swagger https://dev.api.trustlesswork.com/docs
- Scaffold Stellar:
  https://developers.stellar.org/docs/tools/scaffold-stellar.md
  (stellarscaffold.org documents config v2)
- OpenZeppelin Stellar contracts:
  https://docs.openzeppelin.com/stellar-contracts
- Stellar Raven MCP (`stellar-raven`, https://raven.stellar.org/mcp): official
  Stellar docs, ecosystem data and playbooks; already configured, needs a
  one-time browser sign-in. Other optional MCP servers (Trustless Work docs,
  OpenZeppelin contract wizard): see `docs/AGENT-SETUP.md`.
