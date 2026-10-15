# Vendored copy

This folder is a verbatim copy of the official Trustless Work agent skill:

- Source: https://github.com/Trustless-Work/trustlesswork-skill (`trustless-work-dev/`)
- Commit: `80e2467f34041b9f70e66d6c2f567fc76ba9b1bb` (2026-09-26)
- License: Apache-2.0 (see `LICENSE` in this folder). Only change: `SKILL.md` was renamed to
  `OFFICIAL_SKILL.md` so harnesses that scan folders recursively don't register it as a
  second skill. Start reading there.

It lives under `references/` (not as its own skill) so agents load the
repo-specific `../../SKILL.md` first. This repo uses **V1** (`@trustless-work/escrow@3.0.5`):
ignore the `v2/` files unless the user explicitly asks for V2 (beta).

Known differences with the live API/SDK found while building this repo (2026-10-09):
- `POST /helper/set-trustline` does not exist anymore (404). Add trustlines with the
  wallet (see `app/src/trustless/usdc.ts`).
- SDK 3.0.5 `useUpdateFromTxHash` calls a route that 404s; the live route is
  `PUT /indexer/update-from-txhash`.

To update: re-copy the folder from a newer commit and update the hash above.
