#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{Address, Env, String, testutils::Address as _};

/// Copia mínima del escrow multi-release de Trustless Work (API V1, rama
/// `multi-release-main` de trustlesswork-smart-contract-stellar): mismos tipos
/// y nombres de campos, para probar la lectura real de `get_escrow`.
mod tw {
    use soroban_sdk::{Address, Env, String, Vec, contract, contractimpl, contracttype};

    #[contracttype]
    #[derive(Clone, PartialEq, Eq)]
    pub struct Escrow {
        pub engagement_id: String,
        pub title: String,
        pub description: String,
        pub roles: Roles,
        pub platform_fee: u32,
        pub milestones: Vec<Milestone>,
        pub trustline: Trustline,
        pub receiver_memo: u32,
    }

    #[contracttype]
    #[derive(Clone, Debug, PartialEq, Eq)]
    pub struct Milestone {
        pub description: String,
        pub status: String,
        pub evidence: String,
        pub amount: i128,
        pub flags: Flags,
        pub receiver: Address,
    }

    #[contracttype]
    #[derive(Clone, PartialEq, Eq)]
    pub struct Roles {
        pub approver: Address,
        pub service_provider: Address,
        pub platform: Address,
        pub release_signer: Address,
        pub dispute_resolver: Address,
    }

    #[contracttype]
    #[derive(Clone, Debug, PartialEq, Eq)]
    pub struct Flags {
        pub disputed: bool,
        pub released: bool,
        pub resolved: bool,
        pub approved: bool,
    }

    #[contracttype]
    #[derive(Clone, PartialEq, Eq)]
    pub struct Trustline {
        pub address: Address,
    }

    #[contracttype]
    enum Key {
        Escrow,
    }

    #[contract]
    pub struct MockEscrow;

    #[contractimpl]
    impl MockEscrow {
        pub fn __constructor(e: Env, escrow: Escrow) {
            e.storage().instance().set(&Key::Escrow, &escrow);
        }
        pub fn get_escrow(e: Env) -> Escrow {
            e.storage().instance().get(&Key::Escrow).unwrap()
        }
    }

    pub fn milestone(env: &Env, amount: i128, receiver: &Address) -> Milestone {
        Milestone {
            description: String::from_str(env, "m"),
            status: String::from_str(env, "pending"),
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
}

const RENT: i128 = 1_000_000_000;
const DEPOSIT: i128 = 500_000_000;

struct Ctx {
    env: Env,
    client: RentalRegistryClient<'static>,
    admin: Address,
    token: Address,
    platform: Address,
    tenant: Address,
    owner: Address,
}

fn setup() -> Ctx {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let id = env.register(RentalRegistry, (admin.clone(), token.clone()));
    let client = RentalRegistryClient::new(&env, &id);
    Ctx {
        client,
        admin,
        token,
        platform: Address::generate(&env),
        tenant: Address::generate(&env),
        owner: Address::generate(&env),
        env,
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
        &RENT,
        &DEPOSIT,
        &0,
    )
}

/// Escrow correcto para una reserva de RENT + DEPOSIT (+ comisión opcional).
fn good_escrow(c: &Ctx, fee: i128) -> tw::Escrow {
    let mut milestones = soroban_sdk::Vec::new(&c.env);
    milestones.push_back(tw::milestone(&c.env, RENT, &c.owner));
    milestones.push_back(tw::milestone(&c.env, DEPOSIT, &c.tenant));
    if fee > 0 {
        milestones.push_back(tw::milestone(&c.env, fee, &c.platform));
    }
    tw::Escrow {
        engagement_id: String::from_str(&c.env, "rentsafe-1"),
        title: String::from_str(&c.env, "t"),
        description: String::from_str(&c.env, "d"),
        roles: tw::Roles {
            approver: c.tenant.clone(),
            service_provider: c.owner.clone(),
            platform: c.platform.clone(),
            release_signer: c.owner.clone(),
            dispute_resolver: c.platform.clone(),
        },
        platform_fee: 0,
        milestones,
        trustline: tw::Trustline {
            address: c.token.clone(),
        },
        receiver_memo: 0,
    }
}

fn deploy(c: &Ctx, escrow: tw::Escrow) -> Address {
    c.env.register(tw::MockEscrow, (escrow,))
}

fn accepted_and_linked(c: &Ctx) -> (u32, Address) {
    let id = request(c, 1, 2);
    c.client.accept(&c.owner, &id);
    let escrow = deploy(c, good_escrow(c, 0));
    c.client.link_escrow(&c.tenant, &id, &escrow);
    (id, escrow)
}

#[test]
fn happy_path() {
    let c = setup();
    let id = request(&c, 100, 200);
    assert_eq!(id, 0);
    assert_eq!(c.client.get_booking(&id).status, Status::Requested);

    c.client.accept(&c.owner, &id);
    assert_eq!(c.client.active_bookings(&listing(&c.env)).len(), 1);

    let escrow = deploy(&c, good_escrow(&c, 0));
    c.client.link_escrow(&c.tenant, &id, &escrow);
    let b = c.client.get_booking(&id);
    assert_eq!(b.status, Status::EscrowLinked);
    assert_eq!(b.escrow, Some(escrow.clone()));
    assert_eq!(b.arbiter, Some(c.platform.clone()));
    assert_eq!(c.client.booking_of_escrow(&escrow), Some(id));

    c.client.complete(&c.owner, &id);
    assert_eq!(c.client.get_booking(&id).status, Status::Completed);
    assert_eq!(c.client.active_bookings(&listing(&c.env)).len(), 0);
    assert_eq!(c.client.count(), 1);
    assert_eq!(c.client.token(), c.token);
}

#[test]
fn bookings_are_indexed_by_wallet() {
    let c = setup();
    let a = request(&c, 1, 2);
    let b = request(&c, 3, 4);
    let mut expected = soroban_sdk::Vec::new(&c.env);
    expected.push_back(a);
    expected.push_back(b);
    assert_eq!(c.client.bookings_of(&c.tenant), expected);
    assert_eq!(c.client.bookings_of(&c.owner), expected);
    assert_eq!(c.client.bookings_of(&c.platform).len(), 0);
    // Al vincular el escrow, el árbitro también la ve.
    c.client.accept(&c.owner, &a);
    c.client
        .link_escrow(&c.tenant, &a, &deploy(&c, good_escrow(&c, 0)));
    assert_eq!(c.client.bookings_of(&c.platform).len(), 1);
}

#[test]
fn rejects_invalid_requests() {
    let c = setup();
    let l = listing(&c.env);
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.tenant, &l, &1, &2, &10, &0, &0),
        Err(Ok(Error::SelfRental))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &5, &5, &10, &0, &0),
        Err(Ok(Error::InvalidPeriod))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &1, &2, &0, &0, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &1, &2, &10, &-1, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &l, &1, &2, &10, &0, &-1),
        Err(Ok(Error::InvalidAmount))
    );
    let empty = String::from_str(&c.env, "");
    assert_eq!(
        c.client
            .try_request(&c.tenant, &c.owner, &empty, &1, &2, &10, &0, &0),
        Err(Ok(Error::InvalidListing))
    );
}

