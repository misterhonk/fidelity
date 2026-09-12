# 16 – The catalogue service (M21)

> **Status:** concept, nothing built · **As of:** 2026-09-12 · **Decision:** [ADR-013](adr/013-catalogue-service.md)
>
> What the dump makes possible, how it is built once a month, what the service answers,
> how the client uses it without depending on it, and what it costs. `docs/14` §3 was the
> sketch; this is the plan.

---

## 1. The line, first

Two kinds of data, two homes, never mixed:

| | Catalogue | Marketplace and user data |
|---|---|---|
| What | Releases, masters, artists, labels, credits, identifiers, genres, styles, countries, years | Listings, prices, sales, conditions, sellers, collections, wantlists |
| Where from | The monthly CC0 dump | The live API, with the user's token |
| Where it lives | The catalogue service, one file, rebuilt monthly | The browser, IndexedDB, six hours for anything marketplace |
| Who sees it | Everybody; cacheable | The one person whose token fetched it |
| Rule | ADR-013 | ADR-007, rule 4 (six hours), rule 6 (the token) |

The service holds no column the dump does not carry. If a feature needs both halves —
"this listing is one of three pressings, and the cheapest" — the client joins them on the
device, the way it joins the horizon with a listing today.

## 2. What the catalogue answers that the API cannot

Each row names the feature it serves and what stands there today. The "today" column is
the M19/M20 state; the service replaces the *reach*, not the feature.

| Question | Feature | Today | With the catalogue |
|---|---|---|---|
| Every release credited to person P in role R | S8 credit graph | Only people the horizon expanded: artists you own twice, and the credits harvested off your favourites | Second degree: the producer of a record you *do not* own, for every listing |
| Label L's catalogue numbers, sorted, with gaps | S6 catalogue run | Labels under 1,500 releases; Blue Note, Impulse!, Verve, Columbia cut off | Every label, any size |
| Every name artist A goes by | S3 stage 0, the lexicon | Artists you own twice, through `/artists/{id}` | Every artist in the listing, including ones nobody on the shelf has |
| Every pressing of master M: country, year, format, matrix | Pressing advice, the family in the shop | Two requests per record, cached on the hub for a month | Zero requests, the whole catalogue |
| Which release carries barcode B or run-out string X | Identify in the shop | `/database/search`, one request, eight hits for a barcode | An index over 40 M identifiers, normalised, no request |
| How many pressings master M has | Scarcity hint | Only masters the horizon expanded | Every master |
| Genres, styles, decades, countries of the whole catalogue | Year on the shelf, the map | Only the collection itself | "Your seventies share is 3× the catalogue's" |
| Label ↔ style, artist ↔ label co-occurrence | A discovery signal that does not exist yet | — | "Label X sits close to what you collect" (`docs/14` §3.2, last) |

Deliberately **not** answered: anything the dump does not carry. No have/want counts, no
ratings, no images, no prices, no "who sells this".

## 3. The dump

Four gzip XML files, CC0, on the 1st of every month at `data.discogs.com`. Sizes as
measured for 2026-09-01 (`docs/14` §3.1; re-measure before building):

| File | Compressed | Rows | What it carries |
|---|---|---|---|
| `artists.xml.gz` | 474 MB | 9.2 M | name, real name, name variations, aliases, members, groups, profile, urls |
| `labels.xml.gz` | 86 MB | 2.5 M | name, parent label, sublabels, contact, profile |
| `masters.xml.gz` | 597 MB | 2.3 M | title, main release, year, artists, genres, styles, videos |
| `releases.xml.gz` | 10.5 GB | 18.4 M | everything per release: artists with ids and roles, extra artists, labels with catnos, formats with descriptions, genres, styles, country, date, notes, tracklist, identifiers, companies, `master_id`, `data_quality` |

Unpacked, 70–110 GB of XML. Nobody unpacks it: the tools stream. The dump has stalled once
(Aug–Sep 2024) and run monthly since; the job has to cope with "no new file this month" by
keeping last month's build and saying so.

