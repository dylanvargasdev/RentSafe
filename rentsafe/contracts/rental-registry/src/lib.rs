#![no_std]
//! # RentSafe · Rental registry
//!
//! Registro público e inmutable de los **acuerdos de alquiler** de RentSafe.
//! El dinero NO vive aquí: el alquiler y el depósito de garantía se guardan en
//! un escrow de Trustless Work (un contrato por reserva). Este contrato aporta
//! lo que el escrow no sabe:
//!
//! - Qué bien se alquila, entre quién, en qué período y por qué importes.
//! - Que el propietario aceptó expresamente la solicitud (firma on-chain).
//! - Que un mismo bien no se reserve dos veces en fechas que se solapan.
//! - Que cada escrow se vincule a UNA sola reserva y solo una vez.
//! - Transiciones de estado válidas y firmadas por la parte correcta.
//!
//! Lo que NO puede hacer (honestidad): verificar que el bien se entregó o se
//! devolvió en buen estado. Eso lo deciden las partes con sus firmas en el
//! escrow y, si no se ponen de acuerdo, el árbitro de la plataforma.
//!
//! Ciclo de vida:
//! `Requested → Accepted → EscrowLinked → Completed`
//! con salidas `Rejected`, `Cancelled` (antes del escrow) y
//! `Disputed → Resolved` (con escrow).
use soroban_sdk::{
    Address, Env, String, Vec, contract, contracterror, contractevent, contractimpl, contracttype,
};

/// Longitud máxima del identificador de publicación (bytes).
pub const MAX_LISTING_ID_LEN: u32 = 64;
/// Máximo de reservas activas (aceptadas, sin cerrar) por publicación.
pub const MAX_ACTIVE_PER_LISTING: u32 = 50;

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_EXTEND_TO - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// No existe una reserva con ese identificador.
    NotFound = 1,
    /// No tienes permiso para realizar esta acción sobre la reserva.
    Unauthorized = 2,
    /// La reserva no está en un estado que permita esta acción.
    InvalidState = 3,
    /// La fecha de finalización debe ser posterior a la de inicio.
    InvalidPeriod = 4,
    /// El importe del alquiler debe ser mayor que cero y el depósito no puede ser negativo.
    InvalidAmount = 5,
    /// No puedes alquilar un bien que publicaste tú.
    SelfRental = 6,
    /// El identificador de la publicación es demasiado largo o está vacío.
    InvalidListing = 7,
    /// Las fechas se solapan con otra reserva ya aceptada para este bien.
    Overlap = 8,
    /// Este escrow ya está vinculado a otra reserva.
    EscrowAlreadyUsed = 9,
    /// Este bien tiene demasiadas reservas activas.
    TooManyActive = 10,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    Requested,
    Accepted,
    Rejected,
    Cancelled,
    EscrowLinked,
    Completed,
    Disputed,
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Booking {
    pub id: u32,
    pub listing_id: String,
    pub tenant: Address,
    pub owner: Address,
    /// Inicio y fin del alquiler (unix, segundos).
    pub start: u64,
    pub end: u64,
    /// Importes con 7 decimales (1 USDC = 10_000_000).
    pub rent: i128,
    pub deposit: i128,
    pub status: Status,
    /// Escrow de Trustless Work que custodia los fondos (`C...`).
    pub escrow: Option<Address>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    Counter,
    Booking(u32),
    /// listing_id -> ids de reservas aceptadas y abiertas (para evitar solapes)
    Active(String),
    /// escrow -> id de reserva (un escrow, una reserva)
    Escrow(Address),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BookingUpdated {
    #[topic]
    pub id: u32,
    pub status: Status,
    pub tenant: Address,
    pub owner: Address,
}

#[contract]
pub struct RentalRegistry;

fn load(env: &Env, id: u32) -> Result<Booking, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Booking(id))
        .ok_or(Error::NotFound)
}

fn save(env: &Env, booking: &mut Booking) {
    booking.updated_at = env.ledger().timestamp();
    let key = DataKey::Booking(booking.id);
    env.storage().persistent().set(&key, booking);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    BookingUpdated {
        id: booking.id,
        status: booking.status,
        tenant: booking.tenant.clone(),
        owner: booking.owner.clone(),
    }
    .publish(env);
}

fn active_of(env: &Env, listing_id: &String) -> Vec<u32> {
    env.storage()
        .persistent()
        .get(&DataKey::Active(listing_id.clone()))
        .unwrap_or(Vec::new(env))
}

