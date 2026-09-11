# ADR-006: Dealer-centric rather than wantlist-centric

**Status:** Accepted · **Date:** 2026-08-09

## Context

Every existing tool (Waxrunner, Wantlister, discogs_alert, discogs-market-monitor) starts
at the **wantlist** and searches it across all dealers. That is the obvious approach.

## Decision

We start at the **dealer** and the **collection**, not at the wantlist.

## The two reasons

### 1. Technical: there is no listings-by-release endpoint

"Who sells release X?" is **not answerable** through the API:

- `GET /marketplace/listings?release_id=…` → 405
- `GET /marketplace/search?release_id=…` → 401, undocumented, not supported

**That is why every wantlist-centric tool scrapes the website** — with TLS fingerprint
spoofing against Cloudflare. It breaches the terms of use and it breaks regularly.

`GET /users/{username}/inventory`, by contrast, is **fully documented and public**. Our
approach runs on the supported path. That is a structural durability advantage.

### 2. Product: the wantlist is the wrong question

A wantlist contains what you already know. A good seller tells you what you do **not**
know yet. All the value sits in what the collection reveals about taste — and none of
that is in the wantlist.

## Consequences

**Easier:** Clean under the terms of use, robust against Cloudflare, and the product
lands in a position that happens to be vacant (see the competitive matrix in
`docs/00-CONCEPT.md`).

**Harder:** The user has to name a dealer. There is no "search everything".
**Mitigation:** dealer suggestions from Discogs' own `/sell/mywants` overview, from
already-scanned dealers with high affinity, and from the dealers the user has bought from.

**Deliberately not built:** multi-dealer search across the whole marketplace. It would
only work by scraping. Out of the question.