**Licence:** CC0. No attribution required; the app's footer already says "Data provided by
Discogs" and keeps saying it. The terms' Restricted Data clauses are about the API and the
images; the dump carries neither prices nor images.

## 4. The build

Once a month, on the home lab, as a container that runs and exits. Measured by the tools'
own authors, not by us yet: 30–45 minutes for all four files on a laptop-class machine.

```
1. fetch      the four files + checksums → /scratch/dump/2026-09/       (~12 GB, resumable)
2. parse      discogskit → Parquet, one table per entity                 (~10 GB Parquet)
3. shape      DuckDB, SQL only: the tables of §5, sorted and indexed     (~6–8 GB SQLite)
4. check      row counts against last month (±10 % or fail), spot ids
5. publish    /data/catalogue/2026-09.sqlite, symlink `current` → it
6. tidy       keep two builds, delete older; delete /scratch
```

**Why Parquet then SQLite, not DuckDB straight through:** the shaping is set-oriented and
DuckDB does it in minutes; the serving is point lookups by id and `node:sqlite` already
runs in the hub without a native build step. One reader, one writer, no daemon between
them. If a query in §5 turns out to need DuckDB's speed at serving time, the `duckdb` npm
package is the one dependency to add — decided by measurement, not now.

**The tables** (all CC0 fields; ids as in Discogs):

```
release        id, master_id, title, year, country, data_quality
release_artist release_id, artist_id, role (0 = main, else ROLE_TABLE index), position
release_label  release_id, label_id, catno, catno_prefix, catno_num
release_format release_id, name, qty, text, descriptions (json)
release_style  release_id, genre, style
identifier     release_id, type (barcode|matrix|other), value_norm, value
master         id, main_release, year, title
artist         id, name, real_name
artist_name    artist_id, name_norm, name, relation (alias|variation|member|group)
label          id, name, parent_id
label_prefix   label_id, prefix, count            -- the series a label actually has
credit         artist_id, role, release_id        -- the same rows as release_artist, ordered for the person
```

`catno_prefix`/`catno_num` use `parseCatno` from `worker/horizon/pack.ts`, ported to SQL
and pinned by the same golden fixture, or the runs on the two sides disagree.
`value_norm` for identifiers strips spaces, hyphens and case, the way the run-out search
does — measured on 2026-09-11: a full run-out returns one hit, a fragment thousands, and
the index has to make the same distinction.

**Scratch and disk on home-deb:** 12 GB download + 10 GB Parquet + 8 GB SQLite ≈ 30 GB
during the run, 16 GB kept (two builds). 51 GB were free on 2026-09-12; a 50 GB volume for
scratch would make the arithmetic comfortable rather than tight. RAM: DuckDB is happy with
4–8 GB; the box has 16 with 7 free.

## 5. The service

Hono + `node:sqlite`, the hub's shape, its own container `fidelity-catalogue`, read-only on
`current`. Same origin as app and hub — `fidelity.mrtnmlchr.de/catalogue` — so no CORS,
and the client's discovery can find it the way it finds `/hub`.

```
GET /v1/catalogue/health                      → { ok, build: "2026-09-01", releases: 18412345 }
GET /v1/catalogue/artist/{id}                 → { id, name, names: [{name, relation}] }
GET /v1/catalogue/artist/{id}/credits?role=   → { role, releaseIds: [...], total }      ← S8, second degree
GET /v1/catalogue/label/{id}/run?prefix=      → { prefix, numbers: [...], releaseIds }   ← S6, any size
GET /v1/catalogue/master/{id}/family          → PressingFamilyFacts                       ← the shop screen, 0 requests
GET /v1/catalogue/master/{id}                 → { id, year, mainRelease, pressings }      ← scarcity, for every master
GET /v1/catalogue/release/{id}                → the CC0 fields of §4's `release` row and its joins
GET /v1/catalogue/identify?barcode=|runout=   → { releaseIds: [...], exact: bool }        ← the shop, no search request
GET /v1/catalogue/resolve?artist=string       → { artistIds: [...] }                      ← the lexicon for every listing
GET /v1/catalogue/stats/decades|styles|countries → the catalogue's own distribution         ← the map, compared
```

