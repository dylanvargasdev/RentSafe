---
name: build-dapp
description:
  End-to-end workflow to turn ANY dApp idea into a working app in this repo -
  polls/voting, registries, NFTs/badges, tokens, tips, marketplaces, freelance,
  deposits… Short interview, pick only the building blocks the idea needs
  (Soroban contract, direct payments, Trustless Work escrow, Cavos login), build
  in small verified steps, demo checklist. Use when the user describes an app
  idea, says "build/make/create an app/dApp", "I want an app where…", asks what
  to build, or invokes /build-dapp.
license: Apache-2.0
---

# Build a dApp from an idea

You are pairing with someone who may have learned what a blockchain is this
week. Your job: get them from idea → working testnet demo fast, explaining just
enough as you go. Speak the user's language. Keep momentum: small steps, each
one verified.

**This repo ships several building blocks. Use only the ones the idea needs.**
Escrows are one of them, not the default: a poll, a guestbook or an NFT badge
app has no escrow.

## 0. Ground yourself (once per session)

- Read `AGENTS.md` and skim `contracts/reputation` (the contract template every
  app can copy).
- Run `npm install` (if `node_modules` is missing) and `npm run doctor`. If
  something is missing, fix or explain that first. The Trustless Work key only
  matters if the app uses escrows; the Cavos App ID only if it uses email/Google
  login.

## 1. Interview (max 3 questions, skip what's obvious)

Pin down, in plain words:

1. **Who uses it and what do they do?** (create a poll, vote, list an item, hire
   someone, collect a badge…)
2. **Does money or value move? If so, does it go straight to someone, or must it
   WAIT until something happens** (a delivery, an approval, a deadline)?
3. **Which data must be tamper-proof and verifiable by anyone, and which is
   private, big or changes often?** Don't assume everything goes on-chain: see
   step 2b.

If the user is vague, propose a concrete version ("I'll build X with Y and Z,
ok?") instead of asking more. Use `references/ideas.md` for inspiration.

## 2. Pick the building blocks (decide explicitly, say why)

| The idea needs…                                                                                                                                          | Use                                                                                                           | Skill                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Shared state/rules anyone can verify: votes, polls, registries, guestbooks, profiles, attestations, game state                                           | **Your own Soroban contract** (Scaffold deploys it + generates the TS client)                                 | `soroban-contracts`, `scaffold-stellar` |
| Tokens or NFTs: points, membership, badges, certificates, governance tokens                                                                              | **OpenZeppelin contracts** via Scaffold (`contracts/fungible-allowlist`, `nft-enumerable` are ready examples) | `soroban-contracts`, `scaffold-stellar` |
| Money that goes straight to someone: tips, donations, pay-to-enter, splitting a payment                                                                  | **Direct transfers**: a classic payment, or `TokenClient::transfer` inside your contract. No escrow           | `soroban-contracts`, `stellar-basics`   |
| Money that must be **held until a condition** between people who don't fully trust each other: deliveries, milestones, deposits, bounties, with disputes | **Trustless Work escrow**                                                                                     | `trustless-work`                        |
| Users who aren't crypto people                                                                                                                           | **Cavos** "Sign in" with email/Google (already wired)                                                         | `cavos`                                 |

Rules:

- **No escrow unless funds must wait for a condition.** If nobody holds money,
  or it goes directly to the recipient, don't use Trustless Work (and don't ask
  for its API key).
- Most apps are **one small contract + 1–3 pages**. Combine blocks only when the
  idea really has both parts (e.g. a marketplace = listings contract + escrow
  per purchase).
- Blueprints: **voting/polls** → `references/voting.md` (contract only);
  **multi-item marketplace** → `trustless-work` skill, `references/recipes.md`
  (contract + escrow, validated end to end).

## 2b. Decide on-chain vs off-chain, per piece of data

List the data the app handles and place each piece using
`references/data-placement.md`. On-chain means tamper-proof and verifiable by
anyone, but public forever, small, a fee per write and no deleting. Off-chain
means private, editable and unlimited, but people must trust whoever runs it,
and **this repo has no database yet** (adding one is real work).

- Obvious cases: decide and state them in the plan (personal data → off-chain,
  never on-chain; the votes of a voting app → on-chain; images → URL).
- **Genuine choices** (a comment wall, profiles, descriptions, anything where
  privacy, cost or effort matter): **ask the user**, explaining the trade-off in
  2–3 plain sentences with your recommendation (template in
  `references/data-placement.md`). Ask these together with your plan, not one by
  one.

