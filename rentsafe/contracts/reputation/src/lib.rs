#![no_std]
//! # Reputation
//!
//! On-chain reviews between the counterparties of an escrow (for example, a
//! client and a freelancer once a Trustless Work escrow has been released).
//!
//! - Anyone can review anyone else, once per escrow (`reviewer` + `escrow` is unique).
//! - Ratings go from 1 to 5. Comments are capped at 280 bytes.
//! - `score_of` keeps the all-time totals; `reviews_of` keeps only the latest
//!   `MAX_REVIEWS_PER_SUBJECT` reviews so the storage entry stays small.
//!
//! Ideas to extend it (good agent prompts!):
//! - Only allow reviews for escrows that were actually released, by calling the
//!   escrow contract's `get_escrow` (cross-contract call).
//! - Weight reviews by the escrow amount.
//! - Let the reviewed party post a public reply.
use soroban_sdk::{
    Address, Env, String, Vec, contract, contracterror, contractevent, contractimpl, contracttype,
};

/// Keep at most this many reviews per subject (older ones are dropped).
pub const MAX_REVIEWS_PER_SUBJECT: u32 = 25;
/// Max comment length in bytes (UTF-8).
pub const MAX_COMMENT_LEN: u32 = 280;

// Persistent entries live ~30 days (in ledgers, ~5s each) after each write.
const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_EXTEND_TO - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Rating must be between 1 and 5.
    InvalidRating = 1,
    /// You cannot review yourself.
    SelfReview = 2,
    /// This reviewer already reviewed this escrow.
    AlreadyReviewed = 3,
    /// Comment is longer than `MAX_COMMENT_LEN` bytes.
    CommentTooLong = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Review {
    pub reviewer: Address,
    pub subject: Address,
    /// The escrow (contract address, `C...`) this review is about.
    pub escrow: Address,
    /// 1 to 5 stars.
    pub rating: u32,
    pub comment: String,
    /// Ledger timestamp (unix seconds) when the review was posted.
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Score {
    /// How many reviews this address has received.
    pub count: u32,
    /// Sum of all ratings received. Average = total / count.
    pub total: u32,
}

#[contracttype]
enum DataKey {
    /// (reviewer, escrow) -> Review
    Review(Address, Address),
    /// subject -> Vec<Review> (latest MAX_REVIEWS_PER_SUBJECT)
    Received(Address),
    /// subject -> Score
    Score(Address),
}

/// Emitted every time a review is posted. Frontends can subscribe to it.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewPosted {
    #[topic]
    pub subject: Address,
    #[topic]
    pub reviewer: Address,
    pub escrow: Address,
    pub rating: u32,
}

#[contract]
pub struct Reputation;

#[contractimpl]
impl Reputation {
    /// Post a review about `subject` for the given `escrow`. Must be signed by `reviewer`.
    pub fn review(
        env: Env,
        reviewer: Address,
        subject: Address,
        escrow: Address,
        rating: u32,
        comment: String,
    ) -> Result<(), Error> {
        reviewer.require_auth();

        if !(1..=5).contains(&rating) {
            return Err(Error::InvalidRating);
        }
        if reviewer == subject {
            return Err(Error::SelfReview);
        }
        if comment.len() > MAX_COMMENT_LEN {
            return Err(Error::CommentTooLong);
        }

        let storage = env.storage().persistent();
        let review_key = DataKey::Review(reviewer.clone(), escrow.clone());
        if storage.has(&review_key) {
            return Err(Error::AlreadyReviewed);
        }

        let review = Review {
            reviewer: reviewer.clone(),
            subject: subject.clone(),
            escrow: escrow.clone(),
            rating,
            comment,
            timestamp: env.ledger().timestamp(),
        };

        // 1. The review itself (also guards against double reviews).
        storage.set(&review_key, &review);
        storage.extend_ttl(&review_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        // 2. Latest reviews received by the subject (bounded list).
        let received_key = DataKey::Received(subject.clone());
        let mut received: Vec<Review> = storage.get(&received_key).unwrap_or(Vec::new(&env));
        if received.len() >= MAX_REVIEWS_PER_SUBJECT {
            received.pop_front();
        }
        received.push_back(review);
        storage.set(&received_key, &received);
        storage.extend_ttl(&received_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        // 3. All-time score.
        let score_key = DataKey::Score(subject.clone());
        let mut score: Score = storage.get(&score_key).unwrap_or_default();
        score.count += 1;
        score.total += rating;
        storage.set(&score_key, &score);
        storage.extend_ttl(&score_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        ReviewPosted {
            subject,
            reviewer,
            escrow,
            rating,
        }
        .publish(&env);

        Ok(())
    }

    /// The review `reviewer` left for `escrow`, if any.
    pub fn get_review(env: Env, reviewer: Address, escrow: Address) -> Option<Review> {
        env.storage()
            .persistent()
            .get(&DataKey::Review(reviewer, escrow))
    }

    /// Latest reviews received by `subject` (oldest first).
    pub fn reviews_of(env: Env, subject: Address) -> Vec<Review> {
        env.storage()
            .persistent()
            .get(&DataKey::Received(subject))
            .unwrap_or(Vec::new(&env))
    }

    /// All-time score of `subject`.
    pub fn score_of(env: Env, subject: Address) -> Score {
        env.storage()
            .persistent()
            .get(&DataKey::Score(subject))
            .unwrap_or_default()
    }
}

mod test;
