#![cfg(test)]
//! End-to-end tests: RentSafe `rental_registry` + the REAL Trustless Work
//! multi-release escrow contract (API V1, branch `multi-release-main`), both
//! running in the same Soroban test environment.
//!
//! Run with `npm run contracts:e2e` (scripts/contracts-e2e.mjs downloads the
//! Trustless Work contract at a pinned commit; it is not vendored here).
extern crate std;

use escrow::contract::{EscrowContract, EscrowContractClient};
use escrow::storage::types::{Escrow, Flags, Milestone, MilestoneUpdate, Roles, Trustline};
use rental_registry::{Error, RentalRegistry, RentalRegistryClient, Score, Status};
use soroban_sdk::{
    Address, Env, Map, String, Vec, contract, contractimpl, testutils::Address as _, token, vec,
};

/// Minimal SEP-41 token (balance/transfer/decimals: what the escrow uses).
/// A Stellar Asset Contract would need trustlines for G… accounts, such as
/// Trustless Work's fee account, which the local test ledger doesn't have.
#[contract]
pub struct TestUsdc;

#[contractimpl]
impl TestUsdc {
    pub fn mint(e: Env, to: Address, amount: i128) {
        let b: i128 = e.storage().persistent().get(&to).unwrap_or(0);
        e.storage().persistent().set(&to, &(b + amount));
    }
    pub fn balance(e: Env, id: Address) -> i128 {
        e.storage().persistent().get(&id).unwrap_or(0)
    }
    pub fn transfer(e: Env, from: Address, to: soroban_sdk::MuxedAddress, amount: i128) {
        from.require_auth();
        let to = to.address();
        let fb: i128 = e.storage().persistent().get(&from).unwrap_or(0);
        assert!(fb >= amount, "insufficient balance");
        e.storage().persistent().set(&from, &(fb - amount));
        let tb: i128 = e.storage().persistent().get(&to).unwrap_or(0);
        e.storage().persistent().set(&to, &(tb + amount));
    }
    pub fn decimals(_e: Env) -> u32 {
        7
    }
}

const U: i128 = 10_000_000; // 1 USDC
const RENT: i128 = 100 * U;
const DEPOSIT: i128 = 50 * U;
const FEE: i128 = 5 * U;

struct World {
    env: Env,
    usdc: token::Client<'static>,
    reg: RentalRegistryClient<'static>,
    tenant: Address,
    owner: Address,
    platform: Address,
}

fn world() -> World {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let token_id = env.register(TestUsdc, ());
    let usdc = token::Client::new(&env, &token_id);
    let tenant = Address::generate(&env);
    TestUsdcClient::new(&env, &token_id).mint(&tenant, &(1_000 * U));
    let admin = Address::generate(&env);
    let reg_id = env.register(RentalRegistry, (admin, token_id));
    World {
        reg: RentalRegistryClient::new(&env, &reg_id),
        usdc,
        tenant,
        owner: Address::generate(&env),
        platform: Address::generate(&env),
        env,
    }
}

fn milestone(env: &Env, desc: &str, amount: i128, receiver: &Address) -> Milestone {
    Milestone {
        description: String::from_str(env, desc),
        status: String::from_str(env, ""),
        evidence: String::from_str(env, ""),
        amount,
        flags: Flags {
            disputed: false,
            released: false,
            resolved: false,
            approved: false,
        },
        receiver: receiver.clone(),
    }
}

/// What the Trustless Work API builds for RentSafe's `deployEscrow` payload.
fn rentsafe_escrow(w: &World, resolver: &Address) -> Escrow {
    let e = &w.env;
    Escrow {
        engagement_id: String::from_str(e, "rentsafe-0"),
        title: String::from_str(e, "RentSafe · Consola"),
        description: String::from_str(e, "Alquiler"),
        roles: Roles {
            approver: w.tenant.clone(),
            service_provider: w.owner.clone(),
            platform: w.platform.clone(),
            release_signer: w.owner.clone(),
            dispute_resolver: resolver.clone(),
        },
        platform_fee: 0,
        milestones: vec![
            e,
            milestone(e, "Alquiler", RENT, &w.owner),
            milestone(e, "Depósito de garantía", DEPOSIT, &w.tenant),
            milestone(e, "Comisión RentSafe", FEE, &w.platform),
        ],
        trustline: Trustline {
            address: w.usdc.address.clone(),
        },
        receiver_memo: 0,
    }
}

