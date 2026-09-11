# ADR-008: An optional, self-hostable hub

**Status:** Proposed (built in M9) · **Date:** 2026-08-09

## Context

ADR-007 removed the backend. Three things stopped being possible: real push
notifications (which strictly require an application server), a background watchlist (a
browser does not scan while it is closed) and data shared between users (a horizon cache,
shipping tiers).

The question: can that be added back as an optional add-on without softening the client
architecture again?

## Decision

**Yes — as a "hub": a tiny, self-hostable service you may configure but do not have to.**
One field in the settings, empty by default.

Three rules hold the design up:

1. **No feature requires a hub.** It speeds things up; it does not enable them.
2. **The hub never gets a Discogs token.** Everything it does works unauthenticated or
   without Discogs entirely.
3. **The hub does not scan inventories.** It has one IP — all users would be sharing 60
   req/min again. It only polls `num_for_sale` (1 request instead of 100) and wakes the
   client.

## Alternatives

**No hub at all** – push is permanently missing and every user builds their own horizon
(13 minutes). Defensible, but needless when a 60 MB service solves it.

**The hub as a mandatory backend** – that would be a return to the rejected server design.

**The hub as a Discogs proxy** – borderline under the terms of use ("circumvent rate
limits"), makes it the bottleneck, and throws away the greatest advantage of the client
architecture.

**Cloudflare Workers only** – convenient, but vendor lock-in. Hono + SQLite runs
anywhere, including Uberspace and a home server.

## Consequences

**Easier:** Push and a background watcher become possible. Building the horizon shrinks
from 13 minutes to seconds for the second user and every one after. Shipping tiers become
real crowdsourcing instead of pull requests.

**Harder:** A second deployment artefact, a cron job, a SQLite file with a backup. And
the temptation to let features depend on the hub after all — against which only
discipline helps, plus a CI test that runs the app through with an empty `hubUrl`.

**What has to be done now:** the three ports from `13-HUB-ADDON.md` §3
(`HorizonSource`, `ShippingProfileSource`, `WatchService`), their fallback chain, and
`hubUrl` in the preferences. About an hour's work. Without them M9 would be a refactoring
right across the worker.

**The way out:** delete the hub URL. The app carries on as if it had never existed.


---

## Addendum 2026-08-10 – the vault

This ADR says in several places that the hub holds **nothing personal**. The vault appears
to break that: it puts a user's collection, shortlist, basket, dealers and horizon on the
hub so that their devices can find one another.

**It does not break it, because the hub cannot read any of it.** Encryption happens on the
device — AES-GCM, with a key derived from a passphrase over 600,000 PBKDF2 rounds. What
sits in the `vault` table is four fields: `version`, `iv`, `salt`, `cipher`. The hub has
no key, no route that would accept one, and nothing that turns a block back into a
collection. A test holds that in place.

So the ADR's claim stays true, only stated more precisely: **the hub holds nothing
readable.** For the operator — usually the user themselves, sometimes a friend with a
server — nothing about their obligations changes, because they hold nothing they could do
anything with.

What still does **not** go in, and these are tests rather than declarations of intent:

- **The Discogs token.** A credential on three devices is three times the attack surface.
  Each device signs in once, itself (rule 6).
- **Digs and matches.** Marketplace data has to be deleted after six hours (rule 4).
  Putting prices on a server in order to sync them back would be exactly what this app
  promised not to do.

**The way out, unchanged:** set the target to "this device only". Nothing leaves the
browser, and the block on the hub is never read again. Anyone who wants rid of it deletes
the row — that is all it is.
