# 14 – The relaunch concept

> **Status:** research and a position, not a plan · **As of:** 2026-09-11 · **Author:** Martin + Claude
>
> Fidelity as it stands is a proof of concept that costs almost nothing to run. This
> document is what a second version would look like if it were started again today, with
> what has been learned. Nothing in it is scheduled. The candidates that *are* scheduled
> came out of §2 and stand in `06-ROADMAP.md` under M19.

---

## 1. What stays

Four things survived two years of Discogs' own roadmap and would be kept as they are:

- **The thesis.** Collection before wantlist, the shop as the unit, the sentence as the
  product. Every first-party feature since 2024 (Wantlister, Shop My Wants, *Seller
  Matches* in June 2026) starts at the wantlist and ranks by raw overlap. Nothing ranks a
  shop's stock against what you *own*, with a reason.
- **Marketplace data in the browser.** The rate limit is per IP, so every user brings their
  own 60 requests a minute; the token never leaves the device; the GDPR surface stays
  empty. This is not thrift — it is the only design that still works at a thousand users.
- **A pure scoring engine** behind a golden-file test, with `SCALE` and `SECONDARY` as
  constants, so scores stay comparable over time and between people.
- **Honesty in the interface**: coverage in per cent, request costs stated before the tap,
  prices locked after six hours. That is the brand.

## 2. What Discogs users ask for

A research pass on 2026-09-11 over the Discogs forum, r/discogs, r/vinyl, Hacker News,
the app-store reviews of every Discogs client and the blogs around them. Reddit and the
forum block direct fetches; the evidence there comes from search snippets and Wayback
copies, and every row carries a URL that was actually seen.

### 2.1 The recurring wishes, ranked

