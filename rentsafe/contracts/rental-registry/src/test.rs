#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{Address, Env, String, testutils::Address as _};

struct Ctx {
    env: Env,
    client: RentalRegistryClient<'static>,
    admin: Address,
    tenant: Address,
    owner: Address,
}

fn setup() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(RentalRegistry, (admin.clone(),));
    let client = RentalRegistryClient::new(&env, &id);
    let tenant = Address::generate(&env);
    let owner = Address::generate(&env);
    Ctx {
        env,
        client,
        admin,
        tenant,
        owner,
    }
}

fn listing(env: &Env) -> String {
    String::from_str(env, "acc-001")
}

fn request(c: &Ctx, start: u64, end: u64) -> u32 {
    c.client.request(
        &c.tenant,
        &c.owner,
        &listing(&c.env),
        &start,
        &end,
        &1_000_000_000,
        &500_000_000,
    )
}

#[test]
fn happy_path() {
    let c = setup();
    let id = request(&c, 100, 200);
    assert_eq!(id, 0);
    assert_eq!(c.client.get_booking(&id).status, Status::Requested);

    c.client.accept(&c.owner, &id);
    assert_eq!(c.client.active_bookings(&listing(&c.env)).len(), 1);

    let escrow = Address::generate(&c.env);
    c.client.link_escrow(&c.tenant, &id, &escrow);
    let b = c.client.get_booking(&id);
    assert_eq!(b.status, Status::EscrowLinked);
    assert_eq!(b.escrow, Some(escrow.clone()));
    assert_eq!(c.client.booking_of_escrow(&escrow), Some(id));

    c.client.complete(&c.owner, &id);
    assert_eq!(c.client.get_booking(&id).status, Status::Completed);
    assert_eq!(c.client.active_bookings(&listing(&c.env)).len(), 0);
    assert_eq!(c.client.count(), 1);
}

#[test]
fn rejects_invalid_requests() {
    let c = setup();
    let l = listing(&c.env);
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.tenant, &l, &1, &2, &10, &0),
        Err(Ok(Error::SelfRental))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &5, &5, &10, &0),
        Err(Ok(Error::InvalidPeriod))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &1, &2, &0, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &1, &2, &10, &-1),
        Err(Ok(Error::InvalidAmount))
    );
    let empty = String::from_str(&c.env, "");
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &empty, &1, &2, &10, &0),
        Err(Ok(Error::InvalidListing))
    );
}

#[test]
fn overlapping_accept_is_blocked() {
    let c = setup();
    let a = request(&c, 100, 200);
    let b = request(&c, 150, 250);
    let d = request(&c, 200, 300); // contiguous: allowed
    c.client.accept(&c.owner, &a);
    assert_eq!(c.client.try_accept(&c.owner, &b), Err(Ok(Error::Overlap)));
    c.client.accept(&c.owner, &d);
    // Cancelling frees the dates.
    c.client.cancel(&c.tenant, &a);
    c.client.accept(&c.owner, &b);
    assert_eq!(c.client.active_bookings(&listing(&c.env)).len(), 2);
}

#[test]
fn only_owner_accepts_and_only_tenant_links() {
    let c = setup();
    let id = request(&c, 1, 2);
    let stranger = Address::generate(&c.env);
    assert_eq!(
        c.client.try_accept(&c.tenant, &id),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(
        c.client.try_cancel(&stranger, &id),
        Err(Ok(Error::Unauthorized))
    );
    c.client.accept(&c.owner, &id);
    let escrow = Address::generate(&c.env);
    assert_eq!(
        c.client.try_link_escrow(&c.owner, &id, &escrow),
        Err(Ok(Error::Unauthorized))
    );
}

#[test]
fn escrow_cannot_be_reused_or_relinked() {
    let c = setup();
    let a = request(&c, 1, 2);
    let b = request(&c, 3, 4);
    c.client.accept(&c.owner, &a);
    c.client.accept(&c.owner, &b);
    let escrow = Address::generate(&c.env);
    c.client.link_escrow(&c.tenant, &a, &escrow);
    assert_eq!(
        c.client.try_link_escrow(&c.tenant, &b, &escrow),
        Err(Ok(Error::EscrowAlreadyUsed))
    );
    let other = Address::generate(&c.env);
    assert_eq!(
        c.client.try_link_escrow(&c.tenant, &a, &other),
        Err(Ok(Error::InvalidState))
    );
    // Once funds are in escrow, nobody can cancel from the registry.
    assert_eq!(
        c.client.try_cancel(&c.tenant, &a),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn invalid_transitions() {
    let c = setup();
    let id = request(&c, 1, 2);
    assert_eq!(
        c.client
            .try_link_escrow(&c.tenant, &id, &Address::generate(&c.env)),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(
        c.client.try_complete(&c.owner, &id),
        Err(Ok(Error::InvalidState))
    );
    c.client.reject(&c.owner, &id);
    assert_eq!(
        c.client.try_accept(&c.owner, &id),
        Err(Ok(Error::InvalidState))
    );
    assert_eq!(c.client.try_get_booking(&99), Err(Ok(Error::NotFound)));
}

#[test]
fn dispute_flow() {
    let c = setup();
    let id = request(&c, 1, 2);
    c.client.accept(&c.owner, &id);
    c.client
        .link_escrow(&c.tenant, &id, &Address::generate(&c.env));
    c.client.open_dispute(&c.tenant, &id);
    assert_eq!(c.client.get_booking(&id).status, Status::Disputed);
    assert_eq!(
        c.client.try_complete(&c.owner, &id),
        Err(Ok(Error::InvalidState))
    );
    c.client.resolve_dispute(&id);
    assert_eq!(c.client.get_booking(&id).status, Status::Resolved);
    let _ = &c.admin;
}

#[test]
#[should_panic]
fn request_requires_tenant_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(RentalRegistry, (admin,));
    let client = RentalRegistryClient::new(&env, &id);
    client.request(
        &Address::generate(&env),
        &Address::generate(&env),
        &String::from_str(&env, "x"),
        &1,
        &2,
        &10,
        &0,
    );
}
