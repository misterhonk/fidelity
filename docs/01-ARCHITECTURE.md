# 01 – Architecture & tech stack

> **Fidelity has no backend.** A static PWA that talks to `api.discogs.com` directly. All
> data lives in the user's browser. See ADR-007.

---

## 1. The four hard constraints

These four facts determine the architecture completely. All verified live against the
production API on 2026-08-09.

### C-1 · Discogs allows CORS from the browser

```
access-control-allow-origin:  *
access-control-allow-headers: Content-Type, authorization, User-Agent,
                              Private-Auth-Secret, Discogs-UID
access-control-expose-headers: Location
```

`/users/juno_records/inventory` with a Safari user agent → **200, 43,223 listings.**
Discogs does not block browser user agents, even though the docs say "avoid Mozilla".

**That is the foundation for everything else.** Without CORS this architecture would not
exist.

> ⚠️ **Two limitations that follow from it:**
>
> 1. **`x-discogs-ratelimit-*` is not in `expose-headers`** → JavaScript **cannot read**
>    the rate-limit headers. The adaptive token bucket from the server design cannot be
>    built. We drive blind and conservatively (see §5).
> 2. **`POST /oauth/access_token` is blocked by CORS** (500, only `HEAD, OPTIONS`)
>    → **OAuth 1.0a is impossible.** Auth runs on Personal Access Tokens.

### C-2 · The rate limit applies per source IP – and here that is an advantage

- **60 requests/minute** authenticated, in a sliding 60-second window
- **Per source IP**
- On exceeding it: **429 with no `Retry-After`**

```
Server architecture:   30 users  →  1 × 60 req/min   →  a queue
Client architecture:   30 users  →  30 × 60 req/min  →  no queue
```

In the server design this was the hardest scaling limit. In the browser it is gone — every
user brings their own budget.

### C-3 · At most 10,000 listings per foreign dealer

```
GET /users/{u}/inventory?page=100&per_page=100  →  200 OK
GET /users/{u}/inventory?page=101&per_page=100  →  403
    {"message":"Pagination above 100 disabled for inventories besides your own"}
```

The limit sits on the **page number**, not on the offset. And `pagination.pages` **lies** —
it dutifully reports `433` for 43,234 items, but from page 101 you get a 403.

**Mitigation:** `sort_order=asc` **and** `desc` give two disjoint windows → **up to 20,000
listings**. Above that, complete coverage is impossible.

> **Product consequence:** the UI has to be honest. *"18,400 of 43,234 listings scanned
> (43 %)"* — not pretending it was complete.

### C-4 · Marketplace data may be displayed for at most 6 hours

From the API terms of use. Catalogue data, by contrast, is freely available as CC0 dumps —
we fetch the same facts through the API and store **nothing but id edges**, never
displayable content. Details: `09-LEGAL.md`, `11-CATALOGUE-STRATEGY.md` §7.

---

## 2. System architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│  BROWSER (installed PWA)                                               │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  MAIN THREAD — Nuxt 4 SPA (ssr: false)                           │ │
│  │  Vue 3 · Tailwind 4 · Nuxt UI 4 · virtualised lists              │ │
│  └───────────────────────────┬──────────────────────────────────────┘ │
│                              │ postMessage (progress, matches)         │
│  ┌───────────────────────────▼──────────────────────────────────────┐ │
│  │  WEB WORKER — all the work                                        │ │
│  │  ┌────────────────┐  ┌──────────────┐  ┌───────────────────────┐ │ │
│  │  │ DiscogsClient  │  │ Matching     │  │ Horizon expansion     │ │ │
│  │  │ · 1 req/1.2 s  │  │ engine       │  │ · artists/labels/     │ │ │
│  │  │ · 429 backoff  │  │ (pure fns)   │  │   masters → edges     │ │ │
│  │  │ · resumable    │  │              │  │                       │ │ │
│  │  └────────────────┘  └──────────────┘  └───────────────────────┘ │ │
│  └───────────────────────────┬──────────────────────────────────────┘ │
│                              │                                         │
│  ┌───────────────────────────▼──────────────────────────────────────┐ │
│  │  INDEXEDDB (via idb, ~2 kB)                                       │ │
│  │  token · collection · wantlist · tasteProfile                     │ │
│  │  horizon (Int32Array blobs) · digs · dealers · basket             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  SERVICE WORKER — app-shell precache, cover cache (LRU 150 MB)   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTPS, direct
                    ┌───────────▼──────────────┐
                    │  api.discogs.com         │
                    │  60 req/min – for YOU    │
                    └──────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  HOSTING — static files only, no process, no database                  │
