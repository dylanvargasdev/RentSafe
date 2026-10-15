# Escrow recipes

Role mappings for common apps. "platform" = an address your dApp controls (for a
workshop, the builder's own wallet). Every recipe reuses
`useEscrowTx().run(...)`.

## 1. Freelance gig board (multi-release)

- Client posts a job (store it: Soroban contract or just the escrow
  `title`/`description`).
- Freelancer applies → client picks one → deploy escrow: `approver = client`,
  `serviceProvider = freelancer`, `releaseSigner = client`,
  `disputeResolver = platform`, `platformAddress = platform`, milestones =
  deliverables with `amount` and `receiver = freelancer`.
- Client funds → freelancer marks done with evidence link → client approves +
  releases each.
- Use `engagementId = "job-<id>"` to find the escrow for a job:
  `getEscrowsByRole({ role: "approver", roleAddress: client, engagementId })`.

## 2. Rental / security deposit (single-release)

- `approver = landlord`, `serviceProvider = tenant`, `receiver = tenant`
  (refund), `releaseSigner = landlord`, `disputeResolver = platform`.
- Tenant funds the deposit. At move-out the landlord approves → release returns
  it.
- Damage? Landlord opens a dispute; resolver splits the balance (sum must equal
  balance).

## 3. Hackathon bounties / prizes (multi-release, many receivers)

- Sponsor deploys one escrow, one milestone per prize:
  `{ description: "1st place", amount: 500, receiver: winner }`.
- Receivers can be set when winners are known: `update-escrow` (platform only,
  BEFORE funding) or append milestones after funding.
- `approver = judges` wallet, `releaseSigner = sponsor`.

## 4. Marketplace purchase (single-release)

- `approver = buyer`, `serviceProvider = seller`, `receiver = seller`,
  `releaseSigner = buyer` (or platform for auto-release),
  `disputeResolver = platform`.
- Buyer funds at checkout; seller marks "shipped" (`newStatus: "shipped"`,
  evidence = tracking); buyer approves on delivery → release.

## 5. Crowdfunding with milestones (multi-release)

- Many backers fund the same escrow (anyone can fund).
- `serviceProvider = project`, `approver = community multisig / platform`,
  milestones = roadmap.
- Show progress with `escrow.balance` vs total of milestone amounts.

## 6. Grants in tranches (multi-release)

- Funder = approver + releaseSigner; grantee = serviceProvider + milestone
  receiver.
- Evidence = report links. Pairs well with `contracts/reputation`.

## 7. P2P / OTC trade (single-release)

- Seller of the off-chain good is `serviceProvider` + `receiver`; buyer is
  `approver` + funder.
- Buyer approves after receiving the off-chain asset (fiat transfer, item).

## Custom status vocabulary

`newStatus` is free text. Pick a small set per app and show it in the UI:
`"pending" → "in_progress" → "completed"` or `"shipped" → "delivered"`. Approval
is a separate flag set by the approver and cannot be undone.

## Code sketch: app-specific "create" button with fixed roles

```tsx
const { deployEscrow } = useInitializeEscrow()
const { run } = useEscrowTx()

const hire = (freelancer: string, job: Job) =>
	run("Hire freelancer", () =>
		deployEscrow(
			{
				signer: address!,
				engagementId: `job-${job.id}`,
				title: job.title,
				description: job.description,
				platformFee: 1,
				trustline: { address: USDC.address, symbol: USDC.symbol },
				roles: {
					approver: address!,
					releaseSigner: address!,
					serviceProvider: freelancer,
					disputeResolver: address!,
					platformAddress: address!,
				},
				milestones: job.milestones.map((m) => ({
					description: m.title,
					amount: m.usdc,
					receiver: freelancer,
				})),
			},
			"multi-release",
		),
	)
```

## Blueprint: multi-item marketplace (validated by an agent run)

"I want an app to sell different items using escrows" → this design built and
passed `npm run check` from that single sentence. Escrow = single-release per
purchase; a small Soroban contract holds the listings (never money).

**Contract `marketplace`** (`contracts/marketplace`, constructor `--admin me`):

- `Item { id: u32, seller: Address, title: String, description: String, image_url: String, price: i128 /* 7 decimals */, status: Status, buyer: Option<Address>, escrow: Option<Address> }`,
  `enum Status { Listed, Reserved, Delisted }` (make it a `#[contracttype]`
  enum).
- `list_item(seller, …)` (seller auth), `reserve(buyer, id, escrow)` (buyer
  auth, first buyer wins, `buyer != seller`), `cancel_reservation(caller, id)`
  (buyer or seller, back to Listed), `delist(seller, id)`, `get_item(id)`,
  `count()`, `list_items(start, limit)` (cap `limit` at 50), admin `upgrade`.
- Doc comment on every error (they're the UI messages), caps on text lengths,
  TTL extension on writes, tests for auth failures.

**Buy flow (3 signatures, in this order)**:

1. `deployEscrow` single-release: `amount = Number(item.price) / 1e7`,
   `engagementId = "market-<contractId first 8>-<itemId>"`, one milestone
   `"Deliver <title> to the buyer"`, roles: buyer = `approver` +
   `releaseSigner`; seller = `serviceProvider` + `receiver`; `platformOr(buyer)`
   = `platformAddress` + `disputeResolver`.
2. `reserve(buyer, id, escrowId)` on the contract.
3. `fundEscrow` (last, so a buyer who loses the reservation race never moved
   money).

**Orders page**: list items where you are buyer or seller, each with
`<EscrowCard escrow={…} doneStatus="shipped" doneLabel="Mark shipped" evidencePlaceholder="Tracking number" />`.
Offer "Cancel reservation" only while the escrow balance is 0 (abandoned
purchase). Released escrow = sold; show `ReputationPanel` for the counterpart.

**Testing it alone**: a seller can't buy their own item, so use two identities
in the same browser (Cavos "Sign in" + Freighter "Use a wallet") or seed demo
listings as `me` from the CLI (see `scaffold-stellar` skill, CLI one-liners) and
give `me` a USDC trustline so it can be paid.
