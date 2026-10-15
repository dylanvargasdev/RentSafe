#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    Address, Env, Event as _, String,
    testutils::{Address as _, Events as _},
};

fn setup() -> (Env, ReputationClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Reputation, ());
    let client = ReputationClient::new(&env, &id);
    (env, client)
}

#[test]
fn review_updates_score_and_list() {
    let (env, client) = setup();
    let client_addr = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let escrow = Address::generate(&env);

    client.review(
        &client_addr,
        &freelancer,
        &escrow,
        &5,
        &String::from_str(&env, "Great work!"),
    );

    // `events().all()` only sees the LAST invocation, so assert right after `review`.
    let expected = ReviewPosted {
        subject: freelancer.clone(),
        reviewer: client_addr.clone(),
        escrow: escrow.clone(),
        rating: 5,
    };
    assert_eq!(
        env.events().all(),
        std::vec![expected.to_xdr(&env, &client.address)]
    );

    assert_eq!(client.score_of(&freelancer), Score { count: 1, total: 5 });
    let reviews = client.reviews_of(&freelancer);
    assert_eq!(reviews.len(), 1);
    assert_eq!(reviews.get(0).unwrap().rating, 5);
    assert_eq!(
        client.get_review(&client_addr, &escrow).unwrap().subject,
        freelancer
    );
}

#[test]
fn review_requires_reviewer_auth() {
    let (env, client) = setup();
    let reviewer = Address::generate(&env);
    let subject = Address::generate(&env);
    let escrow = Address::generate(&env);

    client.review(
        &reviewer,
        &subject,
        &escrow,
        &4,
        &String::from_str(&env, ""),
    );

    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, reviewer);
}

#[test]
fn rejects_invalid_input() {
    let (env, client) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let escrow = Address::generate(&env);
    let empty = String::from_str(&env, "");

    assert_eq!(
        client.try_review(&a, &b, &escrow, &0, &empty),
        Err(Ok(Error::InvalidRating))
    );
    assert_eq!(
        client.try_review(&a, &b, &escrow, &6, &empty),
        Err(Ok(Error::InvalidRating))
    );
    assert_eq!(
        client.try_review(&a, &a, &escrow, &5, &empty),
        Err(Ok(Error::SelfReview))
    );

    let long = std::string::String::from("x").repeat(MAX_COMMENT_LEN as usize + 1);
    assert_eq!(
        client.try_review(&a, &b, &escrow, &5, &String::from_str(&env, &long)),
        Err(Ok(Error::CommentTooLong))
    );
}

#[test]
fn one_review_per_reviewer_and_escrow() {
    let (env, client) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let escrow = Address::generate(&env);
    let other_escrow = Address::generate(&env);
    let empty = String::from_str(&env, "");

    client.review(&a, &b, &escrow, &5, &empty);
    assert_eq!(
        client.try_review(&a, &b, &escrow, &1, &empty),
        Err(Ok(Error::AlreadyReviewed))
    );
    // A different escrow between the same people is fine.
    client.review(&a, &b, &other_escrow, &3, &empty);
    assert_eq!(client.score_of(&b), Score { count: 2, total: 8 });
}

#[test]
fn keeps_only_latest_reviews_but_full_score() {
    let (env, client) = setup();
    let subject = Address::generate(&env);
    let empty = String::from_str(&env, "");

    let total_reviews = MAX_REVIEWS_PER_SUBJECT + 5;
    for _ in 0..total_reviews {
        let reviewer = Address::generate(&env);
        let escrow = Address::generate(&env);
        client.review(&reviewer, &subject, &escrow, &4, &empty);
    }

    assert_eq!(client.reviews_of(&subject).len(), MAX_REVIEWS_PER_SUBJECT);
    assert_eq!(
        client.score_of(&subject),
        Score {
            count: total_reviews,
            total: total_reviews * 4
        }
    );
}