│  Uberspace docroot · Cloudflare Pages · GitHub Pages — all free        │
└───────────────────────────────────────────────────────────────────────┘
```

**Everything but rendering runs in the worker.** The main thread stays at 60 fps, even
while a dig chews through 20,000 listings.

---

## 3. Time and resource budget

| Operation | Requests | Duration | Compute |
|---|---:|---:|---:|
| Collection + wantlist, first time | ~25 | ~30 s | ~200 ms |
| Horizon expansion, once | ~670 | ~13 min | ~2 s |
| A dig over 10,000 listings | ~101 | ~2 min | **~60 ms** |
| A dig over 20,000 listings | ~201 | ~4 min | **~120 ms** |
| Collection delta, daily | 1–3 | ~4 s | ~10 ms |

**The network dominates by a factor of 2,000.** Compute is not an issue in this app — what
counts is every request saved. The full budget: `12-RESOURCE-BUDGET.md`.

---

## 4. Tech stack – decisions with reasoning

### 4.1 Framework: **Nuxt 4.5 in SPA mode** (`ssr: false`)

Statically generated (`nuxt generate`), no Node at runtime. You know Vue — that is the
strongest argument, and it is a good one.

- **Nuxt 3 has been EOL since 2026-07-31**, so do not start there in the first place
- File-based routing, auto-imports, `@vite-pwa/nuxt`, Nuxt UI 4 — all wired up already
- Vite 8 as the build layer

| Rejected | Reason |
|---|---|
| Nuxt **with** SSR | Would need a Node process. For an app behind a token prompt, SSR buys nothing. |
| Plain Vite + Vue 3 | ~40 kB leaner, but we would rebuild routing, auto-imports and PWA integration ourselves. **The fallback if the bundle budget breaks.** |
| Next.js / SvelteKit / Astro | Relearning React, or the wrong shape; nothing in return |
| Laravel / Nitro / any backend | There is no server any more. See ADR-007. |

> ⚠️ **Do not plan on Vue 3.6 / Vapor Mode.** RC, opt-in per component, an untested
> ecosystem. For lists, performance comes from virtualisation.

### 4.2 Storage: **IndexedDB via `idb`**

A ~2 kB wrapper over the native API. No Dexie (~25 kB), no SQLite-in-WASM (~1 MB and
utterly oversized for a few key-value stores plus two indexes).

The horizon is stored as an **`Int32Array` blob**, not as a list of objects: 200,000 release
ids = **800 kB** instead of ~9 MB.

| Rejected | Reason |
|---|---|
| PostgreSQL + Drizzle | No server any more. ADR-002 and ADR-003 are moot. |
| SQLite WASM (wa-sqlite / SQLocal) | 1 MB of bundle, OPFS trouble on Safari, and we need no relational joins — only set lookups |
| localStorage | A 5 MB limit, synchronous, blocks the main thread |

### 4.3 Auth: **a Personal Access Token**

`POST /oauth/access_token` is blocked by CORS — which makes OAuth impossible. The user
fetches their token at `discogs.com/settings/developers` and enters it once.

- The token lives in IndexedDB and never leaves the device
- It is **never logged**, never written into an error report, never put in a URL
- "Sign out" deletes the token and all data
- No consumer secret in the client — we do not have one

### 4.4 The rest

| Area | Choice | Note |
|---|---|---|
| Language | TypeScript (the version Nuxt 4.5 pins) | TS 7 only once `vue-tsc` has caught up |
| UI | Nuxt UI 4.10 + Tailwind 4.3 + Reka UI | Nuxt UI Pro has been free and open source since 2026. **Radix Vue is dead.** |
| Tokens | DTCG 2025.10 → Style Dictionary → `@theme` | OKLCH |
| Lists | `@tanstack/vue-virtual` | mandatory from ~200 rows |
| Validation | Zod 4.4 (at the API boundary only) | |
| PWA | `@vite-pwa/nuxt` 1.1 | |
| Testing | Vitest 4 + Playwright 1.62 **including WebKit** | the weakest target is iOS Safari |
| Linting | ESLint 10 + `@nuxt/eslint` + Prettier | Biome cannot replace `eslint-plugin-vue` |
| Charts | **no library** | Bars are `<div>`s, the series grid is CSS Grid |
| Monitoring | Sentry optionally, **without** session replay | It is the user's bandwidth |

---

## 5. The Discogs client

The most important component we write ourselves. It lives in the web worker.

```ts
// worker/discogs/client.ts – the behavioural contract