Every answer carries `ETag: "2026-09-01"` and `Cache-Control: public, max-age=2592000`.
The proxy (Traefik, later a CDN) may cache everything; the service has nothing to
invalidate — a new build is a new ETag. No secret: it is public data. Rate limit at the
proxy, the same middleware the hub has, because a public endpoint on a home connection is
an invitation.

**Size of an answer:** a credits list for a busy producer is a few thousand ids — 20 KB.
A label run is a few hundred numbers. `identify` is a handful of ids. Nothing here is a
page of prose; the wire stays the wire format of `shared/wire.ts` where the horizon
already uses it (packed ids, base64), so a catalogue answer can be *stored as a horizon
chunk* — which is the trick that keeps the engine unchanged.

## 6. The client: one port, the horizon behind it

```ts
// shared/ports.ts
export interface CatalogueSource {
  build(): Promise<string | null>                          // null = no catalogue configured
  artist(id: number): Promise<CatalogueArtist | null>
  credits(id: number, role: string): Promise<HorizonChunk | null>
  run(labelId: number, prefix: string): Promise<HorizonChunk | null>
  family(masterId: number): Promise<PressingFamilyFacts | null>
  identify(q: { barcode?: string; runout?: string }): Promise<number[]>
  resolve(name: string): Promise<number[]>
}
```

Where each consumer plugs in, and what it does without the catalogue:

| Consumer | With the catalogue | Without |
|---|---|---|
| `horizon/build.ts` | Asks the catalogue for each candidate before the API; a hit is stored as a chunk with `source: 'catalogue'` and never revalidated (the build date is the validity) | As today: hub, then API |
| `match/index.ts` lexicon | `resolve` for listing artists the map does not know, batched per dig, cached per dig | The lexicon of expanded artists only |
| `pressing-family.ts` | `family` first, then hub, then API | Hub, then API |
| `identify.ts` | `identify` first; the API search only when the catalogue has no build | The API search |
| `collection/review.ts`, the map | `stats` for the comparison line; the section is absent without it | No comparison line |
| Signals S6, S8 | Chunks for labels of any size and for people in the second degree — fetched *per dig* for the listing's labels and credited people, bounded, cached | Only what the collection reaches |

The last row is the one that changes what a dig costs: today a dig makes zero catalogue
lookups because the horizon was built beforehand. With the catalogue, a dig may ask for
labels and people it meets in the listing — a few dozen lookups against a service on the
home network, milliseconds each, cached for a month. Bounded at, say, 200 per dig, and
the dig says how many it asked for, the way it says how many API requests it spent.

**Rule 8, spelled out for the catalogue:** the engine's `buildIndex` takes chunks; it does
not know whether a chunk came from the API, the hub or the catalogue. The golden test runs
with the fixture chunks as it does now. A second golden test runs the same dig with
catalogue chunks and pins that the *scores* are identical where both have the data — the
catalogue may add hits, never move a score.

## 7. Where it runs

The home lab, beside the hub, as the fourth service in `compose/home-deb/fidelity.yml`:

```
fidelity-catalogue   image: ghcr.io/misterhonk/fidelity-catalogue:latest
                     volumes: $DOCKERDIR/appdata/fidelity-catalogue:/data:ro
                     labels:  Host(`fidelity.…`) && PathPrefix(`/catalogue`), chain-fidelity-hub (rate limit + strip)
fidelity-catalogue-build   image: ghcr.io/misterhonk/fidelity-catalogue-build:latest   (profile: build)
                     volumes: /data (rw), /scratch (a 50 GB volume)
                     run:     docker compose run --rm fidelity-catalogue-build   — monthly, by cron or by hand
```

