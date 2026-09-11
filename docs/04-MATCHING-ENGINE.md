# 04 – Matching engine & the Barry Score

> The heart of it. This is where it is decided whether the app is a filter or a shop
> assistant.

---

## 1. Guiding principle

> **A recommendation without a reason is noise. A recommendation with a reason is a shop
> assistant.**

Every hit carries (a) a score, (b) the list of signals that fired with their evidence and
(c) exactly one sentence explaining why. The sentence is **not a nice-to-have** — it is the
product. Without it Fidelity is a better filter; with it, it is Barry.

---

## 2. Pipeline

```
Inventory page (100 listings)
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 1. NORMALISE                                              │
│    artist_string, label_string, title, catno → *_norm     │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 2. HARD FILTERS (before anything is scored)               │
│    format ∉ formats_allow            → discard            │
│    price > max_price (budget)        → discard            │
│    ships_from ∈ block                → discard            │
│    already in the collection         → discard*           │
│    *unless FORMAT_UPGRADE applies                         │
│                                                           │
│    dealer rating < min_seller_rating → do not start the   │
│    dig at all (applies to the dealer, not to a row)       │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 3. DETERMINE SIGNALS (in parallel, each returns 0..1)     │
│    S1 wantlist exact      S7  style adjacency             │
│    S2 wantlist pressing   S8  credit graph                │
│    S3 artist known        S9  format upgrade              │
│    S4 discography gap     S10 price signal                │
│    S5 label affinity      S11 scarcity                    │
│    S6 catalogue run                                       │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 4. SCORE = Σ(weight × confidence) → saturation → ×dampers │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 5. REASON SENTENCE from the strongest signal + context    │
└──────────────────────────────────────────────────────────┘
```

**Important:** step 2 runs **before** step 3. Computing signals and then throwing them away
is pure waste at 10,000 listings.

> ⚠️ **Keep hard and soft cleanly apart.** A criterion is either a filter *or* a damper —
> never both, or the damper is dead code.
>
> | Criterion | Kind | Field |
> |---|---|---|
> | Format | **hard** – discard | `formats_allow` |
> | Budget | **hard** – discard | `max_price` |
> | Shipping origin | **hard** – discard | `ships_from_block` |
> | Already in the collection | **hard** – discard | – |
> | Dealer rating | **hard** – do not start the dig | `min_seller_rating` |
> | Condition | **soft** – damp ×0.4 | `pref_media_cond` |
> | Comfortable price | **soft** – damp ×0.55 | `target_price` |
> | Negative price signal | **soft** – damp ×0.75 | – |
> | Reissue | **soft** – damp ×0.6 | `exclude_reissues` |
>
> **Why "reissue" is soft even though `docs/03` §2 lists it as hard:** whether a record is
> a reissue is in `formats[].descriptions` and therefore only in `/releases/{id}`. The scan
> never calls that (CLAUDE.md rule 2) — it is known only in the top-50 follow-up, that is
> *after* the scan. Discarding something you do not know at the moment of discarding is not
> possible. So the interface says "counts for less" and promises nothing the data cannot
> support.

---

## 3. The signals in detail

### S1 · `WANTLIST_EXACT` — weight 100

```ts
wantlistIds.has(listing.releaseId)      // Set<number>, O(1)
```

Confidence always 1.0. Free. The basic hit Discogs can already manage — but we show it in
the context of the whole dig.

> *"Has been on your wantlist for 14 months."*

### S2 · `WANTLIST_PRESSING` — weight 75 · from M5

A different pressing of a wantlist album, via `catalog.release.master_id`.

```ts
// The horizon holds ALL pressings for every wantlist album
// (from /masters/{id}/versions, 1 request per album).
const hit = horizonIndex.get(listing.releaseId)
hit?.some(h => h.kind === 'master' && wantlistMasterIds.has(h.entityId))
```

Confidence 0.9, damped to 0.6 when the pressing is considerably younger than the one
wanted (suspected reissue).

> *"Not the pressing from your wantlist, but the same album — a UK original from 1971
> instead of the 2015 reissue."*

### S3 · `ARTIST_KNOWN` — weight 55

The core of the MVP. The artist is in the collection, this release is not.

**The matching cascade** (because the inventory only gives a string):

| Stage | Condition | Confidence |
|---|---|---|
| 1 | `artistMap.get(norm)` – a map lookup, O(1) | **1.00** |
| 2 | Token containment: `"Kraftwerk / Neu!"` contains `"kraftwerk"` | **0.85** |
| 3 | Trigram similarity ≥ 0.85 – **only for the leftovers**, in JS | **0.70** |
| — | `artist_norm IN ('various','various artists','v/a','unknown')` | **discard** |

