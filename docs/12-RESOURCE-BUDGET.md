# 12 – Resource budget

> The guiding sentence: **the cheapest resource is the one you do not use.**
> This app has no backend. What it consumes, it consumes on the user's device — and it is
> frugal there too.

---

## 1. Server side: zero

| Resource | Consumption |
|---|---:|
| RAM | **0** |
| CPU | **0** |
| Database | **none** |
| Background processes | **none** |
| Traffic | only the static files on first load |
| Running costs | **€0** |

What is hosted is a few hundred kilobytes of static files. An Uberspace docroot, Cloudflare
Pages or GitHub Pages — free everywhere, interchangeable everywhere.

---

## 2. Bundle budget

The thing should load where reception is bad too — in the basement of a record shop, behind
concrete shelving.

| Part | Budget (gzip) | Measured |
|---|---:|---:|
| HTML + critical CSS | ≤ 8 kB | |
| App-shell JS (Vue + router + UI core) | ≤ 140 kB | |
| Matching engine (worker, lazy) | ≤ 22 kB | 20.1 kB (2026-11-01) |
| The remaining routes (lazy) | ≤ 30 kB each | 13.9 kB |
| Barcode decoder (lazy, only without `BarcodeDetector`) | ≤ 440 kB | 427.3 kB (2026-11-01) |
| **First meaningful paint** | **≤ 180 kB** | **125.4 kB** (2026-11-01) |

> **Why the worker went from 25 to 35 kB (M3).** The 25 kB were an estimate made before
> there was any code. Measured, it is 31.5 kB, about 16 kB of which is Zod. The obvious way
> out would have been `zod/mini` — saving about 13 kB. Against it: the schemas *are* the
> boundary between unchecked API data and everything else (CLAUDE.md), and the worker does
> not block the first paint, it loads alongside it. The number that matters, the 120 kB, is
> met. Zod's core is monolithic besides: the 16 kB are paid once, further schemas cost
> almost nothing — so the budget does not run away by itself.
>
> If the worker does one day rise well above 35 kB, the order is: first load the horizon and
> matching code only when a dig starts, then `zod/mini`.

> **Why 35 kB became 40 kB (2026-09-12, M21.4).** Measured at 34.8 kB with the catalogue's
> client (ADR-013), the running-scan report and the token renewal in it — 3.3 kB over
> eight milestones, none of it Zod. The catalogue adds one more consumer per phase and the
> horizon and matcher stay where they are for now, because the worker loads beside the
> first paint, not in front of it. The order above still holds the day 40 is reached: that
> is the day the horizon and matcher become a chunk a dig loads.

> **Why 40 kB became 25 kB (2026-09-16).** The worker reached 39.54 kB — 0.46 from a hard
> limit that breaks the build — and the escalation above was ready to be spent. It was not
> needed. **Zod was 18.9 kB of the 39.54**, and the reason it was in the start-up at all was
> one line: `worker/auth.ts` named two response schemas at the top of the file. That module
> is the entry — `index.ts` imports `handlers.ts` imports it — so a name at its top is paid
> before the first message is answered, and both uses sit inside a sign-in that is about to
> spend 2.4 seconds on two paced requests. Fetched where they are used instead:
> **39.54 → 20.31 kB.**
>
> Which is the M3 note above, arriving at the opposite conclusion by measuring rather than
> arguing. That note weighed Zod against `zod/mini` and decided the schemas were worth their
> 16 kB *at start-up*. The choice was never between paying and not paying — it was between
> paying **before the first message** and paying when somebody signs in.
>
> **And the ceiling came down with it, which is the part that matters.** A limit of 40 over
> a worker of 20 stops nothing: Zod could walk back in tomorrow through any static import
> and the build would stay green. A budget that is only ever raised is not a budget, and one
> that is never lowered stops being a measurement — the same thing that had happened to the
> roadmap. 25 kB leaves room for real growth and still notices 19 kB arriving by accident.
>
> The order for the day 25 is genuinely reached is unchanged: the horizon and the matcher
> become a chunk a dig loads, then `zod/mini`. Both are still ahead of raising the number.

