# 06 – Roadmap

> SemVer for an app: **MAJOR** = a breaking change to the IndexedDB schema with no
> automatic migration · **MINOR** = features · **PATCH** = fixes.
> Every milestone ends with a tag and a `CHANGELOG.md` entry.

---

## Where we stand

The milestone versions in the headings are planning names from the design period, not the
actual numbering — that is in `CHANGELOG.md`.

**M0 through M18 are done. M19 is open** — the first list of candidates in this file that
came from outside the project: from what Discogs users ask for, checked against what this
architecture can do (`docs/14-RELAUNCH-CONCEPT.md` has the research behind it).

`docs/` was still German until 2026-09-11 and was translated then — fourteen numbered
documents and thirteen ADRs. That was read as ADR-010 being finished. It was not: the rule
says *code, comments, commits*, and the comments were never touched — **141 files, 5,473
lines**, translated the same day behind a ratchet that is now a plain rule. M16 has the
count, and the three things the ratchet could not see.

The runout read aloud from M13 stood here until 2026-09-11 and is **measured and
rejected** — `SpeechRecognition` is available and can even run on the device, but it is
trained on words, and a runout is not one. The reasoning is under M13.

The watcher with Web Push and the hub Dockerfile stood as open in this table until
2026-09-10 and had both been built since 14 August. Checked against the code, not struck
from memory: `app/sw/sw.ts` has `push` and `notificationclick`, `deploy/hub.Dockerfile` is
there and gets published.

Two lines in this file are **superseded rather than open** and are marked as such: the 429
backoff on the status (not buildable in a browser, `docs/02`) and the Uberspace backend
instructions (the app has been purely static since ADR-007).

> This list went unticked for a long time while the app had long been running — anyone
> reading it concluded that nothing was finished. Every tick here has been checked against
> the code, not set from memory.

---

## M0 · Foundations → `v0.1.0`

**Goal:** `pnpm dev` starts an empty but fully wired PWA.

- [x] `git init`, a first conventional commit
- [x] A Nuxt 4.5 skeleton, **`ssr: false`**, TypeScript, pnpm
- [x] IndexedDB set up with `idb`, the stores from `docs/03-DATA-MODEL.md`
- [x] The web worker scaffolding including a typed `postMessage` protocol
- [x] Tailwind 4 via `@tailwindcss/vite` + Nuxt UI 4, design tokens (DTCG → `@theme`)
- [x] `@vite-pwa/nuxt`, a manifest, icons, `registerType: 'prompt'`
- [x] ESLint 10 + `@nuxt/eslint` + Prettier + lefthook + commitlint
- [x] Vitest + Playwright (**including WebKit**), one real smoke test
- [x] **The bundle budget in CI** (`size-limit`), exceeding it breaks the build
- [x] GitHub Actions: lint ∥ typecheck ∥ test → build
- [x] release-please with the Keep a Changelog mapping
- [x] `CLAUDE.md`, the ADR folder

**No Docker, no database, no compose stack.**

**Definition of done:** a fresh clone → `pnpm dev` → the app runs, the tests are green, and
a conventional commit produces a release PR.

---

## M1 · Token & sync → `v0.2.0`

**Goal:** Martin enters his token and sees his collection.

> ⚠️ **THE VERY FIRST TASK, before anything else:** from a real browser, call
> `GET /users/{u}/inventory` and verify that Discogs accepts the browser user agent. Curl
> tests on 2026-08-09 were positive, but `fetch()` cannot set the UA. **If that breaks, the
> whole architecture breaks** — then back to the server design (ADR-007, "The way out").

- [x] Token entry with instructions ("discogs.com/settings/developers → Generate token")
- [x] Validation against `GET /oauth/identity`
- [x] The token in IndexedDB, a redaction list in the logger, a `beforeSend` hook if Sentry
- [x] **The DiscogsClient in the worker**: 1 request/1.2 s, both error shapes, a resumable
      cursor. ⚠️ The originally planned **429 backoff on the status** is not buildable in a
      browser: the 429 comes without CORS headers, `fetch()` rejects, and JS never sees a
      status (measured 2026-08-10, see `docs/02` §Rate limits). Instead: two short retries,
      then sit out the rate-limit window
- [x] Sync collection + wantlist, a **delta strategy** (`sort=added&desc`)
- [x] Normalise names at sync time and store them
- [x] Compute the taste profile (lift-based)
- [x] The "Your map" screen: labels, styles, decades, artists
- [x] "Sign out" deletes the whole database

---

## M2 · The first dig → `v0.3.0` — **the milestone that proves it**

**Goal:** enter a dealer name → a scored list of hits in 2 minutes.

- [x] An advance check `GET /users/{dealer}` → `num_for_sale`, an honest statement above
      10,000
- [x] Paginate the inventory, `per_page=100`, a second pass with `sort_order=desc`
- [x] Process **incrementally per page**, discard raw listings at once
- [x] Hard filters (format, budget, shipping origin, already owned)
- [x] Signals **S1** (wantlist exact), **S3** (artist), **S5** (label) — all free
- [x] The fuzzy cascade in JS: map lookup → token containment → trigram
- [x] Barry Score v1 with the reason-sentence templates
- [x] Progress via `postMessage`, the first hits after ~5 s
- [x] Screens: new dig, dig running, dig result, `MatchCard`
- [x] `expiresAt = now + 6h` including the expiry job and the UI lock
- [x] The dig is resumable after closing the tab

**Definition of done:** Martin scans his regular dealer and finds at least one record he
would not have found without the app. **That is the real project milestone.**

---

## M3 · Barry gets smarter → `v0.4.0`

- [x] Signal **S7** (style adjacency, cosine over sparse vectors)
- [x] Feedback buttons (👍😐👎🛒) with a signal snapshot
- [x] The dealer fingerprint + affinity score → "The Clerk's Take"
- [x] A filter bar with signal chips, sorting, a density toggle
- [x] A virtualised list, the command palette (⌘K)
- [x] The release detail sheet with a view transition
- [x] Golden-file tests of the scoring engine, measure precision@5 (target ≥ 0.6)

**Result:** precision@5 = 1.0 · precision@10 = 0.9 against the golden dig.
S7 runs as a top-50 follow-up over `/releases/{id}` after the scan — the same shape as
S10/S11 in M4 — because a release's styles are not reachable in bulk anywhere else. The
golden dig found a real bug in S9 on its first run (see `docs/04` §S9).

---

## M4 · The basket → `v0.5.0`

- [x] A basket per dealer
- [x] Shipping tiers: user input + `shipping-profiles.json` from the repository
- [x] A free-text parser for `seller.shipping` (clearly marked as a heuristic)
- [x] The marginal cost curve + "+1 record saves €X each"
- [x] Candidate suggestions in the right price window
- [x] Signals **S10** (price) + **S11** (scarcity) via `/marketplace/stats/` — **for the
      top 50 only** by preliminary score
- [x] A greedy optimiser + swap improvement
- [x] Deep links to Discogs (no checkout of our own)

**Notes:**

- S10/S11 run in the same top-50 pass as S7, not in a second one. Two lookups per record,
  around two minutes — the list is already there beforehand.
- The **price window for candidates is the user's comfortable price**, not a number derived
  from the postage saving. Nobody buys a record because it saves postage; the saving only
  tips a decision that was already close.
- The basket **stops showing** prices after six hours (CLAUDE.md rule 4). The record stays
  in, only the number goes. A subtotal over the rows that are still fresh would be a
  smaller number than the truth.
- The worker was split for this: the basket and the detail sheet load only when opened
  (`worker.format: 'es'`), or the basket would have broken the 35 kB budget from
  `docs/12` §2.

---

## M5 · The horizon → `v0.6.0`

**Goal:** unlock the five expensive signals — without a full dump, without an XML parser.

- [x] Determine the relevant entities (artists with ≥ 2 records · labels · wantlist
      masters)
- [x] **Credits as entities of their own** — harvested from the favourite records
- [x] Expansion via `/artists/{id}/releases`, `/labels/{id}/releases`,
      `/masters/{id}/versions`
- [x] Evaluate the `role` field (`Main`, `Producer`, `Remix`, `Engineer`, …)
- [x] The master/release two-step: `main_release` at once, `versions` on demand afterwards
- [x] Packed as `Int32Array`/`Uint8Array` parallel arrays (~1.4 MB instead of ~9 MB)
- [x] A progress display for first-time setup (~670 requests ≈ 13 min), in bites and
      reload-proof
- [x] Revalidation every 30 days, staggered
- [x] Signals **S2** (pressing), **S4** (discography gap), **S6** (catalogue run),
      **S8** (credit graph), **S9** (format upgrade)
- [x] The `CatalogRunGrid` component
- [x] The credit-graph explorer: "every Conny Plank production at this dealer"

**Notes:**

- The **lift ≥ 2 / < 1,500 releases** filter for labels cannot steer the selection: both
  numbers only come into existence during the expansion. The cheap condition selects, and
  the expansion aborts a label that is too large after one page and marks it incomplete.
- Stage 2 of the two-step collects near misses **during** the scan, like the fingerprint —
  keeping 20,000 listings around afterwards would be 40 MB. At most eight masters per dig,
  because a near miss is a guess.
- The credit explorer costs **zero requests**. It only regroups what the horizon already
  knows.

> ### How credit people are found
>
> `docs/11` §3 picks "people with lift ≥ 3 in the collection" as a fourth class of entity
> but does not say how to find them. Nor can it be done cheaply: `extraartists` appears
> only in `/releases/{id}`, and a pass over 2,412 records would be 2,412 requests
> (~48 min) — exactly the pattern CLAUDE.md rule 2 forbids.
>
> **Solved through the favourite records:** only records with **4 or 5 stars** are
> harvested. Those are a few hundred rather than a few thousand, they are precisely the
> ones whose production interests you, and the run is bounded, resumable and started by
> hand.
>
> **"Lift ≥ 3" became "on ≥ 3 favourite records".** A lift needs a denominator — how often
> a person appears in music generally — that no browser can measure. The label lift has
> one, because catalogue sizes come free with the expansion; for a person the size would
> only arrive *after* the decision to expand them. So a plain count, with the number from
> the document.
>
> ⚠️ **A precondition: rated records.** Anyone who gives no stars on Discogs gets nothing
> here — the screen says so and gives the reason.

**No download, no parser, no maintenance appointment.** See `11-CATALOGUE-STRATEGY.md`.

> Since the full dump fell away, M5 is small enough to be pulled **straight after M2** if
> needed — the five signals are the real product lead.

---

## M6 · Offline & the watchlist → `v0.7.0`

- [x] The service worker: app-shell precache, a cover cache with an LRU cap (150 MB)
- [x] Ask for `navigator.storage.persist()`
- [x] Offline mode: the collection and recent digs fully usable
- [x] **The in-store screen** (mobile, large targets, offline) — the basement-of-a-record-
      shop case
- [x] The iOS coach mark "Share → Add to Home Screen" (no `beforeinstallprompt` on iOS)
- [x] The watchlist: bookmark dealers, **a check at app start** rather than overnight
- [x] Cheap change detection: `GET /users/{dealer}` → compare `num_for_sale`
      (**1 request instead of 100**), a full scan only on a change
- [x] The Badging API + a "since your last visit" banner

**Notes:**

- **The 150 MB cap became 6,000 entries.** Workbox's `ExpirationPlugin` counts entries and
  age, not bytes — there is no byte cap there. 6,000 is the same budget in the available
  unit, computed with the ~25 kB a 150 px thumbnail weighs. `purgeOnQuotaError` is the real
  safety net should the estimate be off.
- **The banner promises no more than the number supports.** `num_for_sale` moving by 40
  does not mean "40 new records" — sell five and list five and it moves by zero. The text
  says "40 more listings on offer than last time" and explains the caveat underneath.
- **Offline checked live:** the build deployed, the service worker registered, the server
  switched off, the page reloaded — shell, worker and an IndexedDB query all ran with no
  network at all.

> ⚠️ **No push notifications.** Web Push needs an application server, which we deliberately
> do not have. If push is genuinely missed later: `08-DEPLOYMENT.md` §6.

---

## M7 · Pressing advice → `v0.8.0`

- [x] Matrix/runout from `identifiers` (on demand for the top hits)
- [x] Recognise mastering stamps (RVG, Porky, RL, Pecko + Plastylite, Sterling, Masterdisk,
      Kendun)
- [x] Original vs. reissue — **not heuristically, but from `formats[].descriptions`**
- [x] Trap warnings: "a 2017 European reissue, not the 1994 original"
- [x] A contradiction check: the dealer's `comments` vs. the release data

**Notes:**

- **Costs zero extra requests.** The pressing fields come in the same response as `styles`
  for S7 — the top-50 follow-up was running anyway. The fields are now documented in
  `docs/02`, verified live on three pressings of Blue Note's "Newk's Time".
- **"Reissue" is not a heuristic.** Discogs maintains the field itself. Only where an
  inference really is made — a gap in years with no entry — does the text say "probably",
  and the warning is a notch milder.
