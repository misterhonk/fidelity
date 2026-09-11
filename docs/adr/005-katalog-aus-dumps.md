# ADR-005: A horizon built on demand instead of a full dump

**Status:** Accepted · **Date:** 2026-08-09
**Supersedes:** the first version of this ADR ("catalogue from CC0 dumps, built locally")

## Context

Five of the eleven match signals need data an inventory listing does **not** carry:
`master_id`, genres, styles, country, credits, the complete label list.

The first thought was: call `/releases/{id}` for each of the 10,000 listings — which
costs roughly 3 hours per dig. From there the 10.4 GB full dump seemed unavoidable.

**The conclusion was wrong, because the direction of the query was wrong.**

## Decision

We do not cache the large, volatile side (the inventory) but the **small, stable** one
(the user's collection). After the collection sync, the relevant entities are expanded
once into sets of release ids — the **horizon**. Every dig after that is a set
intersection without a single extra request.

Verified against the production API on 2026-08-09:

- `GET /artists/{id}/releases` returns a **`role` field** (`Main`, `Producer`, `Remix`, …)
  → Conny Plank: **1,095 entries in 11 requests**. That puts the credit graph (S8) within
  reach without a dump.
- `GET /masters/{id}/versions` returns every pressing with its `release_id`
  → Neu! 2: **55 pressings in 1 request**. That puts S2 within reach without a dump.

Cost for a 2,412-record collection: **~670 requests ≈ 12 minutes, once.**

## Alternatives

**The full dump (`releases.xml.gz`)** – the original plan. 10.4 GB compressed, ~110 GB
unpacked, a streaming parser, a ~6 GB database, 1.5–3 GB of rsync — **every month**.
Rejected: the effort is out of all proportion as long as we do not have users in the
hundreds. Legally (CC0) it was cleaner; practically it is grotesquely oversized for 5–30
users.

**`/releases/{id}` per listing** – ~3 hours per dig. Never an option.

**Only the small dumps** (artists 472 MB + labels 86 MB + masters 593 MB = 1.15 GB, CC0) –
they carry master data, aliases and sublabel hierarchies, but **no edges**
(release→master, credits). Kept as an optional addition and as a ToS fallback.

## Consequences

**Easier:** No download, no XML parser, no blue/green schema rotation, no monthly
maintenance appointment. ~300–500 MB instead of ~6 GB — which takes Uberspace's 10 GB
quota out of the picture. M5 shrinks from "the big one" to an ordinary milestone. The
horizon grows with use instead of going stale every month.

**Harder:** Large labels (> 1,500 releases) cannot be expanded — `CATALOG_RUN` does not
fire there. The credit graph reaches only as far as your own collection. First-time setup
costs ~12 minutes of rate-limit budget per user. And: API data formally falls under the
six-hour rule where the dump would be CC0 — which is why we store nothing but id edges,
never displayable content (see `11-KATALOG-STRATEGIE.md` §7).

**The way out:** The matching engine queries a **table**, not a data source. A global
index from the full dump could later be slid underneath **additively**, without anything
changing in the domain logic. Triggers for that: users in the hundreds, exploration
features reaching beyond your own horizon, or a VPS with plenty of disk.
