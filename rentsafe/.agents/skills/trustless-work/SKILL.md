---
name: trustless-work
description:
  Escrows on Stellar with Trustless Work, as wired in THIS repo (React SDK
  @trustless-work/escrow 3.0.5, API V1, testnet). Use whenever the user wants to
  hold, lock, release, refund or split payments; milestones;
  freelance/marketplace/bounty/rental-deposit/crowdfunding/grant flows;
  disputes; USDC; or mentions escrow, fideicomiso, depósito en garantía, or
  Trustless Work. Covers the build→sign→send pattern, roles, payloads, reading
  escrows, USDC trustlines and the verified gotchas. NOT for apps where money
  doesn't wait for a condition (polls/voting, registries, NFTs, direct tips or
  donations): those don't need an escrow.
license: Apache-2.0
metadata:
  sdk: "@trustless-work/escrow@3.0.5"
  api:
    "V1 (https://dev.api.trustlesswork.com testnet,
    https://api.trustlesswork.com mainnet)"
---

# Trustless Work escrows (this repo)

Trustless Work deploys one **escrow smart contract per deal** on Stellar. Money
(USDC) sits in the contract and only moves when the right **role** signs the
right action. You never write the escrow contract: you call the Trustless Work
API, which returns an **unsigned transaction** that the user's wallet signs.

> This repo uses **API V1** + `@trustless-work/escrow@3.0.5` (stable, pinned).
> V2 is beta, testnet-only, with different payloads. Never mix them, never
> `npm i @trustless-work/escrow@beta`.

## Where things live

| File                                          | What it does                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `app/src/trustless/config.ts`                 | API URL per network, `PUBLIC_TRUSTLESS_WORK_API_KEY`, USDC issuer, viewer/explorer links |
| `app/src/trustless/TrustlessWorkProvider.tsx` | `TrustlessWorkConfig` provider (mounted in `app/src/main.tsx`)                           |
| `app/src/trustless/useEscrowTx.ts`            | **`run(label, build)`**: build → wallet sign → send. Use it for EVERY write              |
| `app/src/trustless/useEscrows.ts`             | `useMyEscrows(address)`, `useEscrow(contractId)` (indexer reads via React Query)         |
| `app/src/trustless/usdc.ts`                   | `addUsdcTrustline`, `swapXlmForUsdc` (testnet DEX)                                       |
| `app/src/trustless/components/*`              | `SetupChecklist`, `CreateEscrowForm`, `EscrowCard` (full lifecycle UI, role-aware)       |
| `app/src/pages/Escrows.tsx`                   | The Escrow Studio page (`/escrows`)                                                      |
| `scripts/tw-smoke.mjs`                        | Headless end-to-end test with a real API key (`npm run tw:smoke`)                        |

Reuse these. A new app is usually: a new page, a `CreateEscrowForm`-like form
with fixed roles, `EscrowCard` (or a custom card), and maybe a Soroban contract
for app data. `EscrowCard` takes `doneStatus`, `doneLabel` and
`evidencePlaceholder` (e.g. `"shipped"`, `"Mark shipped"`, `"Tracking number"`)
so you don't need to edit it.

## The one pattern for every write

```ts
import { useFundEscrow } from "@trustless-work/escrow"
import { useEscrowTx } from "../trustless/useEscrowTx"

const { run, pending } = useEscrowTx()
const { fundEscrow } = useFundEscrow()

await run("Fund escrow", () =>
	fundEscrow({ contractId, amount: 10, signer: address }, "multi-release"),
)
```

`run` checks API key + wallet, gets `unsignedTransaction`, asks the wallet to
sign (`signTransaction(xdr, { address, networkPassphrase })`), posts it to
`/helper/send-transaction`, shows notifications, invalidates `["escrows"]`
queries and returns the API response (`res.contractId` after a deploy). Don't
re-implement this flow.

## Pick the escrow type

- **multi-release**: each milestone has its own `amount` + `receiver` and is
  approved/released separately. Freelance milestones, bounties (one milestone
  per winner), grants in tranches.
- **single-release**: one `amount`, one `receiver`, paid once ALL milestones are
  approved. Marketplace purchase, rental/security deposit, pre-orders, P2P
  trades.

## Roles (V1 field names, exact)

| Role              | Does                                                                     | Typical person                  |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `approver`        | approves milestones; can dispute                                         | client / buyer / tenant / judge |
| `serviceProvider` | marks milestones done (+evidence); can dispute                           | freelancer / seller             |
| `releaseSigner`   | releases funds                                                           | client, or the platform         |
| `disputeResolver` | resolves disputes (splits funds); **cannot** open one                    | platform / arbiter              |
| `platformAddress` | receives `platformFee` %; only one who can `update-escrow`               | your dApp                       |
| `receiver`        | gets paid (**single-release only**; multi uses per-milestone `receiver`) | freelancer / landlord           |

Anyone can **fund**. One address may hold several roles (great for demos: the
Studio defaults every role to the connected wallet). The wallet that signs MUST
equal the role address in the payload, or the contract rejects it.

**Platform / dispute resolver in multi-user apps**: when a buyer or client
creates the escrow, use `platformOr(address)` from `app/src/trustless/config.ts`
for `platformAddress` and `disputeResolver`. It returns
`PUBLIC_PLATFORM_ADDRESS` (the builder's own Freighter/Cavos address, set in
`app/.env`) or, in demo mode, the connected wallet. Show a "demo mode" warning
when `platformAddress` is undefined, because then the buyer could resolve their
own dispute. Never use the CLI deployer `me` for a role: it can't sign in the
browser.

