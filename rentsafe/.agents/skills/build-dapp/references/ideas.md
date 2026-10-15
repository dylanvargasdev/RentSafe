# Idea bank (each fits in a workshop)

⭐ = good first project. Pick the building blocks by need (see `SKILL.md`, step
2): most ideas below need **no escrow**.

## Without escrows (a Soroban contract, maybe tokens or direct payments)

1. ⭐ **Polls / voting**: anyone creates a poll, people vote once, live results.
   · contract only · blueprint: `references/voting.md`.
2. ⭐ **Guestbook / wall of messages** for an event: sign in, leave a message,
   everything public and permanent. · contract only.
3. ⭐ **Proof-of-attendance badges (POAP-style)**: organizer creates an event,
   attendees claim an NFT with a code. · NFT contract (start from
   `contracts/nft-enumerable`).
4. **Tip jar / donations**: creators get a page, fans send USDC/XLM directly. ·
   direct transfers (classic payment or `TokenClient::transfer`), optional
   contract for a public leaderboard.
5. **Community points / loyalty**: a shop gives points, customers redeem them. ·
   fungible token (start from `contracts/fungible-allowlist`).
6. **Membership-gated voting**: only holders of a club NFT can vote. · NFT +
   polls contract (token-gated, see `references/voting.md`).
7. **Public registry**: certificates, diplomas, product authenticity, pet
   records… issuer writes, anyone verifies. · contract only.
8. **Shared to-do / bounty ideas board with upvotes**. · contract only.
9. **Reputation passport**: show every review an address received
   (`contracts/reputation` already does it). · contract only.

## With escrows (money waits for a condition)

Each lists: escrow type · roles · optional Soroban contract.

1. ⭐ **Chamba / gig board**: clients post jobs, freelancers apply, hire =
   multi-release escrow per deliverable. · approver/releaseSigner = client,
   serviceProvider + receivers = freelancer, resolver = platform · contract:
   `JobBoard` (post, apply, hire→store escrow id) + reputation.
2. ⭐ **Rental deposit**: tenant locks the deposit, landlord approves the refund
   or disputes for damages. · single-release, receiver = tenant · no contract
   needed (title = property address).
3. **Hackathon bounties**: sponsor funds prizes, judges approve, winners get
   paid per milestone. · multi-release, one milestone per prize/winner ·
   contract: submissions + judge votes.
4. **Group trip / vaquita**: friends each fund a shared escrow; the organizer
   gets paid per booking (flights, hotel) once the group approves. ·
   multi-release, many funders.
5. **Pre-order / crowdfunding**: backers fund; the maker unlocks money per
   production milestone; refund via dispute if it fails. · multi-release ·
   contract: backer list + rewards NFT.
6. **Grants in tranches**: DAO/community funds a project, releases per report. ·
   multi-release · contract: proposals + votes (approver = multisig/committee
   wallet).
7. **P2P marketplace (secondhand items)**: buyer funds, seller ships with
   tracking evidence, buyer approves on delivery. · single-release · contract:
   listings. Full tested blueprint: `trustless-work` skill,
   `references/recipes.md` → "Blueprint: multi-item marketplace".
8. **Tutoring / classes pack**: student prepays 10 classes, teacher marks each
   class done, student approves → paid per class. · multi-release (10
   milestones).
9. **Event tickets with refund guarantee**: attendees' payments sit in escrow
   until the event happens; cancelled event → resolver refunds. · single-release
   per order.
10. **Wedding/event vendor payments**: deposit + final payment milestones for
    each vendor.
11. **Bug bounty board**: maintainers fund bounties per issue; PR merged =
    evidence; approve + release. · multi-release · contract: issue registry
    linking GitHub issue ↔ escrow.
12. **Remittance with conditions**: family member abroad funds school fees
    released when the school confirms enrollment (approver = school). ·
    single-release.
13. **Proof-of-work NFT badge**: after a released escrow, mint an NFT
    certificate (enable `nft_enumerable_example` in `environments.toml` or write
    a minimal NFT).

Spicy add-ons (pick one if there's time): reputation-gated hiring (min score),
events feed via `useSubscription`, shareable escrow links (`/escrows?id=C…`), QR
code to fund an escrow, "agent mode": a page that explains each escrow state in
plain language.
