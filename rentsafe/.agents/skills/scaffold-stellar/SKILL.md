---
name: scaffold-stellar
description:
  How this Scaffold Stellar project is wired - environments.toml, the npm start
  dev loop that compiles, deploys to testnet and generates TypeScript clients,
  adding a new Soroban contract, calling contracts from React (reads, signed
  writes, events), CLI commands, troubleshooting and deployment. Use whenever
  you add/rename/deploy a contract, touch environments.toml or app/.env, import
  from @stellar-scaffold/app-lib, or the dev server/contract build fails.
license: Apache-2.0
metadata:
  scaffold-cli: "stellar-scaffold-cli 0.0.27 (config v1: environments.toml)"
  stellar-cli: ">=27"
---

# Scaffold Stellar in this repo

Scaffold Stellar = Soroban contracts (Rust) + a Vite/React app, glued by a CLI
plugin (`stellar scaffold`) that **builds → deploys → generates a typed TS
client** for each contract every time you save.

> ⚠️ Version: this repo uses the released CLI **0.0.27** with **config v1**:
> `environments.toml`, and `scaffold.yml` with `version: 1`. The upstream
> docs/skill at stellarscaffold.org now describe config **v2** (`networks:` and
> `contracts:` in scaffold.yml). Do NOT convert this repo to v2 or follow v2
> examples unless the user explicitly asks to migrate.

## Map

```
contracts/<crate>/            Rust/Soroban contracts (Cargo workspace members)
environments.toml             which contracts deploy where (per STELLAR_SCAFFOLD_ENV)
app/                          Vite + React 19 + TS frontend (routes in app/src/App.tsx)
app/.env                      STELLAR_SCAFFOLD_ENV, PUBLIC_* vars (copied from .env.example)
app/.config/stellar/          deployer identity + contract ids (gitignored, auto-created)
app-lib/                      shared TS: network env, wallet (Stellar Wallets Kit), friendbot, events
app-lib/clients/              GENERATED clients (gitignored, never edit) → import from "@stellar-scaffold/app-lib/clients"
app/src/trustless/            Trustless Work escrow integration (see trustless-work skill)
```

## Dev loop

```bash
npm start            # from repo root: `stellar scaffold watch --build-clients` + `vite` (http://localhost:5173)
```

- `development` targets **testnet** (no Docker). Ignore Scaffold's "Starting
  local Stellar Docker container…" log line: it's cosmetic in CLI 0.0.27. The
  app always runs on **http://localhost:5173** (`strictPort`); if the port is
  busy, stop the other server. On first run it creates + funds the `me` deployer
  account, compiles every contract, deploys the ones listed in
  `environments.toml`, generates clients into `app-lib/clients/`. First run:
  ~1–2 min. Vite may show "Failed to resolve import
  @stellar-scaffold/app-lib/clients" until that finishes: wait.
- Saving a `.rs` file, `Cargo.toml` or `environments.toml` triggers a rebuild +
  redeploy (contracts with `upgrade(BytesN<32>)` are upgraded in place; others
  get a NEW contract id, so on-chain state resets). Saves during a rebuild can
  be missed: save again.
- Run Scaffold CLI commands **from `app/`** (or via the npm scripts), because
  `app/.env` sets `XDG_CONFIG_HOME=".config"` relative to the current directory.

Useful scripts (repo root): `npm run contracts:build` (one-off
build+deploy+clients), `npm run contracts:test` (`cargo test`), `npm run check`
(tests + typecheck + lint), `npm run doctor` (environment diagnosis).

## Add a new contract (the 5 steps)

1. Create `contracts/<crate-name>/` with `Cargo.toml` + `src/lib.rs` (+
   `src/test.rs`). Copy `contracts/reputation/Cargo.toml` and change
   `name`/`description`. Write it with the `soroban-contracts` skill. Run
   `cargo test -p <crate-name>`.