#[test]
fn overlapping_accept_is_blocked() {
    let c = setup();
    let a = request(&c, 100, 200);
    let b = request(&c, 150, 200); // se solapa con `a`
    let d = request(&c, 200, 300); // contigua a `a` y `b`: permitida
    c.client.accept(&c.owner, &a);
    assert_eq!(c.client.try_accept(&c.owner, &b), Err(Ok(Error::Overlap)));
    c.client.accept(&c.owner, &d);
    // Cancelar libera las fechas.
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
    let escrow = deploy(&c, good_escrow(&c, 0));
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
    let escrow = deploy(&c, good_escrow(&c, 0));
    c.client.link_escrow(&c.tenant, &a, &escrow);
    assert_eq!(
        c.client.try_link_escrow(&c.tenant, &b, &escrow),
        Err(Ok(Error::EscrowAlreadyUsed))
    );
    let other = deploy(&c, good_escrow(&c, 0));
    assert_eq!(
        c.client.try_link_escrow(&c.tenant, &a, &other),
        Err(Ok(Error::InvalidState))
    );
    // Con fondos en el escrow nadie puede cancelar desde el registro.
    assert_eq!(
        c.client.try_cancel(&c.tenant, &a),
        Err(Ok(Error::InvalidState))
    );
}

#[test]
fn link_verifies_the_escrow() {
    let c = setup();
    let id = request(&c, 1, 2);
    c.client.accept(&c.owner, &id);
    let try_link = |e: tw::Escrow| {
        let escrow = deploy(&c, e);
        c.client.try_link_escrow(&c.tenant, &id, &escrow)
    };

    // No es un contrato de escrow.
    assert_eq!(
        c.client
            .try_link_escrow(&c.tenant, &id, &Address::generate(&c.env)),
        Err(Ok(Error::EscrowUnreadable))
    );
    // El arrendatario como árbitro (podría resolver su propia disputa).
    let mut e = good_escrow(&c, 0);
    e.roles.dispute_resolver = c.tenant.clone();
    assert_eq!(try_link(e), Err(Ok(Error::EscrowRolesMismatch)));
    // El propietario como plataforma (podría reescribir el escrow).
    let mut e = good_escrow(&c, 0);
    e.roles.platform = c.owner.clone();
    assert_eq!(try_link(e), Err(Ok(Error::EscrowRolesMismatch)));
    // Otro aprobador.
    let mut e = good_escrow(&c, 0);
    e.roles.approver = c.platform.clone();
    assert_eq!(try_link(e), Err(Ok(Error::EscrowRolesMismatch)));
    // Otra moneda.
    let mut e = good_escrow(&c, 0);
    e.trustline.address = Address::generate(&c.env);
    assert_eq!(try_link(e), Err(Ok(Error::EscrowAssetMismatch)));
    // Comisión porcentual (se descontaría del depósito).
    let mut e = good_escrow(&c, 0);
    e.platform_fee = 1;
    assert_eq!(try_link(e), Err(Ok(Error::EscrowAssetMismatch)));
    // Importe del alquiler distinto.
    let mut e = good_escrow(&c, 0);
    e.milestones
        .set(0, tw::milestone(&c.env, RENT - 1, &c.owner));
    assert_eq!(try_link(e), Err(Ok(Error::EscrowMilestonesMismatch)));
    // Depósito a otro receptor.
    let mut e = good_escrow(&c, 0);
    e.milestones
        .set(1, tw::milestone(&c.env, DEPOSIT, &c.owner));
    assert_eq!(try_link(e), Err(Ok(Error::EscrowMilestonesMismatch)));
    // Hito de más.
    assert_eq!(
        try_link(good_escrow(&c, 7)),
        Err(Ok(Error::EscrowMilestonesMismatch))
    );
    // Nada de lo anterior cambió la reserva; el escrow correcto sí se vincula.
    assert_eq!(c.client.get_booking(&id).status, Status::Accepted);
    assert_eq!(try_link(good_escrow(&c, 0)), Ok(Ok(())));
}

