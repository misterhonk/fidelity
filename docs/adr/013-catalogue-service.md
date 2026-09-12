# ADR-013: A stateless catalogue service from the CC0 dump, beside the hub

**Status:** Proposed (M21) · **Date:** 2026-09-12
**Extends:** ADR-005, ADR-007, ADR-008 · **Concept:** `docs/16-CATALOGUE-SERVICE.md`

## Context

ADR-005 chose the horizon over the dump — the collection unfolded into release ids through
the API, a few hundred requests once — and named the way out: *"the matching engine queries
a table, not a data source; a global index from the full dump could later be slid underneath
additively."* It named the triggers too: exploration beyond your own horizon, offline
analyses across the whole catalogue, plenty of disk.

Between 2026-09-11 and 2026-09-12 everything the API can reach was built (M19, M20): the
lexicon through `/artists/{id}`, pressing families through `/masters/{id}/versions`, the
scarcity hint from the horizon's master chunks, the year on the shelf from the mirrored
fields. Each of them stops exactly where the collection stops. What is left on every list
needs the catalogue as a whole:

- catalogue runs for labels above 1,500 releases (Blue Note, Impulse!, Verve are cut off);
- credits in the second degree — the producer of a record you do not own;
- aliases and members for artists nobody in the shop has on the shelf;
- pressing families and identifiers for the whole catalogue, without two requests per record;
- the map compared with the catalogue, not only with itself;
- scarcity for every master, not for the ones the horizon happened to expand.

Two facts changed since ADR-005. The dump is a solved engineering problem — `dgtools` and
`discogskit` turn the four files into Parquet or SQLite in half an hour on a laptop
(`docs/14` §3.1). And the home lab exists: Docker, Traefik, 51 GB free, a Cloudflare tunnel,
and the hub already running there (`docs/14` §8). ADR-005's "grotesquely oversized for 5–30
users" was about a monthly rsync onto a 10 GB Uberspace quota; it is not about a container
on a machine that runs Plex.

The constraint that does **not** change: ADR-007. Marketplace data and user data stay in
the browser, the token never leaves the device, the rate-limit budget stays per user.

## Decision

**A second optional service, `fidelity-catalogue`, built monthly from the CC0 dump, read-only
and stateless, beside the hub.** It answers catalogue questions — who made this, what
belongs to it, how many pressings exist, which release carries this barcode or run-out —
and nothing else.

The rules, in the order of ADR-008's three, which all still hold:

1. **No feature requires it.** Every consumer has the horizon as its fallback; a feature that
   only the catalogue can carry degrades to *nothing said*, never to an error, and the
   screen labels it "with the catalogue" where it appears.
2. **It never sees a token** — there is no route that takes one.
3. **It never scans inventories** — it knows no listing, no price, no seller.
4. **Catalogue from the dump, marketplace from the API, never mixed.** The service holds no
   field that the dump does not carry. What it cannot answer — what a record costs, who
   has it, what it is worth — stays with the live API and the six-hour rule.
5. **No images.** The dump carries none, the terms call them Restricted Data, and the
   service does not fetch them.
6. **It knows no user.** No accounts, no secret, no per-user state; its only state is the
   monthly build. What it learns from a request is a release id and an address, and it
   keeps neither beyond the proxy's access log.

The build is one file (SQLite, produced through DuckDB from Parquet), swapped by symlink,
two generations kept. Answers carry the build date as an `ETag` and are cacheable for
thirty days — the catalogue changes monthly and never retroactively.

In the client the service plugs in behind one port, `CatalogueSource`, next to
`HorizonSource`. The matching engine keeps querying its lookup table; what changes is who
filled it.

## Alternatives

**The dump in the browser** — 11 GB compressed does not belong in IndexedDB on a phone,
and the shards a client could fetch on demand are the service by another name.

**The hub does it** — rejected on shape. The hub is a friend circle's shared memory behind
a secret and holds things that were paid for with somebody's rate limit. The catalogue is
public, CC0, the same for everybody and cacheable by a CDN. Mixing them would make the
public thing secret or the private thing public. They share a machine, not a process.

**Stay with the API** — done; it reached its limit on 2026-09-12 with the last M20 row.
The API has no "everyone credited as producer on this label" and no barcode index; the
search endpoint is capped at 100 pages.

**PostgreSQL** (ADR-002's ghost) — a monthly, read-only artefact needs no migrations, no
backup and no daemon. A file that is replaced whole is the simpler system, and `node:sqlite`
is already in the hub.

**Cloudflare Workers and R2 shards** (`docs/14` §4) — good for a public product with a CDN
in front; premature for one home lab. Kept as the shape to grow into: the API is designed
so that a shard per artist or label could serve the same answers.

## Consequences

**Easier:** The signals reach past the collection. A dig at a Blue Note specialist gets
catalogue runs; a producer you own nothing *by* still fires the credit graph; the shop
screen identifies a record without a search request; the year on the shelf can say "your
seventies share is three times the catalogue's". Each new user costs the service nothing —
the horizon's twelve minutes of rate limit become a fallback, not the entry fee.

**Harder:** A monthly job that must not silently rot — the dump has stalled before
(Aug–Sep 2024) and the build has to say "still September's" rather than pretend. Roughly
12 GB of download and 25 GB of scratch a month on the home lab. A schema the dump can
change under us; a parser at the boundary, like the Zod schemas at the API's. A third
deployment artefact and the temptation, once more, to let a feature depend on it — met the
same way as with the hub: a CI run with the catalogue URL empty.

**What has to be done first:** the port (`CatalogueSource`) with the horizon behind it and
a test that everything runs through with an empty URL; a frozen mini-dump fixture (a few
hundred releases) so the ETL and the service have golden tests without 10 GB in CI; the ETL
as a container; the service with two routes; then the consumers one by one. Phases and
sizes in `docs/16`.

**The way out:** delete the catalogue URL. The horizon is still there and still fills the
same table. Nothing in the engine knows the difference — which is the whole point of the
port, and the sentence ADR-005 ended on.