2. Register it in `environments.toml` under `[development.contracts]` (and
   `[staging.contracts]`):
   ```toml
   my_contract = { client = true }                                  # no constructor
   my_contract = { client = true, constructor_args = "--admin me" } # __constructor(admin: Address)
   ```
   The key MUST be the crate name with `-` → `_` (`my-contract` →
   `my_contract`). `me` is the deployer identity in `development`; in
   `[staging.contracts]` use the staging account instead
   (`--admin testnet-user`). `after_deploy = """\nfn_name --arg value\n"""` runs
   invocations after deploy.
3. Save / keep `npm start` running (or `npm run contracts:build`). Watch the
   "stellar" logs.
4. Import the generated client (camelCase of the key):
   ```ts
   import { myContract } from "@stellar-scaffold/app-lib/clients"
   ```
5. Use it in a component (below), add a route in `app/src/App.tsx` and a nav
   link.

Starting from a template instead: `stellar scaffold generate contract --ls`
lists examples;
`stellar scaffold generate contract --from oz/nft-enumerable -o contracts/my-nft`
copies one (OpenZeppelin `oz/*` ones may need extra `[workspace.dependencies]`
such as `stellar-contract-utils = "0.7.2"`; `stellar/*` examples currently fail
on version mismatch). `--from-wizard` opens
https://wizard.openzeppelin.com/stellar. `generate` never edits
`environments.toml`: do step 2 yourself.

## Calling contracts from React

