# On-chain or off-chain? (decide per piece of data)

Don't put everything on-chain by reflex. For each piece of data in the idea,
decide where it lives. When the answer depends on what the user values (privacy,
cost, effort), **ask them**: explain the trade-off in 2–3 plain sentences, give
your recommendation, and let them choose.

## The trade-offs

|                             | On-chain (Soroban contract)                                                | Off-chain                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Who can change it           | Only via the contract's rules; nobody can secretly edit it                 | Whoever controls the server/database (you)                                                                                  |
| Who can see it              | **Everyone, forever** (even "deleted" data stays in history)               | Only who you allow                                                                                                          |
| Verifiable by others        | Yes, anyone can check it without trusting you                              | Only if they trust you                                                                                                      |
| Cost                        | A small fee per write (free test XLM on testnet) + storage rent (TTL)      | Hosting/database costs, usually none for reads                                                                              |
| Size                        | Small: short text, numbers, addresses (entries ~64 KB max; keep them tiny) | Anything: images, files, long text                                                                                          |
| Speed                       | ~5 s per write, needs a wallet signature                                   | Instant, no signature                                                                                                       |
| Queries                     | No search/SQL: read by key, keep simple indexes, use events                | Full search, filters, sorting                                                                                               |
| Deleting / editing          | Not really possible (bad for personal data)                                | Possible (privacy laws, typos)                                                                                              |
| Infrastructure in THIS repo | **Already there**: Scaffold deploys it, no server needed                   | **Not there yet**: you'd add a service (e.g. Supabase/Firebase) with its own keys, or use `localStorage` (one browser only) |

Rule of thumb: **on-chain = what people must be able to trust without trusting
you** (votes, ownership, balances, who agreed to what, rules that release
money). **Off-chain = big, private, editable or high-frequency data** (photos,
long descriptions, personal info, chat, drafts, analytics).

## Common placements

| Data                                                        | Usually                                  | Why                                         |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Votes, results, eligibility rules                           | on-chain                                 | the whole point is that nobody can rig them |
| Ownership (NFTs, badges, tokens), balances                  | on-chain                                 | must be verifiable and transferable         |
| Agreements and money flows (escrows, payments)              | on-chain                                 | money rules                                 |
| Reviews / reputation                                        | on-chain                                 | tamper-proof history                        |
| Listings: title, price, seller                              | on-chain                                 | others browse and act on them               |
| Images, files, long descriptions                            | off-chain URL (+ optional hash on-chain) | size; the hash proves it wasn't swapped     |
| Names, emails, phone numbers, addresses, medical/legal data | **off-chain, never on-chain**            | public forever, can't be deleted            |
| Drafts, UI preferences                                      | `localStorage`                           | one user, one browser, no trust needed      |
| Chat, notifications, analytics                              | off-chain service                        | high frequency, private                     |

Hybrid trick: store the content off-chain and its **hash** on-chain
(`BytesN<32>`), so anyone can verify the off-chain copy wasn't changed.

## How to ask (template, in the user's language)

> "Where should **[data]** live? **On-chain**: nobody (not even you) can alter
> it and anyone can verify it, but it's public forever and each change costs a
> small fee. **Off-chain**: private and editable, but people have to trust you,
> and this repo has no database yet (we'd add one, e.g. Supabase). For this app
> I recommend **[X]** because **[reason]**. Which do you prefer?"

Ask only for data where it's a genuine choice. Obvious cases (personal data →
off-chain; votes in a voting app → on-chain) don't need a question: just state
the decision in the plan. If the user can't answer (non-interactive run), pick
the recommendation and say so.

## Off-chain options, from simplest

1. **A URL field** (image hosted anywhere; IPFS via a pinning service if it
   should be permanent). Needs nothing new.
2. **`localStorage`**: per-browser, for drafts and preferences only.
3. **A hosted database** (Supabase, Firebase…): needs an account, project keys
   in `app/.env` (`PUBLIC_*` only for keys designed to be public) and access
   rules. Mention the setup effort before choosing it.
4. **Your own backend**: most flexible, most work. Not for a workshop.