> **Why 25 kB became 22 kB, and where 18 kB of first paint went (2026-11-01, #299).**
> `pnpm size` had reported the first paint at 143–144 kB for weeks while this table still
> said 125, and the worker stood at 25.01 kB of 25. Measured against v0.116.0 (143.14 kB),
> Sprint 2 itself added only **1.07 kB** to the first paint: English strings (`app/i18n/en.ts`),
> new entries in the router table, the palette's open-state composable, 0.13 kB of CSS. No
> feature had walked into the first screen; the command palette is still a lazy component.
>
> The other 18 kB were **the worker, preloaded by index.html**. Vite lists a worker's entry
> as an *asset* of the chunk that says `new Worker(new URL(...))`, and Nuxt preloads the
> assets of every chunk it preloads — so the page fetched and compiled 19.3 kB into its own
> module map, which the worker, having one of its own, never uses. A `build:manifest` hook
> in `nuxt.config.ts` takes `.js` assets out of the preload, and `.size-limit.js` now
> refuses to measure a build where the worker is back among the first-paint files:
> **144.21 → 125.39 kB.**
>
> The worker lost 4.9 kB the same way it lost 19 in September — by not paying at start-up
> for something used later. `z.config({ jitless: true })` in `worker/index.ts` had pulled
> zod's core and util into the entry for one flag (3.6 kB); the flag is now set on
> `globalThis.__zod_globalConfig`, the object zod reads its config from, and a unit test
> pins that. The basket's twelve handlers and the hub's two moved into
> `worker/basket/handlers.ts` and `worker/hub/handlers.ts`, loaded the first time one of
> them is asked for; the table in `worker/handlers.ts` keeps every kind, and
> `tests/unit/worker-entry.spec.ts` fails if a group is imported statically or a handler is
> written inline again. **25.01 → 20.13 kB**, and the ceiling came down to 22 kB with it, for
> the reason given in the September note.

> **Why a 427 kB dependency is allowed in (2026-11-01, ADR-018, #301).** `zxing-wasm`
> 3.1.5, reader build only: 415.1 kB gzip of `.wasm` and 12.3 kB of JS glue. It is the
> largest single thing the app can download, and it justifies its place under rule 7 only
> because of *who* pays and *when*:
>
> - **Nobody on first paint.** It is an `import()` inside `useBarcodeScan.start()`, never
>   prefetched or preloaded. `.size-limit.js` breaks the build if either file shows up among
>   the first-paint assets or anywhere in `index.html` or `200.html`. First paint and worker were measured
>   identical before and after (125.46 kB, 20.17 kB).
> - **Not the main thread.** Since #304 the glue and the decoding live in a worker of their
>   own (`worker/scan/zxing.ts`); the page's side is a 1 kB launcher.
> - **Nobody with `BarcodeDetector`.** Chromium reads barcodes by itself and never fetches it.
> - **An iPhone, once, on the first tap on "Read a barcode".** About 0.3 s on normal LTE,
>   ~4.3 s on one bar in the basement (the table below, scaled) — and then never again:
>   the service worker keeps the `.wasm` (`fidelity-decoder`, CacheFirst, one entry). It is deliberately **not** in the
>   install-time precache, so a fresh install does not carry 415 kB most visitors never use;
>   the 12 kB glue is, like every lazy chunk.
> - **What it buys:** pointing the camera instead of typing thirteen digits or two extra taps
>   for Scan Text, per record, in a shop — on the platform that had no reader at all.
>
> The alternatives were weighed in ADR-018: a JS-only decoder would be 100–200 kB *without*
> the CSP change but slower and worse on a curved, glossy sleeve; the full zxing-wasm build
> (reader + writer) roughly doubles the bytes for a writer nobody here needs. The ceiling of
> 440 kB leaves room for a patch release, not for the full build slipping in.

> **Why 120 kB became 180 kB (2026-08-11).** The 120 were tied to a network that no longer
> exists: "in the basement of a record shop over 3G". 3G was switched off in Germany in
> 2021. A limit modelling a dead network generation protects nobody any more — it only costs
> design.
>
> Recalculated, what the increase actually costs:
>
> | Connection | 120 kB | 180 kB | Extra |
> |---|---:|---:|---:|
> | 5G, medium | 0.00 s | 0.01 s | 0.00 s |
> | LTE good | 0.02 s | 0.03 s | 0.01 s |
> | LTE normal | 0.08 s | 0.12 s | **0.04 s** |
> | LTE weak | 0.32 s | 0.48 s | 0.16 s |
> | One bar in the basement | 1.20 s | 1.80 s | 0.60 s |
>
> Forty milliseconds in the normal case. Doing without gradients, shadows and motion is not
> worth that.
>
> **What stays the same:** the sentence at the top. A higher ceiling is not an invitation to
> stack up to it — 180 is the point at which the build breaks, not the target. And the limit
> stays a *real* limit: it still breaks the build, because a budget you raise at every
> attempt is not a budget. The basement, incidentally, was never a problem of network
> generation but of coverage — LTE at −110 dBm behaves like 3G. That makes the extreme case
> rarer, not better.

**Measures**

- Nuxt in **SPA mode** (`ssr: false`), statically generated — no Node at runtime
- Route-based code splitting; basket, map and dealer profile load only when needed
- Import Nuxt UI **selectively**, not as a whole package
- No icon library as a whole — only the ~20 SVGs actually used, inline
- **No chart library.** Bars and distributions are `<div>`s with `width: %`. The series grid
  is CSS Grid. Saves 60–150 kB against Chart.js/ECharts
- No Moment/date-fns — `Intl.DateTimeFormat` and `Intl.NumberFormat` are built in
- No Lodash, no polyfills (Baseline 2026 is the target platform)
- `motion-v` only where it pays off in practice; CSS transitions are enough for nearly
  everything
- Check bundle size in CI; exceeding the budget breaks the build

---

## 3. Storage on the device

| What | Size |
|---|---:|
| Collection, 2,412 entries (lean) | ~1.4 MB |
| Wantlist, 184 entries | ~0.1 MB |
| Taste profile | ~50 kB |
| Horizon: ~200,000 release ids as an `Int32Array` | **800 kB** |
| Horizon metadata (role, catalogue number, year) | ~6 MB |
| The last 5 digs, matches from score 30 up only | ~1 MB |
| **Total** | **< 10 MB** |

**Measures**

- **Release ids as an `Int32Array`, not as an array or a set of objects.**
  200,000 ids = 800 kB instead of ~9 MB. Look up by binary search on the sorted array, or
  lift it into a `Set` once (then ~4 MB, but O(1)) — depending on what measurement says
- **Nothing** from the inventory is persisted except the matches. 20,000 listings flow
  through the worker and are discarded
- Dig history capped hard at 5, FIFO after that
- Marketplace fields are nulled after 6 hours (the ToS) — the storage is freed anyway
- IndexedDB through `idb` (~2 kB), not Dexie (~25 kB)
- Ask for `navigator.storage.persist()` so iOS does not clean up after 7 days

---

## 4. Compute on the device

A dig processes up to 20,000 listings. That sounds like a lot and is not.

```
20,000 listings
  → normalise                ~20,000 × regex        ≈  40 ms
  → hard filters             ~20,000 × comparison   ≈   5 ms
  → set lookup in horizon    ~20,000 × O(1)         ≈   3 ms
  → fuzzy for leftovers only ~800 × trigram         ≈  60 ms
  → scoring + reasoning      ~600 matches           ≈  15 ms
                                            total   ≈ 120 ms
```

For comparison: the **network** needs **200 requests at 1.2 s = 4 minutes** for the same
20,000 listings. The compute time disappears entirely into the noise.

**Measures**

- Scan and scoring entirely in the **web worker** — the main thread stays at 60 fps
- Process **incrementally, per page**, never 20,000 objects in memory at once
- Compute the collection's normalised names **once** at sync time, not per dig
- Fuzzy matching is the only expensive stage → it runs **only** for listings the exact map
  lookup did not hit
- The result list is virtualised (`@tanstack/vue-virtual`) — never 600 DOM cards
- No reactivity over large arrays: results as `shallowRef`, not `ref`
- Covers are loaded lazily by the browser, and only in the viewport

---

## 5. Network – the real cost centre

The rate limit is the only resource that is genuinely scarce.

| Operation | Requests | Duration |
|---|---:|---:|
| First-time setup: collection + wantlist | ~25 | ~30 s |
| Horizon expansion (once) | ~670 | **~13 min** |
| One dig, 10,000 listings | ~101 | ~2 min |
| One dig, 20,000 listings | ~201 | ~4 min |
| Collection delta (daily) | 1–3 | ~4 s |
| Horizon revalidation | ~20/day | ~25 s |

**Measures**

- **`per_page=100` everywhere.** The default is 50 — which would double everything
- **A collection delta instead of a full sync:** `sort=added&sort_order=desc` and stop as
  soon as a known entry comes. With no new records the daily sync costs **one** request
- **Never `/releases/{id}` in a loop** — the project's most expensive rule
- `/marketplace/stats/` only for the **top 50** by preliminary score, not for every match
- **Images do not count against the API budget** but have a Cloudflare limit of their own
  (~30–40/min) → lazy, viewport only, `CacheStorage` with an LRU cap of 300 entries — not
  bytes: the covers are opaque responses, and Chrome books each at ~7 MB of quota
  (`app/sw/sw.ts`, measured 2026-09-16)
- Interrupted digs are resumable: the page cursor is persisted
- Horizon expansion runs in small bites and survives reloads

---

## 6. What is deliberately not built

| Doing without | Saved |
|---|---|
| A chart library | 60–150 kB of bundle |
| Server rendering | an entire Node process |
| PostgreSQL | ~250 MB of RAM, backups, migrations |
| Redis/Valkey | another service |
| A job queue | a process + a schema |
| `pgvector`/embeddings | compute and complexity with no demonstrated benefit |
| Sentry session replay | the user's bandwidth and CPU |
| Analytics/tracking | all of the above, plus a cookie banner |
| The full dump (10.4 GB) | ~6 GB of disk and a monthly maintenance appointment |
| Our own user accounts | a database, password handling, GDPR obligations |

---

## 7. Measure, do not guess

In CI, with thresholds that break the build:

- **Bundle budget** per chunk (`vite-bundle-visualizer`, `size-limit`)
- **Lighthouse** under mobile throttling: performance ≥ 95, LCP < 2.0 s
- **Scoring benchmark**: 20,000 synthetic listings must stay under 250 ms
- **IndexedDB size** after a simulated full sync: under 15 MB

The rule: **every new dependency must justify its place in the budget.**
Uberspace would have had 1.5 GB of RAM — a phone in a basement has less patience.