Multiplied additionally by the weight from the taste profile: an artist you own 12 records
by counts more than one you own a single record by.

> **Performance:** stages 1 and 2 are map and string operations and cost under 10 ms
> together for 20,000 listings. Stage 3 is the only expensive one — it runs only for the few
> hundred listings 1 and 2 did not hit. Total budget < 60 ms.

> ⚠️ **Never strip disambiguation suffixes.** `"Nirvana (2)"` is a *different* artist from
> `"Nirvana"`. That is the classic mistake that destroys precision.

> *"You have 12 Can records — not this one."*

### S4 · `ARTIST_GAP` — weight 70 · from M5

Psychologically the strongest card: nearly complete series are irresistible.

```
For every artist in the collection with ≥ 3 releases:
  gap_ratio = owned / (the artist's main albums in the relevant window)
  The signal fires when gap_ratio ≥ 0.5 AND this release closes the gap
  Confidence = gap_ratio  (0.5 → 0.5 … 0.9 → 0.9)
```

Relevance filters: only `role === 'main'` in the horizon, albums only, no
compilations/singles, and derive the time window from the collection itself (somebody who
only collects sixties Miles does not want an eighties one).

> *"You have 4 of Hank Mobley's 6 Blue Note leader dates from 1960–61. This is the fifth."*

### S5 · `LABEL_AFFINITY` — weight 45

It is not the absolute number that counts but the **lift**:

```
lift = share_in_your_collection / share_globally
```

Ten Warner records mean nothing. Three Ohr records mean everything.
Confidence = `min(1, log2(lift) / 3)`, fires from `lift ≥ 2`.

> ⚠️ The inventory gives **only the first label**. Multi-label releases are systematically
> underrated as a result. Correctable from M5 via `catalog.release_label`.

> *"Brain Records — you have 7 of those, 9× more than average."*

### S6 · `CATALOG_RUN` — weight 60 · from M5

Catalogue number runs: Blue Note 4000s, ECM 1000s, Impulse! AS-, Vertigo Swirl,
Brain/Ohr/Pilz, Factory FAC-.

```
Split catno → (prefix, number):  "BLP 4058" → ("BLP", 4058)
For every (label, prefix) in the collection with ≥ 3 entries:
  Determine the numbers held → the gaps
  The signal fires when listing.catno_num falls in a gap
  Confidence rises with the density of the run in your collection
```

> *"Blue Note 4058 — in the 4000 series you are only missing 4051 and 4058."*

This deserves a **visual representation** of its own: the run as a grid with
owned / buyable here / missing. That is the dopamine loop for jazz and krautrock collectors.

### S7 · `STYLE_ADJACENT` — weight 30

The collection's style centroid as a weighted vector over Discogs styles.

```
score = cosine(style_vector(listing), style_centroid(user))
The signal fires from 0.6.
```

From M2 only when the release is known from the collection/wantlist (styles are missing
from the inventory). From M5, out of `catalog.release.styles` for every listing.

> **No pgvector at the start.** Discogs has ~600 styles — a sparse vector in JSONB plus a
> cosine in SQL is entirely enough. `pgvector` only when measured relevance justifies it.

> *"Deep house with a Detroit lean — your home ground."*

### S8 · `CREDIT_GRAPH` — weight 65 · from M5 · **the differentiator**

The unused treasure. Practically no tool consumes `extraartists`.

```
For every role in ('Producer','Engineer','Mixed By','Mastered By','Recorded At'):
  Determine the people over-represented in your collection (lift ≥ 3)
  The signal fires when this release carries one of them in the same role
  Confidence = min(1, count_in_collection / 8)
```

Also the **sideman axis**: people who appear often in your collection with
`role IS NOT NULL` but never as the main artist — the classic jazz and dub navigation path.

> *"Conny Plank at the desk, 1974. You have 9 of his productions — not this one."*
> *"Rudy Van Gelder recorded this. Like 23 other records on your shelf."*

### S9 · `FORMAT_UPGRADE` — weight 40 · from M5

You own the master, but not on **this medium**.

```ts
// ⚠️ masterId 0 means "no master" – without this guard ALL masterless
//    releases land in one pot and produce false hits.
const masterId = horizonMasterOf(listing.releaseId)
masterId !== 0
  && nonVinylMasterIds.has(masterId)              // Set<number>, built at sync time
  && matchesFormat(listing.format, prefFormats)   // matches your preference
  && !ownedFormats.some((f) => sameMedium(listing.format, f))
```

> *"You have this on CD. This is the German first pressing."*

**Why not simply `/vinyl/i.test(listing.format)`** (which is what stood here until M3):
that was both too narrow and too loose. Too narrow, because it does not cover "you have it
on cassette, here is the CD" and ignores the configured format preferences. Too loose,
because the preference check alone is worthless: an empty preference list means "no filter"
and lets everything through — and then the CD of a record you already have on CD is offered
as an upgrade to itself.

