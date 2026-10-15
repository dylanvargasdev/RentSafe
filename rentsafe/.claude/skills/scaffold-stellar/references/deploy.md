# Deploying

## Environments (environments.toml, config v1)

| `STELLAR_SCAFFOLD_ENV`  | Deploys contracts?                                                              | Network here             |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------ |
| `development` (default) | yes, on every change (`client = true`)                                          | testnet                  |
| `testing`               | yes                                                                             | define it if you need it |
| `staging`               | only binds/deploys what's listed; prefer `id = "C…"` for a stable shared deploy | testnet                  |
| `production`            | **no**: reference existing ids only (`name = { id = "C…" }`)                    | mainnet                  |

## Shareable testnet demo (what the workshop needs)

1. `npm start` once so `development` deploys your contracts (ids printed in the
   logs and stored in `app/.config/stellar/contract-ids/`).
2. Build the frontend: `npm run build --workspace app` → static files in
   `app/dist/`. The generated clients are baked in with the testnet contract
   ids, and `app/.env` values (`PUBLIC_*`) are inlined at build time.
3. Host `app/dist` anywhere static (Vercel, Netlify, Cloudflare Pages, GitHub
   Pages). It's an SPA: configure a fallback to `index.html` for client-side
   routes (`/escrows`). CI builds must generate clients first (they're
   gitignored): run `stellar scaffold build --build-clients` with the deployer
   identity, or commit-free alternative: build locally and upload `dist/`.

## Mainnet (real money: only when asked, and after a review)

- Deploy the wasm manually: `stellar contract build` then
  `stellar contract deploy --wasm target/wasm32v1-none/release/<crate_with_underscores>.wasm --source <funded-mainnet-key> --network mainnet -- <constructor args>`.
- Put the id under `[production.contracts]`: `my_contract = { id = "C…" }`, set
  a real RPC URL in `[production.network]`, and in the frontend env:
  `PUBLIC_STELLAR_NETWORK="PUBLIC"`, passphrase
  `Public Global Stellar Network ; September 2015`, mainnet RPC + Horizon URLs.
- Trustless Work mainnet: `https://api.trustlesswork.com` (the app switches
  automatically when `PUBLIC_STELLAR_NETWORK="PUBLIC"`), a **mainnet** API key,
  and mainnet USDC issuer
  `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` (already in
  `config.ts`).
- Run the security checklist in the `soroban-contracts` skill before any mainnet
  deploy.

## Stellar Registry (optional, publish/deploy by name)

```bash
cargo install --locked stellar-registry-cli
stellar registry publish --wasm target/wasm32v1-none/release/my_contract.wasm --wasm-name unverified/my-contract --binver 1.0.0
stellar registry deploy --contract-name unverified/my-instance --wasm-name unverified/my-contract -- --admin alice
stellar registry create-alias unverified/my-instance my-instance
```
