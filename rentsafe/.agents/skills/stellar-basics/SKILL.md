---
name: stellar-basics
description:
  Stellar mental models for web3 beginners and the agent - accounts and keys,
  XLM and fees, stroops and decimals, trustlines and assets (USDC), Stellar
  Asset Contracts, testnet and Friendbot, wallets (Freighter), Horizon vs RPC,
  explorers, and what common transaction errors mean. Use when the user asks
  "what is…/why…" about Stellar or blockchain, when explaining what an app does
  on-chain, or when decoding a Stellar error.
license: Apache-2.0
---

# Stellar basics (explain simply, in the user's language)

The people using this repo may be new to blockchain. When you explain, use one
short analogy, then the precise term. Don't lecture: answer what was asked and
get back to building.

## Core ideas

| Concept         | Plain explanation                                              | Precise                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account         | Your "bank account" on Stellar, identified by a public address | `G…` public key; controlled by a secret `S…` key held by the wallet                                                                                                                        |
| Wallet          | App that holds your secret key and signs for you               | Two options here: **Cavos** (sign in with email/Google, the wallet lives in a secure iframe, no install) or an extension via Stellar Wallets Kit (Freighter, xBull, Lobstr, Albedo, Hana…) |
| Contract        | A program living on the network                                | Soroban smart contract, address `C…`, written in Rust → Wasm                                                                                                                               |
| XLM             | The network's own coin, pays fees                              | 1 XLM = 10,000,000 stroops. Fees are tiny (~0.00001–0.01 XLM)                                                                                                                              |
| Minimum balance | Accounts must keep a little XLM locked                         | 1 XLM base + 0.5 XLM per trustline/entry (testnet XLM is free)                                                                                                                             |
| Asset / token   | Any currency issued on Stellar (USDC, EURC…)                   | Identified by `CODE:ISSUER` (e.g. `USDC:GBBD47…`). All amounts have 7 decimals                                                                                                             |
| Trustline       | "I agree to hold this token" switch on your account            | Required before receiving any non-XLM asset (`changeTrust` operation)                                                                                                                      |
| SAC             | The smart-contract face of a classic asset                     | Stellar Asset Contract: lets Soroban contracts move XLM/USDC via the token interface                                                                                                       |
| Transaction     | A signed instruction (pay, call a contract…)                   | Built → signed by the wallet → submitted. Confirms in ~5 seconds, final (no reorgs)                                                                                                        |
| Testnet         | Practice network with fake money                               | Free XLM from Friendbot; reset every few months. Mainnet = real money                                                                                                                      |
| Escrow          | A neutral vault that releases money when conditions are met    | Here: Trustless Work contracts with roles (approver, service provider…)                                                                                                                    |

Golden rules to repeat often:

- **Secret keys (`S…`) and seed phrases never go in code, chats, `.env` or
  git.** The wallet signs.
- **Testnet only** in this workshop. Make sure the wallet is set to _Testnet_.
- Every on-chain action costs a tiny fee and needs the right signer.

## Getting test money

1. Friendbot (10,000 test XLM): the "Fund Account" button in the app header, or
   `https://friendbot.stellar.org/?addr=G…`, or
   `stellar keys fund <name> --network testnet`.
2. Test USDC: add the USDC trustline, then swap XLM→USDC on the testnet DEX
   (Escrow Studio setup button) or use https://faucet.circle.com (Stellar
   Testnet, 20 USDC / 2 h).

USDC testnet issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
(SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`). XLM SAC
(testnet): `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

## Infrastructure

- **RPC** (`https://soroban-testnet.stellar.org`): smart contracts (simulate,
  send, events).
- **Horizon** (`https://horizon-testnet.stellar.org`): accounts, balances,
  classic payments, DEX.
- **Explorers**: https://stellar.expert/explorer/testnet (search G…/C…/tx hash),
  Stellar Lab https://lab.stellar.org (build/sign/inspect txs, invoke
  contracts), Trustless Work viewer
  `https://viewer.trustlesswork.com/testnet/v1/<escrowId>`.

## Amounts

- Classic assets and SAC tokens: 7 decimals. `10.5 USDC` = `105000000` in
  contracts (`i128`).
- The Trustless Work API takes **human units** (`10.5`), not stroops.
- In TS: contract `i128`/`u64`/`i64` are `bigint` (`BigInt(x)`), `u32/i32` are
  `number`.

## Error decoder

| You see                                      | It means                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `op_no_trust` / `trustline entry is missing` | the account hasn't added the asset's trustline                                 |
| `op_underfunded`, `tx_insufficient_balance`  | not enough of the asset / XLM (incl. minimum balance)                          |
| `op_low_reserve`                             | would drop below the minimum XLM balance                                       |
| `tx_bad_seq`                                 | stale transaction (sequence number); rebuild and sign again                    |
| `tx_bad_auth` / `Error(Auth, InvalidAction)` | signed by the wrong account / missing `require_auth` signer                    |
| `Error(Contract, #N)`                        | the contract returned its own error number N (see its `#[contracterror]` enum) |
| `Error(Storage, MissingValue)`               | reading data that doesn't exist (or expired)                                   |
| `Error(Budget, ExceededLimit)`               | the call does too much work: loops/collections too big                         |
| `account not found`                          | account not created yet: fund it with Friendbot                                |
| wallet "network mismatch"                    | wallet is on another network: switch to Testnet                                |

Live sources: the `stellar-raven` MCP (https://raven.stellar.org/mcp, official
docs + ecosystem data; configured in this repo, needs a one-time sign-in) or the
docs index https://developers.stellar.org/llms.txt (index; append `.md` to any
docs URL for markdown).