fn deploy_escrow(w: &World, props: &Escrow) -> EscrowContractClient<'static> {
    let id = w.env.register(EscrowContract, ());
    let c = EscrowContractClient::new(&w.env, &id);
    c.initialize_escrow(props);
    c
}

fn booking(w: &World, start: u64) -> u32 {
    let id = w.reg.request(
        &w.tenant,
        &w.owner,
        &String::from_str(&w.env, "tec-consola"),
        &start,
        &(start + 86_400),
        &RENT,
        &DEPOSIT,
        &FEE,
    );
    w.reg.accept(&w.owner, &id);
    id
}

const fn net(amount: i128) -> i128 {
    amount - amount * 30 / 10_000 // Trustless Work 0.3%
}

#[test]
fn happy_path_with_real_escrow() {
    let w = world();
    let id = booking(&w, 1_000);
    let props = rentsafe_escrow(&w, &w.platform);
    let esc = deploy_escrow(&w, &props);

    // Verified link, then fund (same order as the app).
    w.reg.link_escrow(&w.tenant, &id, &esc.address);
    let b = w.reg.get_booking(&id);
    assert_eq!(b.status, Status::EscrowLinked);
    assert_eq!(b.arbiter, Some(w.platform.clone()));
    esc.fund_escrow(&w.tenant, &props, &(RENT + DEPOSIT + FEE));
    assert_eq!(w.usdc.balance(&esc.address), RENT + DEPOSIT + FEE);

    // Owner marks the delivery (rent + fee milestones), tenant confirms, owner collects.
    let set_status = |i: u32, status: &str| {
        esc.change_milestone_status(
            &vec![
                &w.env,
                MilestoneUpdate {
                    index: i,
                    status: String::from_str(&w.env, status),
                    evidence: Some(String::from_str(&w.env, "nota")),
                },
            ],
            &w.owner,
        )
    };
    set_status(0, "entregado");
    set_status(2, "entregado");
    esc.approve_milestone(&0, &w.tenant);
    esc.approve_milestone(&2, &w.tenant);
    esc.release_milestone_funds(&w.owner, &0);
    esc.release_milestone_funds(&w.owner, &2);
    assert_eq!(w.usdc.balance(&w.owner), net(RENT));
    assert_eq!(w.usdc.balance(&w.platform), net(FEE));

    // Return: owner registers it, tenant approves, owner releases the deposit.
    esc.change_milestone_status(
        &vec![
            &w.env,
            MilestoneUpdate {
                index: 1,
                status: String::from_str(&w.env, "devuelto"),
                evidence: Some(String::from_str(&w.env, "Todo bien")),
            },
        ],
        &w.owner,
    );
    esc.approve_milestone(&1, &w.tenant);
    esc.release_milestone_funds(&w.owner, &1);
    assert_eq!(
        w.usdc.balance(&w.tenant),
        1_000 * U - RENT - DEPOSIT - FEE + net(DEPOSIT)
    );
    assert_eq!(w.usdc.balance(&esc.address), 0);

    w.reg.complete(&w.owner, &id);
    w.reg
        .review(&w.tenant, &id, &5, &String::from_str(&w.env, "Excelente"));
    w.reg
        .review(&w.owner, &id, &4, &String::from_str(&w.env, "Puntual"));
    assert_eq!(w.reg.score_of(&w.owner), Score { count: 1, total: 5 });
    assert_eq!(w.reg.bookings_of(&w.platform).len(), 1);
}

/// Trustless Work refuses to approve a milestone whose status is empty (and the
/// API can't set one at deploy time): the owner must mark the delivery first.
#[test]
fn approving_without_a_status_fails() {
    let w = world();
    let id = booking(&w, 1_000);
    let props = rentsafe_escrow(&w, &w.platform);
    let esc = deploy_escrow(&w, &props);
    w.reg.link_escrow(&w.tenant, &id, &esc.address);
    esc.fund_escrow(&w.tenant, &props, &(RENT + DEPOSIT + FEE));
    assert!(esc.try_approve_milestone(&0, &w.tenant).is_err());
    assert!(esc.try_approve_milestone(&1, &w.tenant).is_err());
}

