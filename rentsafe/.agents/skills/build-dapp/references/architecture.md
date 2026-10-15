# Architecture patterns

Pick the smallest pattern that fits:

| Pattern                           | When                                                                           | Escrow? |
| --------------------------------- | ------------------------------------------------------------------------------ | ------- |
| **0. Contract only**              | shared state and rules: polls, registries, guestbooks, profiles, badges, games | no      |
| **1. Contract + direct payments** | money goes straight to someone: tips, donations, pay-to-enter                  | no      |
| **A. Escrow only**                | the app is just conditional payments: deposits, simple freelance               | yes     |
| **B. Escrow + registry contract** | people browse things, then a deal holds money: marketplaces, gig boards        | yes     |
| **C. Contract as a role holder**  | advanced, unsupported by Trustless Work                                        | yes     |

## Pattern 0: contract only (most non-payment apps)

Your Soroban contract holds the state and enforces the rules; the frontend reads
it through the generated client and users sign writes with `useWallet()`. No
Trustless Work, no API key. Example: `references/voting.md`.

## Pattern 1: contract + direct payments

When value moves immediately, transfer it directly: a classic payment built with
`@stellar/stellar-sdk` (see `app/src/trustless/usdc.ts` for the
build-sign-submit pattern) or `TokenClient::transfer(from, to, amount)` inside
your contract (the payer `require_auth`s). An escrow would only add steps.

```
 Browser (app/)                     Stellar testnet
 ┌───────────────────────┐          ┌───────────────────────────────┐
 │ React page            │  sign    │ Your Soroban contract (C…)    │  ← Scaffold deploys,
 │  ├ generated client ──┼─────────▶│  listings / profiles / reviews│    TS client generated
 │  ├ useEscrowTx ───┐   │          │                               │
 │  └ useWallet()    │   │          │ Trustless Work escrow (C…)    │  ← one per deal, deployed
 └───────────────────┼───┘          │  holds USDC, enforces roles   │    via TW API
                     │ build/send   └───────────────────────────────┘
                     ▼                          ▲
           Trustless Work API ──────────────────┘ (returns unsigned XDR, submits signed XDR,
           (dev.api.trustlesswork.com)              indexes escrows for queries)
```

## Pattern A: escrow-only

All state = escrows. Encode your app's object in `title`, `description`,
`engagementId` (e.g. `"job-<uuid>"`) and milestone
`description`/`status`/`evidence`. List with `useGetEscrowsFromIndexerByRole` /
`BySigner` and filter by `engagementId` or `title`. Good for: deposits, simple
freelance, pre-orders.

## Pattern B: escrow + registry contract (most workshop apps)

A small Soroban contract holds the things people browse before money moves (job
posts, listings, bounty specs, profiles). When a deal starts, deploy the escrow
and save its `contractId` in your contract (`escrow: Option<Address>`), or use
`engagementId = "<kind>-<id>"` to find it. Flow: `post()` (contract) →
`deployEscrow` (TW) → `link_escrow(id, escrowId)` (contract) →
fund/approve/release (TW) → `review()` (reputation). Remember: the contract
can't see TW off-chain index; the frontend orchestrates both.

## Pattern C: contract as a role holder (advanced, unsupported by TW)

TW roles are checked with `require_auth`, so a contract address _could_ be the
approver (e.g. a voting contract approves when quorum is reached) by invoking
the escrow contract directly. Not documented/supported by Trustless Work and not
indexed automatically. Only for experienced builders; prefer having a human
wallet act on the contract's decision.

## Where data goes

Short version below; full trade-offs and how to ask the user in
`data-placement.md`.

| Data                                                                          | Put it in                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| Money, who can move it, deal status                                           | Trustless Work escrow                                  |
| Public, shared, must be tamper-proof (listings, votes, reputation, ownership) | Soroban contract                                       |
| Big blobs (images, long text, files)                                          | Off-chain (IPFS/URL); store only the URL/hash on-chain |
| UI preferences, drafts                                                        | `localStorage`                                         |
| Secrets                                                                       | Nowhere in the frontend. Never.                        |