- **The follow-up is now unconditional.** Previously `/releases/{id}` was skipped without a
  style centroid; but pressing advice needs only the release, and for somebody without a
  taste profile it is the more useful half. The honest consequence: two requests per record
  instead of one, capped at 50, and the progress bar names the number beforehand.
- **Checked against real data:** the top-scoring hit of a real dig (87 points, €33.99) is a
  2017 European pressing of a 1994 album that is on the wantlist. Release 10147986 →
  master 5542 → the horizon knows 1994 through 160 pressings. Captured as a test.

---

## M8 · Polish → `v1.0.0`

- [x] Onboarding Jens gets through without asking
- [x] Data export (JSON) and "delete everything"
- [x] Dig export as a file (a substitute for sharing by link)
- [x] A privacy notice + legal notice (short — there is almost nothing to explain)
- [x] The attribution strings everywhere Discogs data appears
- [x] An a11y audit: keyboard + VoiceOver in full
- [x] Lighthouse ≥ 95 under mobile throttling
- [x] Error handling: token expired, offline, 429, storage full

**Lighthouse, mobile-throttled, against the real build:**

| Category | Value |
|---|---:|
| Performance | **95** |
| Accessibility | **100** |
| Best practices | **100** |
| SEO | 63 – see below |

> **SEO is deliberately not reached.** Exactly one check fails: "Page is blocked from
> indexing". Fidelity is a private tool for a circle of friends (`docs/00` §9) and carries
> `robots.txt: Disallow: /` plus `noindex`. Without those two it would say 100 — getting
> the number higher would mean making a private tool indexable. Every other SEO check is
> green, `robots.txt` included.

**Notes:**

- **axe now runs across all eight screens**, in Chromium *and* WebKit, plus keyboard checks
  for focus visibility and the ⌘K palette. Zero violations.
- **The export contains neither the token nor marketplace data.** `docs/09` §1.3 calls
  prices and conditions Restricted Data and forbids passing them on — an export file is the
  most third-party-shaped thing in the app. What is shared is *which* records fit how well
  and why, with a deep link to the current price.
- **The worker threw the reason for an error away until M8.** "Token expired" and "429"
  arrived as anonymous text; the whole explanation layer would have run into nothing.
  Checked with a genuinely invalid token against the live API.
- **The legal notice is deliberately left blank.** A provider identification is a
  declaration about a real person; inventing its content is not something a generator should
  do.

---

## M9 · The hub (optional) → `v1.1.0`

**Goal:** a tiny, self-hostable service that enriches the app — without any feature
requiring it. The full concept: `docs/13-HUB-ADDON.md`.

- [x] `hub/` as its own package: Node + Hono + `node:sqlite`, 5 routes
- [x] The horizon cache (`GET/PUT /v1/horizon/:kind/:id`) — saves every further user the
      13-minute first-time setup
- [x] Shipping tiers as a community store instead of a pull request
- [x] The cover cache (`GET/PUT /v1/covers`) — the inventory endpoint delivers no images at
      all (measured 2026-08-10), so every cover costs a lookup of its own, and the answer is
      the same for everybody. In bulk, with origin checks at both ends
- [x] Hub discovery in the client: it looks for `http://localhost:8787`, and says when the
      browser refuses the connection rather than claiming "not found"
- [x] The watcher, hub side: asks `num_for_sale` per shop at most hourly — **one lookup for
      everybody rather than one per user**, without a token, paced at 2.4 s. The first look
      is a baseline and not an alert; a fall is never reported; dead recipients (404/410)
      are dropped. Off until `HUB_WATCH=1`
- [x] **The service worker is ours** (`app/sw/sw.ts`, `injectManifest`) — the precondition
      for a `push` handler, because a notification arrives when no tab is open, and only
      code in the worker can answer that. Attempted three times, reverted twice; the causes
      were found and are in the code:

      1. **The registration never happened.** `client: { installPrompt: false }` left
         `registerPlugin` as `undefined`, because the module only inserts its default object
         when `client` is missing **entirely**. Under `generateSW` it never showed, because
         there it also injects into the HTML. `registerPlugin: true` is now written out.
      2. **`srcDir` counts from Nuxt's `srcDir`**, so `sw` and not `app/sw`.
      3. **The actual cause, and it was in the generated worker too:** @vite-pwa/nuxt strips
         the `.html` from every precached document via `manifestTransforms` — `200.html`
         appears as `200` in the list. `createHandlerBoundToURL` looks it up exactly there
         and **throws** when the address is missing. In the generated worker that call sat
         inside a promise: the worker installed, precached, looked healthy — and everything
         below it, namely the cover cache, was never registered. Measured 2026-08-12, fixed,
         and `tests/e2e/service-worker.spec.ts` now watches both halves.

      Acceptance: the four tests in `tests/e2e/offline.spec.ts` and
      `tests/e2e/service-worker.spec.ts` against the built output.
- [x] The watcher, client side: the push subscription and the notification — ask permission,
      subscribe at the hub (`/v1/watch/key`, `subscribe`, `unsubscribe`), answer `push` and
      `notificationclick` in the worker. `app/composables/usePush.ts` and `app/sw/sw.ts`;
      rung against the running hub on 2026-08-14 and it arrived on Chrome and on iOS.

      Two things cost an attempt each, both invisible: the hub's `allowMethods` knew no
      `POST`, so **no browser** could ever subscribe (the first successful test ran through
      curl and past the gap), and Apple rejects a VAPID subject address on `.invalid` with a
      **403**. Both looked from the outside like "nothing arrives, then", until `watch.ts`
      started counting failed deliveries.
- [x] Device sync for the basket and the shortlist — **through the vault, not the hub**
      (M8/ADR-007): encrypted, with a freely chosen target, and it works without a hub too
- [x] Sharing a dig by link (TTL 6 h, ToS-compliant) — the hub carries ciphertext under a
      random identifier, the key sits in the `#` fragment and reaches no server.
      `GET /v1/share/:id` is the only door at the hub without a secret, because the
      recipient has none; `POST` stays behind it. The clock runs from the scan, not from the
      sending, and the server additionally caps at six hours.
- [x] A Dockerfile for the hub — `deploy/hub.Dockerfile`; the release workflow publishes the
      image with it. The hub itself runs on Uberspace under supervisord
      (`.github/workflows/hub.yml`).
      ⚠️ The addendum "supervisord + `uberspace web backend`" is superseded: the app has been
      purely static since ADR-007 and runs in a docroot, there is no backend any more (see
      `docs/08-DEPLOYMENT.md`). Only the optional hub is affected
- [x] **A CI test: the app must run through completely with an empty `hubUrl`**

**What is built is the uncontroversial core** — the horizon cache, shipping tiers and
covers. None of the three needs a token, marketplace data or a permanently running process;
the hub may be off at any time. Device sync was added, but through the vault rather than the
hub — which confirms the rule "no feature requires the hub" rather than breaking it.

**What a hub deliberately does not become:** accounts, a web interface of its own, any
server-side computation on the matching engine (which is pure and local, and that is its
worth), statistics about users. The hub is a shared memory for facts that are the same for
everybody — nothing more.

**Notes:**

- **SQLite comes from `node:sqlite`.** No driver, no native dependency, nothing to compile —
  for a service whose whole point is easy self-hosting, that weighs more than any feature of
  a real driver.
- **The horizon travels as base64.** `JSON.stringify(new Int32Array([1,2]))` gives
  `{"0":1,"1":2}` — wrong when read back and larger than the array. The format lives in
  `shared/wire.ts`, because the hub and the client have to agree and a format that exists
  twice drifts apart.
- **Every response is distrusted.** A Zod schema *and* a plausibility check: if the parallel
  arrays are different lengths, index *i* of `roles` describes a different record from index
  *i* of `releaseIds`. Such a chunk would quietly and permanently spoil the horizon — worse
  than any slowness.
- **Only hand-typed shipping tiers are shared.** Passing a parsed guess on would mean
  laundering a heuristic into a fact.
- **Eight tests for "runs without a hub"**, because that has several shapes: never
  configured, configured but dead, slow, or lying. All four have to end on the local route
  without saying a word about it.

> ⚠️ **The hub does not scan inventories** and **stores no Discogs tokens.** Either would
> tear down the advantages of the client architecture again (ADR-008).

**This is prepared in M2/M5 already:** the three ports `HorizonSource`,
`ShippingProfileSource` and `WatchService` together with their fallback chain. About an
hour's work — without them M9 would be a refactoring right across the worker.

---

## M10 · Two languages → `v0.10.0`

Triggered by the repository going public on 2026-08-11. A German interface with German
addresses shuts out everyone who does not speak German — they can read the code and still
not find out what a screen promises. The decision and the reasoning:
[ADR-010](adr/010-english-base-language.md).

**Definition of done**

- [x] English is the default, German is chosen on a matching `navigator.language` and is
      switchable under Settings → Appearance.
- [x] No i18n package. Message packs as typed objects; `de` is typed as a shape of `en`, so
      a missing key is a build error.
- [x] Split by area: the shell in the entry chunk, every screen in its own. First paint
      117.8 kB of 120 — the change did not cost the budget.
- [x] The language is decided **before** the first stroke. Demonstrated by a test that
      records the heading from a MutationObserver set up before mounting.
- [x] Addresses in English, without a language prefix. Eighteen old paths redirect
      permanently — middleware plus real 301s in nginx and Apache, query strings included.
- [x] The engine's reason sentences are built when read rather than when scanning.
      `worker/match/reason.ts` keeps only the ordering.
- [x] Every user-visible text is tested in **both** languages.
- [x] `docs/` is English. The biggest chunk and the least urgent — done on 2026-09-11,
      together with the German file names: an English document at a German address is the
      half measure ADR-010 argues against. The numbers stayed, because around 200 references
      in the code cite a document by its number.

**What came out of it along the way**

- Every `Intl` formatter in the app was built once at import time and frozen in `de-DE`.
  `14,00 €` and `€14.00` are the same amount to two readers and a factor of a hundred to
  each other.
- `vaultStatus()` and the hub check returned German sentences from a thread that knows no
  language. Both now return reasons that the interface words.
- A fixture in `db.spec` asserted a signal that could never have produced its sentence —
  hidden by the hand-written sentence sitting next to it.
- `/welcome` had two `v-if` roots inside one `<Transition>` and could not be opened at all in
  development. Older than this change.

---

## M11 · Watched records → `v0.11.0`

**The find everything here rests on is a negative one.** There is no endpoint that lists the
offers for a release id (`docs/02` § "The endpoint that does not exist"). "This record has
just turned up somewhere" is **not answerable** through the API. That is exactly why the
third-party tools scrape, and exactly why they die regularly.

What does exist is `GET /marketplace/stats/{release_id}`: **without a token**, one request
per release, returning `num_for_sale` and `lowest_price`. That does not answer "who has it",
but it does answer "how many are there and what does the cheapest cost". Two directions fall
out of one mechanism — and the second is the one that exists nowhere else.

### Direction 1: your own collection (the actual reason for M11)

"Your pressing of *Selected Ambient Works* stood at €40 three months ago; the cheapest now
costs €95." Discogs does not tell you that, and none of the known third-party apps does.
Anyone wanting to sell learns of the rise today only by chance.

- [x] Watch records from the shelf. Deliberately a **selection**, not a collection —
      `MAX_WATCHED = 100`, which is two minutes per pass.
- [x] An alert on a rise above a chosen threshold, with a history rather than just a
      snapshot. The comparison is against the **oldest point in the window**, not the
      previous one: a rise from 40 to 95 comes in thirty small steps, and comparing
      neighbours never sees it.
- [x] **"Sold" is not claimed.** A falling `num_for_sale` means "one offer fewer" — that
      could be a purchase or a withdrawn listing, and the API does not say which. The text
      says what was measured, not what is suspected.
- [x] For records that have already turned up in a dig it goes more precisely:
      `GET /marketplace/listings/{id}` gives `status`, and if it no longer says `For Sale`,
      that exact offer is gone (`docs/02`). "One offer fewer" then becomes "the copy at
      Plattenkiste is no longer listed".

⚠️ **And that is the only place where the watcher names a shop.** The sentence above — "who
sells release X" is not answerable through the API — holds unchanged; what is queried here is
exclusively offers a dig on **this device** walked past itself. `noShops` on the screen now
says so.

It is affordable because the expensive question hangs off a cheap signal: it is asked **only**
when `num_for_sale` has actually fallen, at most three times per alert (`MAX_CONFIRM`), and a
copy once recognised as gone never costs a request again (`goneOffers`). In the normal case —
a hundred watched records, no movement — that is zero extra requests.

### Direction 2: the wantlist, with a threshold

The second most common wish from the forums: wantlist entries with conditions — "VG+ or
better only", "under €30 only". Discogs' own **Wantlister** reports every listing, unfiltered.

⚠️ **Here we are strictly weaker than Discogs, and that should be said.** Wantlister knows
*who* has just listed, because Discogs owns the marketplace. We only see "there are three
copies now, the cheapest at €24". So the added value is **the threshold, not the
discovery** — and the dig remains what finds the shop.