#[test]
fn delivery_dispute_with_real_escrow() {
    let w = world();
    let id = booking(&w, 1_000);
    let props = rentsafe_escrow(&w, &w.platform);
    let esc = deploy_escrow(&w, &props);
    w.reg.link_escrow(&w.tenant, &id, &esc.address);
    esc.fund_escrow(&w.tenant, &props, &(RENT + DEPOSIT + FEE));

    // "No recibí el bien": the tenant freezes every milestone.
    for i in 0..3u32 {
        esc.dispute_milestone(&i, &w.tenant);
    }
    w.reg.open_dispute(&w.tenant, &id);
    // The owner can't release a disputed milestone.
    assert!(esc.try_release_milestone_funds(&w.owner, &0).is_err());

    // Arbiter: 20 USDC of the rent to the owner, the rest back to the tenant.
    let split = |pairs: &[(&Address, i128)]| {
        let mut m = Map::new(&w.env);
        for (a, v) in pairs {
            m.set((*a).clone(), *v);
        }
        m
    };
    esc.resolve_milestone_dispute(
        &w.platform,
        &0,
        &split(&[(&w.owner, 20 * U), (&w.tenant, RENT - 20 * U)]),
    );
    esc.resolve_milestone_dispute(&w.platform, &1, &split(&[(&w.tenant, DEPOSIT)]));
    esc.resolve_milestone_dispute(&w.platform, &2, &split(&[(&w.tenant, FEE)]));
    assert_eq!(w.usdc.balance(&esc.address), 0);

    // Only the escrow's arbiter (or the admin) closes it in the registry.
    assert_eq!(
        w.reg.try_resolve_dispute(&w.tenant, &id),
        Err(Ok(Error::Unauthorized))
    );
    w.reg.resolve_dispute(&w.platform, &id);
    assert_eq!(w.reg.get_booking(&id).status, Status::Resolved);
    let owner_got = w.usdc.balance(&w.owner);
    assert!(
        owner_got > 19 * U && owner_got <= 20 * U,
        "owner got {owner_got}"
    );
}

#[test]
fn registry_rejects_bad_real_escrows() {
    let w = world();
    let id = booking(&w, 1_000);

    // Tenant as dispute resolver: rejected.
    let bad = deploy_escrow(&w, &rentsafe_escrow(&w, &w.tenant));
    assert_eq!(
        w.reg.try_link_escrow(&w.tenant, &id, &bad.address),
        Err(Ok(Error::EscrowRolesMismatch))
    );
    // Rent milestone pays someone else: rejected.
    let mut p = rentsafe_escrow(&w, &w.platform);
    p.milestones
        .set(0, milestone(&w.env, "Alquiler", RENT, &w.platform));
    let bad = deploy_escrow(&w, &p);
    assert_eq!(
        w.reg.try_link_escrow(&w.tenant, &id, &bad.address),
        Err(Ok(Error::EscrowMilestonesMismatch))
    );
    // Percentage platform fee (would be taken from the deposit refund): rejected.
    let mut p = rentsafe_escrow(&w, &w.platform);
    p.platform_fee = 100;
    let bad = deploy_escrow(&w, &p);
    assert_eq!(
        w.reg.try_link_escrow(&w.tenant, &id, &bad.address),
        Err(Ok(Error::EscrowAssetMismatch))
    );
    // Un-initialized escrow contract: unreadable.
    let empty = w.env.register(EscrowContract, ());
    assert_eq!(
        w.reg.try_link_escrow(&w.tenant, &id, &empty),
        Err(Ok(Error::EscrowUnreadable))
    );
    // The right one still links.
    let good = deploy_escrow(&w, &rentsafe_escrow(&w, &w.platform));
    w.reg.link_escrow(&w.tenant, &id, &good.address);
    let _ = Vec::<u32>::new(&w.env);
}
