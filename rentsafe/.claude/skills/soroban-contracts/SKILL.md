---
name: soroban-contracts
description:
  Write, test and harden Soroban smart contracts in Rust for this repo
  (soroban-sdk 26, OpenZeppelin stellar-contracts 0.7.2). Use when creating or
  editing anything under contracts/, designing on-chain state, auth, events,
  errors, token transfers (XLM/USDC via SAC), cross-contract calls, unit tests,
  or reviewing a contract before deploy.
license: Apache-2.0
metadata:
  soroban-sdk: "26.1.x (workspace pin in Cargo.toml)"
  openzeppelin: "stellar-tokens / stellar-access / stellar-macros 0.7.2"
---

# Soroban contracts (soroban-sdk 26)

Contracts live in `contracts/<crate>/`, are Cargo workspace members, compile to
`wasm32v1-none`, and are deployed by Scaffold (see `scaffold-stellar` skill).
Reference implementation to copy from: **`contracts/reputation`** (storage +
auth + errors + events + TTL + tests). OpenZeppelin-based examples:
`contracts/fungible-allowlist`, `contracts/nft-enumerable`.

Workflow: design state → write tests → implement → `cargo test -p <crate>` →
register in `environments.toml` → `npm start` deploys + generates the TS client.

## Skeleton

```rust
#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// No job with this id.          <- REQUIRED: this doc comment is the error
    NotFound = 1,                  //    message users see in the frontend
    /// Only the job owner can do this.
    Unauthorized = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Job { pub owner: Address, pub title: String, pub budget: i128, pub escrow: Option<Address> }

#[contracttype]
enum DataKey { Admin, Counter, Job(u32) }                   // storage keys

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JobPosted { #[topic] pub owner: Address, pub id: u32 }

#[contract]
pub struct JobBoard;

#[contractimpl]
impl JobBoard {
    pub fn __constructor(env: Env, admin: Address) {           // runs once at deploy
        env.storage().instance().set(&DataKey::Admin, &admin);  // environments.toml: constructor_args = "--admin me"
    }

    pub fn post(env: Env, owner: Address, title: String, budget: i128) -> Result<u32, Error> {
        owner.require_auth();                                   // the caller must sign as `owner`
        let id: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        env.storage().instance().set(&DataKey::Counter, &(id + 1));
        let key = DataKey::Job(id);
        env.storage().persistent().set(&key, &Job { owner: owner.clone(), title, budget, escrow: None });
        env.storage().persistent().extend_ttl(&key, 17_280 * 29, 17_280 * 30);
        JobPosted { owner, id }.publish(&env);
        Ok(id)
    }

    pub fn get(env: Env, id: u32) -> Result<Job, Error> {
        env.storage().persistent().get(&DataKey::Job(id)).ok_or(Error::NotFound)
    }
}

mod test;
```

`Cargo.toml`: copy `contracts/reputation/Cargo.toml` (crate-type `cdylib`,
`soroban-sdk = { workspace = true }`, dev-dep with `features = ["testutils"]`).

## Storage: pick the right tier

| Tier           | Use for                                                   | Notes                                                                       |
| -------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `instance()`   | small config: admin, counters, settings                   | loaded on every call; shares the contract's TTL. Keep it tiny               |
| `persistent()` | user data that must survive (listings, balances, reviews) | each key has its own TTL; `extend_ttl(&key, threshold, extend_to)` on write |
| `temporary()`  | short-lived data (nonces, sessions)                       | cheap, deleted when TTL expires, can't be restored                          |

- Ledgers close every ~5 s: 1 day ≈ 17,280 ledgers. Extend TTL whenever you
  write important data; instance:
  `env.storage().instance().extend_ttl(threshold, extend_to)`.
- Entries have a size limit (~64 KB): **never** keep unbounded `Vec`/`Map` in
  one key. Use one key per item (`DataKey::Job(id)`) + a counter, or cap lists
  (see `MAX_REVIEWS_PER_SUBJECT`).
- There is no "list all keys": keep an index (counter or per-user `Vec<u32>`
  capped) if the UI needs to enumerate.

## Auth

- `addr.require_auth()` = "this call must be authorized by `addr`" (user
  signature, or the calling contract if `addr` is a contract). Put it FIRST, on
  the address whose assets/state change.
- Admin pattern: store admin in instance storage,
  `fn require_admin(env) { admin.require_auth() }`.
- Never trust an `Address` argument without `require_auth()` when acting on its
  behalf.
- `env.current_contract_address()` = the contract itself (to hold funds).

## Tokens (XLM, USDC, any SEP-41)

```rust
use soroban_sdk::token::TokenClient;
let usdc = TokenClient::new(&env, &usdc_address);           // pass the SAC address as an arg / constructor
usdc.transfer(&from, &env.current_contract_address(), &amount); // `from` must have require_auth'd
```

- Amounts are `i128` with **7 decimals** (1 USDC = 10_000_000). Frontend
  converts.
