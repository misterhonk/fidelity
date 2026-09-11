# ADR-007: A client-only PWA with no backend

**Status:** Accepted · **Date:** 2026-08-09
**Supersedes parts of:** ADR-001, ADR-002, ADR-003, ADR-004

## Context

The goal: minimal resource use. The server design (Nuxt SSR + PostgreSQL + pg-boss on
Uberspace) needed ~700 MB of RAM, a deployment, backups, a database — and it split a
**shared** rate-limit budget across all users.

The question was: can this run entirely in the browser?

## Verified on 2026-08-09 against `api.discogs.com`

```
access-control-allow-origin:  *
access-control-allow-headers: Content-Type, authorization, User-Agent,
                              Private-Auth-Secret, Discogs-UID
access-control-expose-headers: Location
```

| Test | Result |
|---|---|
| GET with an `Origin` header | **200**, `allow-origin: *` |
| Preflight with `authorization` | **204**, header allowed |
| `/users/juno_records/inventory` with a **Safari user agent** | **200**, 43,223 listings |
| Preflight `PUT /users/{u}/wants/{id}` | allows `DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT` |
| Preflight `POST /oauth/access_token` | **500**, only `HEAD, OPTIONS` |
| `x-discogs-ratelimit-*` in `expose-headers` | ❌ **not present** |

## Decision

**Fidelity becomes a client-only PWA.** Static files, no backend, no database, no
deployment process. The browser talks to `api.discogs.com` directly.

**Authentication through a Personal Access Token.** The user creates one for themselves at
`discogs.com/settings/developers` and enters it into the app. The token lives in IndexedDB
on their device and never leaves it.

> **OAuth 1.0a is no longer an option** — `POST /oauth/access_token` is blocked by CORS.
> That is no loss: a PAT reads exactly its owner's data, and that is precisely what every
> user needs. The original reason for ruling it out ("a PAT only reads its own owner's
> data") applied only to a server app serving many users.

## The real prize: the rate limit

Discogs throttles **per source IP**. In a server app all users share *one* budget of 60
requests a minute — on Uberspace even with other customers on the same host. In the
browser **every user has their own budget**.

```
Server architecture:   30 users  →  1 × 60 req/min   →  a queue, staggering
Client architecture:   30 users  →  30 × 60 req/min  →  no queue
```

That removes the project's hardest scaling limit outright.

## Alternatives

**The server architecture (the original design)** – gives a shared horizon, a background
watchlist and real push notifications. It costs ~700 MB of RAM, operations, backups, GDPR
obligations and the shared rate limit. Rejected: the ratio does not work for 5–30 users.

**Hybrid (static PWA + a tiny push service)** – stays open as an **additive** step, see
"The way out". Not now.

**A browser extension** – would have made the user agent settable. Rejected: store review,
no iOS, worse installability. The test shows Discogs accepts browser user agents anyway.

## Consequences

**Easier**

- No server, no database, no ORM, no job queue, no deployment, no backups
- Hosting = static files. An Uberspace docroot, Cloudflare Pages, GitHub Pages — free
- **A full rate-limit budget per user**
- GDPR becomes trivial: there is no controller for anyone else's data, because nobody
  else's data is stored anywhere. No processor, no token on someone else's server
- Offline capability falls out for free — the data is local anyway
- The device does the computing, and every phone is stronger than the Uberspace account

**Harder**

| Loss | Replacement |
|---|---|
| **No push notifications** – Web Push needs an application server | Check on opening + the Badging API. A "since your last visit" banner |
| **No nightly watchlist scans** – Periodic Background Sync is Chromium-only and unreliable | Watchlist check at app start, staggered in the background worker |
| **Rate-limit headers invisible to JS** (`expose-headers` lists only `Location`) | Drive blind and conservatively: 1 request per 1.2 s, exponential backoff on 429 (the **status** is readable) |
| **The horizon is not shared** – every user expands their own | ~12 minutes once, on their own budget. Not a real problem |
| **Shipping tiers cannot be crowdsourced** | As `shipping-profiles.json` in the repository, maintained by pull request, shipped with the app |
| **Digs cannot be shared by link** | Export as a JSON file |
| **iOS clears data after ~7 days of inactivity** – except for installed home-screen apps | Promote installation actively; the horizon is reproducible anyway |
| **No user agent can be set** – `fetch()` forbids the header | Verified harmless: Discogs accepts browser user agents. **Check this first in M1.** |

**The way out**

The dividing line is clean: the app talks to a `DiscogsClient` interface and a `Store`
interface. Both can later be swapped for a server implementation without the matching
engine or the UI noticing.

A **Cloudflare Worker** (free up to 100,000 requests a day) could be added later,
additively — purely for push and nightly watchlist runs, not for scanning.
**Trigger:** push is missed, or the number of users reaches the hundreds.
