# 00 – Product concept

> **Status:** draft v0.1 · **As of:** 2026-08-09 · **Author:** Martin + Claude

---

## 1. The thesis

**Discogs is a search engine, not a record shop.**

Discogs answers the question *"do you have record X?"* perfectly. It **never** answers the
question you ask in a good record shop:

> *"I collect krautrock and Blue Note jazz. What have you got for me?"*

That is exactly the gap this project fills. We are not building another marketplace but
**the person behind the counter** — the figure who knows what you have, what you are
missing, and why the record in box C should interest you.

### The concrete pain

A dealer has 20,000 records in stock. On Discogs you always buy several records from the
same dealer to save on postage. So you have to dig through 20,000 entries — by hand, sorted
by artist name, with no relation to your own collection at all.

Discogs' own tools only help so far:

| Discogs feature | What it can do | What is missing |
|---|---|---|
| "Items I Want" (`/sell/mywants`) | Shows dealers with the most wantlist hits | Only the **exact release version**, a top-5 display, buried deep |
| Wantlister (acquired 2024) | Real-time alerts, filters, churn detection | Wantlist only. Does not know your **collection** |
| Recommendations | ~20 suggestions | Practically dead, not dealer-related |
| Price suggestions | Median/lo/hi | For sellers only, without postage |

**The blind spot:** every existing tool starts at the **wantlist** — that is, at records you
already know you want. None starts at the **collection** — at what your taste says about
you.

---

## 2. Competitive analysis

An honest placing (as of August 2026, researched):

```
                    PERSONALISED to your collection
                              ▲
        recordsv.lt ●         │         ★ THIS PROJECT
     (analysis only,          │        (forerunner "crate_digger.php"
      no marketplace)         │         from 2021 – dead for years)
                              │
  COLLECTION ─────────────────┼───────────────────── DEALER
     SIDE                     │                       SIDE
                              │
      Vizcogs ●               │         ● milkcrate.fm  (no personalisation)
      Groovv  ●               │         ● Waxrunner     } wantlist,
   Discogs Enhancer ●         │         ● Wantlister    } not collection
                              ▼
                        NOT personalised
```

### The players that matter

| Tool | What it does | Alive? | What it lacks |
|---|---|---|---|
| **Discogs Enhancer** (browser ext.) | 60+ features: sorting including postage, currency conversion, collection indicators | ✅ very active, 10k+ users, €3–10/year | No recommendations, no inventory matching |
| **Waxrunner** | Constraint solver: the best combination of wantlist × dealer | ✅ (HN, Aug 2026) | **Wantlist only**, no taste profile |
| **milkcrate.fm** | Dealer storefronts, "crates", genre bins | ✅ (HN, Jun 2026) | **No personalisation** |
| **recordsv.lt** | Pressing insights, contributor networks from your collection | ✅ (HN, Mar 2026) | **No marketplace connection** – it does not say what to buy |
| **discogs_alert** (OSS) | Wantlist alerts | ✅ | Scrapes the website (a ToS breach), wantlist only |
| **Discogs Wantlist Optimizer** | Dealer ranking by wantlist overlap | ❌ **dead** – domain lost to gambling spam in 2026 | A memorial: hobby projects die quickly |

### The precedent