## Payload cheat sheet (V1)

```ts
// Deploy multi-release  →  deployEscrow(payload, "multi-release")
{
  signer: me, engagementId: "gig-42", title: "Logo", description: "…",
  roles: { approver, serviceProvider, releaseSigner, disputeResolver, platformAddress },
  platformFee: 1,                                   // percent, number
  milestones: [{ description: "Draft", amount: 5, receiver: freelancer }],
  trustline: { address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", symbol: "USDC" },
}
// Deploy single-release: + amount: 10, roles.receiver, milestones: [{ description }] (only description!)

fundEscrow({ contractId, amount: 10, signer: me }, type)
changeMilestoneStatus({ contractId, milestoneIndex: "0", newStatus: "completed", newEvidence: "https://…", serviceProvider: me }, type)
approveMilestone({ contractId, milestoneIndex: "0", approver: me }, type)
releaseFunds({ contractId, releaseSigner: me }, "single-release")
releaseFunds({ contractId, releaseSigner: me, milestoneIndex: "0" }, "multi-release")
startDispute({ contractId, signer: me }, "single-release")                 // multi: + milestoneIndex
resolveDispute({ contractId, disputeResolver: me, distributions: [{ address, amount }] }, type) // multi: + milestoneIndex
```

Rules the API/contract enforce:

- `amount`/`platformFee` are **numbers in human units** (`10` = 10 USDC). Not
  stroops, not strings.
- `milestoneIndex` is a **string** (`"0"`).
- `trustline.address` is the **issuer G…** (use `USDC` from `config.ts`), never
  a `C…` contract.
- Single-release release needs every milestone approved + balance ≥ amount.
- Single-release resolve: distributions sum **exactly** to the current balance.
  Multi: ≤ the milestone amount.
- After funding, roles/amounts/fee are frozen (only new milestones can be
  appended by `platformAddress`).
- Fees (platform % + 0.3% protocol) are taken from the amount at release, not
  added on top.

## Reading escrows

```ts
const { data: escrows } = useMyEscrows(address) // by signer + approver + serviceProvider
const { data: escrow } = useEscrow(contractId) // validateOnChain: true
```

Raw hooks: `useGetEscrowsFromIndexerByRole`
(`{ role, roleAddress, engagementId?, title?, … }`),
`useGetEscrowsFromIndexerBySigner`, `useGetEscrowFromIndexerByContractIds`.
Filter by `engagementId` to link escrows to your own objects (job id, listing
id). Milestone approval: single → `m.approved`, multi → `m.flags.approved`;
escrow flags (`released`, `disputed`, `resolved`) live in `escrow.flags` for
single, per-milestone `flags` for multi.

## Money prerequisites (testnet)

Every signer needs XLM (Friendbot). Funders and anyone who RECEIVES USDC
(receivers, `platformAddress`, dispute distribution addresses) need a **USDC
trustline**. The `SetupChecklist` component handles: connect → Friendbot →
trustline → swap XLM→USDC → API key.

Any connected wallet works as a role: `useWallet().signTransaction` signs with
an extension wallet or with a **Cavos** embedded wallet (email/Google login, see
the `cavos` skill). Cavos users must use Friendbot before anything else.

## Linking escrows with your own Soroban contract

The escrow is the payment rail; app state that must be shared and trustless goes
in a Scaffold contract (see the `scaffold-stellar` and `soroban-contracts`
skills). Store the escrow `contractId` (as `Address`) and/or use a shared
`engagementId`. Example already in the repo: `contracts/reputation` reviews are
keyed by escrow address and shown in `EscrowCard` after release.

## Gotchas (verified 2026-10-09)

- API key: `PUBLIC_TRUSTLESS_WORK_API_KEY` in `app/.env` (from
  https://dapp.trustlesswork.com → profile → API Keys; the "Use case" profile
  field is required). Sent as `x-api-key`. Restart `npm start` after changing
  `.env`. Reads also need the key (401 without it).
- It's a client-visible key in this pattern: fine for testnet/workshops, never
  commit `.env`.
- Rate limit ~50 req/min per key: don't poll the indexer in tight loops.
- The indexer can lag a few seconds after a write; `run()` already refetches.
- `/helper/set-trustline` no longer exists: add trustlines with the wallet
  (`usdc.ts`).
- SDK `useUpdateFromTxHash` is broken (wrong route). Not needed when you send
  via `run()`.
- Viewer: `https://viewer.trustlesswork.com/testnet/v1/<contractId>`.

## Deeper reference (load only what you need)

- `references/recipes.md`: role mappings + code sketches for common apps.
- `references/official/OFFICIAL_SKILL.md`: the official Trustless Work skill
  (vendored, Apache-2.0). Then
  `references/official/skills/react-sdk/hooks-reference.md` (every hook),
  `skills/api/multi-release-escrow.md` / `single-release-escrow.md` (every
  endpoint), `constitution.md` (role laws). Ignore `v2/` files.
- Live docs: https://docs.trustlesswork.com/trustless-work/llms.txt (append
  `.md` to any docs URL), Swagger: https://dev.api.trustlesswork.com/docs