The medium comparison therefore belongs in the signal, not in the filter. With an unknown
medium on either side, "different" applies — "I cannot tell" must not quietly become "these
are the same".

The golden dig (`tests/unit/golden.spec.ts`) found this on its first run.

### S10 · `PRICE_SIGNAL` — weight 35 · from M4 · **1 API request per release**

`GET /marketplace/stats/{release_id}` → `lowest_price`, `num_for_sale`.

> ⚠️ **Never for every hit.** Only for the **top 50 by preliminary score**, after the scan,
> as its own phase in the worker. Otherwise a dig costs 10,100 requests instead of 101.
> ⚠️ `lowest_price` from `/releases/{id}` is demonstrably wrong — use `/marketplace/stats/`.

```
ratio = listing.price / market_lowest_price
ratio ≤ 0.7  → confidence 1.0   ("well below market")
ratio ≤ 0.85 → 0.6
ratio > 1.3  → a NEGATIVE signal, a score damper
```

> *"€24 against a market low of €41."*

### S11 · `SCARCITY` — weight 30 · from M4

From `num_for_sale` in the same lookup.

```
num_for_sale ≤ 3   → confidence 1.0
num_for_sale ≤ 10  → 0.5
num_for_sale > 30  → no signal (it will come round again)
```

> *"Only 2 copies on offer worldwide."*

---

## 4. Computing the score

```ts
const WEIGHTS = {
  WANTLIST_EXACT: 100, WANTLIST_PRESSING: 75, ARTIST_GAP: 70,
  CREDIT_GRAPH:    65, CATALOG_RUN:       60, ARTIST_KNOWN: 55,
  LABEL_AFFINITY:  45, FORMAT_UPGRADE:    40, PRICE_SIGNAL: 35,
  STYLE_ADJACENT:  30, SCARCITY:          30,
} as const

const SECONDARY = 0.3   // the weight of secondary reasons
const SCALE     = 115   // raw = 115  →  score 100

function barryScore(signals: Signal[], ctx: Context): number {
  const vals = signals
    .map(x => WEIGHTS[x.type] * x.confidence * (ctx.userWeights[x.type] ?? 1))
    .sort((a, b) => b - a)

  if (vals.length === 0) return 0

  // 1. THE STRONGEST REASON DOMINATES; secondary reasons count, damped.
  //    A plain sum would wash hits with many weak signals to the top; but a
  //    single perfect reason should weigh more than five mediocre ones.
  //    Worked example:
  //      1 × perfect (100)          → raw = 100      → score 87
  //      5 × mediocre (30 each)     → raw = 30+36=66 → score 57
  const [primary, ...rest] = vals
  const raw = primary + SECONDARY * rest.reduce((a, b) => a + b, 0)

  // 2. Linear scaling with a cap. No saturation term is needed, because
  //    step 1 already bounds the summation.
  let score = Math.min(100, (raw / SCALE) * 100)

  // 3. SOFT dampers. Everything hard was already sorted out in step 2 of the
  //    pipeline – only criteria that can actually occur appear here.
  if (ctx.conditionBelowPreference) score *= 0.40   // below pref_media_cond
  if (ctx.priceAboveTarget)         score *= 0.55   // above target_price, below max_price
  if (ctx.priceSignalNegative)      score *= 0.75   // well above market level
  if (ctx.alreadyInBasket)          score  = 0

  return Math.round(score)
}
```

**Calibration points** (checkable by hand, and they belong in the golden-file test):

| Set of signals | raw | Score | Band |
|---|---:|---:|---|
| Wantlist exact alone | 100 | **87** | S |
| Wantlist exact + price signal | 110.5 | **96** | S |
| Credit 1.0 + run 0.95 + label 0.9 + price 1.0 | 104.8 | **91** | S |
| Discography gap 0.8 + run 0.9 | 72.2 | **63** | B |
| Artist known + label 0.8 | 65.8 | **57** | B |
| Artist known alone | 55 | **48** | C |
| Style adjacency alone | 30 | **26** | discarded |

> ⚠️ **In M2 there are only S1, S3 and S5.** The maximum reachable there is ~100 points
> (wantlist + artist + label); realistically most hits land at 45–65. That is correct and
> honest: with three signals we know less. `SCALE` must **not** be adjusted per milestone,
> or scores stop being comparable over time — and the golden-file test becomes worthless.

### Score bands

| Band | Range | Label | Presentation |
|---|---|---|---|
| S | 85–100 | **Side One, Track One** | A large card, cover, full reasoning |
| A | 70–84 | **Top Five** | A card with a cover |
| B | 50–69 | Solid | A compact row |
| C | 30–49 | A footnote | A row, collapsed |
| — | < 30 | | not stored at all |