```tsx
import { reputation } from "@stellar-scaffold/app-lib/clients"
import { useWallet } from "../hooks/useWallet"

// READ: simulation only, free, no wallet needed. Value is in `.result`.
const score = (await reputation.score_of({ subject })).result

// READ of a fn returning Result<T, Error>: `.result` is a Result wrapper.
const r = (await polls.get_poll({ id })).result
if (r.isErr()) throw new Error(r.unwrapErr().message)
const poll = r.unwrap()

// WRITE: build with the user's publicKey, then sign + send with the wallet.
const { address, signTransaction } = useWallet()
const tx = await reputation.review(
	{ reviewer: address!, subject, escrow, rating: 5, comment: "great" },
	{ publicKey: address },
)
// Contract errors (#[contracterror]) appear in the SIMULATION, before signing.
// Check them here: `signAndSend` would throw `Error(Contract, #N)` instead, after
// a pointless wallet popup. The message is the variant's `///` doc comment.
if (tx.result.isErr()) throw new Error(tx.result.unwrapErr().message)
await tx.signAndSend({ signTransaction })
```

- Argument names = Rust parameter names (snake_case). Types: `Address` →
  `string` (G…/C…), `i128/u64` → `bigint`, `u32/i32` → `number`, `String/Symbol`
  → `string`, `Option<T>` → typed `T | undefined` but **`null` at runtime**
  (check with `== null`, not `=== undefined`), `Vec<T>` → `T[]`, structs →
  objects, `Result<T, E>` → `Result` with `isOk()/unwrap()/isErr()`. Prices as
  `i128` with 7 decimals: `Number(price) / 1e7` for display and for the
  Trustless Work API (human units); `BigInt(Math.round(usdc * 1e7))` back.
- Generated struct/enum types aren't exported from `…/clients`. Derive them from
  the client instead of importing the package (it pins another stellar-sdk):
  `type Item = Awaited<ReturnType<typeof marketplace.get_item>>["result"]` (for
  `Vec` results add `[number]`). Copy small enums by hand.
- Wrap reads in React Query (`useQuery({ queryKey: [...], queryFn })`) as
  `ReputationPanel.tsx` does, and `invalidateQueries` after writes.
- Contract events: `useSubscription(contractId, topic, cb)`
  (`app/src/hooks/useSubscription.ts`) polls RPC events. Contract id:
  `reputation.options.contractId`.
- Wallet state: `useWallet()` → `address`, `connector` (`"cavos"` email/Google
  embedded wallet | `"extension"` Freighter & co.), `balances`
  (`balances.xlm.balance`), `signTransaction` (same shape for both connectors),
  `updateBalances`, `disconnect`, `networkPassphrase` (the wallet's network:
  warn if it's not testnet). Never import the wallet SDKs directly in features
  (see `cavos` skill).
- Env in code:
  `import { stellarNetwork, rpcUrl, networkPassphrase, horizonUrl } from "@stellar-scaffold/app-lib"`.
  Frontend env vars must start with `PUBLIC_` (Vite `envPrefix`).

## CLI one-liners (run from `app/`)

```bash
stellar contract invoke --id reputation --source me --network testnet -- score_of --subject G...   # alias = env key
stellar contract invoke --id reputation --source me --network testnet -- --help                   # list functions
stellar keys address me              # deployer address
stellar scaffold build --build-clients   # one-off (same as npm run contracts:build)

# Seed demo data as `me` (e.g. listings, so ONE browser wallet can test buying):
stellar contract invoke --id marketplace --source me --network testnet --send=yes -- list_item --seller $(stellar keys address me) --title "Bike" --price 50000000
# Let `me` receive USDC (needed if `me` is a seller/receiver in a demo escrow):
stellar tx new change-trust --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --source-account me --network testnet
```

`me` is a CLI key: it can seed data and sign from the terminal, but it can't
sign in the browser, so never make it a role someone must click with.

Avoid `stellar scaffold clean` unless asked: it wipes deployments/identities and
can touch global identities with the same name.

## Must-knows

- **Never name a contract function argument `options`.** Every generated TS
  method already takes an `options` parameter, so the client build fails (TS2300
  Duplicate identifier) and Scaffold only logs
  `npm run build failed with status: Some(2)`. Use `choices`, `opts`, etc.
  `npm run contracts:build` exits 1 when a client fails to generate; to see the
  real TS error:
  `stellar contract bindings typescript --wasm target/wasm32v1-none/release/<crate>.wasm --output-dir /tmp/x`
  then `cd /tmp/x && npm install && npm run build`.
- The generated `Errors` map in `app-lib/clients/<name>/src/index.ts` shows the
  variant NAMES, but at runtime `unwrapErr().message` is the variant's `///` doc
  comment (verified). Trust the runtime.
- **Fresh clone**: `npm run typecheck`/`check`/`build` stop with "Contract
  clients aren't generated yet" (TS2307 on `@stellar-scaffold/app-lib/clients`)
  until the first `npm run contracts:build` or `npm start`. Not a code bug.
- `package-lock.json` changes when clients are (re)generated, because
  `app-lib/clients/*` are npm workspaces. Harmless; commit it with your change.
- **Upgrade in place** keeps on-chain state across saves only if the contract
  has `pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>)` (admin-gated) and
  you keep the storage layout compatible (same keys/types; add, don't change).
  If you change a stored struct, delete
  `app/.config/stellar/contract-ids/<name>.json` to get a fresh deploy instead.

- Scaffold tries to deploy **every crate in `contracts/`**. Crates you don't
  want deployed (references, WIP) must be listed with `client = false` (see the
  OpenZeppelin examples), otherwise the build prints
  `❌ Failed to generate client` (e.g. missing constructor args).
- Never edit `app-lib/clients/*` (regenerated). Wrap clients in your own code
  under `app/src/`.
- `PUBLIC_STELLAR_NETWORK` must be `TESTNET` (or `PUBLIC`/`LOCAL`/`FUTURENET`);
  an invalid value silently falls back to LOCAL/localhost. Mainnet is `PUBLIC`,
  not `MAINNET`.
- Changing only `constructor_args` doesn't redeploy. Touch the contract source
  (or delete its alias in `app/.config/stellar/contract-ids/`) to force a fresh
  deploy.
- Unit tests run natively with `cargo test`; they don't need the network.

More: `references/troubleshooting.md` (errors → fixes), `references/deploy.md`
(staging, production, hosting the frontend). Docs:
https://developers.stellar.org/docs/tools/scaffold-stellar (append `.md` for
markdown), https://stellarscaffold.org/docs (describes v2, see warning above).