- [x] A price threshold per watched entry (condition to follow: `/marketplace/stats/` does
      not know it)
- [x] An alert when the cheapest copy falls below it — once on crossing, not on every pass
- [x] The text never names a shop, because we know none — and the screen says so

### What it costs — and why it stays a selection

One request per watched release per round. With a token, 50 records are **one minute**, 500
records **ten**. Watching the whole collection would have exactly the shape rule 2 forbids.

So the upper limit is not a blemish but the design: **you watch what you would sell, and what
you are really looking for.** The hub can carry it for a circle of friends —
`/marketplace/stats/` needs no token, one lookup serves everybody — but under rule 8 it has to
work without one.

---

## M12 · Where the record is → `v0.12.0`

**Optional, and the only feature on the whole roadmap that costs zero requests.**

A collection does not live in a list, it lives in a flat: a shelf in the living room, the
second compartment, the box in the cellar, the carton in the attic you have not opened since
moving. Discogs does not know this place and does not want to.

It is the same question as the in-store screen, one step further: there it is "have I got
this already?", here "and where is it, then?".

- [x] Places as a flat hierarchy: place → furniture → compartment/box. Three levels,
      enforced.
- [x] A copy lies in a place — at the `instanceId`, not the `releaseId`.
- [x] Both directions: "where is X" in the shelf sheet, "what is in the cellar" as a tab.
- [x] Offline and local, **zero requests**. Its own store, which the sync does not touch.
- [x] Travelling through the vault, so that the phone in the cellar gives the same answer —
      and in the backup file, since locations are the only thing in it that cannot be
      obtained again anywhere.

⚠️ **For that, deletion had to disappear from both stores.** The merge knows only "this row
is newer" (`worker/vault/merge.ts`); a deleted row is not a message to it but a gap, and the
device that still has it fills the gap in again next time. A dissolved shelf would come back,
and a record taken off it would be lying in it again — quietly, and only noticed in the
cellar in front of the wrong compartment.

Since then a dissolved place carries `removedAt` and a record taken down carries
`placeId: null`. Both are writes and win every comparison. Filtering happens exclusively in
`worker/places.ts` — no other module reads these stores, and a second filter would be one
somebody forgets. A place gained `updatedAt` for this: with a renamed shelf, `createdAt` is
the same on both devices, and then chance would decide.
- [x] Being able to move: "everything from box 3 to shelf 2".

✅ **Measured on 2026-09-11, and the answer is no.** `GET /users/{u}/collection/fields`
returns exactly three fields — Media Condition, Sleeve Condition, Notes — and none of your
own. So a location cannot travel to Discogs even optionally: there is no field for it.

⚠️ **The second find was more important and was not on the list.**
`worker/sync/library.ts` rewrites every collection row with `put()`. A `placeId` **on** the
entry would be gone after the next full pass — quietly, and nobody notices until they look
for a record. Hence a store of its own, and a test holds it that the sync does not know it.

---

## M13 · Recognising the record in your hand → `v0.13.0`

Two stages, the cheaper one first.

### Stage 1: the barcode

`GET /database/search?barcode=…` is documented, costs one request and works **without a
token** (measured 2026-09-11).

> ⚠️ **And it is not unique — this used to say otherwise, wrongly.** Measured on
> 2026-09-11: `5012394144777` returns **eight** releases in five countries (UK, Italy,
> France, Portugal, Europe), and the release the barcode came from is at **position seven**.
> A barcode names a *release*, not a *pressing*.
>
> For Fidelity's question that is not a problem — "have I got this already" asks about the
> record anyway. It becomes one as soon as the interface presents one hit as *the* answer,
> or if only the first candidate is checked against the collection: in the measurement, the
> pressing actually owned was seventh.
>
> **And not every record has one.** A sample of ten records from a real collection: eight
> yes, two no — a club 12" and a white label. Exactly the cases stage 2 is meant for.

- [x] Camera → barcode → release → the question Fidelity asks: *have I got this already, is
      it on my wantlist*. Built into the in-store screen, which answers that question
      already — the camera is a third route into the search field there.
- [x] **With no new dependency.** `BarcodeDetector` is present in Chromium and absent in
      WebKit; so on an iPhone no camera button is offered, and it says that typing is the
      way there. A decoder in JavaScript weighs over a hundred kilobytes, and rule 7 demands
      a justification that typed digits do not need.

The Discogs app has a barcode scanner. Ours answers a different question — and the one you
are standing in the shop for.

### Stage 2: the runout — not the cover

> ⚠️ **The cover design that stood here is not buildable. Measured on 2026-09-11.**
>
> It ran: a perceptual hash over the covers from `db/covers.ts`, compared against a camera
> image, without a single request. That fails on one line that is written nowhere:
> **`i.discogs.com` sends no CORS header.** Checked at the server — neither
> `access-control-allow-origin` nor anything related, not even on a preflight.
>
> The consequence in the browser: without `crossOrigin` the image loads and **taints the
> canvas**, `getImageData` throws a `SecurityError`. With `crossOrigin="anonymous"` it does
> not load at all. A `fetch` fails too. So there is no way to read the pixels of your own
> covers — and without readable comparison values there is no hash.
>
> The detour through text recognition is closed too: `TextDetector` no longer exists in any
> browser (measured: `BarcodeDetector` yes, `TextDetector` and `FaceDetector` no). An OCR
> library weighs megabytes and falls under rule 7.

**Instead, what collectors do anyway: read the number in the runout.** And it is the better
identifier, measured on the same sample of twelve records:

| | |
|---|---|
| with a barcode | 10 of 12 |
| **with a runout** | **11 of 12** |
| with neither | 0 |
| no barcode but a runout | 2 |

And more precisely: the full string `MPO SK 032 A1 G PHRUPMASTERGENERAL T2T LONDON` returns
**one** hit where a barcode returns eight. Fragments become useless quickly — `MPO SK 032 A1`
gave 21, `SK 032 A1` three thousand four hundred, and a distinctive mastering signature alone
two.

- [x] One field takes both and decides for itself: digits only is a barcode, anything with
      letters is a runout. Somebody holding a record does not want to choose first which kind
      of number they are typing.
- [x] Fragments that are too short are not searched at all — under six characters the search
      fetches half the catalogue and costs a request for nothing.
- ~~Read the runout **aloud** instead of typing it.~~ **Measured on 2026-09-11, and the
  answer is: not like this.** Not on availability — that is better than expected. No
  checkbox, because this is not an open task: it was examined and rejected, and the
  difference matters for anyone reading this list to find out what is left.

> **What the measurement showed.** In current Chrome, `SpeechRecognition` exists **without a
> prefix**, with `continuous`, `interimResults`, `maxAlternatives` and even `processLocally`
> plus `install()`: recognition the device does itself, rather than sending every syllable to
> Google. For an app whose privacy page names every outside access, that would have been the
> precondition, and it is met.
>
> **It is still the wrong tool for this text.** A runout reads `BN-LP-4001-A [ear] M9 RVG`.
> Speech recognition is trained on words and guesses at letter sequences and digits;
> "BN-LP-4001-A" comes back as "Bien LP forty-one A", and the search demands the **full**
> string — it is good precisely because a complete runout returns one hit rather than eight.
> A method that is wrong every third character turns the best identifier into the worst.
>
> **What would have to be true for it to work after all:** a spelling mode in which somebody
> says "B – N – dash – L – P". That is slower than typing, and with it goes the only reason
> to build it — a record in one hand, the phone in the other.
>
> Left where it is, not as "not managed yet" but as checked and rejected. Anyone reopening it
> should bring something new: a model that can do serial numbers, or a measurement with real
> runouts instead of a guess.

⚠️ **What is still not promised here:** recognising spines on a shelf. Breaking a photographed
shelf into individual records is a different and considerably harder problem.

---

## M14 · Does this shop grade honestly? → `v0.14.0`

**The gap Discogs structurally cannot close.** From the forums: the feedback system measures
"quality of transaction" and says nothing about grading accuracy; negative ratings for
overgrading are removed when the seller objects. What remains is superstition — "buy nothing
under 100 %".

Fidelity can do something a public rating system cannot: **a private record of your own
purchases.** No rating of others, no pillory, no moderation — just "at this shop, seven of
eight records were as described", on your own device.

- [x] After a delivery: one question, one tap. As described, better, worse. On the start page
      (`ArrivalQuestion.vue`, always just **one** record) and on the bought list, there for
      every purchased row and changeable at any time.
- [x] It stands in the dealer profile — **beside** the fingerprint, not inside it (see below)
- [x] It stays local. An honesty score about other people belongs to nobody but the person
      who unpacked the record. `worker/grading.ts` contains no `fetch`, and a test holds that.

### The measurement the design had to work around

⚠️ The brief was to check `GET /marketplace/orders` for the listed condition per line item.
**Measured on 2026-09-11: that endpoint is the seller side** — it answers `items: 0` for an
account that only buys, ten hours after a real purchase, in four filter variants. So the
measurement cannot be performed *there*.

**It can be performed one door along, and it was.** `GET /marketplace/orders/{order_id}`
returns a purchase to its buyer, and `items[]` carries `media_condition`,
`sleeve_condition` and `condition_comments` — exactly the fields this brief asked about.
The catch is that the id cannot be discovered: the list is the seller side, so there is no
API route from "I am a buyer" to "here are my order numbers". The number is on the web at
`/sell/purchases` and nowhere else. Details in `docs/02`.

**That changes what is available and not what is allowed**, which is why nothing below
moved: a claimed grade is marketplace data whichever endpoint it comes from.

It also turned out that the question was wrongly put. The promised grade would be **Discogs
content** and may not be on screen after six hours (rule 4, `docs/09` §1.1). A feature that
records it in order to put it alongside weeks later breaks the rule — whichever endpoint it
comes from.

**The way out is to store only the comparison.** "As described / better / worse" is a
*derived* datum, the same category as scores and the fingerprint, and those may expressly
stay. So the interface does not ask "was it really VG+" but "how did it arrive" — a question
that does not presuppose the answer the app does not have. Two tests hold this: one reads
`shared/types.ts` and `worker/grading.ts` against every grade word, the other reads the
vocabulary of both languages.

### Two decisions that arrived while building

- **Ten days of ripening** (`ASK_AFTER_MS`). A tick against "bought" means ordered, not
  arrived; somebody asked the same evening learns to skip the question. Only the question
  *of its own accord* waits — on the bought list it is there from day one.
- **Not in the fingerprint.** That is built from an inventory scan and carries coverage; a
  rate from your own purchases is something else and would have to rewrite the fingerprint on
  every thumb. It sits in the profile directly under the Discogs seller rating — side by side
  you read the difference between "the transaction" and "was the grade right", one under the
  other they would never come together.

⚠️ **Under five judged records there is no percentage** (`MIN_FOR_RATE`). Two out of two is
100 %, and that reads like a verdict on a shop you know nothing about.

---

## M15 · The stack → `v0.15.0`

A **second** interface for the same data, beside the list and not instead of it: a row of
dealers at the top like Instagram — a coloured ring where there is something new — and below
it one record after another, full-bleed, with the cover, the reason sentence and the price.
Swiping moves on, three buttons: like, into the basket, share. At the end of one shop it
carries on at the next.

### Why this is technically cheap

**A swipe costs zero requests.** The dig happened long ago, the matches are in `matches`, the
covers in `covers`, and the follow-up over the top 50 has run. The stack only *shows* what is
already there. So neither rule 3 nor the pacing problem applies — and a feed that loads while
you swipe would be unusable at 1.2 s per request anyway.

The three buttons are wiring too, not new apparatus: `feedback` (M3), `basket` (M4) and the
sharing from M9 all exist. The ring on a dealer is a rendering of data that already exists —
`depth: 'new'` knows what has arrived since the last visit, and the watcher from M9 knows
whether the stock has changed.

- [x] Its own route, its own chunk, loaded only when somebody opens it (rule 7) —
      `stack-*.js` sits as its own file in the build
- [x] Swiping with pointer events and a CSS transform. **No library** — a card that follows
      the gesture is about a hundred lines, and the budget is 180 kB. The threshold is 80 px;
      below that it is a tremble while tapping
- [x] `prefers-reduced-motion` respected — through the global rule in `main.css` that pulls
      every transition duration to 0.01 ms. The stack needs no line of its own for it
- [x] Fully operable by keyboard (left and right arrow keys). A stack only a thumb can
      operate is a screen some people do not have

### Four design decisions that are not negotiable

- [x] **Taking it back.** Tinder can afford a lost no, a rare record cannot. Every swipe is
      reversible, and visibly so.
- [x] **The order stays the score.** Shuffling to keep it exciting longer would throw away the
      one thing this app can do. The stack does not sort at all — it shows what `dig.get`
      returns, and that is ordered by score.
- [x] **The reason sentence is on every card** (`reasonFor(match.signals)`). Without it the
      stack is a slot machine with record sleeves. With it, it is what Fidelity promises
      anyway, only faster to read.
- [x] **It ends.** A shop runs out eventually, and then the screen says so and offers the next
      one that still has something. Feigning infinity would be the one kind of pull that does
      not suit an app whose whole worth is honesty.
