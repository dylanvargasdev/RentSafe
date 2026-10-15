---
name: cavos
description:
  Wallet-less onboarding with Cavos embedded wallets (@cavos/kit 0.2.5) as wired
  in THIS repo - users sign in with email or Google and get a self-custodial
  Stellar G… account, no extension or seed phrase. Use when the user wants "no
  wallet", "login with email/Google", social login, embedded/invisible wallets,
  onboarding non-crypto users, gasless UX, passkeys, or mentions Cavos; also
  when touching useWallet, WalletProvider, WalletButton or anything that signs
  transactions.
license: Apache-2.0
metadata:
  sdk: "@cavos/kit@0.2.5 (pinned)"
  docs: "https://docs.cavos.xyz/llms-full.txt"
---

# Cavos embedded wallets (this repo)

Cavos gives each user a normal Stellar **`G…` account** created from a login
(email code or Google). The signing key lives in the **Cavos vault** (an iframe
on `vault.cavos.xyz`), never in your page and never with Cavos servers. To the
rest of the app it is just another wallet.

## The one rule

**Features never talk to Cavos or Stellar Wallets Kit directly. They use
`useWallet()`.**

```ts
const {
	address,
	connector,
	signTransaction,
	balances,
	updateBalances,
	disconnect,
} = useWallet()
// connector: "cavos" (email/Google) | "extension" (Freighter, xBull…) | undefined
```

`signTransaction(xdr, { address, networkPassphrase })` → `{ signedTxXdr }` has
the same shape for both connectors, so everything that already works with
Freighter works with Cavos: Trustless Work escrows (`useEscrowTx`), generated
contract clients (`tx.signAndSend({ signTransaction })`), the USDC trustline and
swap helpers.

## Where things live

| File                                   | Role                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/src/cavos/config.ts`              | `PUBLIC_CAVOS_APP_ID`, `PUBLIC_CAVOS_ENVIRONMENT`, network mapping, `CAVOS_APP_SALT`                  |
| `app/src/cavos/CavosRoot.tsx`          | Mounts `<CavosProvider>` only when an App ID is set (mounted in `main.tsx`) and bridges its state     |
| `app/src/cavos/context.ts`             | `useCavosState()`: SDK-independent Cavos state (`null` when not configured), `SignTransactionFn` type |
| `app/src/providers/WalletProvider.tsx` | Chooses the active connector (Cavos wins when signed in) and exposes `useWallet()`                    |
| `app/src/components/WalletButton.tsx`  | "Sign in" (Cavos modal) + "Use a wallet" (extension); sign out; unlock device                         |

The Cavos signer is `wallet.signXdr(unsignedXdr)`: it signs classic transactions
and re-signs this account's Soroban auth entries, without submitting. That is
exactly the "API builds, wallet signs, API submits" seam Trustless Work uses.

## Setup (per app, ~3 minutes)

1. https://cavos.xyz/dashboard → create an app → copy the **App ID**.
2. App **Settings → allowed web origins**: add `http://localhost:5173` (and your
   deployed URL). Without it the vault refuses to load:
   `kit/vault: add <origin> to this app's allowed web origins`.
3. For Google login: **Callback URLs** → add `http://localhost:5173` exactly (no
   trailing slash). `CavosRoot` sets `redirectUri: window.location.origin`.
   Email codes need no callback.
4. `app/.env`: `PUBLIC_CAVOS_APP_ID="…"` (public by design, safe in the
   browser), restart `npm start`.

Never put a Cavos **API key** (`cav_…`, operator credential) in the frontend;
only the App ID.

## Money and fees on testnet (important)

Transactions built by the Trustless Work API and by the generated contract
clients are paid by the user's own account, so the Cavos account needs a little
XLM:

1. Sign in → the `G…` exists as an address, not on-chain yet ("undeployed").
2. **Friendbot first** (Setup checklist / "Fund Account"): creates the account
   with 10,000 test XLM.
3. Then trustline, swap XLM→USDC, escrows: all signed with `signXdr`, fees paid
   from that XLM.

Don't trigger Cavos' own sponsored account creation (`wallet.execute`,
`wallet.addTrustline`) before Friendbot: that creates the account with 0 XLM,
and Friendbot refuses existing accounts.

## What the user sees when signing

The vault signs silently within the app's limits (dashboard → **Approvals**).
Payments of XLM/USDC under the limits and `changeTrust` are silent. **Contract
calls (every escrow action, every Soroban call) and path payments are "over the
limit"**, so by default the vault shows its own approval modal (amount,
destination, network). Handle these rejections:
`kit/vault: the user rejected this transaction`,
`kit/vault: this app's policy does not allow this transaction`.

## Devices and recovery

Configured with `deviceApproval: "passkey"` (one chain, no dashboard setup
needed):

- Same browser: next visit signs in silently.
- New browser/device: `walletStatus.needsDeviceApproval` → `WalletButton` shows
  "Unlock wallet with passkey" (`approveDevice`). That only works if the user
  added a passkey before: `useCavosState()?.addPasskey?.()` (offer it after the
  first escrow, not at sign-up).
- Without a passkey, clearing site data loses the key. Fine for testnet; for
  production enable social recovery (`socialRecovery: true` /
  `deviceApproval: "enclave"` + dashboard config, and then email must be magic
  link, not code).

## Never

- Never change `CAVOS_APP_SALT` or the App ID after users exist: users silently
  get new, empty wallets.
- Never derive `userId` yourself from a mutable field (handled by Cavos hosted
  login here).
- Never ask the user for a seed phrase or export the key: there is none to
  export, by design.

## Going further (only when asked)

- **Gasless contract calls**:
  `wallet.invokeContract({ contractId, method, args })` (relayer pays fees,
  account needs no XLM). Get the wallet with `useCavos().wallet` inside
  `CavosRoot`'s tree and narrow on `wallet.chain === "stellar"`. Requires
  `status === "ready"`.
- **Cavos' own Trustless Work wrapper** (`deployEscrow`, `TrustlessWorkEscrow`)
  talks to the escrow contracts directly (needs factory id + wasm hash, amounts
  in base units, not indexed by the Trustless Work API automatically). This repo
  uses the Trustless Work API instead; don't mix both.
- **Mainnet**: users need XLM for API-built transactions, or pay fees in USDC
  with `@cavos/reserve` (classic operations only).

Docs (read the Stellar page first):
https://docs.cavos.xyz/llms.mdx/docs/stellar/content.md · React:
https://docs.cavos.xyz/llms.mdx/docs/react/content.md · Vault:
https://docs.cavos.xyz/llms.mdx/docs/vault/content.md · Troubleshooting:
https://docs.cavos.xyz/llms.mdx/docs/troubleshooting/content.md · Everything:
https://docs.cavos.xyz/llms-full.txt