- Testnet SAC ids (verified with `stellar contract id asset`): XLM
  `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`, USDC (Circle
  testnet) `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`. Pass them
  via `constructor_args` instead of hardcoding.
- For escrow-style payments prefer **Trustless Work** (audited, indexed,
  UI-ready) over writing your own escrow logic. Write a contract for app state
  around it (listings, profiles, votes, badges).

## Cross-contract calls

```rust
#[soroban_sdk::contractclient(name = "ReputationClient")]
pub trait ReputationInterface { fn score_of(env: Env, subject: Address) -> Score; }
let score = ReputationClient::new(&env, &reputation_id).score_of(&subject);
```

(Types used across contracts must be redeclared with the same `#[contracttype]`
shape, or use
`soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/reputation.wasm")`
after building it.)

## Errors, events, misc

- Every `#[contracterror]` variant needs a `///` doc comment written for end
  users, in the app's language: the TS client surfaces it as
  `tx.result.unwrapErr().message` (verified). Without it users see an empty
  error.
- Don't name a function argument `options`: it collides with the generated TS
  client's own `options` parameter and the client won't build.
- Events: a `#[contractevent] struct VoteCast` is published with the topic
  `"vote_cast"` (snake_case) followed by its `#[topic]` fields; that's the
  `topic` string `useSubscription` expects.
- Return `Result<T, Error>` for expected failures; `panic!`/`unwrap` only for
  impossible states.
- Events: `#[contractevent]` struct + `.publish(&env)` (`env.events().publish`
  is deprecated). `#[topic]` fields are indexed/filterable. Frontend:
  `useSubscription(contractId, topic, cb)`.
- Time: `env.ledger().timestamp()` (unix seconds), `env.ledger().sequence()`.
- Randomness `env.prng()` is NOT safe for anything with money at stake
  (validators can bias it).
- `#![no_std]`: no `format!`, no floats, no `std::String`. Use
  `soroban_sdk::{String, Symbol, Vec, Map, Bytes}`. `symbol_short!("abc")` for
  ≤9-char symbols.
- Upgradeable dev loop: an admin-gated
  `pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>)` calling
  `env.deployer().update_current_contract_wasm(new_wasm_hash)` lets Scaffold
  upgrade in place (keeps state) instead of redeploying a fresh contract on
  every save. The name and signature must be exactly that. Keep the storage
  layout compatible across upgrades (only add keys/fields); if you change a
  stored type, force a fresh deploy (see `scaffold-stellar` must-knows).

## Tests (`src/test.rs`, run `cargo test -p <crate>`)

```rust
#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{testutils::{Address as _, Events as _}, Address, Env, Event as _, String};

#[test]
fn posts_job() {
    let env = Env::default();
    env.mock_all_auths();                                  // auto-approve require_auth
    let admin = Address::generate(&env);
    let id = env.register(JobBoard, (admin.clone(),));     // constructor args as a tuple
    let client = JobBoardClient::new(&env, &id);
    let owner = Address::generate(&env);
    let job_id = client.post(&owner, &String::from_str(&env, "Logo"), &100);
    // events().all() only holds events of the LAST invocation: assert right after it
    assert_eq!(env.events().all(), std::vec![JobPosted { owner: owner.clone(), id: job_id }.to_xdr(&env, &id)]);
    assert_eq!(env.auths()[0].0, owner);                    // who had to sign
    assert_eq!(client.try_get(&99), Err(Ok(Error::NotFound))); // try_* returns contract errors
}
```

- Tokens in tests:
  `let sac = env.register_stellar_asset_contract_v2(admin.clone());`
  `soroban_sdk::token::StellarAssetClient::new(&env, &sac.address()).mint(&user, &1_000_0000000);`
- Time travel: `env.ledger().set_timestamp(1_700_000_000);`
- Tests write `test_snapshots/` (gitignored).

## Security checklist (before any deploy that holds value)

- [ ] Every state-changing fn calls `require_auth()` on the right address; admin
      fns check admin.
- [ ] No unbounded loops/collections; per-item keys; caps on user-supplied
      lengths.
- [ ] Amounts: `i128`, reject `<= 0`, use `checked_*` or rely on
      `overflow-checks = true` (set in release profile).
- [ ] Persistent data TTL extended on write; nothing critical in `temporary()`.
- [ ] Re-initialization impossible (constructor only, or guard `has(&Admin)`).
- [ ] External token/contract addresses come from trusted config
      (constructor/admin), not arbitrary args, when it matters.
- [ ] Errors are explicit `#[contracterror]` variants; tests cover auth failures
      and every error.
- [ ] No secrets in contract or repo; deployer keys stay in `app/.config`
      (gitignored).

More: https://developers.stellar.org/docs/build/smart-contracts (append `.md`),
https://docs.rs/soroban-sdk/26.1.1, OpenZeppelin Stellar:
https://docs.openzeppelin.com/stellar-contracts (+ wizard
https://wizard.openzeppelin.com/stellar). Official Stellar agent skills:
https://skills.stellar.org (note: they target newer SDK versions than this
repo's pin).