- [x] Prices grey out as soon as `expiresAt` has passed. A stack you swipe through quickly is
      the easiest place for a six-hour-old price to stand unnoticed (rule 4).

### The audio preview — possible, but it costs a promise

**Measured on 2026-09-10:** `GET /releases/{id}` returns `videos[]` with `uri` (YouTube),
`title` and `duration` — fourteen of them for release 1. **The follow-up fetches this endpoint
for the top hits anyway**, so the previews would come along free, just like the pressing
fields.

A sample over seven releases: five had videos (14, 17, 9, 1, 1), two had none. So roughly two
in three — at seven that is an indication, not a figure.

**Decided on 2026-09-10: [ADR-012](adr/012-audio-preview.md).** The audio preview is coming, as a
named exception in the shape of ADR-009 — because Discogs' only source of sound is YouTube,
and an embed loads Google. What actually flows out is not the collection but the IP and which
record is being watched; the sentence "does not leave this device" is still no longer true
without a qualifier afterwards, and a promise that is only nearly true is broken.

- [x] Off by default, one switch per device
- [x] **Not a byte to Google before somebody wants it.** The `<iframe>` is created on the
      first deliberate tap, not when a card is drawn
- [x] After that, one player instance that travels along (`loadVideoById()` per card). That
      is also the only route that works: browsers require a gesture for sound, and this one
      gesture then carries through the stack. **There is no autoplay on card one**, in any
      browser
- [x] `youtube-nocookie.com` — prevents cookies before playback, not the request
- [x] The privacy page has a paragraph of its own that names who learns what
- [x] The sound belongs to the record, not the track: `videos[]` belongs to the release. On a
      compilation the screen names the title it is playing rather than pretending it is *the*
      record

---

## M16 · The comments, in English → done

ADR-010 has been the rule since 2026-08-11: **English everywhere — code, comments, commits,
user-visible text and addresses.** The user-visible half was done that week. The docs were
done on 2026-09-11. The comments were not, and nobody noticed, because the thing that would
have noticed did not exist.

**The size, counted rather than guessed:** 141 of 368 source files carry a German comment;
737 blocks, 5,473 lines. They are not throwaway lines — this codebase explains itself in its
comments, and several of them are the only place a decision is written down. Translating
them badly would cost more than leaving them.

**Why a ratchet and not a pass.** Two of those files were written in German *during* the
session that translated the docs, by somebody who had just read the rule and agreed with it.
A rule that nothing enforces is a preference, and a single cleanup pass would only reset the
count. So `tests/unit/english-comments.spec.ts` holds a list of the files that still carry
German, and the list can only get shorter: a German comment in a file that is **not** on it
fails, and a name on it whose file is already clean fails too.

- [x] A detector and the ratchet around it — `tests/helpers/german.ts`, the list in
      `tests/fixtures/german-comments.txt`
- [x] `db/` and `shared/` — 6 files, the schema and the protocol, where a wrong word costs
      the most
- [x] `hub/src/` — 4 files, plus the two gaps the ratchet's own search area had hidden
- [x] `worker/` — 28 files, the reasoning that is written down nowhere else
- [x] `app/` — 61 files, plus the icon set, which had to be translated in its *generator*
      (`scripts/icons/lucide.mjs`); the file it writes says "Do not edit", so the next build
      would have been the relapse
- [x] `tests/` — 53 files, several of which explain *why a test exists*, which is the part
      that gets lost first
- [x] `hub/test/`, `hub/scripts/` and `nuxt.config.ts` — 4 files. The hub's test *names*
      were German too, which is not a comment and which the ratchet would never have seen
- [x] The list file deleted — but **not** the test with it

> **That last line says something different from what it said this morning.** It read "the
> list file deleted, and the test with it — the ratchet has no reason to stay once it is at
> zero", and that was written before the two halves had shown themselves to be different
> jobs. The list was scaffolding: it made a 141-file backlog shrinkable one commit at a
> time. The other half — *no German comment, anywhere* — is ADR-010 itself, and a rule with
> nothing enforcing it is what put 5,473 lines there in the first place. So the list is
> gone and the guard stays.

> **And the guard was wrong when this was first ticked.** It reported zero while 130 German
> comments sat in 74 files, and M16 was declared done on that reading. Four holes, each
> found by looking rather than by running it:
>
> 1. **A regex literal containing a quote derailed the walk.** `/'([^']*)'/` opened a
>    phantom string and everything after it in the file went unseen — nine comments in four
>    files, including the guard's own neighbours `template-text.spec.ts` and
>    `one-measure.spec.ts`. The walk had learned about strings after `'/v1/*'` and stopped
>    one delimiter short.
> 2. **Each `//` line counted as its own comment.** A German sentence written across two
>    lines put one or two words in each and fell under any threshold.
> 3. **`.mjs` was outside the glob** — including `scripts/icons/lucide.mjs`, the generator
>    this very checklist names as the relapse risk. Its German shipped into the generated
>    file on every build.
> 4. **The word list held eight words that are also English** (`die`, `was`, `hat`, `war`,
>    `also`, `man`, `in`, `so`), which forced the threshold to three distinct hits. Most
>    comments here are a line or two; a short German one carries one or two. That single
>    number hid about a hundred.
>
> Dropping the eight ambiguous words buys the threshold back: one unambiguous German
> function word is decisive, quoted spans do not count, and an all-capital word is an
> acronym (`MIT` in a licence header matched `mit`). Six probes hold it — including one per
> hole.

**What the ratchet does not see, and did not:**

- [x] **Five error messages** in the code were German. They are thrown, not looked up in a
      language pack, and `ErrorNote` shows the raw text behind the detail button — so they
      were on screen. Found by reading the comment beside them.
- [x] **German identifiers**, about thirty: `lebt`, `vorhanden`, `stuecke`, `bloecke`,
      `SCHWELLE`, `drueber`, `gemeldet`. Renamed on the way through; in
      `app/utils/release-notes.ts` the rename pulled through three files, because
      `kind: 'absatz'` was a *value* in the test and not only a name.
- [x] **A comment in `DemoDig.vue` that was gibberish** — on 2026-08-11 an English line was
      inserted into the middle of a German paragraph and the halves of two sentences ran
      into each other. It stood in the repository for a month. The ratchet reported the file
      as German, which was true, and would never have said why it mattered.

> **Two of those three now have a guard; one never will.** Identifiers are the one that
> never will — see M17 for why the alternative is worse than the gap. The string literals
> turned out to have a rule after all, and it is M17.

---

## M17 · What the worker throws → done

**The comment that started it was in the test suite, not here.**
`tests/unit/template-text.spec.ts` forbids thrown prose under `app/` and ended with: *"Ten
thrown German sentences in the worker are still waiting for it; they are deliberately not
listed here as exceptions, because an exception list would make them invisible."* This file
meanwhile said nothing was open.

**Why translating them is the wrong fix, and why five of them got it anyway.** `explain()`
ends with `title: message || words.unknown` — so a thrown sentence *is* the red headline,
not a line of small print. And a sentence written in the worker can never follow a language
switch: the packs hang off `activeLanguage()` in the main thread, and the worker computes
without knowing anything about language (CLAUDE.md). On 2026-09-11 five of them were
translated from German to English, which moved the fault from one set of readers to the
other.

- [x] `worker/fail.ts` — `fail(code, detail)`, the only way the worker throws something a
      person reads. The code picks the words; the detail stays behind `ErrorNote`'s detail
      button, where somebody debugging a genuinely new failure needs the original.
- [x] Eighteen codes on `WorkerError['code']`, and every throw in `worker/` converted —
      including the two error classes in `dig/scan.ts`, which carried their own sentences.
- [x] Words for all of them in both packs, as a **lookup keyed by code** rather than
      fourteen more branches in `explain()`. Every one of them says the same *kind* of thing;
      only the words differ.
- [x] `tests/unit/explain.spec.ts` walks the whole table in both languages: a code with no
      words behind it would otherwise reach a screen as `passphrase shorter than eight
      characters`.
- [x] Three tests that asserted the old wording now assert the **code**. That is the
      coupling `tests/unit/vault-file.spec.ts` warns about, and they were an instance of it.
- [x] The rule that keeps it: **`throw new Error('…')` under `worker/` is gone as a shape.**

> **The rule names no words, and that is the whole point.** `app/` forbids thrown prose by
> shape — two words with a space. The worker cannot use that rule, because a terse marker
> like `no such dig` is two words and is exactly what should be thrown as a *detail*. So the
> worker's rule is about the throw itself rather than its contents: there is one function
> that makes a failure, and `new Error` is not it. No vocabulary, no exception list — and an
> exception list is where a thing like this goes to become invisible.

**The cost, said rather than buried:** the words live in the shell pack, so they are in the
first paint. 116.81 → 117.51 kB of a 180 kB budget. That is a deliberate 0.7 kB, not a free
one — the alternative is a separate chunk for text that appears at the worst possible
moment, when something has already gone wrong.

**Two things the comments were hiding, both found by reading and not by a rule:**

- [x] **Five error messages in the code were German** — "Treffer nicht gefunden.", "Das ist
      kein Fidelity-Hub.", "Diesen Dig gibt es nicht mehr." and two from the hub client.
      They are not in the language packs; they are thrown, and `ErrorNote` shows the raw
      text behind the detail button. So they were on screen. Translated.
- [ ] **German identifiers**, about thirty of them: `lebt`, `gesehen`, `vorhanden`,
      `stuecke`, `bloecke`, `gemeldet`, `treffer`, `ergebnis`, `antwort`. ADR-010 names
      variables explicitly. The ones in `worker/` were renamed on the way through; the rest
      are in `app/` and `tests/` and go with those.

> **Neither of those has a guard, and that is the honest state.** The ratchet reads
> comments; it does not read string literals and it does not read identifiers. A word list
> over identifiers would be a guess with false positives in a way a word list over prose is
> not — `war`, `rest`, `die`, `man` are all English. So they are counted here and fixed by
> hand, and if one comes back, nothing will catch it.

---

## M18 · The audit → done

On 2026-09-11 the whole frontend was read against `docs/05`, the tokens and the eleven
message packs, and the built app was photographed on a desktop and a phone. Ten findings,
ranked by what a user sees, all fixed the same day:

| # | Finding | Fix |
|---|---|---|
| 1 | In-store screen read "7 7 finds" and, under seven finished finds, "No dig yet" | `in-store.vue`: the count was printed twice; the empty state tested "not done" instead of "no dig" |
| 2 | German inside the English interface — "4 Platten" in the basket, "– hast du" to a screen reader | Plurals inside the packs, labels from the packs; `tests/unit/script-text.spec.ts` now reads string literals, which `template-text.spec.ts` never could |
| 3 | No focus trap and no focus return in either detail sheet, though `docs/05` promised both | `SheetFrame.vue`: one drawer for both sheets, focus kept in and handed back |
| 4 | `ShelfSheet` used a class defined only in `ReleaseSheet`'s scoped style — its view transition and reduced-motion opt-out were dead | The name is a custom property on the frame; `.fid-sheet` and its opt-out live once in `main.css` |
| 5 | `@sm:` inside the shelf sheet measured the window, not the 512 px drawer | `@container` on the panel |
| 6 | Update banner at `max-w-[80rem]`, footer with its own padding — a third and fourth measure | Both in `fid-page`; `one-measure.spec.ts` checks them |
| 7 | `tokens/component.json` emitted nine variables and nothing read any of them | Chip alphas, row height, target floor and both motion durations are referenced; `comfortable` and `cover.size` deleted rather than kept as promises |
| 8 | shop / dealer / seller mixed within six lines; nav said "Shops", palette said "Dealers" | *shop* in English, *Laden* in German, everywhere a person reads it. *dealer* stays a code word; "seller rating" stays Discogs' term |
| 9 | Start page blank until the stores answered; four pages without an error state; five empty states without a way out | A loading line, `ErrorNote` on `/dealers`, `/basket`, `/wantlist`, `/map`, a link in every empty state |
| 10 | "40 records" on the shelf, "37 records" on the map | The map says "37 different releases" — it counts taste, the shelf counts copies |

Found on the way and fixed with it: seven pressing marks whose label and sentence were
German in the worker (now keyed, worded in `app/i18n/pressing.ts`), fourteen German log
and error strings in the worker, and `docs/05` itself, which was a release behind — three
font sets, `UCommandPalette`, a Reka drawer and `motion-v`, none of which exist.

---

## M19 · Candidates → done

**Where these come from.** A research pass over the Discogs forum, r/discogs, r/vinyl,
Hacker News and the app-store reviews of every Discogs client (2026-09-11), ranked by how
often a wish recurs, then checked against four questions: does it work without a backend,
does the API ToS allow it, does it serve the thesis (collection first, the shop as the unit,
the sentence as the product), and what does it cost. The full ranking with sources is in
`docs/14-RELAUNCH-CONCEPT.md` §2.

**In this order**, because each earlier one touches no architecture. All nine landed on
2026-09-11, releases 0.30.0 to 0.38.0 — and two of them (6 and 7) without the hub the table
had budgeted for, because the API already answered what the hub would only have cached:


| # | Candidate | Serves | Cost | Note |
|---|---|---|---|---|
| 1 | **Landed price in the find list.** Price plus the postage this record would *add* at this shop, from the same tier table the basket uses, as a sort ("With postage ↑") and a ceiling ("Up to"). "€24.00 · €26.10 with postage." | The most frequent wish after "find the seller with the most of my wantlist": postage only visible in the cart, prices not comparable across shops | days | **Done 2026-09-11.** In the shop's currency, not the reader's — nothing in this app converts one, and the basket and S10 refuse for the same reason. The arithmetic is `shared/shipping.ts`, the context comes from `basket.landed`, the sort and the ceiling live in the URL like every other view setting. Shops with no known postage get no sort and one line saying why |
| 2 | **Hide a shop.** "Never show this one again" — on the shop's profile and on every suggestion. | Enhancer's flagship paid feature, asked for since 2015 | hours | **Done 2026-09-11.** A field on the dealer row (`hiddenAt`), like watching. Gone from the shops screen, the start page, the dig chips, the palette and the suggestions; unwatched. The hidden ones are listed at the foot of the shops screen with "Show again". A dig started by name still runs and brings the shop back — typing it is asking for it |
| 3 | **Collection value over time.** One `collection.value` a day, kept locally, a line on the map. | The single most reliable hook in every collecting app (Collectr, BrickEconomy, Vizcogs); Discogs keeps no history | a day | **Done 2026-09-11.** A row per day in `valueHistory` (v11), written by the sync — which now fetches the estimate once a day even when the shelf did not change, one request against the keeper's forty-eight. The map draws the middle estimate as a line with the lowest and highest as a band, hand-drawn SVG, from the second day on. In the JSON backup, not in the vault. An aggregate of your own collection, labelled as Discogs' estimate, never per record |
| 4 | **Record-fair mode.** Several shops one after another in the in-store screen, one find list, one basket per stand, offline. | The in-store mode is the one thing Discogs will structurally not build; this is its natural continuation. Was Phase 4 in `docs/00` | days | **Done 2026-09-11.** The in-store screen offers every shop scanned in the last day — the newest dig per shop, expired or not, since at a fair the morning's scan is usually past its six hours by the afternoon and the finds stay while the prices go. A chip per stand and one for all of them; the stand is in the address, so a reload in a basement lands where you were. All at once is one list by score with the stand named on each row; the basket was per shop already, so nothing there had to change. No request anywhere |
| 5 | **CSV export with genres, styles, release ids** — and values, optional. | Discogs' own export lacks all four; tools exist only to fill that gap | hours | **Done 2026-09-11**, without the values. Read against the terms they are marketplace data and a file is passing them on — the same reason the JSON backup strips prices. What the sheet gets instead is what is yours alone and what Discogs has no export for: rating, folder, the three condition fields, and the place a record sits in. Two files, collection and wantlist, under Settings › Your data |
| 6 | **Alias resolution in matching.** Artist aliases, group members, sublabel trees from the small dumps (1.15 GB, CC0) — "Miss Dinky*" is Dinky. | Matching precision on the one string the inventory gives us | weeks | **Done 2026-09-11**, for artists, and without the dump: the per-collection shard is the horizon. `GET /artists/{id}` carries name variations, aliases, members and groups, and the expansion fetches it with the discography — one request per artist, ~300 on a real shelf, paid once. The names go into the same map the cascade consults (`docs/04` §S3 stage 0); an alias counts as the artist, a member or group as a related act at 0.85 at most, and the sentence says under which name it was found. Chunks from before are refreshed by the daily revalidation slice, a few a day. The hub passes the names along. Sublabel trees are not in: `S5` runs on label ids and a lift, and a sublabel is a different label with its own lift — a different question, not a missing lexicon |
| 7 | **Pressing advice with the whole catalogue.** Matrix/runout and barcode of every release via the hub; original / reissue from format descriptions, country, year, notes. | M7's promise, with reach beyond the horizon; "tilting the record under a lamp at 15 angles" | weeks | **Done 2026-09-11**, without the hub. Read against what the API already answers, the hub would only have saved requests — and no feature may need it (rule 8): the run-out search reaches the whole catalogue already (M13), and what M7 lacked beyond the horizon was the album's first year. `GET /masters/{id}/versions` sorted by release date supplies it in one request, with every pressing beside it. The in-store screen now lists the pressings that share a code — year, country, label, catalogue number, which one is yours — and reading the one in your hand costs two requests: M7's profile (stated reissue, the marks in the run-out) placed among the family: "One of 160 pressings. The first are from 1994:" with the first pressings on the same medium, or "among the first". A run-out that returns one candidate needs no tap. No images, no marketplace data, nothing stored — a record in a shop is read once |
| 8 | **Year in review.** Additions, decades, labels, producer network, from the CC0 fields. | Letterboxd Pro, StoryGraph Plus: statistics are what people pay for in a catalogue | days | **Done 2026-09-11.** A sixth collection tab, `/review`, one year at a time with the year in the address. Read off the device, no request, nothing from the marketplace: copies that arrived, by month and against the year before; artists new to the shelf (their first record ever); the map's bars over that year's additions — artists, labels, styles, the pressing decades, the media; the oldest and newest pressing to arrive; stars; digs, shops, finds and purchases that year; and who shaped the additions, from the horizon's credits. The horizon is the only reach it has for people — somebody it has not expanded is not named, and the screen says so |
| 9 | **Wantlist optimiser across scanned shops.** "For your 24 wants: 3 shops, €41 postage, not 5 shops, €67." | Wish #1 on every list — but Waxrunner does it across all sellers, Fidelity can only do it across the shops it has scanned | days | **Done 2026-09-11**, labelled as the subset it is. A box at the top of the wantlist over the digs still inside their six hours (rule 4): which wants those shops have, the cheapest set of shops that covers them with the postage from the basket's tier tables, and the plan it beats — each where it is cheapest, with its extra parcels. Exact pressings first; another pressing only for wants no shop has the exact one of. One currency, nothing converts; shops without a postage table are named and left out; a shop under its minimum says so. Twelve shops or fewer are enumerated outright, more are dropped greedily. Links into the dig and to the listing; the box carries the earliest expiry |

---

## M20 · Candidates → proposed

**Where these come from.** A second research pass on the evening of 2026-09-11 — the
Discogs forum, r/discogs, r/vinyl, Hacker News, the app-store texts and the comparison blogs
the competing apps publish — plus a walk through the nine M19 screens with a real
collection. Checked against the same four questions as M19: no backend, the API terms, the
thesis, the cost. Proposed, not scheduled.