#[test]
fn fee_milestone_goes_to_the_platform() {
    let c = setup();
    let id = c.client.request(
        &c.tenant,
        &c.owner,
        &listing(&c.env),
        &1,
        &2,
        &RENT,
        &DEPOSIT,
        &50_000_000,
    );
    c.client.accept(&c.owner, &id);
    let escrow = deploy(&c, good_escrow(&c, 50_000_000));
    c.client.link_escrow(&c.tenant, &id, &escrow);
    assert_eq!(c.client.get_booking(&id).status, Status::EscrowLinked);
}

#[test]
fn invalid_transitions() {
    let c = setup();
    let id = request(&c, 1, 2);
    let escrow = deploy(&c, good_escrow(&c, 0));
    assert_eq!(
        c.client.try_link_escrow(&c.tenant, &id, &escrow),
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
fn dispute_is_resolved_by_the_escrow_arbiter() {
    let c = setup();
    let (id, _) = accepted_and_linked(&c);
    c.client.open_dispute(&c.tenant, &id);
    assert_eq!(c.client.get_booking(&id).status, Status::Disputed);
    assert_eq!(
        c.client.try_complete(&c.owner, &id),
        Err(Ok(Error::InvalidState))
    );
    // Las partes no pueden resolver su propia disputa.
    assert_eq!(
        c.client.try_resolve_dispute(&c.tenant, &id),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(
        c.client.try_resolve_dispute(&c.owner, &id),
        Err(Ok(Error::Unauthorized))
    );
    c.client.resolve_dispute(&c.platform, &id);
    assert_eq!(c.client.get_booking(&id).status, Status::Resolved);
    assert_eq!(c.client.active_bookings(&listing(&c.env)).len(), 0);
}

#[test]
fn admin_can_also_resolve() {
    let c = setup();
    let (id, _) = accepted_and_linked(&c);
    c.client.open_dispute(&c.owner, &id);
    c.client.resolve_dispute(&c.admin, &id);
    assert_eq!(c.client.get_booking(&id).status, Status::Resolved);
}

#[test]
fn reviews_only_after_a_closed_booking() {
    let c = setup();
    let (id, _) = accepted_and_linked(&c);
    let ok = String::from_str(&c.env, "Todo perfecto");
    assert_eq!(
        c.client.try_review(&c.tenant, &id, &5, &ok),
        Err(Ok(Error::InvalidState))
    );
    c.client.complete(&c.owner, &id);

    let stranger = Address::generate(&c.env);
    assert_eq!(
        c.client.try_review(&stranger, &id, &5, &ok),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(
        c.client.try_review(&c.tenant, &id, &0, &ok),
        Err(Ok(Error::InvalidRating))
    );
    assert_eq!(
        c.client.try_review(&c.tenant, &id, &6, &ok),
        Err(Ok(Error::InvalidRating))
    );
    let long = String::from_str(&c.env, &"x".repeat(281));
    assert_eq!(
        c.client.try_review(&c.tenant, &id, &5, &long),
        Err(Ok(Error::CommentTooLong))
    );

    c.client.review(&c.tenant, &id, &5, &ok);
    c.client
        .review(&c.owner, &id, &4, &String::from_str(&c.env, "Puntual"));
    assert_eq!(
        c.client.try_review(&c.tenant, &id, &3, &ok),
        Err(Ok(Error::AlreadyReviewed))
    );

    assert_eq!(c.client.score_of(&c.owner), Score { count: 1, total: 5 });
    assert_eq!(c.client.score_of(&c.tenant), Score { count: 1, total: 4 });
    let received = c.client.reviews_of(&c.owner);
    assert_eq!(received.len(), 1);
    assert_eq!(received.get(0).unwrap().reviewer, c.tenant);
    assert_eq!(c.client.get_review(&id, &c.tenant).unwrap().rating, 5);
}

#[test]
#[should_panic]
fn request_requires_tenant_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let id = env.register(RentalRegistry, (admin, token));
    let client = RentalRegistryClient::new(&env, &id);
    client.request(
        &Address::generate(&env),
        &Address::generate(&env),
        &String::from_str(&env, "x"),
        &1,
        &2,
        &10,
        &0,
        &0,
    );
}