fn set_active(env: &Env, listing_id: &String, ids: &Vec<u32>) {
    let key = DataKey::Active(listing_id.clone());
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn remove_active(env: &Env, booking: &Booking) {
    let ids = active_of(env, &booking.listing_id);
    let mut kept = Vec::new(env);
    for id in ids.iter() {
        if id != booking.id {
            kept.push_back(id);
        }
    }
    set_active(env, &booking.listing_id, &kept);
}

/// `caller` debe firmar y ser el arrendatario o el propietario de la reserva.
fn require_party(caller: &Address, booking: &Booking) -> Result<(), Error> {
    caller.require_auth();
    if *caller != booking.tenant && *caller != booking.owner {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

#[contractimpl]
impl RentalRegistry {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// El arrendatario solicita alquilar `listing_id` del `owner` en un período.
    #[allow(clippy::too_many_arguments)]
    pub fn request(
        env: Env,
        tenant: Address,
        owner: Address,
        listing_id: String,
        start: u64,
        end: u64,
        rent: i128,
        deposit: i128,
    ) -> Result<u32, Error> {
        tenant.require_auth();
        if tenant == owner {
            return Err(Error::SelfRental);
        }
        if listing_id.len() == 0 || listing_id.len() > MAX_LISTING_ID_LEN {
            return Err(Error::InvalidListing);
        }
        if end <= start {
            return Err(Error::InvalidPeriod);
        }
        if rent <= 0 || deposit < 0 {
            return Err(Error::InvalidAmount);
        }
        let id: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        env.storage().instance().set(&DataKey::Counter, &(id + 1));
        let now = env.ledger().timestamp();
        let mut booking = Booking {
            id,
            listing_id,
            tenant,
            owner,
            start,
            end,
            rent,
            deposit,
            status: Status::Requested,
            escrow: None,
            created_at: now,
            updated_at: now,
        };
        save(&env, &mut booking);
        Ok(id)
    }

    /// El propietario acepta. Bloquea las fechas para ese bien.
    pub fn accept(env: Env, owner: Address, id: u32) -> Result<(), Error> {
        owner.require_auth();
        let mut booking = load(&env, id)?;
        if owner != booking.owner {
            return Err(Error::Unauthorized);
        }
        if booking.status != Status::Requested {
            return Err(Error::InvalidState);
        }
        let mut active = active_of(&env, &booking.listing_id);
        if active.len() >= MAX_ACTIVE_PER_LISTING {
            return Err(Error::TooManyActive);
        }
        for other_id in active.iter() {
            let other = load(&env, other_id)?;
            // Intervalos [start, end): se solapan si cada uno empieza antes de que acabe el otro.
            if booking.start < other.end && other.start < booking.end {
                return Err(Error::Overlap);
            }
        }
        active.push_back(id);
        set_active(&env, &booking.listing_id, &active);
        booking.status = Status::Accepted;
        save(&env, &mut booking);
        Ok(())
    }

    /// El propietario rechaza una solicitud pendiente.
    pub fn reject(env: Env, owner: Address, id: u32) -> Result<(), Error> {
        owner.require_auth();
        let mut booking = load(&env, id)?;
        if owner != booking.owner {
            return Err(Error::Unauthorized);
        }
        if booking.status != Status::Requested {
            return Err(Error::InvalidState);
        }
        booking.status = Status::Rejected;
        save(&env, &mut booking);
        Ok(())
    }

    /// Cualquiera de las partes cancela ANTES de que exista un escrow con fondos.
    pub fn cancel(env: Env, caller: Address, id: u32) -> Result<(), Error> {
        let mut booking = load(&env, id)?;
        require_party(&caller, &booking)?;
        match booking.status {
            Status::Requested => {}
            Status::Accepted => remove_active(&env, &booking),
            _ => return Err(Error::InvalidState),
        }
        booking.status = Status::Cancelled;
        save(&env, &mut booking);
        Ok(())
    }

    /// El arrendatario vincula el escrow que custodia el alquiler y el depósito.
    /// Un escrow solo puede vincularse una vez y a una sola reserva.
    pub fn link_escrow(env: Env, tenant: Address, id: u32, escrow: Address) -> Result<(), Error> {
        tenant.require_auth();
        let mut booking = load(&env, id)?;
        if tenant != booking.tenant {
            return Err(Error::Unauthorized);
        }
        if booking.status != Status::Accepted || booking.escrow.is_some() {
            return Err(Error::InvalidState);
        }
        let escrow_key = DataKey::Escrow(escrow.clone());
        if env.storage().persistent().has(&escrow_key) {
            return Err(Error::EscrowAlreadyUsed);
        }
        env.storage().persistent().set(&escrow_key, &id);
        env.storage()
            .persistent()
            .extend_ttl(&escrow_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        booking.escrow = Some(escrow);
        booking.status = Status::EscrowLinked;
        save(&env, &mut booking);
        Ok(())
    }

    /// El propietario confirma la devolución del bien y cierra la reserva.
    pub fn complete(env: Env, owner: Address, id: u32) -> Result<(), Error> {
        owner.require_auth();
        let mut booking = load(&env, id)?;
        if owner != booking.owner {
            return Err(Error::Unauthorized);
        }
        if booking.status != Status::EscrowLinked {
            return Err(Error::InvalidState);
        }
        remove_active(&env, &booking);
        booking.status = Status::Completed;
        save(&env, &mut booking);
        Ok(())
    }

    /// Cualquiera de las partes abre una disputa sobre una reserva con escrow.
    pub fn open_dispute(env: Env, caller: Address, id: u32) -> Result<(), Error> {
        let mut booking = load(&env, id)?;
        require_party(&caller, &booking)?;
        if booking.status != Status::EscrowLinked {
            return Err(Error::InvalidState);
        }
        booking.status = Status::Disputed;
        save(&env, &mut booking);
        Ok(())
    }

    /// El administrador de la plataforma marca la disputa como resuelta
    /// (el reparto de fondos se ejecuta en el escrow).
    pub fn resolve_dispute(env: Env, id: u32) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let mut booking = load(&env, id)?;
        if booking.status != Status::Disputed {
            return Err(Error::InvalidState);
        }
        remove_active(&env, &booking);
        booking.status = Status::Resolved;
        save(&env, &mut booking);
        Ok(())
    }

    pub fn get_booking(env: Env, id: u32) -> Result<Booking, Error> {
        load(&env, id)
    }

    /// Ids de reservas aceptadas y abiertas de una publicación.
    pub fn active_bookings(env: Env, listing_id: String) -> Vec<u32> {
        active_of(&env, &listing_id)
    }

    /// Reserva vinculada a un escrow, si existe.
    pub fn booking_of_escrow(env: Env, escrow: Address) -> Option<u32> {
        env.storage().persistent().get(&DataKey::Escrow(escrow))
    }

    pub fn count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}

mod test;