## 3. Design (write it down in 5–10 lines before coding)

- **Building blocks** chosen (table above) and why the others aren't needed.
- **Data placement**: what is on-chain, what is off-chain (and where), and the
  user's answers to any trade-off you asked about.
- **Contract** (if any): stored data, functions, who must sign each
  (`require_auth`), errors, events. See `references/architecture.md`.
- **Escrow** (only if chosen): type (single/multi-release) and role mapping with
  real people of the story (`trustless-work` skill, `references/recipes.md`).
- **Screens**: usually 1–3 pages. Replace the starter's Home with the app.
  Remove what the app doesn't use from what users SEE: nav links (e.g. "Escrow
  Studio" in a voting app), footer links and the page `<title>`. Keep the code,
  routes, providers and the `reputation` contract (starter components import its
  client); unused code is harmless.
- **Language**: write all UI text in the user's language, including the
  starter's shared components (`WalletButton`, `SetupChecklist`,
  `FundAccountButton`) and the contract's error doc comments (they are the
  messages users see).
- **Onboarding**: for non-crypto users make "Sign in with email/Google" the main
  path (Cavos, `cavos` skill, behind `useWallet()`).
- **Honest limits**: say what on-chain can't do for this idea (e.g. votes are
  public; one address ≠ one person).

Share the plan in a few bullet points. If you asked trade-off questions (step
2b), **wait for the answers** before building the parts they affect. If you
asked nothing, or the user says "decide for me", or nobody can answer
(non-interactive run), go ahead with your recommendations and say which ones you
picked.

## 4. Build in this order (verify after each step)

1. **Contract** (if any): write tests first, then code (`soroban-contracts`
   skill). ✅ `cargo test -p <crate>`
2. **Register + deploy**: add it to `environments.toml` (`scaffold-stellar`
   skill). With `npm start` running it deploys automatically; otherwise
   `npm run contracts:build`. ✅ the logs say
   `Successfully generated client for: <name>`
3. **UI**: new page(s) in `app/src/pages/`, routes in `app/src/App.tsx`, nav
   links in the header. Contract writes: `client.method(args, { publicKey })`,
   check `tx.result.isErr()`, then `signAndSend({ signTransaction })`. Escrow
   writes (only if used): `useEscrowTx().run(...)`. Reads through React Query.
   ✅ `npm run typecheck` and `npm run lint`
4. **Copy + polish**: clear labels, amounts with units, empty states, loading
   states ("confirm in your wallet…"), explorer links.
5. **Full check**: ✅ `npm run check`

If the app mixes a contract and an escrow: put the step that moves money LAST
(e.g. deploy escrow → reserve in your contract → fund), and give abandoned flows
a way out. In multi-user escrow apps the platform/dispute resolver is the
builder, not the customer: `platformOr(address)` (`trustless-work` skill).

On a fresh clone, run `npm run contracts:build` once before `npm run typecheck`
(the generated clients don't exist yet; the script tells you so).

You cannot click the wallet popup. After building, give the user a short manual
test script (e.g. "1. Sign in 2. Fund Account 3. Create a poll 4. Vote…"), and
ask them to paste any error they see. Use the `stellar-basics` error decoder.

## 5. Demo checklist

- [ ] `npm run check` passes.
- [ ] Happy path works end-to-end on testnet: one wallet, or two identities in
      one browser for two-party flows (Cavos "Sign in" + a Freighter account),
      or demo data seeded as `me` from the CLI.
- [ ] Each page explains in one sentence what's happening on-chain.
- [ ] Nav shows only what the app uses.
- [ ] No secrets committed (`git status`: `.env` must not appear).
- [ ] README section "What I built" with the idea, the building blocks and how
      to try it.
- [ ] (Optional) Deployed frontend: `scaffold-stellar` skill
      `references/deploy.md`.

## Guardrails

- Testnet only unless the user explicitly asks for mainnet (then: security
  checklist + review).
- Never ask for or handle secret keys/seed phrases. The wallet signs; the agent
  never does. Every signature goes through `useWallet().signTransaction` (works
  for Cavos and extension wallets).
- Don't edit generated code (`app-lib/clients/*`) or the vendored skill under
  `references/official`.
- Don't re-implement escrow logic in a custom contract: when funds must be held
  conditionally, Trustless Work is the payment rail.
- Keep diffs small and explain each step in 1–2 sentences. If a step fails
  twice, stop and show the user the error with your diagnosis instead of
  thrashing.