The Uberspace has neither the disk nor Docker; the catalogue never goes there. Hetzner
stays what `docs/14` §8 said: the step after the home connection's upload or uptime
becomes the limit, and the containers move unchanged.

**Monitoring:** `health` reports the build date; Uptime Kuma, which the home lab already
runs, watches it and alerts when the date is older than 40 days — the one failure mode
that looks like success.

## 8. What it costs, and what it saves

| | Today | With the catalogue |
|---|---|---|
| First-time setup per user | ~670 API requests, 12 minutes | The same, minus every entity the catalogue answers — for a new user with a hub and a catalogue: seconds |
| Pressing family in the shop | 2 requests (1 with a hub hit) | 0 |
| Identify in the shop | 1 request | 0 |
| Labels above 1,500 releases | not covered | covered |
| Credits beyond the collection | not covered | covered |
| Disk on home-deb | 0 | ~16 GB kept, ~30 GB during a build |
| Monthly work | none | one job, unattended, with an alert when it does not run |
| New dependency in the app | none | none — the port is TypeScript, the wire format exists |
| New dependency in the build | — | `discogskit` (Python) or `dgtools` (Go), and DuckDB |

## 9. Phases

Each phase ends green and shippable on its own; none of them changes a score.

| Phase | Delivers | Proof |
|---|---|---|
| **M21.1 The seam** | `CatalogueSource` in `shared/ports.ts`, `catalogueUrl` in the preferences, discovery at `<origin>/catalogue`, the settings line, and a CI run with the URL empty | The existing suites unchanged; a new test that every consumer falls through to today's path with no catalogue |
| **M21.2 The mini-dump** | A frozen fixture: ~300 releases, their artists, labels, masters, cut from a real dump, checked in (a few MB) | The ETL runs on it in CI in seconds; golden tests for `parseCatno` in SQL and the identifier normalisation |
| **M21.3 The build** | The ETL container, the six steps of §4, the two-generation swap, the health date | A full run on home-deb, timed and sized; the numbers replace the estimates in §4 and §8 |
| **M21.4 Two routes** | `family` and `artist` — the two the app already asks the API for | The shop screen reads a pressing with zero requests; the lexicon covers a listing's artists |
| **M21.5 The signals** | `credits`, `run`, per-dig lookups with the bound, the second golden test | A dig at a Blue Note specialist fires S6; a producer you own nothing by fires S8 |
| **M21.6 The shop and the map** | `identify`, `stats`, the comparison line in the year on the shelf | Barcode and run-out without a search request; "3× the catalogue's" on the map |
| later | `resolve` for every listing artist, co-occurrence, shards behind a CDN | when there are users to serve |

M21.1 and M21.2 are days and touch no server. M21.3 is the first weekend with the home
lab. M21.4 is where the first user notices something.

## 10. Risks, and what answers them

| Risk | Answer |
|---|---|
| The dump changes shape or stalls | The parser is at the boundary and versioned per build; a missing month keeps the old build and the health date says so; Uptime Kuma alerts after 40 days |
| The build fills the disk | A dedicated scratch volume, deleted after the run; two generations kept, never more; row-count check before publish |
| Somebody depends on the catalogue after all | The CI run with the URL empty, and the second golden test that pins scores |
| The public endpoint is abused | Traefik's rate limit; nothing here is expensive to answer; if it becomes a problem, a CDN in front and shards |
| The home connection's upload | A credits answer is 20 KB; a dig's worth is a few hundred KB; the app already streams covers from Discogs, which is more |
| A catalogue answer carries something the terms restrict | It cannot: the service has no column the dump does not carry, and the dump is CC0 |

## 11. Not verified

Stated rather than guessed: the tools' timings are their authors' on their hardware, not
ours on home-deb; the SQLite size is an estimate from row counts, to be replaced by the
first real build; whether `node:sqlite` serves the credits queries fast enough or DuckDB
has to answer them; and this month's file sizes, which the bucket did not list on
2026-09-12 — `docs/14` §3.1 carries the last measurement.