| # | Candidate | Serves | Cost | Note |
|---|---|---|---|---|
| 1 | **The wantlist's priority, shown at last.** Discogs keeps a 0–5 per want; the sync stores it as `want` and nothing displays it. Sort and mark on the wantlist, a "wanted most" line on a find, the plan over the important ones first. | The second most frequent wish ("records I want more than others", multiple wantlists), and the data is already in IndexedDB | hours | **Done 2026-09-11.** Five stars on every wantlist row, tapped like the shelf's rating and written back with the note (Discogs takes both together); "wanted most" from four up, on the row, on the plan's items, and in the Barry sentence of a find — S1 and S2 carry `want` in their evidence. "Wanted most" as the second order of the wantlist, in the address. The score never moved: the golden snapshot is unchanged |
| 2 | **"Only from Germany / the EU" as a switch** on the find list and the plan, from the `shipsFrom` every shop carries. | Seven forum threads since 2014; staff in 2021: there is no such filter | hours | **Done 2026-09-11**, on the plan and on the shops screen rather than the find list — a dig is one shop, so there is nothing to filter inside it. Three chips in the address (`?from=home|eu`): anywhere, from your country (the postage's `shipsToCountry`), from the EU — the customs union of 27, not the continent, because customs is what the question is about. A shop with no origin on record is out under both, and counted: "2 shops elsewhere, or with no origin on record, left out." The block list stays the hard rule |
| 3 | **In the shop: another pressing of a wanted album.** The search returns `master_id`, the wantlist knows its masters. Today the screen says "not on your wantlist" about a record whose album stands three lines below it. | Found in the walk-through with a real wantlist | hours | **Done 2026-09-11.** Measured first: eight of eight barcode rows and the run-out row carry `master_id`. The candidates now carry the master, and the answer has four steps instead of two — you have this pressing, you have the album in another pressing, this pressing is on the wantlist, another pressing of the album is. Through the `by-master` indexes both stores already had; no request |
| 4 | **The plan box says how it fills.** Without a fresh dig the wantlist shows nothing; a sentence with a link to the dig screen instead of silence. | The walk-through: the feature is invisible until you know it | hours | **Done 2026-09-11.** The box is always there once there is a wantlist; without a shop scanned in the last six hours it says what would fill it and links to the dig screen |
| 5 | **What you paid.** The order import reads `price` and drops it. On the arrival diary: price, condition, how it arrived, per record and as a year's sum in the review. | The lawful twin of the price archive (`docs/14` §9): your own purchases | a day | **Checked on 2026-09-12 and left out.** The import drops the price on purpose, and a test holds it: `worker/orders.ts` names neither `price` nor the promised grade in its schema, because both are marketplace data that rule 4 forbids showing after six hours — an order's price is the listing's price at the moment of sale, and a diary of those would be the archive `docs/09` §1.3 rules out, only smaller. What stays lawful is what M14 keeps: the comparison, never the number. Reopen only with a reading of the terms that says a buyer's own order price is the buyer's data |
| 6 | **Scarcity as a hint** on a find: "one of 3 pressings", from the horizon's master chunks. | The scarcity proxy of `docs/14` §3.2, without the dump, for the albums the horizon knows | a day | **Done 2026-09-12.** The scan writes the album's pressing count onto the match from the horizon's complete master chunks; the card says "Only 3 pressings of this album exist" from five down. Catalogue, so it does not expire; null where the horizon does not know the album; never in the score |
| 7 | **Pressing families and the lexicon through the hub.** `GET/PUT /v1/family/:master`, CC0 facts, 30 days. Whoever fetched a family first saves everybody else two requests. | The catalogue hub of `docs/14` in miniature, on the hub that already runs | days | **Done 2026-09-12.** The lexicon was already travelling in the horizon chunks since #6 of M19; the family has its own table and two routes now. The shop screen asks the hub first, two seconds at most, and offers a fresh family back; a family older than a month is a miss. Without a hub it stays two requests (rule 8). The hub has to be redeployed for the routes to exist |
| 8 | **Visible from outside.** A page "what Fidelity is, and is not": against Seller Matches, discdogs, WaxTracker, Groovv, and one sentence on why it is not an API wrapper. | `docs/14` §2.1 #20; every competing app publishes a "best vinyl apps 2026" post and none lists this one | a day, prose | **Done 2026-09-12** as `docs/15-COMPARED.md`, linked from the README's "What it does". Facts about the others from their own pages, dated; the "not an API wrapper" argument in three points: the horizon, the score with a reason, honesty as a feature |

| 9 | **Hand the basket over to Discogs, one listing at a time.** The Discogs cart is not in the API — neither to read nor to fill, measured 2026-08-10 (`docs/02`), and the website's "Add to Cart" is a session-bound form Fidelity must not touch. What can be better is the way there: per shop a "Put these in at Discogs" flow that runs "Still there?" first, then opens the listings one after another — Safari on iOS blocks a second `window.open`, so "next" in the app, each tab landing on the listing page with the button — and ticks off what is over there. | Asked 2026-09-12 with a ten-record basket at fatplastics; today it is ten taps on ten links with no memory of which are done | a day | **Done 2026-09-12.** "Put these in at Discogs" on the shop's basket card: a link that opens the next listing, moves up when tapped, remembers on the item which are done — a reload or a closed tab loses nothing — and ends at the cart link. "Still there?" is recommended before it, not forced, so the flow works offline-first and the test needs no network |

**Checked and left out:** an insurance export with values (marketplace data in a file, and a
`/marketplace/stats` loop per record — both forbidden); alerts (Wantlister, and discdogs for
free); reviews (the API returns no text); filtering all sellers by postage (only the scanned
shops are reachable, and there the plan does it); filling the Discogs cart itself (no
endpoint, and the website's form is off limits — #9 is what remains).

---

> **The road to 1.0 as a whole — M21 to M25, the test rings, the cloud cross-check and the
> paid comfort tier — is laid out in [`17-ROADMAP-1.0.md`](17-ROADMAP-1.0.md).**

## M21 · The catalogue → in progress

**Decision:** [ADR-013](adr/013-catalogue-service.md) · **Concept:** `docs/16-CATALOGUE-SERVICE.md`

Everything left on the lists after M19 and M20 needs the catalogue as a whole: catalogue
runs for labels above 1,500 releases, credits in the second degree, the lexicon for artists
nobody on the shelf has, pressing families and identifiers without a request, the map
compared with the catalogue. ADR-005 named this as the way out — "the engine queries a
table, not a data source" — and the home lab (`docs/14` §8) is the disk it was waiting for.

A second optional service, `fidelity-catalogue`, built monthly from the CC0 dump, read-only,
no token, no user, no marketplace data, no images; one port in the client with the horizon
behind it, so no feature depends on it and no score moves.

| Phase | Delivers | Cost |
|---|---|---|
| M21.1 The seam · done 2026-09-12 | `CatalogueSource` in `shared/ports.ts`, `catalogueUrl`, the client with two seconds and null for everything, discovery and check, the settings line under the hub; `familyFacts` asks the catalogue before the hub. Eleven tests that every shape of absence falls through to today's path | days, no server |
| M21.2 The mini-dump · done 2026-09-12 | `catalogue/` with the streaming reader, the shaping and the build — TypeScript on bare Node into `node:sqlite`, no DuckDB (docs/16 §4 says why); 400 real releases and what they point at as a 660 kB fixture; 19 tests in 0.3 s, golden files for the fields that bite, and a twin test holding the copied `parseCatno` and `norm` to the app's; hub and catalogue tests now run in CI | days |
| M21.3 The build · done 2026-09-12 | `fetch.ts`, `run.ts` (fetch, build, check, atomic `current` swap, two builds kept, dump files deleted as loaded, daily look for a new month), the `fidelity-catalogue` image, the service in the home-lab compose. First full run: 89.6 minutes on home-deb, 17.5 GB, 19.4 M releases, 250 M rows; the service picked the build up within a minute and answers a family in 250 ms from outside | a weekend with the home lab |
| M21.4 Two routes · done 2026-09-12 | The service (Hono, read-only on `current`, ETag = build date, follows the swap without a restart) with `health`, `master/{id}/family` and `artist/{id}`; `familyFacts` and the horizon's artist lookup ask it before the API; worker ceiling 35 → 40 kB (docs/12) | days |
| M21.5 The signals · done 2026-09-12 | `label/{id}/run` and `artist/{id}/credits` as rows, packed on the client by the app's own `packChunk`; the horizon build asks the catalogue per candidate before hub and API — Blue Note whole instead of cut at 1,500, a producer's whole list, zero requests; the second golden test pins the ranking identical to the API path. Per-dig lookups for names the horizon does not know wait for `resolve` (M21.6+) | a week |
| M21.6 The shop and the map · done 2026-09-12 | `identify` (exact stamps from the index, no search request; the search stays for what the build does not carry), `release/{id}` for the candidate's fields, `stats/{kind}` counted at build time; the map shows the lift against the catalogue behind every decade, style and genre bar, with the build named under them | days |

M21.1 is in 0.45.0 with no catalogue behind it — the port exists, every consumer has the horizon behind it, and the URL is empty on every device. M21.2 is the build that will fill it, proven on a cut of the real dump; the reader streamed the three smaller files (1.2 GB gzip) in 2 min 40 s on a laptop. Nothing is bought; M21.3 is the first weekend with the home lab.

---

## M22 · The hub's second door → in progress

**Plan:** [`17-ROADMAP-1.0.md`](17-ROADMAP-1.0.md) §3.2, §6.2, §8.2 · **Decision:** ADR-014

| Phase | Delivers | State |
|---|---|---|
| M22.1 The door | `hub/src/access.ts`: keys as `fk1.<payload>.<sig>`, Ed25519, verified with `HUB_ACCESS_PUBLIC_KEY` and no database of people; the revocation list from `HUB_ACCESS_URL/v1/revoked` or `HUB_ACCESS_REVOKED`, refreshed hourly, kept through an outage; a token bucket per key; `doors` in health. Secret only, key only, both, neither — each opens what it should | **Done 2026-09-12.** 79 hub tests |
| M22.2 Personal rows | `owner` on `vault` and `watchers`, added in place; a key reads, overwrites and deletes only its own rows; a secret-only hub keeps every row as its own | **Done 2026-09-12** |
| M22.3 The app | `accessKey` in the preferences (rule 6 applies), `x-fidelity-key` on every hub and catalogue call, Settings › Access with the key read for tier and end date, Settings › Support with the plans and tips of §6.3 and the beta note, the key's verdict on the hub check | **Done 2026-09-12** |
| M22.4 The issuer | `hub/scripts/access-keys.ts generate | issue` for beta keys by hand; the access service with the provider's webhooks and the two pages in the private repository (ADR-014) | Script done; the service waits for the provider decision (M25) |
| M22.5 Renewal | The keeper asks `/v1/renew` once a day when the key is older than 30 days | Waits for M22.4 |

## M23 · Ops → in progress

**Plan:** [`17-ROADMAP-1.0.md`](17-ROADMAP-1.0.md) §4, §8.3

| Phase | Delivers | State |
|---|---|---|
| M23.1 The smoke run | `tests/e2e/smoke/` against `SMOKE_BASE_URL`: the app loads, the hub names its doors, the catalogue answers with a build that is not stale and knows a family, the settings pages stand, the shop identifies a barcode with Discogs routed; the nightly `Smoke` workflow at 04:17 UTC against the home lab | **Done 2026-09-12** |
| M23.2 The load test | `catalogue/scripts/load.ts`: `autocannon` against a family and a person's credits, a child-process service for the mini-dump in CI with a floor of 300 requests a second. Measured on the home lab past Traefik: ~1,750 requests a second on the real build, p50 10 ms — the target of 200 met eight times over. Through Traefik the rate limit answers, which is the proxy's job | **Done 2026-09-12** |
| M23.3 Backups | `node:sqlite`'s online backup once a day into a second volume, fourteen kept; `restore-drill.ts` starts a throwaway hub on the newest copy and reads health; the `hub-backup` service in both compose files. The offsite copy of the volume is a `rclone` line the box has to get | Done, offsite copy open |
| M23.4 The build-date alert | `"stale":false` in the catalogue's health, true after forty days without a build — for Uptime Kuma's keyword monitor. A legacy build's distributions are counted in a worker thread, because 25 s on the request thread was two minutes of 502 after every restart | **Done 2026-09-12** |
| M23.5 Release channels | The home lab on `latest`; the `Promote` workflow points `stable` at a release's three images; `compose.cloud.yml` runs `stable` by default | **Done 2026-09-12** |
| M23.6 The cloud rehearsal | `compose.cloud.yml`, `Caddyfile`, `cloud.env.example` and the ten steps in `docs/08` §6.1 are written; a CAX21 for a week is the part that costs money and a decision | Files done; the week is Martin's call |

## M24 · The app to the 1.0 promise → in progress

**Plan:** [`17-ROADMAP-1.0.md`](17-ROADMAP-1.0.md) §2, §8.4

| Phase | Delivers | State |
|---|---|---|
| M24.1 The way back | `worker/import.ts`: a backup read back in — rows merged the way the vault merges, the digs left out because the file never had their prices, settings and the taste profile taken when the device has none; the export stamped with the database version, and shelf rows from before v6 skipped with "sync again" — the same path the migration takes. "Read a backup back in" on the data screen with a report line by line | **Done 2026-09-12** |
| M24.2 The quiet update | A waiting service worker takes over on the next navigation by itself unless a dig is running; after fifteen minutes of waiting the banner comes back, because then the person should decide. `app/utils/quiet-update.ts` is the decision, tested | **Done 2026-09-12** |
| M24.3 What to do | A changelog lead may carry one "What to do:" paragraph; the what's-new screen draws it as a call-out | **Done 2026-09-12** |
| M24.4 The stranger's afternoon | `tests/e2e/onboarding.spec.ts`: from an empty device through token, collection and the two optional steps to a first dig with a find — Discogs answered from the test, no document read | **Done 2026-09-12** |
| M24.5 Every screen since M8 through axe | The settings screens added since M8 in the accessibility run: hub with the catalogue, access, support, account with the renewal, data with the import | **Done 2026-09-12** |
| M24.6 The clean machine | The self-hosting walk-through done once from nothing: `deploy/compose.cloud.yml` on a fresh VM, the ten steps of `docs/08` §6.1 timed | Open — a VM and an afternoon |

## M25 · Launch → in progress

**Plan:** [`17-ROADMAP-1.0.md`](17-ROADMAP-1.0.md) §6, §8.5 · **Decision:** ADR-014

The milestone with the fewest lines of code and the most decisions. What could be written
was written on 2026-09-12; what has to be signed, paid for or sent is Martin's.

| Phase | Delivers | State |
|---|---|---|
| M25.1 The letter | The letter to Discogs asking for written confirmation of the tier's shape (`docs/09` §1.4): the app free and self-hostable, the paid parts hosting and CC0 computation, no API call on a member's behalf. Drafted in the private folder as ADR-014 places it | **Drafted 2026-09-12**; sending is Martin's |
| M25.2 The public page | `docs/15` as `/compared` in the app, both languages, open without a token, in the footer; the README's sentence about the name | **Done 2026-09-12** |
| M25.3 The privacy notices | The access service's own notice, drafted in both languages beside the letter; the app's notice extended by the catalogue and the access key — two destinations that existed since M21 and M22 without a heading — with the guard now watching the catalogue client too | **Done 2026-09-12** (the service's notice goes live with the service) |
| M25.4 Prices and provider | Fees read from the providers' pages (`docs/17` §3.5): Paddle out on its under-$10 rule, Lemon Squeezy and Polar at 5 % + 50 ¢, the €1.99 tip a poor deal at that fee. The numbers in `settings.ts` stay placeholders until decided | Material done; decision and account are Martin's |
| M25.5 The store shell | Play and App Store wrappers | **Deferred to 1.1**, as planned |
| M25.6 The Support screen | Settings › Support with the plans and tips, built in M22.3, is off the settings index and out of the bundle until a provider can take the money — a price list nobody can pay is a promise. Comes back with M25.4 | **Taken out 2026-09-12** |
| 1.0 | Tag, changelog, the four promises of `docs/17` §2 checked one by one | After M24.6 and M25.1's reply, or its absence |

## M26 · Sleeve → in progress

**Occasion:** the UI review of 2026-09-12 — docs/05 §1 says "record covers are the
interface" and the screens showed 72 px thumbnails beside eight lines of text, four type
steps with the largest at 28 px, and a frame around every level. The references are Braun's
ten principles, Teenage Engineering's store and AIAIAI's product pages: the object large,
the text small, one voice, plates instead of sentences, a grid instead of boxes. **The rule:
per screen one large thing, one loud sentence, everything else a plate.** Fonts stay with
Fontshare, self-hosted as before.

| Phase | Delivers | State |
|---|---|---|
| M26.1 Plate | The fifth type step `display` (40–72 px, `PageHeader` only, the guard allows it in one file); `.fid-plate` for labels, tabs and terms; the collection and basket tabs as a line with the current one underlined, no frame; fields on a baseline (`.fid-field`), no box; the rhythm 8 · 16 · 32 · 64 with the head at 32/64 px from the bar. No screen changes its content | **Done 2026-09-12**; the font set is Martin's pick from four Fontshare trials |
| M26.2 Sleeve | The MatchCard with the cover at 40 % and the signals as a plate line, the shelf at six columns with a density switch (eight is the crate), the start rails taller, the wantlist card with a 128 px cover, the release sheet tinted by a blurred copy of its own cover — not by reading pixels, `i.discogs.com` sends no CORS header (docs/02). Golden files untouched: no score moves | **Done 2026-09-12** |
| M26.3 Sixty | `tests/e2e/sixty.spec.ts`: sixty words of prose above the fold per screen, measured in a browser with a seeded profile; eight screens were over it (data 109, search 101, account 101, hub 89) and every one is under it now — leads shortened, explanations behind “Why?”, the wantlist plan a hairline instead of a box. And one door: the access key and the shared secret share one field on the hub screen, told apart by the `fk1.` prefix; Settings › Access is folded in and its address redirects | **Done 2026-09-12** |

## M27 · Wall → `v0.65.0`

**Concept:** [`18-PLACES.md`](18-PLACES.md) · **Decision:** ADR-015

Where a record stands, in three words: room · furniture · compartment. Furniture from a
preset, drawn as the wall it is; inside a compartment a rule, not a slot.

| Phase | Delivers | State |
|---|---|---|
| M27.1 Compartments | `kind`, `shape`, `grid`, `slot`, `capacity` on a place; `places.createUnit` makes furniture with its compartments in one transaction; the wall on the places screen (`PlaceWall`, a grid with roving focus, fill level, first covers); a compartment's records as covers; presets Kallax 2×2–5×5, crate, 7" box, pile, custom; the address as a plate on the record's sheet; dissolving a unit takes its compartments. Rows from M19 are rooms. And the look (M27.1b): material, thickness and colour of the walls as CSS, presets Kallax, Billy, USM Haller, Tylko, stocubo, HHV record box | **Done 2026-09-12** |
| M27.1c Fill | Filling from the wall, pulled forward from M27.3 because it is the first question anybody asks: open a compartment, "Fill" lists the collection with *not placed yet* on by default, a tick per record, one button puts the armful here; `collection.records` learns `unplaced`, `places.assignMany` writes them in one transaction | **Done 2026-09-12** |
| M27.2 Rule | `worker/place-rules.ts`: a unit's rule (by artist, label, year, arrival, or by hand), "Sort in" shows the plan — how many would move, how many from the pile — and only "Apply" moves them, dealt evenly across the compartments in reading order with the dividers written on them ("A–Bo"); the record's sheet proposes the compartment whose divider covers it, one tap puts it there. A rule proposes, never moves. Movable boundaries wait for M27.3 | **Done 2026-09-12** |
| M27.3 Selection | In the compartment's sheet: "Select" turns the sleeves into things to tick, "Move n to …" opens the wall small as the picker (`PlacePicker`, a button per compartment with its coordinate and divider, the rooms as a list), "Take n out" empties, and every move leaves a line with "Undo" that puts the records back where they were. Select mode on the shelf and the wantlist, and movable dividers, stay open | **Done 2026-09-12** (compartment) |
| M27.5 Keys and the shelf | On the wall `M` opens the focused compartment on "move all", a letter jumps to the compartment whose divider covers it, Home/End to the corners; on the shelf "Select" ticks sleeves and "Put n in …" opens the wall small as the picker, with the undo line that puts each record back where it was. Movable divider boundaries stay open — a rule proposes, and a boundary moved by hand would be a second rule | **Done 2026-09-13** |
| M27.4 Drag | `usePlaceDrag`: pointer events, not the HTML drag API — a mouse drags after six pixels, a finger has to rest 400 ms first, then the phone buzzes once; a sleeve from the sheet (or all the ticked ones) onto a cube of the wall behind it, a whole compartment onto another, furniture by its name onto a room or onto "without a room" (`places.move`); every drop leaves the undo line on the page | **Done 2026-09-12** |


## M28 · The tester's first quarter of an hour → `v0.67.0`–`v0.70.0`

**Where these come from.** The demo account (`docs/19`) walked on 2026-09-13: sixty-six
records and nineteen wants on a fresh device, then the shelf, the start page, the map, the
wantlist, a Kallax 4×4 filled and sorted in, a compartment opened. Checked against the same
four questions as M19 and M20: no backend, the API terms, the thesis, the cost. Proposed,
not scheduled.

| # | Candidate | Serves | Cost | Note |
|---|---|---|---|---|
| 1 | **The wantlist as sleeves.** The wantlist is the last screen still made of boxed cards: a 128 px cover beside five lines, "Pressings not unfolded yet" in orange and "Which pressing will do?" repeated on every one of nineteen cards, "Not any more" as a button on each. The M26 rule — one large thing, one loud sentence, everything else a plate — applied here: the cover large, the stars and the years as one plate line, the pressing hint once at the top and only while the horizon is not built, "Not any more" inside the record's sheet | The first screen a tester opens after the shelf, and the one that looks like another app | a day | **Done 2026-09-13.** A grid of sleeves like the shelf: the cover large, the title in the display face, one plate line for year, wait, priority and pressings, the stars under it, "Not any more" as a plate. The pressing hint per row is gone — the first sentence carries it while the horizon is not built. |
| 2 | **One row per album on the wantlist.** Four of the demo account's wants are pressings of one record — "Sonar System" four times, because Discogs wants are per release. The app knows the master: fold them into one row with "wanted in 4 pressings", unfolded on tap | Anybody who wants an album and has ticked its pressings at Discogs | hours | **Done 2026-09-13.** Wants with a master fold under the first of them in queue order; "wanted in 4 pressings · Show them" unfolds the rest, an anchor into a folded pressing unfolds its album first. |
| 3 | **Fill from the front.** "Sort in" deals sixty-two records evenly across sixteen compartments — four per cube in a Kallax with room for seventy, and dividers like "A–An" and "Ap–Bj" that mean nothing. A second way to deal: fill each compartment to a comfortable share of its capacity before starting the next, front to back, so a small collection stands in two cubes and the rest waits empty; the plan line says which way it dealt | Every collection smaller than its furniture — most of them | hours | **Done 2026-09-13.** "Evenly" or "From the front" next to the rule; the unit remembers it (`dealing`), the plan says which way it dealt, a compartment filled from the front takes 80 % of its capacity before the next. |
| 4 | **"All" means all.** In "Fill" the button ticks what is loaded — forty-eight of sixty-two — and "Put 48 in A1" leaves fourteen behind without saying so. "All" should tick the whole answer, and say so: "Put 62 in A1" | The very first fill anybody does | an hour | **Done 2026-09-13.** "All" in the fill sheet ticks the whole answer and the button says the true number. |
| 5 | **The horizon, explained once.** "19 records wanted, 0 with every pressing known to the horizon" is the first sentence on the wantlist, and it is jargon — a tester does not know what a horizon is. Say what it does for them, once, with the way there: "Fidelity does not know the other pressings of these yet — build the horizon in the settings (two minutes, once)"; gone once it is built | The tester who never opens the settings | an hour | **Done 2026-09-13.** While the horizon is not built, the wantlist's first sentence says what it would do and links to the settings; the old sentence returns once it is. |
| 6 | **The dividers on the sheet.** A record's sheet proposes its compartment "by the rule" — but the wall's dividers are not on it, so the proposal is a coordinate without a reason. Show the divider with it: "A2 · C–D, by artist" | Whoever files records one at a time from the sheet | an hour | **Done 2026-09-13.** "By the rule: A2 · C–D, by artist" — the divider and the rule next to the coordinate. |
| 7 | **Sync again is a plate, not a button.** "Synced just now · Sync now" sits at the top right of the shelf as a filled button and a sentence; on a screen whose rule is one loud thing, it competes with the covers. A plate with the time, and "Sync now" as a plate action | The shelf, every day | an hour | **Done 2026-09-13.** The time and "Sync now" as one plate line at the top right, no border, no fill. |

**Checked and left out:** the sixty-word rule for the wantlist (the rows are `li`, and the
prose above them holds); covers on the demo shelf (they load — what looked like "no cover"
in the first walk was a device that had just been signed out); a second furniture type per
room (the presets cover it).

## M29 · The tester's second session → `v0.72.0`

**Where these come from.** A session sitting next to the tester on 2026-09-13, with his own
device and his own collection. Everything here is a sentence he said.

| # | What | Serves | Cost | Note |
|---|---|---|---|---|
| 1 | **A surname is not a name.** "The Mark & Clark Band" came back at 0.85 as "Clark ist Anne Clark". Stage 2 of the S3 cascade took one token out of the listing's artist string and found it in the lexicon | Every dig — a wrong match at the top of the list costs more than a missed one | an hour | **Done.** Stage 2 skips entries carrying a `via`. Stages 1 and 3 keep the lexicon: both compare a whole string with a whole name (docs/04 §S3b) |
| 2 | **The round.** "Can I build a favourite-shop list and scan it weekly?" Almost: shops were remembered and could be watched, but watching only says *that* something moved | Anybody with more than two shops | a day | **Done.** One incremental dig per watched shop, ten to twenty requests for ten shops. Not weekly — there is no server (ADR-007) |
| 3 | **On your radar.** "Exit North, I think they are great, have no record by them, but I would like to be shown one if it turns up" | The gap between the wantlist (per release) and the shelf (what you own) | a day | **Done.** S3b `ARTIST_FOLLOWED`, weight 65, db v12 |
| 4 | **Shops that bill by grams.** A real shop's table is "1 bis 1999 Gramm: 14,00 €", and no honest conversion to records exists | Every shop outside the LP-count convention | hours | **Done.** The shape is named rather than refused in silence, and the shop's own text — free in every inventory row, thrown away until now — stands next to the form |
| 5 | **The same basket elsewhere.** "Five records at one shop for €100 — could another have the same five for €80? What if one has four of them, much cheaper? Or in better condition?" | The decision the basket screen exists for | a day | **Done.** A join over the stock rows the digs already wrote — no request, and inside the six hours those rows live anyway. db v13 indexes `stock` by release |
| 6 | **A vault file you carry.** "Why is there no iCloud option in Safari?" It was never about iCloud: WebKit has no File System Access API, so the destination that would have used iCloud Drive is not offered | Every iPhone, and Safari on every Mac | hours | **Done.** The same round with two taps instead of none: read a file, merge, save one |

## M30 · The shops screen, as a shop list → not scheduled

**Where these come from.** The same session, after the six above. Asked for in as many words:
"I want to enter dealers myself", "under Shops I want to see every dealer I have bought from,
have something in the basket from, have something on my wantlist from, or added by hand", and
"at Dig I only see the shops I have dug — I want mine there too".

| # | Candidate | Serves | Cost | Note |
|---|---|---|---|---|
| 1 | **A shop entered by hand.** A username or a shop link, checked once against `/users/{name}`, written down as a dealer row. It then appears everywhere a dug shop appears — the chips on Dig, the shops screen, the round | Somebody who knows where they want to look before they have looked | hours | One request per shop, on a button |
| 2 | **Why each shop is there.** The list is one list today and it is only ever "shops you dug". It should carry every shop the app has met and say which: bought from (`/marketplace/orders`, already read), something in the basket from, something on the wantlist offered by, dug, entered by hand. A row without a reason is a row nobody trusts | The screen's whole purpose | a day | The sources exist; what is missing is the union and the word on each row |
| 3 | **The shops on the Dig screen are the same shops.** Today that row is dug shops only, so a shop entered by hand or bought from is invisible exactly where somebody would dig it | Every dig after the first | an hour | Falls out of 2 |
| 4 | **Watching, for shops that were never dug.** The watch asks `num_for_sale` — one request, no dig needed — so it works for a shop entered by hand from the first minute. What it cannot do is say *what* moved until the shop has been dug once | A favourite-shop list that is useful before it is scanned | hours | Already true of `watch/check.ts`; the screen has to stop implying otherwise |
| 5 | **Where you are, and what is near.** `shipsToCountry` decides "from Germany" and it defaults to `Germany` for everybody — a Swiss or British user gets a chip about the wrong country until they find the setting. Derive it on the first run the way the language is derived, and offer a third group beside home and EU: Europe without the customs union, which is exactly what a Swiss, British or Norwegian buyer is asking about | Every user outside Germany, which is most of them | hours | The filter and the country list exist (`shared/countries.ts`); the default and the third group do not |
| 6 | **Shops other people dug, through the hub.** Which shops exist, what they stock (`fingerprint` — derived, not marketplace content) and what their postage is are all durable and shareable; prices never are (rule 4). A device could ask the hub "which shops do you know that I do not?" and rank them against its own collection | The "which shops suit me" question, without the platzhirsch bias of any curated list — it is whatever the community actually digs | a day | Needs an ADR: it is the first time the hub would carry something about **shops** rather than about records |

## M31 · Hearing it before buying it → done, with one rung parked

**Where this comes from.** "I want to be able to listen to the music it suggests — Spotify,
Apple Music, Tidal, Deezer, and let me choose which in the settings."

**What already exists.** ADR-012 put an audio preview in the stack in M15: the `videos[]` a
release carries, YouTube, off by default, no byte to Google before a deliberate tap. That
same ADR considered *"only link out — no embed, no Google on our page"*, rejected it for the
stack because leaving the app for every card ends the swiping, and left it standing as what
happens without the switch.

**Step one, done 2026-09-13.** A link, at the service somebody picks: the detail sheet and
the shelf sheet carry "Find it on TIDAL" and it opens that service's search with the artist
and the title. No request, no key, no account, and nothing leaves the device until it is
tapped.

**Step two, the same day.** The clips themselves, on both sheets — the same one switch, the
same off by default, the same nothing-before-a-tap. With the switch off a clip is a link
out; with it on it plays in place. `ListenSection.vue` holds both, and the ADR carries the
amendment that widened it.

**And the clips a find came without.** A dig fills `videos[]` for the top fifty, because
those get a `/releases/{id}` anyway; open the fifty-first and there was nothing to hear
although the record almost certainly has something. The sheet now looks that one up — one
release, once, for something on the screen, kept for ever after. The same bargain the covers
and the shelf's own sheet already make, and not a loop (rule 2 is about walking ten thousand
of them).

### What the research says about going further

Measured 2026-09-13, because the answer decides the whole shape:

| Service | Resolve a record from the browser, no server? | Player embeddable? |
|---|---|---|
| **Spotify** | **Yes** — Authorization Code with PKCE, the user's own account. Spotify's own tutorial does the token exchange in browser JavaScript and says no backend is needed. Needs a registered client id, which is public by design in PKCE | Yes: `open.spotify.com/embed/album/{id}` needs no token. The oEmbed *endpoint* sends no CORS headers, but the iframe does not need it |
| **TIDAL** | **Yes in principle** — OAuth 2.0 with PKCE for user-context flows | Needs an id, so it hangs off the same login |
| **Apple Music** | **No.** MusicKit needs a developer token: a JWT signed with a private key, which is a secret, which is a server (rule 1). The iTunes Search API has no CORS | Same token, same wall |
| **Deezer** | **No.** The public API is not CORS-enabled — JSONP or a proxy, and a proxy is a backend | — |

**So the ladder has exactly three rungs**, and the second and third are only ever going to
carry two of the four services. Anything that promised all four equally would be promising a
proxy.

### The plan, after checking it against the code

The research above is right about what is *possible* and was wrong about what to build
next. Reading the app settled it: `videos[]` is **already on every enriched match**
(`worker/dig/enrich.ts`), and ADR-012 has had a player for it since M15 — on the stack, and
only there. The screen where somebody actually weighs up a find had a search link and no
sound, over a match that was carrying the addresses the whole time.

| # | Rung | What it gives | Cost | State |
|---|---|---|---|---|
| 1 | **The link** | One tap to that service's search, for all four | hours | **Done 2026-09-13.** No request, no key, no account |
| 2 | **The clips, wherever a record is** | The sound Fidelity already has, on the find's sheet and the shelf's — not just in the stack | hours | **Done 2026-09-13.** No new third party, no new consent: ADR-012's switch, unchanged |
| 3 | **Sign in to Spotify or TIDAL** (PKCE) | The exact album instead of a search, and "not on there" before the tap | a day each | **Possible, not chosen** — see below |

**Why rung 3 is parked rather than queued.** It is buildable: the research above stands.
What it costs and what it buys do not meet.

- **The client id cannot be ours.** A Spotify app in development mode serves twenty-five
  users, each added by hand; more needs a quota review. So every user would register their
  own app — a developer account, an app, a redirect address, a pasted id — four steps of
  friction in front of one link.
- **It buys a link, not sound.** The embedded player needs no token of ours either way;
  the token only resolves an id. The sound in the app is YouTube's, and rung 2 already has
  it.
- **It is weakest where Fidelity is strongest.** A resolver that fails on 12" singles and
  white labels spends a day per service to answer "no" about the records this app is best
  at finding.

It stays written down because the measurement was the expensive part. If Spotify's quota
ever stops being a wall, the plan is three paragraphs up.

### How well the data actually matches

What a find carries is an artist string, a title, a catalogue number, a label and a year —
and what it does *not* carry is anything a streaming service uses as a key. The search is
`artist + title`, which is what somebody would type.

Where that works: albums. Where it does not, and this is the half of the collection Fidelity
is best at — 12" singles, white labels, DJ tools, bootlegs, unofficial pressings, anything
never licensed for streaming. A jazz LP resolves; a Freude-Am-Tanzen 12" often does not
exist on Spotify at all.

**Which is why rung 1 is a search and not a claim.** A link that lands on a search page and
finds nothing is honest; a button that says "play" and plays the wrong record is not. Rung 2
would let the app say *whether* it is there before the tap — that is its real value, more
than the exactness.

### What a second source would add — measured 2026-09-14

The question was whether Fidelity can assemble more than the handful of links Discogs hands
over. Three routes, and two of them were closed by measuring rather than by arguing.

**Discogs itself is exhausted.** `videos[]` is a *master*-level fact, and Discogs already
prints it on every release under that master: master 96559 and release 249504 hand back the
identical set of 17 addresses; master 5542 and five of its pressings 12 each; release
14251612 has none and neither does its master. **A `/masters/{id}` fallback would spend a
request to fetch the list we already have.** What M31 shipped — looking the clips up for a
find below the enriched fifty — is the whole of what this API can give.

**MusicBrainz is open, exact, and almost empty.** It sends `access-control-allow-origin: *`,
needs no key, and — the elegant part — it indexes Discogs master URLs, so
`/ws/2/url?resource=https://www.discogs.com/master/5542` lands on the right release group
with **no fuzzy matching at all**. Streaming links then hang off the *recordings*, one
browse request for a whole release.

The catch is the coverage, and it is the same catch as everywhere else in M31:

| Record | In MusicBrainz | Streaming links |
|---|---|---|
| Portishead — *Dummy* | yes | **9 of 10 tracks** (Spotify, one also YouTube) |
| Andrew Hill — *Point of Departure* | yes, score 100 | **0** |
| Marcel Dettmann — *Dettmann* | yes, score 100 | **0** |
| Kassem Mosse — *Workshop 19* | yes, score 100 | **0** |
| Skudge — *Convolution* | **no entry** | — |

Three requests per record, a third party with its own paragraph, a second pacer at one
request a second, and a 503 on the first attempt — for an answer that is there on famous
albums and absent on exactly the records this app is best at finding.

**So the only route that would actually find something is the user's own key** — the YouTube
Data API allows CORS and referrer-restricted browser keys, but the free quota is 10,000 units
a day and a search costs 100, which is a hundred searches for everybody together. That means
one key per user, the same handgrip as the Discogs token. Written down, not queued: it moves
work onto the user for a feature that already works without it.

### Where the data protection line runs

| | What reaches the service | Needs consent |
|---|---|---|
| **A link** | Nothing, until it is tapped. Then it is the reader's own navigation, like any link on any page | No |
| **An embed** | The IP address and which record, **before any interaction**, because the iframe loads on sight | Yes, and it is exactly the ADR-012 case |
| **A sign-in** | Whatever the user deliberately authorises, at the service's own page | It *is* the consent, and the screen names what leaves |

The distinction is the whole design: automatically loaded third-party content makes the site
a joint controller for what it sends, and a link does not. Rung 1 therefore needs no banner,
no toggle for privacy's sake and no paragraph — the switch it has is about the screen, not
about data. Rungs 2 and 3 each get their own sentence on the privacy page before they ship,
the way the YouTube preview did.

**Not planned:** a proxy for Apple Music or Deezer. That is a backend (rule 1), and it would
put every user's listening through a machine of ours — the one thing the privacy promise is
built to avoid.

## M32 · The screens around the record → `v0.75.0`–`v0.86.0`

**Where this comes from.** Four design concepts written on 2026-09-13 and -14 — *Drei
Sprossen zum Ton*, *Wo grabe ich als Nächstes*, *Vom Laden zur Platte*, *Sechzig pro Minute*
— and a day of reading them back against the code. The commits carry `M31.x` numbers because
the sequence ran on from the audio work; the subject is a different one and it is this.

### What shipped

| | What it answers |
|---|---|
| **The request ledger and the pulse** | "How much can I still do today?" — which is the wrong question, because Discogs' limit is a tempo and not a stock. A strip of sixty ticks, one per second of the last minute, and a panel that splits them by cause and by whether they cost a slot at all. Never Discogs' own counter: `x-discogs-ratelimit-*` is not exposed and a 429 arrives without CORS headers, so the only honest number is our own |
| **The next rung** | One line, and only where this device's own numbers make the case: without a token the ceiling is half, with a token and no catalogue the horizon requests already counted are exactly the ones a catalogue would take over |
| **One masthead for a record** | The same record opened from two screens was two designs. Now one composition, three voices — artist in the text face, title in the display face, facts in mono — with the sleeve's colour washed behind the head of the sheet |
| **Walking the list from inside the sheet** | A find means something next to its neighbours. Arrows and `k`/`j` step the list as it stands on the screen, on finds, on the shelf and on the wantlist |
| **The wantlist opens in the app** | It was the one screen where a sleeve led *out* of it. It keeps what is only true there: the note about which pressing will do, and how badly you want it |
| **The crate** | A card with a big cover is one screen per record on a phone. Two across, sleeves only — the pass where a sleeve stops you, not the one where you weigh a score |
| **The compact density, named** | It was always a table; now the columns have names and each one sorts |
| **The head that folds** | Once a result stands under it, the question — field, shops, earlier digs — becomes one line |
| **The shop as a sheet on a phone** | Three screens down is not "open". The same drawer the records use |
| **`?find=` in the address** | A reload keeps the record open, a link can point at a find, and Back closes the sheet instead of leaving the dig. Stepping *replaces* that entry; only opening pushes |
| **Asking one offer again** | Six hours on, the dig-wide refresh costs one request per find. This costs one, from where the record is being read — and the row then carries its own six hours, because its dig has already been swept |
| **One answer per address** | Two parts of the screen wanting the same record at the same moment were two requests. Coalescing, never caching: a finished request is gone, so rule 4 is untouched |
| **Reading ahead** | After the *first* arrow, the next record is looked up while this one is read. Not before — opening one record is no evidence that anybody wants a second |

### What was measured and not built

- **A `/masters/{id}` fallback for clips.** Master 96559 and release 249504 hand back the
  *identical* seventeen addresses; release 14251612 has none and neither does its master.
  The fallback would spend a request to fetch the list we already have.
- **MusicBrainz as a bridge.** Open, no key, and it indexes Discogs master URLs — so the
  resolution needs no fuzzy matching at all. And then: nine of ten tracks for *Dummy*, zero
  for Andrew Hill, zero for Marcel Dettmann, no entry at all for Skudge. Thin exactly where
  this app is strong.
- **Pooling release details in the hub.** ADR-016: the tracklist, the credits, the run-out
  and the clips are all in the CC0 dump — 400 of 400 mini-dump releases carry a tracklist,
  362 the videos. There is nothing to pool that Discogs does not already give away.
- **Blocking the service worker in the test suite.** 145 ms a test in Chromium, 295 in
  WebKit — and it makes those tests test less, while `usePush` waits on a registration that
  would never resolve.
- **Docking the sheet beside the list on a desk.** It was in *Vom Laden zur Platte* and it
  is the one item not built. What it was for — comparing without losing your place — the
  arrows, `j`/`k` and `?find=` now do, without making `SheetFrame` conditionally non-modal.
  Written down rather than dropped: if it comes back, it comes back as focus handling.

### And the suite that runs it

Ten minutes to under three, measured rather than guessed: eight shards instead of one runner,
four workers instead of the two the default gave, browsers in the image instead of sixty
seconds of downloading, and a wait in the seed that watched the network fall quiet instead of
watching for a screen. The diagnosis was wrong twice before it was right — Playwright's
worker *index* counts restarts, not slots — and both corrections are in the commits.

## Not on the roadmap

| Idea | Why not |
|---|---|
| Wantlist alerts as discovery | Discogs owns Wantlister, and it knows **who** has just listed, because Discogs owns the marketplace. Through `/marketplace/stats/` we only see "there are three copies now, the cheapest at €24". Competing on discovery would be hopeless — on the **threshold** it is not, and Wantlister has none. Hence M11 direction 2, and hence it never names a shop. |
| Our own checkout | A ToS breach, strategically stupid |
| Collection cataloguing | A solved problem, a dozen apps |
| A native app | The PWA is entirely sufficient |
| A paid model | The ToS forbids fees for API-integrated apps without permission |
| Multi-dealer search | There is **no** listings-by-release endpoint. Only through scraping — out of the question. **The basket comparison (M29 #5) is not this** and it is worth saying why: it never asks Discogs who sells a record. It reads the inventories this device has already walked, inside the six hours their prices may be shown, and it says so on the screen — "the shops you know", never "the market". The moment it claimed the second thing it would be this row again. |
| User accounts with passwords | Nobody needs them. The optional hub (M9) uses a shared secret. |
| Signal weights per user | Stood in the data model as `signalWeights` and was never read; removed on 2026-08-11. Scores have to stay comparable over time **and between people** — which is why `SCALE` and `SECONDARY` are constants, and why adjusting per user would be the same mistake one level up. |
| A price archive beyond Discogs' ten sales | Asked for constantly; forbidden just as constantly — the six-hour rule and the storage clause. Popsike lives on it with eBay data. The lawful equivalent exists: your own purchases, with price, condition and how they arrived (`/saved`). |
| An overlay on discogs.com ("you own 3 / want 7 of these") | Keepa's and Enhancer's pattern, and the one channel this app does not have. Impossible as a PWA — a different origin cannot read this one's IndexedDB. It would be a browser extension, that is, a second product; ADR-007's reasons against extensions (store review, no iOS) apply to the core, not to an add-on. Noted in `docs/14`, not planned. |
| Cover photo → release | Record Scanner and VinylAI sell it. Training it means downloading images, which are Restricted Data; M13 chose the runout for that reason and it stands. |
| Play log, random record, item photos, DJ key/BPM, seller tools | Each has a thread and an app. None starts at the collection or ends at a shop. |

---

## Order

```
M0 ─▶ M1 ─▶ M2 ──────────────▶ M3 ─▶ M4 ─▶ M6 ─▶ M8
       ▲      │                        ▲
       │      └──▶ M5 (the horizon) ───┘
       │                └──▶ M7 (pressing)
       │
   ⚠️ The user-agent test in M1 —
      if that breaks, everything breaks

M11 (market watcher) ┬─▶ does not need M5, only /marketplace/stats/
                     └─▶ shares the delivery path with the watcher from M9

M12 (places) ───────▶ hangs off nothing. Zero requests, purely local.
      │
      └──▶ M13 (recognising) — stage 2 computes on the covers from db/covers.ts

M14 (grading) ──────▶ hangs off the dealer fingerprint from M3

M15 (the stack) ────▶ **after** "share a dig" from M9, not before: the third
                      button on every card *is* the sharing. The other way
                      round you build a button that does nothing — or twice

M19 (candidates) ───▶ 1–5 touch nothing below them. 6–8 hang off the catalogue
                      hub (`docs/14`), 9 comes last because it starts at the wantlist
```