// 1. THROTTLE BLIND AND CONSERVATIVELY
//    x-discogs-ratelimit-* is NOT in access-control-expose-headers.
//    JavaScript cannot read the headers – the adaptive token bucket from the
//    server design cannot be built.
//    → a fixed 1200 ms between requests (= 50/min, 10 under the limit)
//    → on a 429 (the status IS readable): 60s, 120s, 240s + jitter, max 3 tries
//    → after 3 failures: pause the dig and tell the user why

// 2. EXACTLY ONE IN-FLIGHT REQUEST
//    Concurrency buys nothing – the limit is time-based, not parallelism-based.

// 3. AUTH AS A HEADER
//    Authorization: Discogs token=<PAT>
//    Never in the query string (a historical bug: 25/min instead of 60/min).

// 4. THE USER AGENT IS NOT SETTABLE
//    fetch() forbids the header. Verified harmless: Discogs accepts browser
//    user agents. ⚠️ Check this FIRST of all in M1 – if it breaks, the whole
//    architecture breaks.

// 5. PARSE BOTH ERROR SHAPES
//    Legacy:   { "message": "..." }
//    Migrated: { "detail": [ { "type": "literal_error", ... } ], "message": "..." }

// 6. NEVER FETCH IMAGES ACTIVELY
//    i.discogs.com has its own undocumented Cloudflare limit (~30–40/min).
//    We only set <img loading="lazy"> – the browser fetches them when visible.

// 7. EVERY RUN IS RESUMABLE
//    The page cursor goes into IndexedDB after every page. Tab closed, phone
//    locked, network gone → next time it carries on instead of starting over.
```

---

## 6. The horizon – a catalogue built on demand

Five signals need data the inventory listing lacks (`master_id`, credits, genres, the
complete label list). The obvious route — `/releases/{id}` per listing — costs roughly
**3 hours per dig** and is out of the question.

**The solution is to reverse the direction of the query:**

```
WRONG:  20,000 inventory listings  →  1 request each  →  metadata
        expensive, volatile, redone every dig

RIGHT:  ~150 entities from the COLLECTION  →  1–11 requests each  →  sets of release ids
        once, long-lived, and every dig after that is a free set lookup
```

The collection is small and stable. The inventory is large and volatile.
**You cache the small, stable side.**

### Verified on 2026-08-09

```
GET /artists/40135/releases?per_page=100        (Conny Plank)
→ 1,095 entries · 11 requests · no page limit
  Roles: { Main: 13, Remix: 11, Producer: 76 }   ← the role field is the key
  Types: { master: 72, release: 28 }