In the Discogs forum (thread #786216) a user called *faraz12inch45rpm* described exactly
this idea in 2021:

> "It first scans your collection to find unique artist names. Then it checks the entire
> seller's inventory for those artists."

It ran on a bare IP as `crate_digger.php`. **It is dead today.** Never named, never
launched, never marketed. So the idea is validated *and* the field is open.

### Risk

Discogs **acquired Wantlister in June 2024** (Stoat Labs). That is validation, an exit path
and a cloning risk all at once. Our defence: the collection taste graph and the credit graph
are laborious; the wantlist intersection is trivial.

---

## 3. Naming

An homage to *High Fidelity* (Stephen Frears, 2000 / Nick Hornby, 1995).

### Recommendation: **Fidelity**

One word. Three layers of meaning:

1. **High Fidelity** – the homage, instantly recognisable to those who know
2. **Fidelity = sound fidelity** – pressing quality, original vs. reissue
3. **Fidelity = reliability** – honest grading, trustworthy dealers

Unproblematic as a mark (a generic term), pronounceable in German and English, realistic
domain variants (`fidelity.app` presumably taken → `fidelity.fm`, `getfidelity.app`,
`fidelity-vinyl.de`).

### The naming system inside the app

| Element | Name | Origin |
|---|---|---|
| Product | **Fidelity** | *High Fidelity* |
| Recommendation engine / persona | **Barry** | Jack Black's Barry Judd – the guy who knows everything and judges unasked |
| One dealer scan | **Dig** ("start a dig") | Crate digging |
| The 0–100 rating | **Barry Score** | see above |
| The top recommendations | **Top Five** | The film's running gag |
| The outright number one in a dig | **Side One, Track One** | Rob Gordon's category |
| The shop/dashboard screen | **Championship** | *Championship Vinyl* – as an internal screen name, not a product name |
| The dealer profile | **The Clerk's Take** | |

> ⚠️ **"Championship Vinyl" deliberately not used as a product name.** A fictional company
> name from a copyrighted work — unnecessary risk as a trade mark. As an internal screen
> name / easter egg, entirely harmless.

### Alternatives (should "Fidelity" not catch)

- **Top Five** – the closest to the film, describes the output format literally
- **Deep Cut** – collector slang, memorable
- **Sleeve** – minimal, a .app domain more likely to be free
- **Barry** – cheeky, but too tied to the character for a product name

---

## 4. The core function (MVP)

> **One dealer in, one scored list of finds out — with a reason per hit.**

```
   Discogs dealer name
           │
           ▼
   ┌───────────────────┐     ┌──────────────────────┐
   │  Inventory scan   │◀───▶│  Your collection     │
   │  (up to 20,000    │     │  + wantlist          │
   │   listings)       │     │  (OAuth sync)        │
   └─────────┬─────────┘     └──────────────────────┘
             │
             ▼
   ┌───────────────────────────────────────┐
   │  Matching engine  →  Barry Score      │
   │  11 signals, weighted, with a reason  │
   └─────────┬─────────────────────────────┘
             ▼
   ┌───────────────────────────────────────┐
   │  Top Five · full list · basket        │
   │  Dealer profile · postage calculator  │
   └───────────────────────────────────────┘
```

---

## 5. The match signals

Every hit carries one or more **signals**. That is the heart of the product — and the reason
every recommendation gets a sentence explaining it.

| # | Signal | Meaning | Cost | Phase |
|---|---|---|---|---|
| 1 | `WANTLIST_EXACT` | This exact release id is on your wantlist | **free** | M2 |
| 2 | `WANTLIST_PRESSING` | A different pressing of a wantlist album | catalogue DB | M5 |
| 3 | `ARTIST_KNOWN` | The artist is in your collection, this release is not | **free** | M2 |
| 4 | `ARTIST_GAP` | A discography gap: you have 4 of 6 | catalogue DB | M5 |
| 5 | `LABEL_AFFINITY` | A label you collect more than average | **free** | M2 |
| 6 | `CATALOG_RUN` | A catalogue-number run (Blue Note 4000s, ECM 1000s, Brain/Ohr/Pilz) | catalogue DB | M5 |
| 7 | `STYLE_ADJACENT` | Style adjacency to your collection's centroid | **free** | M3 |
| 8 | `CREDIT_GRAPH` | Same producer / engineer / studio / sideman | catalogue DB | M5 |
| 9 | `FORMAT_UPGRADE` | You have it on CD – here is the original vinyl | catalogue DB | M5 |
| 10 | `PRICE_SIGNAL` | Well below the market's lowest price | 1 API call | M4 |
| 11 | `SCARCITY` | Rarely turns up on the marketplace | 1 API call | M4 |

### Why signal 8 (`CREDIT_GRAPH`) is the real killer feature

Discogs' greatest unused treasure is the **credit graph**: every release carries
`extraartists` with roles — producer, engineer, mastered by, recorded at. Practically **no
tool consumes this data**.

Example output:

> *"You own 9 Conny Plank productions. This dealer has 4 more that you do not — two of them
> you would never have searched for."*

That is exactly what a good shop assistant says. And the data for it is **CC0-licensed**
(Discogs data dumps) — permanently, freely usable with no restrictions.

---

## 6. The Barry Score

```
score = (strongest signal + 0.3 × sum of the rest) / 115 × 100
```

Capped at 0–100. The strongest reason dominates — five mediocre reasons do not beat one
perfect one. The full formula including the calibration table is in
`04-MATCHING-ENGINE.md` §4. **Always** accompanied by a generated sentence of reasoning:

> **91 · Side One, Track One**
> *"A Conny Plank production from 1973 on Brain – you own 9 of his productions and are only
> two short of the complete 1000 series. VG+ for €24 against a market low of €41."*

**Soft dampers** (multiplicative). Hard filtering happens beforehand — format, budget,
shipping origin and dealer rating deliberately do *not* appear here, or the damper would be
dead code (see `04-MATCHING-ENGINE.md` §2):
- Condition below your desired condition → ×0.40
- Price above your comfortable price (but within budget) → ×0.55
- Well above market level → ×0.75
- Already in the basket → ×0

**Design principle:** A recommendation without a reason is noise. A recommendation with a
reason is a shop assistant. The reason sentence is **not a nice-to-have**; it is the
product.

---

## 7. Postage optimisation ("the basket")

The most frequently named pain of all — and quantifiable in euros.

> *"The 3rd record brings postage down from €4.50 to €3.00 each. Here are the 12 best
> candidates at this dealer in exactly that price window."*

Discogs shows combined postage **only in the basket**. We show it **beforehand** — as an
argument for buying.

### ⚠️ An honest limitation

The `shipping_price` field is **empty** for many dealers in the inventory API — Discogs
calculates postage only in the cart. The answer:

1. **A dealer shipping profile**: the user enters the tiers once (1 LP: €6, 2–3 LP: €9, …)
2. The app remembers the profile **globally per dealer** — maintained once by one user,
   everyone benefits (crowdsourcing on a small scale)
3. A heuristic parser over the free text in `seller.shipping`
4. Fallback: "postage unknown — enter it and I will do the arithmetic"

This is documented as a limitation, not hidden.

**The parser reads by destination country.** A real shipping box is rarely one table; more
often it is three, stacked under headings: `Germany:`, `Europe:`, `Non-Europe:`. Read as one
table the rates mix, and the cheapest line from the wrong continent wins — that is exactly
how a two-record basket at fatplastics came to €13 instead of the real €6.

So: headings that name a place split the text. Only the block **for the configured
destination country** is read — exact country name, otherwise the region (`Europe:` for a
European destination), otherwise a catch-all block (`Rest of World:`). If no block names the
destination there is **no tier** rather than one from the neighbourhood. The card says which
section it read from.

Headings that name no place (`Porto:`, `Shipping address Terms:`) split nothing — otherwise
a perfectly readable table would fall into pieces that fit nothing.

---

## 8. Further features (prioritised)

### Phase 2 – dealer intelligence

- **Dealer fingerprint**: *"Stock leans towards German krautrock 1970–77; 62 %
  Brain/Ohr/Pilz; median year 1974; hardly any reissues."* Costs one scan and nothing else.
- **Affinity score**: *"Your collection overlaps this stock by a factor of 3.1 — one of your
  top 5 dealers overall."*
- **Dealer watchlist**: a periodic rescan with a diff. *"Vinyl-Tom has 40 new listings, 6
  of them suit you."* No existing tool watches at the **dealer** level.
- **Price positioning**: *"Systematically 15 % below median on jazz, 40 % above on soul."*

### Phase 3 – pressing advice

- **Original vs. reissue** from matrix/runout, mastering stamps (RVG, Porky, RL), pressing
  plant, country, label variant
- **Trap warnings**: *"That is a Japanese pressing from 1983, not a '65 original — the price
  suggests otherwise."*
- **Format upgrade paths**

### Phase 4 – in-store mode

- You are standing in the shop and the dealer has a Discogs store → the PWA shows the dig
  list on your phone, offline-capable (many record shops are basements with no reception)
- Record fair mode: several dealers one after another

### Noted for later

- **Sleeve condition as a damper.** The data is already there: `sleeve_condition` comes from
  the inventory, is stored, and is handed to the matcher. What is missing is the damper — a
  VG+ record in a G sleeve is a different purchase, and collectors know it.

  It stood in the settings as `prefSleeveCondition` until 2026-08-11 without anything ever
  reading it, and has been removed from there. A field that promises a feature which does
  not exist is worse than no field. If it comes, it comes by the intended route: first
  `docs/04-MATCHING-ENGINE.md`, then built — and with an explained snapshot diff, because it
  moves every score.

### Deliberately **not** built

| Not building | Why |
|---|---|
| Wantlist alerts | Discogs owns Wantlister — hopeless |
| Collection cataloguing | A dozen apps, a solved problem |
| Collection visualisation | Vizcogs, Groovv, Discogs Enhancer |
| Our own marketplace / checkout | A ToS breach and strategically stupid |
| Price arbitrage to eBay/Amazon | The ToS forbids diverting traffic |

---

## 9. Audience & scope

**Phase 1 (now):** Martin + Jens. Then the circle of friends. No public launch.

Consequences:
- **A client-only PWA with no backend** (ADR-007). Every user brings their own Discogs
  Personal Access Token — and with it their own rate-limit budget
- No multi-user data model needed, because there is no shared database. Passing it on means
  sending the URL
- No registration, no invitation codes, no user management
- No monetisation (a ToS conflict, see `09-LEGAL.md`) — and with no server there is nothing
  to finance either

---

## 10. Success criteria

| Criterion | Target |
|---|---|
| Time from a dealer name to a list of finds | < 3 minutes at 10,000 listings |
| Precision of the Top Five | ≥ 3 of 5 hits marked "interesting" |
| Use by Jens with no explanation | The first dig succeeds without a question |
| Time saved vs. clicking through by hand | A factor of > 50 |
| One purchase that would not have happened without the app | The actual proof |
