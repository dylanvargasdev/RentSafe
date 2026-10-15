# Blueprint: voting / polls (contract only, no escrow)

For "I want a voting app", "polls", "surveys", "let my community decide",
"elections for my club"… Nobody holds money, so: **one Soroban contract + 2–3
pages. No Trustless Work, no API key.** Cavos "Sign in" makes voting
frictionless for non-crypto people.

## Data placement (decide with the user)

- **On-chain**: polls (question, options, deadline), tallies, who already voted.
  That's the point: nobody, not even the app owner, can rig results.
- **Off-chain**: long descriptions or images → a URL field; voter names/emails →
  never on-chain (Cavos login already gives each person an address).
- **Ask the user**: "On-chain, anyone can see which address voted for what. Is
  open voting OK, or do you need secret ballots? (secret = much more complex:
  commit-reveal or zero-knowledge)". Default for a demo: open voting.
- **Ask if relevant**: should anyone create polls, or only some people
  (allowlist / members holding a token)?

## Contract `polls` (`contracts/polls`)

Copy `contracts/reputation` (Cargo.toml, storage/TTL/event/test patterns) and
adapt. Give it `__constructor(admin)` + an admin-gated
`upgrade(new_wasm_hash: BytesN<32>)` and register it with
`constructor_args = "--admin me"`: then each save upgrades the contract in place
and **existing polls survive** while you iterate (without it, every contract
edit deploys a new, empty contract and shared links break).

```text
Poll { id: u32, creator: Address, question: String, options: Vec<String>, ends_at: u64 }
PollView { poll: Poll, tally: Vec<u32> }        // what list/get return: no N+1 reads

DataKey::Admin                  instance   Address
DataKey::Count                  instance   u32 (next poll id)
DataKey::Poll(id)               persistent Poll
DataKey::Tally(id)              persistent Vec<u32> (one counter per option)
DataKey::Voted(id, voter)       persistent u32 (the option chosen)
```

Functions (sign = `require_auth` on that address):

- `create_poll(creator, question, choices, duration_secs) -> u32`: creator
  signs. **Name the argument `choices`, never `options`**: every generated TS
  method already has an `options` parameter, so `options` breaks the client
  build (TS2300 Duplicate identifier). Validate: 2–10 choices, none empty or
  duplicated, question ≤ 200 bytes, each choice ≤ 64 bytes, duration 60 s – 30
  days. `ends_at = env.ledger().timestamp() + duration_secs`. Tally starts as
  zeros. Emit `PollCreated { #[topic] creator, id }`.
- `vote(voter, poll_id, option: u32)`: voter signs. Errors if the poll doesn't
  exist, `timestamp >= ends_at`, `option >= options.len()`, or
  `Voted(id, voter)` exists. Increment the tally, store `Voted`. Emit
  `VoteCast { #[topic] poll_id, option }`.
- Reads: `get_poll(id) -> Result<PollView, Error>`,
  `vote_of(id, voter) -> Option<u32>`, `count()`,
  `list_polls(start, limit) -> Vec<PollView>` (cap `limit` at 50; newest-first
  ordering is done in the UI).
- `#[contracterror]` with a `///` user-facing message on each variant, written
  in the app's language: `PollNotFound`, `PollClosed`, `InvalidOption`,
  `AlreadyVoted`, `TooFewOptions`, `TooManyOptions`, `EmptyText`,
  `DuplicateChoice`, `TextTooLong`, `InvalidDuration`.
- TTL: extend `Poll`, `Tally` and `Voted` keys on every write to ~60 days
  (`17_280 * 60` ledgers) so they outlive the poll.

Tests (`cargo test -p polls`): create + vote + results; second vote →
`AlreadyVoted`; vote after `env.ledger().set_timestamp(ends_at)` → `PollClosed`;
bad option; 1 and 11 choices rejected; empty and duplicate choices rejected;
`env.auths()` shows the voter signed; `list_polls` respects the cap.

Register: `polls = { client = true, constructor_args = "--admin me" }` in
`[development.contracts]` (staging: `--admin testnet-user`). Import:
`import { polls } from "@stellar-scaffold/app-lib/clients"`.
`npm run contracts:build` fails loudly if the client couldn't be generated.

## Pages

- **Polls** (`/` or `/polls`): list with question, time left, total votes,
  leading option (all from `list_polls`). "Create poll" button.
- **Create** (`/polls/new`): question, 2–10 choice inputs, duration select (1 h,
  1 day, 1 week). Limits are in **bytes** (accents count 2): check with
  `new TextEncoder().encode(text).length`, not `maxLength`. After success,
  navigate to the poll.
- **Poll** (`/polls/:id`): option buttons while open; result bars (CSS width =
  votes / total); "You voted: X" from `vote_of`; countdown from
  `Number(ends_at) * 1000` (u64 is `bigint` in TS); share link. Live results:
  `useSubscription(polls.options.contractId, "vote_cast", refetch)` (the event
  name in snake_case), or refetch every ~10 s.

Reads that return `Result`: `const r = (await polls.get_poll({ id })).result` →
`if (r.isErr()) …` → `r.unwrap()`. Writes:
`polls.vote({ voter: address, poll_id, option }, { publicKey: address })` →
`if (tx.result.isErr()) …` → `signAndSend({ signTransaction })`. `vote_of`
returns `null` (not `undefined`) when the user hasn't voted.

Clean up the starter for this app: replace the Home page, remove the "Escrow
Studio" nav link, the Trustless Work footer link and the starter's page title.
Keep the escrow code and the `reputation` contract (other starter components
import its client).

## Honest limits (tell the user)

- **Votes are public**: anyone can see which address voted for what. Secret
  ballots need commit-reveal or zero-knowledge proofs (advanced).
- **One address ≠ one person**: addresses are free, so a determined person can
  vote many times. Options, from simple to strong: an **allowlist** chosen by
  the creator (`Allowed(id, addr)` keys, capped), **token-gated** voting (hold a
  membership NFT/token: `TokenClient::new(&env, &token).balance(&voter) > 0`,
  see the OpenZeppelin examples), or off-chain identity checks.
- Each vote is a transaction: voters need a little XLM (Friendbot on testnet;
  Cavos users too).

## When money DOES enter a poll

- Pay-to-vote or donations per option → direct transfers in `vote`
  (`TokenClient::transfer`), still no escrow.
- A prize pool held until the poll closes and someone judges the outcome →
  that's a conditional hold: now a Trustless Work escrow makes sense.