GET /masters/2598/versions?per_page=100          (Neu! – Neu! 2)
→ 55 pressings with release_id · 1 request
```

`/artists/{id}/releases` returns not only the albums as main artist but **also the ones
produced, mixed and remixed** — with the role stated. That puts the credit graph within
reach for eleven requests rather than a 10.4 GB dump.

| What | Selection | Endpoint | Requests |
|---|---|---|---|
| Wantlist albums | all with `master_id ≠ 0` | `/masters/{id}/versions` | ~1 per album |
| Artists | ≥ 2 records in the collection | `/artists/{id}/releases` | 1–11 |
| Labels | lift ≥ 2 **and** < 1,500 releases | `/labels/{id}/releases` | 1–15 |
| Credits | people with lift ≥ 3 | `/artists/{id}/releases` | 1–11 |

**~670 requests ≈ 13 minutes, once.** After that only deltas, with revalidation every 30
days. **The 10.4 GB releases dump is not needed** — reasoning in
`11-CATALOGUE-STRATEGY.md`.

---

## 7. How a dig runs

```
1  The user enters a dealer name
2  Worker: GET /users/{dealer}  →  num_for_sale
   → more than 10,000?  Say honestly, right away, how much is reachable
3  The worker paginates the inventory, per_page=100, 1 request/1.2 s
4  AFTER EVERY PAGE:
   a) normalise 100 listings, apply the hard filters
   b) set lookup against the horizon + map lookup against collection/wantlist
   c) the fuzzy stage only for what is left
   d) scoring + the reason sentence
   e) postMessage: { scanned, total, eta, newMatches }
   f) persist the cursor in IndexedDB
   g) throw the 100 raw listings away — only matches from score 30 up stay
5  Beyond 10,000: automatically a second pass with sort_order=desc
6  Done: expiresAt = now + 6h  ← the ToS, hard in the data model
7  After 6 h: marketplace fields are nulled, banner "snapshot expired"
```

**Why incrementally?** Four minutes of spinner is hostile. Matches that appear after five
seconds and keep growing feel like searching, not like waiting.

**Why throw the raw listings away at once?** 20,000 listings at ~2 kB would be 40 MB in
memory. We keep ~600 matches.

---

## 8. Fuzzy matching of artist and label names

The real algorithmic problem — now in JavaScript rather than in `pg_trgm`.

**The problem:** an inventory listing gives `release.artist` as a **string**
(`"Miles Davis"`, `"Various"`, `"Kraftwerk / Neu!"`) and `release.label` as a **string**
(the first one only!). The collection gives `artists[]` and `labels[]` **with ids**.

**The good news:** both sides come from the same Discogs database. The strings are
canonical, including disambiguation suffixes (`"Nirvana (2)"`). A normalised exact match has
very high precision — and is a `Map` lookup in O(1).

```
1. NORMALISE — once at sync time, not per dig
   lower → strip diacritics (String.normalize('NFD') + regex)
   → drop leading articles ("The Beatles" ≈ "Beatles")
   → KEEP parenthetical qualifiers (!) — "Nirvana (2)" is a DIFFERENT artist
   → collapse remaining punctuation and whitespace

2. EXACT MATCH  Map.get(norm)                  → confidence 1.00   O(1)
3. TOKEN CONTAINMENT for multi-artist strings  → confidence 0.85
   "kraftwerk / neu!" contains the token "kraftwerk"
4. TRIGRAM SIMILARITY ≥ 0.85, only for leftovers → confidence 0.70
5. "various" / "various artists" / "v/a"       → NEVER an artist match
```

Stage 4 is the only expensive one — it runs only for the few hundred listings stages 2 and 3
did not hit. Measured budget: < 60 ms for 20,000 listings.

> **No embeddings.** "Same record, different pressing" is a normalisation and
> catalogue-number problem, not a semantic one.

---

## 9. Security & privacy

| Topic | Implementation |
|---|---|
| Personal Access Token | IndexedDB only, never logged, never in a URL or error report, never to third parties |
| "Sign out" | Deletes the token **and** all local data |
| GDPR | **There is no server processing anyone else's data.** No processor, no cookie banner, no tracking. The privacy notice simply describes: everything stays on your device |
| CSP | Strict. `connect-src 'self' https://api.discogs.com` · `img-src 'self' https://i.discogs.com data:` |
| Subresource integrity | For anything not from our own build (ideally: nothing) |
| Dependencies | Renovate, `pnpm audit` in CI, GitHub Actions pinned to commit SHAs |
| Persistence | Ask for `navigator.storage.persist()` so iOS does not clean up after 7 days |