---

## 5. The reason sentence

**No LLM generation.** Templates per signal type, filled with real evidence, combined by
priority. Reasons: deterministic, immediate, free, with no hallucination risk — and a Barry
who says the same sentence every time for the same situation is more credible than one who
improvises.

```ts
const TEMPLATES = {
  ARTIST_GAP: (e) =>
    `You have ${e.owned} of ${e.total} ${e.label ? e.label + ' ' : ''}albums by ` +
    `${e.artist}${e.era ? ` from ${e.era}` : ''}. This is the missing one.`,

  CREDIT_GRAPH: (e) =>
    `${e.person} ${ROLE_EN[e.role]} – you have ${e.owned} records of theirs on the ` +
    `shelf, not this one.`,

  CATALOG_RUN: (e) =>
    `${e.label} ${e.catno}. In the ${e.prefix} series you are only missing ` +
    `${e.gaps.slice(0, 3).join(', ')}.`,

  LABEL_AFFINITY: (e) =>
    `${e.label} – you have ${e.owned} of those, ${e.lift.toFixed(0)}× more than average.`,

  WANTLIST_EXACT: (e) =>
    `Has been on your wantlist for ${e.monthsOnList} months.`,

  WANTLIST_PRESSING: (e) =>
    `Not the pressing from your wantlist, but the same album – ` +
    `a ${e.country} pressing from ${e.year}.`,

  ARTIST_KNOWN: (e) =>
    `You have ${e.owned} ${e.owned === 1 ? 'record' : 'records'} by ${e.artist} – not this one.`,
}

// Assembly: the strongest signal as the main clause,
// the second strongest as a subordinate clause, the price/scarcity signal
// always as the closing sentence. Two sentences at most. Barry talks a lot,
// but not endlessly.
```

**Example output:**

> **91 · Side One, Track One**
> *Conny Plank at the desk, 1973 – you have 9 of his productions, not this one. In the
> Brain 1000 series you are only missing 1051 and 1060. VG+ for €24 against a market low
> of €41.*

---

## 6. Basket optimisation

### The marginal cost curve

```
For dealer D with shipping tiers T and a basket of size n:
  postage_per_item(n)     = T(n) / n
  marginal_cost(n → n+1)  = T(n+1) - T(n)
  saving_per_item(n+1)    = T(n)/n - T(n+1)/(n+1)

UI: "The 3rd record brings postage down from €4.50 to €3.00 each
     → here are the 12 best candidates at this dealer."
     (tiers 1 LP: €6, 2–3 LP: €9  →  T(2)/2 = 4.50 · T(3)/3 = 3.00)
```

### The optimiser

A small integer optimisation problem, no solver needed:

```
Maximise Σ score(i)
s.t.     Σ price(i) + postage(|K|) ≤ budget
         |K| ≤ max_items
```

At ≤ 200 candidates, greedy on `score / (price + marginal postage)` plus local improvement
(a swap neighbourhood) is enough. A result in milliseconds, explainable in plain words —
which matters more than the mathematical optimum.

> ⚠️ **No checkout.** We build the basket, then deep-link to the Discogs listings. The
> purchase happens at Discogs. Anything else would breach the terms of use and be
> strategically stupid.

---

## 7. Calibration

Without feedback the Barry Score is guesswork. So from M3:

- Per hit: 👍 interesting / 😐 so-so / 👎 wrong / 🛒 bought
- Stored **with the signal snapshot** (`app.match_feedback.signals`)
- From ~200 verdicts: analysis of which signals correlate with "interesting"
- At first **manual** adjustment of the weights, no ML
- Later: per-user weights in `user_preference.signal_weights`

**Target metric:** precision@5 — how many of the Top Five are rated positively. Target
≥ 0.6.

---

## 8. Testability

The engine is a **pure function** — that is deliberate:

```ts
scoreListing(listing, tasteProfile, preferences, horizonIndex) → Match | null
```

No I/O, no IndexedDB, no network. Runs in the web worker. Which gives us:

- **Golden-file tests**: frozen fixtures from real inventories, expected scores in the
  snapshot. Every change to a weight shows its effect on the whole list immediately.
- **Property tests**: the score is monotonic in confidence; hard filters are absolute; the
  score always lies in [0,100].
- **A regression corpus**: Martin's and Jens's real collections against 3 frozen dealer
  inventories. Run before every release, then compare the Top Five.
- **A performance benchmark**: 20,000 synthetic listings must stay under **250 ms**. Breaks
  the build when exceeded (see `12-RESOURCE-BUDGET.md`).