| # | Wish | How often | Fidelity today |
|---|---|---|---|
| 1 | **The seller with the most of my wantlist**, to bundle postage. Removed from the site in Aug 2025 with *Shop My Wants*, uproar, then *Seller Matches* in the app (Jun 2026). [forum/1136465](https://www.discogs.com/forum/thread/1136465) · [forum/1154350](https://www.discogs.com/forum/thread/1154350) | frequent | Per shop yes; across shops no — there is no listings-by-release endpoint |
| 2 | **Wantlist notifications are noise** — price ceiling, condition, country, seller as filters. [forum/705163](https://www.discogs.com/forum/thread/705163) | frequent | Deliberately not built (Wantlister) |
| 3 | **A "ships from" filter.** Staff, 2021: "there is not a ways to filter by where an item ships from". [forum/701208](https://www.discogs.com/forum/thread/701208) | frequent | The country is on the shop profile, not a filter |
| 4 | **The official app is unreliable** — crashes, sign-in loops, captchas. [App Store](https://apps.apple.com/us/app/discogs/id1036449551) | frequent | — |
| 5 | **"Do I own this?" offline, in the shop.** Basements have no signal. [HN: Digs](https://news.ycombinator.com/item?id=47486916) | frequent | **Built** — the in-store screen |
| 6 | **"In collection / on wantlist" markers** on marketplace and seller pages. [forum/702926](https://www.discogs.com/forum/thread/702926) | recurring | In the app, not on discogs.com |
| 7 | **Browse a big seller's stock by relevance** — artists I own, want/have, rarity. Community scripts since 2014. [forum/786216](https://www.discogs.com/forum/thread/786216) · [discogs-advanced-sorter](https://github.com/ae0j/discogs-advanced-sorter) | recurring | **The core.** Nothing first- or third-party does it with a reason |
| 8 | **Postage invisible until checkout**; the 2026 payment-first checkout ends order merging for most sellers. [forum/1162546](https://www.discogs.com/forum/thread/1162546) | frequent | **Built** — the basket |
| 9 | **One cart, many sellers.** [forum/854299](https://www.discogs.com/forum/thread/854299?page=1) | recurring | Impossible without a checkout of our own |
| 10 | **Collection value over time.** Discogs keeps no history. [forum/830635](https://www.discogs.com/forum/thread/830635) | recurring | The value, no history |
| 11 | **CSV export without values, genres, styles; import broken.** [forum/783709](https://www.discogs.com/forum/thread/783709) | recurring | The data is local; export is a backup, not CSV |
| 12 | **Block a seller.** Enhancer's flagship paid feature. [forum/402398](https://www.discogs.com/forum/thread/402398) | recurring | No |
| 13 | **A comparable price** across currencies and including postage. | recurring | Shop currency, postage in the basket, no landed price in the list |
| 14 | **Wrong pressing listed; photos of the actual copy.** Discogs shipped *Item Photos* in Jun 2026. | frequent | Pressing warnings; no item photos |
| 15 | **Redesigns break workflows** — "you would need a college degree to navigate through discogs". [forum/1168587](https://www.discogs.com/forum/thread/1168587) | frequent | A calm, stable front end is an argument |
| 16 | Play log, last played. | recurring | Outside the thesis |
| 17 | **Identifying the pressing** — "tilting the record under a lamp at 15 different angles". | occasional | Runout lookup, reach limited to the horizon |
| 18 | **Sales history deeper than ten sales.** [forum/898381](https://www.discogs.com/forum/thread/898381) | recurring | Forbidden (six-hour rule). Popsike lives on it, with eBay data |
| 19 | Seller side: 9 % on item + postage, Persona ID checks, slow pages with big inventories. | frequent | Not addressed; Fidelity is the buyer's side |
| 20 | "All the third-party apps are the same API wrapper." [r/discogs](https://www.reddit.com/r/discogs/comments/1hayw7u/discogs_alternative/) | recurring | Fidelity is not one — which has to be visible from outside |

### 2.2 What Discogs shipped 2024–2026, so it is not rebuilt

| When | What | Consequence |
|---|---|---|
| Jun 2024 | Wantlister acquired: saved searches with price/condition/format/location, real-time mail | Alerts stay off the table |
| Nov 2024 | Collection tool rebuilt: dynamic min/med/max, all folders in the dropdown | Cataloguing stays solved |
| Aug 2025 | *Shop My Wants* replaces *Items I Want*; the seller-count facet removed | Wish #1 got worse, then moved to the app |
| Nov 2025 | App relaunch on both platforms: live prices, barcode scanner, listing notifications; 500k updates on day one | Discogs absorbs what third parties used to sell |
| Apr 2026 | New listing layout; `/sell/item` → `/shop/item` | The basket's paste parser has to read both paths |
| Jun 2026 | *Item Photos*; a personalised app home with **Seller Matches**; native barcode scanner | Seller Matches is raw wantlist overlap, app only, no collection, no reason |
| 2026 | Payment-first checkout; the classic flow only for high-volume sellers who merge orders | Bundling postage matters *more* for buyers — the basket gains value |

No consumer "Discogs Pro" exists. The API is unchanged: 60/25 requests a minute, OAuth 1.0a
or a personal token, no announced deprecations, the image limit still undocumented. The
monthly dumps stalled in Aug–Sep 2024 and have run on the 1st of every month through 2026.

## 3. What would change: a thin server for CC0, a thick client for restricted data

ADR-007 ("no backend") was right for marketplace and user data and, in hindsight, mistook
privacy for asceticism where the catalogue is concerned. The catalogue is CC0, has no
six-hour rule, changes monthly, weighs 10 GB and is the same for every user. Rebuilding it
per user out of the API — the horizon: ~670 requests, twelve minutes, and only as far as
the collection reaches — is elegant and structurally blind to everything outside the
collection. A server that knows only the dump and never sees a token removes exactly that
limit.

Fidelity already has the seams: the hub is optional, `HorizonSource` and
`ShippingProfileSource` are ports, and ADR-005 ends with *"the matching engine queries a
table, not a data source"*. The difference in a second version is that the catalogue hub
would be the default and the local horizon the fallback for self-hosters.

```
Monthly, offline (a cron on the server or a laptop; 10–35 min measured by others):
  data.discogs.com ─▶ dgtools / discogskit ─▶ Parquet ─▶ DuckDB
                                                 │
        precompute:  credits graph        person → release ids (producer, engineer, studio)
                     catalogue runs       label → sorted catno series, gaps
                     master families      master → pressings: country, year, matrix, format
                     identifiers          barcode, matrix/runout → release id
                     entity resolution    artist aliases, group members, sublabel trees
                     style co-occurrence  label ↔ style, artist ↔ style
                                                 │
                                                 ▼
Catalogue hub (stateless, no token, no accounts, CDN-cacheable for 30 days):
  GET /catalogue/artist/{id}/credits      GET /catalogue/label/{id}/run
  GET /catalogue/master/{id}/pressings    GET /catalogue/identify?barcode=|runout=
  GET /catalogue/resolve?artist=string    GET /catalogue/release/{id}   (CC0 fields only)

Client (the PWA, unchanged in principle):
  Discogs API with the user's token, one request in flight, a Web Lock across tabs
  IndexedDB: collection, wantlist, digs, basket, feedback
  Worker: scoring, now against catalogue answers instead of horizon sets
  Fallback: the local horizon when no hub is configured
```

**The rule that does not move:** catalogue from the dump, marketplace from the live API,
never mixed. The dump answers "what is this, who made it, where does it belong". It cannot
answer "what does it cost, who has it, what is it worth", and archiving those out of the
API is the one way to lose the project.

### 3.1 The dump, verified

Four gzip XML files a month under CC0 — on 2026-09-01: artists 474 MB, labels 86 MB,
masters 597 MB, releases 10.5 GB. Unpacked ~70–110 GB; ~18.4 million releases, 9.2 million
artists, 2.5 million labels, 2.3 million masters. Per release: artists with ids and roles,
all labels with catalogue numbers, formats with descriptions, genres, styles, country,
date, notes, tracklist with extra artists, identifiers (barcode, matrix/runout), companies,
`master_id`, `data_quality`. Artists carry aliases, members and name variations; labels
their parent and sublabels.

**Not in it:** listings, prices, sales history, collections, wantlists, have/want counts,
and **no image URLs** — the `<image>` elements carry width and height only, confirmed by
staff ([forum/411182](https://www.discogs.com/forum/thread/411182)). Images are Restricted
Data in the API terms as well.

**Tooling and cost, as reported by their authors:**

| Tool | Path | Measured |
|---|---|---|
| [dgtools](https://github.com/marcw/dgtools) | Go → ndjson / Parquet / Postgres, S3 download | 18.4 M releases → Parquet in 34 min; Parquet 5–13 % smaller than xml.gz |
| [discogskit](https://github.com/jmfontaine/discogskit) | Python → Parquet / JSONL / SQLite / Postgres | 33.8 M records (2026-03 dump) in 34 min, 11 min with unlogged tables, MacBook Air M3 |
| [discogs-load](https://github.com/DylanBartels/discogs-load) | Rust → Postgres | ~15 min for releases on an M1 Air |
| [discogs-xml2db](https://github.com/philipmat/discogs-xml2db) | Python / C# → CSV → SQL | The classic; 43 min in C# for 12.8 M releases |

A full reload is a laptop job. ADR-005 rejected the dump in August 2026 as "grotesquely
oversized for 5–30 users" — true for that audience, and the tools were already this fast.
For a public product the arithmetic flips: the dump is a cron job, the horizon is twelve
minutes of rate-limit budget *per user*.

### 3.2 The layers the dump makes possible

| Layer | From the dump | For Fidelity | Exists already |
|---|---|---|---|
| **Credit graph** | Producer, engineer, mastering, studio, sideman → releases, over 18 M rows | "9 Conny Plank productions, 4 more here" without 11 requests, and beyond the collection (second degree) | Disco/graph (70 M edges, dead), Discogsgrapher; no *buying* product |
| **Catalogue runs** | Label → sorted catalogue-number series | The gap signal for every label, including Blue Note at 5,000 (cut off at 1,500 today) | Nothing |
| **Pressing families** | Master → versions with country, year, format text, matrix, notes; a rule-based original / reissue / boot classifier | M7 with full reach; the trap warning | Nothing public; Record Scanner and VinylAI guess from the cover |
| **Identifiers** | Barcode → release, matrix/runout → release, normalised | In-store lookup over the whole catalogue, without a single image | Discogs' own scanner (app, online) |
| **Entity resolution** | Aliases, name variations, groups ↔ members, label hierarchies | The fuzzy cascade gets a lexicon: "Miss Dinky*" is Dinky | MusicBrainz links; no Discogs product |
| **Taste embeddings** | Co-occurrence artist ↔ label ↔ style ↔ producer as vectors | "Label X sits close to what you collect" for labels not in the collection — the discovery signal that is missing | MTG Discogs-EffNet (audio), Discogs-VI; metadata embeddings only in papers |
| **Scarcity proxy** | Versions per master, age, country, format rarity, `data_quality` | A prior without a request; the real `num_for_sale` stays API | Nothing |
| **Statistics** | Decades, countries, formats, genre correlations (Bogdanov & Serra 2017) | Year in review; the map compared to the whole catalogue | Vizcogs (own collection only) |

## 4. Stack

| Layer | Choice | Why, and what not |
|---|---|---|
| Client | TypeScript, Vue 3 or Svelte 5, Vite, a hand-written service worker, IndexedDB via `idb`, Zod at the boundary | Nuxt today is little more than router and build; a lighter frame saves bundle and layers of configuration. No React (bundle), no SSR (nothing to render that is not private) |
| Catalogue ETL | Go (`dgtools`) or Python (`discogskit`) → Parquet → DuckDB; precomputation as SQL | Measured at 10–35 min a dump. Writing an XML parser in 2026 is wasted time |
| Catalogue hub | One process, SQLite or DuckDB read-only, behind a cache (Cloudflare, Bunny); or Workers + R2 with pre-cut JSON shards | Stateless and monthly: blue/green is "new file, new symlink". No Postgres, no migrations, no backup — the source is the dump |
| User hub | Today's `hub/`: SQLite, push, sharing, vault | Stays. Never sees a token |
| Auth | Personal access token in the client | OAuth is dead under CORS, and a token reads exactly its owner's data. Right, stays |
| Deploy | Static files on a CDN, hubs as arm64 containers | As today |

## 5. Web or app

**A PWA at the core, a Capacitor shell for the stores once the app is public.** Not for
technical reasons — camera, push (iOS 16.4+), offline and storage work as an installed
PWA. For distribution: every competitor lives in the App Store (VinylBox 2.8k ratings,
Record Scanner 2k, Discographic 433), the vinyl-app roundups list apps rather than URLs,
and "Fidelity" is an empty search result there. The shell is cheap because the app is
already built as if it had no network. What would not be built: a native second
implementation. The scoring engine exists exactly once.

## 6. SaaS, PaaS, or neither

A SaaS in the narrow sense — an account, a subscription, all data on our server — is the
wrong shape: it would pull tokens onto somebody else's machine, pool the rate-limit budget
again and create GDPR duties for data the client keeps better. The right shape is
**local-first with a hosted catalogue**: the core runs without us, the hub makes it better.
Obsidian (sync as an add-on) and Keepa (extension free, data paid) have proven the form.

## 7. Business model

The constraint first, soberly. The API terms forbid *"charging a fee to use or access any
part of Your application that integrates with Our API"* without written permission, and
Discogs has never interpreted the clause in public — the one forum question asking got no
reply. A dozen paid apps (Enhancer $3/month, Vizcogs $4/month, VinylBox, Record Scanner)
breach it on a strict reading and have existed for years. The defensible reading: what is
paid for is *computation on CC0 data* — credit graph, pressing advice, statistics — not
access to the API. **Before money changes hands: a letter to Discogs.** It costs nothing
and is the only real insurance.

| Option | Mechanism | Realistic size | Verdict |
|---|---|---|---|
| **Open-source core + hosted catalogue hub** | App free and self-hostable (AGPL, as now). "Fidelity Cloud": catalogue hub, push, sharing, sync. Free up to one watched shop; €2/month, €19/year, **€49 lifetime** | Enhancer: ~10k users at ~$10/year. The niche of serious collectors is perhaps 20–50k people worldwide. 2,000 paying: €30–40k a year. Solo-developer economics, not a venture case | **Recommended.** A lifetime tier is mandatory: collectors hate subscriptions audibly (Enhancer's reviews) |
| **B2B: "Fidelity for shops"** | A shop pays for a fingerprint report on its own stock (its OAuth, its data), buyer-fit statistics, landed-price preview, visibility in discovery. Untappd-for-Business pattern ($899–1,199/year) | Milkcrate.fm has 41 shops. 100 shops × €120: €12k. Small, but the buyer with a budget | Second step. Marketplace data "for commercial purposes" is delicate; only with consent and the shop's own token |
| **Affiliate** | Links to eBay, Juno, Amazon | — | **Forbidden.** The terms ban driving traffic away; Discogs has no affiliate programme; links *into* Discogs are welcome (dofollow required) and pay nothing |
| **Data licensing** | Aggregated taste profiles, shop fingerprints sold to labels or shops | — | **No.** Restricted Data, and it breaks the promise the brand stands on |
| **Exit to Discogs** | MilkCrate (2015) bought for the app, Wantlister (2024) for the alerts | Not a plan; a pattern: what becomes table stakes is bought or rebuilt | An option. It requires that Fidelity ends in Discogs' checkout and raises basket size. It does |

**The honest summary:** Fidelity is a product for a few tens of thousands of people that
makes a good side income and an excellent portfolio piece, not a company. The apps that
have survived in this niche are built exactly that way: one person, a cheap lifetime
price, one feature the platform does not want.

## 8. Hosting

Prices read from hetzner.com on 2026-09-11, incl. 19 % VAT. Verify before ordering.

### 8.1 What each Hetzner product is for

| Product | What it is | Right for | Wrong for |
|---|---|---|---|
| **Webhosting S / M** (€1.90 / €4.90) | Apache, PHP, FTP; 10 / 50 GB; `.htaccess` works | The static PWA as it is today — `deploy/.htaccess` was written for exactly this | The hub: no Node below L, no Docker anywhere |
| **Webhosting L** (€9.90) | Adds SSH, Node.js, Redis; 100 GB | A hub without Docker, if one server is one too many | A 10 GB catalogue under a shared PHP process model |
| **Cloud CAX11** (€7.72: 2 Ampere vCPU, 4 GB, 40 GB NVMe, 20 TB traffic) | A root VM, arm64 | Today's hub and a first catalogue hub, if the precomputed SQLite stays under ~15 GB | Running the ETL on the same disk — 10.5 GB download plus output does not fit beside it |
| **Cloud CAX21** (€13.08: 4 vCPU, 8 GB, 80 GB) | The same, twice | The relaunch: both hubs, two generations of catalogue side by side (blue/green), room for the ETL | — |
| **Cloud CX33** (€10.70: 4 Intel/AMD vCPU, 8 GB, 80 GB) | The x86 twin | The same job €2.38 cheaper | Availability: the cost-optimised Intel/AMD lines showed *nicht verfügbar* at NBG1 and HEL1 on the day; the images are arm64 anyway |
| **Storage Box BX11** (€3.81: 1 TB, SFTP/FTPS/rsync/Borg, snapshots) | A network drive | Nightly backups of the user hub's SQLite and the last three catalogue builds | Serving anything — it is not an HTTP origin |
| **Object Storage** (S3-compatible, FSN1/NBG1/HEL1; base fee includes 1 TB storage and 1 TB egress — the base price renders client-side and was not captured, roughly €6) | A bucket | The artefact store for monthly builds, and public Parquet/JSON shards behind a CDN | A database |
| **Cloud Volume** | Block storage attached to a VM, billed per GB | 50 GB for the ETL's scratch space during the run, detached after | — |

### 8.2 Recommendation

**Today (the proof of concept):** nothing has to move. If the static site needs a home,
Webhosting S is enough and already supported by `deploy/.htaccess`. If the hub needs one,
a CAX11 with Docker is the better deal than Webhosting L: root, the published arm64
image, 20 TB of traffic, and it is where the relaunch would start anyway.

**The relaunch, on Hetzner:**

1. **Static PWA on Cloudflare Pages** (free, global CDN, custom domain) — or on Webhosting S
   with Cloudflare's free proxy in front if everything should stay under one vendor.
   Hetzner has no CDN of its own; for an audience outside Germany that matters more than
   the hosting bill.
2. **One CAX21** for both hubs, Docker, Caddy for TLS. Start on a CAX11 if the precomputed
   catalogue stays small; Hetzner rescales in place (the disk only ever grows).
3. **The monthly ETL** on that machine at night, with a 50 GB volume attached for the run —
   or on the development Mac, with the result pushed. Either way the output is one SQLite
   or Parquet set of ~10 GB, uploaded to Object Storage, pulled by the hub, swapped by
   symlink.
4. **Object Storage** as the artefact store and, optionally, as the origin for per-artist
   and per-label shards the client could fetch directly through the CDN.
5. **Storage Box BX11** for backups: Borg from the hub every night, the last three
   catalogue builds beside it.

Roughly €13 + ~€6 + €3.81 + €0 ≈ **€23 a month**, or ~€17 without Object Storage (shards
served from the VM behind Cloudflare's cache instead). Today's app costs a fraction of that.

**Before renting anything: the home lab.** A machine on the home network with Docker and
Traefik in front can carry both hubs and the monthly ETL for the price of its electricity,
with a real domain through Traefik's Let's Encrypt and a tunnel or a port forward for the
outside. `deploy/compose.yml` already describes the app and the hub as two services; what
would be added is the Traefik labels and the catalogue job. What it does not solve is the
one thing `docs/13` §4 measured: an app served over https cannot talk to a hub on
`http://localhost`, so the home lab needs its public name from the first day — which
Traefik provides. The right order is therefore: home lab first, Hetzner when the home
connection's upload or uptime becomes the limit, and the containers move unchanged.

**Hostinger** was on the table. Its VPS plans are competitive at the introductory price
and are billed higher on renewal; the control panel is built around WordPress and
managed hosting, which this project does not use. What the relaunch needs beside a VM —
S3 storage, a backup box, attachable volumes, arm64, an API and a Terraform provider, a
German data controller for the push subscriptions the hub stores — Hetzner has under one
account, at prices that do not change after the first year. Hostinger's current prices
were not verified for this document; the recommendation does not depend on them.

## 9. Patterns from the apps that work

| Pattern | Example | For Fidelity |
|---|---|---|
| Freemium with a cheap lifetime | Enhancer $3/$10/$50, Vizcogs $4/$40/$150, Groovv $29.99, Spinstack $9.99 once | €49 once, not €2 a month as the only option |
| The portfolio value as the hook | Collectr (4 M users, eight-figure ARR), BrickEconomy, Vizcogs | A local, six-hour-fresh value history is legal and sticky |
| Scan as the funnel | Vivino, Collectr, VinylAI, Record Scanner | Barcode/runout against the dump — CC0, no image download |
| An overlay on the incumbent | Keepa on Amazon, Enhancer on Discogs | The one channel Fidelity lacks; a browser extension would be a second product |
| Consumer free, B2B pays | Untappd for Business, Vivino data licensing, Keepa API | "Fidelity for shops", second step |
| Affiliate first, subscription second | Collectr, Goodreads, Brickset | Closed by the terms |
| A price archive as the moat | Popsike, Keepa | Forbidden for marketplace data; the lawful twin is the reader's own purchase diary — half built in `/saved` |
| Community data, platform-owned marketplace | Discogs (CC0 catalogue, 9 % take), BrickLink (bought by LEGO), TCGplayer (bought by eBay) | Position on what Discogs structurally will not do: collection-first, cross-shop, offline |
| Statistics as the paid feature | Letterboxd Pro, StoryGraph Plus, Key Collector | Year in review from CC0 fields |
| Live selling as a demand signal | Whatnot ($8 B GMV 2025), vinyl category | Buyers want to see the actual copy; Discogs' Item Photos are the answer |

## 10. What was not verified

Stated as such rather than filled in: an alleged 2026 Discogs fee tiering (one vendor
blog, contradicted by Discogs' own pages); the Google Play rating of the Discogs app;
Popsike's archive size; ECDB's $275 M revenue estimate; Hostinger's current prices;
Hetzner's Object Storage base fee. The apps "Kvibe", "Diskogs" and "Vinylize" could not be
found. The domain of the dead "Discogs Wantlist Optimizer" now serves gambling spam and is
deliberately not linked anywhere in this repository.
