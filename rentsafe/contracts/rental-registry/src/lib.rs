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
//! - Que el escrow vinculado es **el correcto**: al vincularlo, el contrato lee
//!   el escrow on-chain y comprueba roles, importes, receptores, moneda y que
//!   ninguna de las partes sea árbitro ni plataforma.
//! - Que cada escrow se vincule a UNA sola reserva y solo una vez.
//! - Índice de reservas por billetera, para que cada parte vea sus reservas
//!   desde cualquier navegador.
//! - Reseñas verificadas: solo las partes de una reserva cerrada pueden
//!   reseñarse, una vez cada una.
//!
//! Lo que NO puede hacer (honestidad): verificar que el bien se entregó o se
//! devolvió en buen estado. Eso lo deciden las partes con sus firmas en el
//! escrow y, si no se ponen de acuerdo, el árbitro.
//!
//! Ciclo de vida:
//! `Requested → Accepted → EscrowLinked → Completed`
//! con salidas `Rejected`, `Cancelled` (antes del escrow) y
//! `Disputed → Resolved` (con escrow).
use soroban_sdk::{
    Address, BytesN, Env, IntoVal, Map, String, Symbol, TryFromVal, Val, Vec, contract,
    contracterror, contractevent, contractimpl, contracttype,
};

/// Longitud máxima del identificador de publicación (bytes).
pub const MAX_LISTING_ID_LEN: u32 = 64;
/// Máximo de reservas activas (aceptadas, sin cerrar) por publicación.
pub const MAX_ACTIVE_PER_LISTING: u32 = 50;
/// Reservas recientes que se recuerdan por billetera (las más antiguas se descartan).
pub const MAX_BOOKINGS_PER_ADDRESS: u32 = 100;
/// Reseñas recientes que se guardan por billetera.
pub const MAX_REVIEWS_PER_SUBJECT: u32 = 25;
/// Longitud máxima del comentario de una reseña (bytes UTF-8).
pub const MAX_COMMENT_LEN: u32 = 280;

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
    /// El alquiler debe ser mayor que cero; el depósito y la comisión no pueden ser negativos.
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
    /// No se pudo leer el escrow o no tiene el formato de Trustless Work.
    EscrowUnreadable = 11,
    /// Los roles del escrow no coinciden con la reserva (o una parte es árbitro o plataforma).
    EscrowRolesMismatch = 12,
    /// Los hitos del escrow (importes o receptores) no coinciden con la reserva.
    EscrowMilestonesMismatch = 13,
    /// El escrow no usa la moneda de la plataforma o cobra una comisión no permitida.
    EscrowAssetMismatch = 14,
    /// La calificación debe estar entre 1 y 5.
    InvalidRating = 15,
    /// El comentario supera los 280 bytes.
    CommentTooLong = 16,
    /// Ya dejaste una reseña para esta reserva.
    AlreadyReviewed = 17,
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
    /// Comisión de la plataforma (hito propio del escrow, receptor = plataforma).
    pub fee: i128,
    pub status: Status,
    /// Escrow de Trustless Work que custodia los fondos (`C...`).
    pub escrow: Option<Address>,
    /// Árbitro de disputas, leído del escrow al vincularlo.
    pub arbiter: Option<Address>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Review {
    pub booking_id: u32,
    pub reviewer: Address,
    pub subject: Address,
    /// 1 a 5 estrellas.
    pub rating: u32,
    pub comment: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Score {
    /// Reseñas recibidas.
    pub count: u32,
    /// Suma de calificaciones. Media = total / count.
    pub total: u32,
}

#[contracttype]
enum DataKey {
    Admin,
    /// Contrato del activo que deben usar los escrows (USDC).
    Token,
    Counter,
    Booking(u32),
    /// listing_id -> ids de reservas aceptadas y abiertas (para evitar solapes)
    Active(String),
    /// escrow -> id de reserva (un escrow, una reserva)
    Escrow(Address),
    /// billetera -> ids de sus reservas (como arrendatario, propietario o árbitro)
    ByAddress(Address),
    /// (reserva, autor) -> reseña
    Review(u32, Address),
    /// billetera -> últimas reseñas recibidas
    Received(Address),
    /// billetera -> puntuación acumulada
    Score(Address),
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

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewPosted {
    #[topic]
    pub subject: Address,
    #[topic]
    pub booking_id: u32,
    pub reviewer: Address,
    pub rating: u32,
}

#[contract]
pub struct RentalRegistry;

fn bump<K: IntoVal<Env, Val>>(env: &Env, key: &K) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

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
    bump(env, &key);
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
    bump(env, &key);
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

fn index_for(env: &Env, who: &Address, id: u32) {
    let key = DataKey::ByAddress(who.clone());
    let mut ids: Vec<u32> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    if ids.len() >= MAX_BOOKINGS_PER_ADDRESS {
        ids.pop_front();
    }
    ids.push_back(id);
    env.storage().persistent().set(&key, &ids);
    bump(env, &key);
}

/// `caller` debe firmar y ser el arrendatario o el propietario de la reserva.
fn require_party(caller: &Address, booking: &Booking) -> Result<(), Error> {
    caller.require_auth();
    if *caller != booking.tenant && *caller != booking.owner {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

// ── Lectura del escrow de Trustless Work (API V1, multi-release) ─────────────
//
// Se decodifica de forma genérica (mapa de campos) en lugar de copiar los
// tipos del contrato de Trustless Work: así toleramos campos nuevos y solo
// dependemos de los que verificamos. Campos usados (V1, rama multi-release-main):
//   roles { approver, service_provider, platform, release_signer, dispute_resolver }
//   platform_fee: u32
//   milestones: Vec<{ amount: i128, receiver: Address, .. }>
//   trustline { address }

type Fields = Map<Symbol, Val>;

fn field<T: TryFromVal<Env, Val>>(env: &Env, map: &Fields, name: &str) -> Result<T, Error> {
    let v = map
        .get(Symbol::new(env, name))
        .ok_or(Error::EscrowUnreadable)?;
    T::try_from_val(env, &v).map_err(|_| Error::EscrowUnreadable)
}

fn read_escrow(env: &Env, escrow: &Address) -> Result<Fields, Error> {
    let res = env.try_invoke_contract::<Val, soroban_sdk::Error>(
        escrow,
        &Symbol::new(env, "get_escrow"),
        Vec::new(env),
    );
    match res {
        Ok(Ok(v)) => Fields::try_from_val(env, &v).map_err(|_| Error::EscrowUnreadable),
        _ => Err(Error::EscrowUnreadable),
    }
}

/// Comprueba que el escrow custodia exactamente esta reserva. Devuelve el árbitro.
fn verify_escrow(env: &Env, booking: &Booking, escrow: &Address) -> Result<Address, Error> {
    let e = read_escrow(env, escrow)?;
    let party = |a: &Address| *a == booking.tenant || *a == booking.owner;

    // Roles: el arrendatario aprueba; el propietario registra la devolución y
    // libera; árbitro y plataforma son terceros (si no, una parte podría
    // resolver su propia disputa o reescribir el escrow antes del depósito).
    let roles: Fields = field(env, &e, "roles")?;
    let approver: Address = field(env, &roles, "approver")?;
    let provider: Address = field(env, &roles, "service_provider")?;
    let release: Address = field(env, &roles, "release_signer")?;
    let arbiter: Address = field(env, &roles, "dispute_resolver")?;
    let platform: Address = field(env, &roles, "platform")?;
    if approver != booking.tenant
        || provider != booking.owner
        || release != booking.owner
        || party(&arbiter)
        || party(&platform)
    {
        return Err(Error::EscrowRolesMismatch);
    }

    // Moneda y comisión porcentual (que se descontaría también del depósito).
    let platform_fee: u32 = field(env, &e, "platform_fee")?;
    let trustline: Fields = field(env, &e, "trustline")?;
    let asset: Address = field(env, &trustline, "address")?;
    let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
    if platform_fee != 0 || asset != token {
        return Err(Error::EscrowAssetMismatch);
    }

    // Hitos: [alquiler → propietario] + [depósito → arrendatario] + [comisión → plataforma]
    let mut expected: Vec<(i128, Address)> = Vec::new(env);
    expected.push_back((booking.rent, booking.owner.clone()));
    if booking.deposit > 0 {
        expected.push_back((booking.deposit, booking.tenant.clone()));
    }
    if booking.fee > 0 {
        expected.push_back((booking.fee, platform.clone()));
    }
    let milestones: Vec<Val> = field(env, &e, "milestones")?;
    if milestones.len() != expected.len() {
        return Err(Error::EscrowMilestonesMismatch);
    }
    for (i, (amount, receiver)) in expected.iter().enumerate() {
        let m = Fields::try_from_val(env, &milestones.get(i as u32).unwrap())
            .map_err(|_| Error::EscrowUnreadable)?;
        let m_amount: i128 = field(env, &m, "amount")?;
        let m_receiver: Address = field(env, &m, "receiver")?;
        if m_amount != amount || m_receiver != receiver {
            return Err(Error::EscrowMilestonesMismatch);
        }
    }
    Ok(arbiter)
}

#[contractimpl]
impl RentalRegistry {
    /// `token`: contrato del activo que custodian los escrows (USDC en testnet:
    /// `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`).
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
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
        fee: i128,
    ) -> Result<u32, Error> {
        tenant.require_auth();
        if tenant == owner {
            return Err(Error::SelfRental);
        }
        if listing_id.is_empty() || listing_id.len() > MAX_LISTING_ID_LEN {
            return Err(Error::InvalidListing);
        }
        if end <= start {
            return Err(Error::InvalidPeriod);
        }
        if rent <= 0 || deposit < 0 || fee < 0 {
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
            fee,
            status: Status::Requested,
            escrow: None,
            arbiter: None,
            created_at: now,
            updated_at: now,
        };
        index_for(&env, &booking.tenant, id);
        index_for(&env, &booking.owner, id);
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
    /// El contrato lee el escrow y comprueba que corresponde a esta reserva.
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
        let arbiter = verify_escrow(&env, &booking, &escrow)?;
        env.storage().persistent().set(&escrow_key, &id);
        bump(&env, &escrow_key);
        // El árbitro también ve la reserva en `bookings_of`, para poder resolverla.
        index_for(&env, &arbiter, id);
        booking.escrow = Some(escrow);
        booking.arbiter = Some(arbiter);
        booking.status = Status::EscrowLinked;
        save(&env, &mut booking);
        Ok(())
    }

    /// El propietario cierra la reserva cuando el escrow ya liberó los fondos.
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

    /// El árbitro del escrow (o el administrador) marca la disputa como
    /// resuelta. El reparto de fondos se ejecuta en el escrow.
    pub fn resolve_dispute(env: Env, caller: Address, id: u32) -> Result<(), Error> {
        caller.require_auth();
        let mut booking = load(&env, id)?;
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin && Some(caller) != booking.arbiter {
            return Err(Error::Unauthorized);
        }
        if booking.status != Status::Disputed {
            return Err(Error::InvalidState);
        }
        remove_active(&env, &booking);
        booking.status = Status::Resolved;
        save(&env, &mut booking);
        Ok(())
    }

    /// Una parte reseña a la otra tras una reserva cerrada (completada o con
    /// disputa resuelta). Una reseña por parte y reserva.
    pub fn review(
        env: Env,
        reviewer: Address,
        id: u32,
        rating: u32,
        comment: String,
    ) -> Result<(), Error> {
        let booking = load(&env, id)?;
        require_party(&reviewer, &booking)?;
        if booking.status != Status::Completed && booking.status != Status::Resolved {
            return Err(Error::InvalidState);
        }
        if !(1..=5).contains(&rating) {
            return Err(Error::InvalidRating);
        }
        if comment.len() > MAX_COMMENT_LEN {
            return Err(Error::CommentTooLong);
        }
        let storage = env.storage().persistent();
        let key = DataKey::Review(id, reviewer.clone());
        if storage.has(&key) {
            return Err(Error::AlreadyReviewed);
        }
        let subject = if reviewer == booking.tenant {
            booking.owner.clone()
        } else {
            booking.tenant.clone()
        };
        let review = Review {
            booking_id: id,
            reviewer: reviewer.clone(),
            subject: subject.clone(),
            rating,
            comment,
            timestamp: env.ledger().timestamp(),
        };
        storage.set(&key, &review);
        bump(&env, &key);

        let received_key = DataKey::Received(subject.clone());
        let mut received: Vec<Review> = storage.get(&received_key).unwrap_or(Vec::new(&env));
        if received.len() >= MAX_REVIEWS_PER_SUBJECT {
            received.pop_front();
        }
        received.push_back(review);
        storage.set(&received_key, &received);
        bump(&env, &received_key);

        let score_key = DataKey::Score(subject.clone());
        let mut score: Score = storage.get(&score_key).unwrap_or_default();
        score.count += 1;
        score.total += rating;
        storage.set(&score_key, &score);
        bump(&env, &score_key);

        ReviewPosted {
            subject,
            booking_id: id,
            reviewer,
            rating,
        }
        .publish(&env);
        Ok(())
    }

    /// Actualiza el código del contrato (solo el administrador).
    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(wasm_hash);
    }

    // ── Lecturas ────────────────────────────────────────────────────────────

    pub fn get_booking(env: Env, id: u32) -> Result<Booking, Error> {
        load(&env, id)
    }

    /// Ids de las reservas (recientes) de una billetera: como arrendatario,
    /// propietario o árbitro (desde que se vincula el escrow).
    pub fn bookings_of(env: Env, who: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::ByAddress(who))
            .unwrap_or(Vec::new(&env))
    }

    /// Ids de reservas aceptadas y abiertas de una publicación.
    pub fn active_bookings(env: Env, listing_id: String) -> Vec<u32> {
        active_of(&env, &listing_id)
    }

    /// Reserva vinculada a un escrow, si existe.
    pub fn booking_of_escrow(env: Env, escrow: Address) -> Option<u32> {
        env.storage().persistent().get(&DataKey::Escrow(escrow))
    }

    pub fn get_review(env: Env, id: u32, reviewer: Address) -> Option<Review> {
        env.storage()
            .persistent()
            .get(&DataKey::Review(id, reviewer))
    }

    /// Últimas reseñas recibidas por una billetera (la más antigua primero).
    pub fn reviews_of(env: Env, who: Address) -> Vec<Review> {
        env.storage()
            .persistent()
            .get(&DataKey::Received(who))
            .unwrap_or(Vec::new(&env))
    }

    /// Puntuación acumulada de una billetera.
    pub fn score_of(env: Env, who: Address) -> Score {
        env.storage()
            .persistent()
            .get(&DataKey::Score(who))
            .unwrap_or_default()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}

mod test;
