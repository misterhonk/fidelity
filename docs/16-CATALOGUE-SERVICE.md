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
1. fetch      `fetch.ts`: the four files + CHECKSUM.txt → /scratch/dump/<date>/, each
              hashed on the way down and held against the checksum file; a whole file
              already there is not fetched twice (~12 GB)
2. build      `build.ts`: stream each file, shape, insert; each dump file is deleted
              the moment its rows are in, so the disk never holds download and file
              at full size together
3. check      row counts against last month (±10 % or refuse) — part of the build
4. publish    /data/<build>.sqlite, then `current` → it by renaming a fresh symlink over
              the old one: a reader opens the old file or the new one, never half of either
5. tidy       keep two builds, delete older; delete /scratch/dump
```

All five are `run.ts`, the job in the `fidelity-catalogue` image (M21.3): it runs once a
day, and a day on which the listing shows no newer month than `current` is "current is
still 2026-09-01" in `status.json` and nothing else. `status.json` also carries the last
run's outcome, seconds, bytes and row counts — the health date until the service (M21.4)
answers it over HTTP. `CATALOGUE_ONCE=1` runs once and exits; `CATALOGUE_DATE` pins a
month; `CATALOGUE_OFFLINE=1` builds from files already in the scratch dir.

**Changed at M21.2 (2026-09-12): one stream, no warehouse.** The plan above had
discogskit → Parquet → DuckDB → SQLite. Writing the shaping showed it is row-local — one
entity becomes its own rows and nobody else's — and a row-local job wants a stream, not a
set engine. The build is TypeScript on bare Node: `sax` streams the gzip, `shape.ts` turns
each entity into rows, `node:sqlite` takes them ten thousand entities per transaction,
indexes come after the load. The one set-oriented step, the label prefixes, is a GROUP BY at
the end. That removes two tools, a second language and the "ported to SQL" clause below —
`parseCatno` and `norm` are the app's own functions, copied, and a test in the root suite
(`tests/unit/catalogue-twins.spec.ts`) runs both copies over the mini-dump's real values.

Measured on 2026-09-12 on a laptop: the reader streams masters, artists and labels
(1.2 GB gzip, 9.2 M + 2.3 M + 2.5 M entities) in 2 min 40 s; the mini-dump builds in
0.26 s. Extrapolated, the releases file is 20–30 minutes of parsing plus the inserts — a
night at most, and M21.3 measures it on home-deb. If it is more than a night, DuckDB is the
fallback and only `build.ts` changes.

**The tables** (all CC0 fields; ids as in Discogs):

```
release        id, master_id, title, year, country, data_quality
release_artist release_id, artist_id, role (0 = main, ROLE_TABLE index, -1 = unnamed), role_name, position
release_label  release_id, label_id, catno, catno_prefix, catno_num
release_format release_id, name, qty, text, descriptions (json)
release_style  release_id, kind (genre|style), name
identifier     release_id, type (barcode|matrix|other), value_norm, value
master         id, main_release, year, title
artist         id, name, real_name
artist_name    artist_id, name_norm, name, relation (self|alias|variation|member|group), other_id
label          id, name, parent_id
label_prefix   label_id, prefix, count            -- the series a label actually has
meta           key, value                         -- build date, row counts
```

`credit` is an index on `release_artist (artist_id, role, release_id)`, not a second copy.
Three columns the first real cut asked for: `role_name` keeps the dump's credit string
("Written-By, Producer") next to the strongest table index it maps to, so a credit the
table has no name for is still a row; `release_style` carries genres and styles as
(kind, name) rows; `artist_name` has a `self` row and the other artist's id, so the lexicon
is one query. `<master_id>0</master_id>` is "no master".

**What the first full run taught (2026-09-12, home-deb):** the download ran at
30 MB/s — the four files in six and a half minutes — and the build died 90 seconds into
the releases file on a `<label>` without an `id`: a name typed on a release that never
became a database entry. The cut of 400 releases had none. Labels and credits without an
id are strings, not joins, and are skipped; a single entity the database refuses is logged
and skipped too, and only more than one in a thousand fails the build. The dump files stay
in the scratch dir after a failure, hashed, so the next run fetches nothing.

`catno_prefix`/`catno_num` come from `parseCatno`, the app's function copied, and
`name_norm` from `norm`, likewise — the twin test above holds them together. `value_norm`
for identifiers strips spaces, hyphens and case, the way the run-out search does — measured
on 2026-09-11: a full run-out returns one hit, a fragment thousands, and the index has to
make the same distinction.

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

**Implemented (M21.4, 2026-09-12):** `health`, `master/{id}/family` and `artist/{id}` in
`catalogue/src/service/app.ts`, served by `server.ts` from `/data/current` read-only —
the server follows the symlink once a minute, so a new build arrives without a restart.
A family is every release with that `master_id`, oldest first, capped at 200, with the
first label and the first format written the way the API writes them; `fetchedAt` is the
build date, so the client's month-freshness rule reads it as this month's. A person is
every `artist_name` row but `self`, variations and aliases both as `alias`, capped at 100
— `kinOf`'s shape.

**M21.5 (2026-09-12):** `label/{id}/run` and `artist/{id}/credits`, as rows rather than
packed chunks: `[releaseId, year, catnoNum, catnoPrefix]` for a label, the series rows first
and capped at 20,000; `[releaseId, role, year]` for a person, one row per release with the
strongest table role, a credit the table has no name for counted as main exactly as the API
path does. The client packs both with the app's own `packChunk` — one packer, so the dump's
run and the API's run are the same bytes for the same rows — and `horizon/build.ts` asks
the catalogue per candidate before the hub and the API: a label of any size, a person's
whole credit list, a master's versions, for zero requests. The second golden test
(`tests/unit/golden-catalogue.spec.ts`) runs the golden dig with every chunk arriving
through the catalogue and pins the ranking identical to the API-built one, score for score.
The per-dig lookups for labels and people the horizon does not know wait for `resolve`,
because a listing carries names and not ids. The other routes come with their consumers.

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

The home lab, beside the hub, in `compose/home-deb/fidelity.yml` — one image, two
services, the same `/data` (M21.3, 2026-09-12):

```
fidelity-catalogue-build   image: ghcr.io/misterhonk/fidelity-catalogue:latest   (M21.3)
                     command: the default — run.ts, daily, builds when a new month appears
                     volumes: $DOCKERDIR/appdata/fidelity-catalogue/data:/data
                              $DOCKERDIR/appdata/fidelity-catalogue/scratch:/scratch
                     network: the default bridge — it needs data.discogs.com and nothing needs it
fidelity-catalogue   image: the same                                             (M21.4)
                     command: the service, read-only on /data/current
                     labels:  Host(`fidelity.…`) && PathPrefix(`/catalogue`), chain-fidelity-hub (rate limit + strip)
```

No cron: the job is a container that stays up and looks once a day, which is visible in
`docker ps` and needs nothing outside compose. The home lab's disk is one 99 GB volume
with 50 GB free (measured 2026-09-12), not the separate 50 GB scratch volume planned
above — enough because the job deletes each dump file as soon as it is loaded and keeps
two builds; a third generation or a second service on the box would call for the volume.

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
| **M21.1 The seam** · done 2026-09-12 | `CatalogueSource` in `shared/ports.ts`, `catalogueUrl` in the preferences, discovery at `<origin>/catalogue`, the settings line, and a CI run with the URL empty | The existing suites unchanged; a new test that every consumer falls through to today's path with no catalogue |
| **M21.2 The mini-dump** · done 2026-09-12 | `catalogue/`: the streaming reader, the shaping, the build; `fixtures/mini-dump` — 400 releases, 336 masters, 180 labels, 731 artists cut from the dump of 2026-09-01, 660 kB | The ETL runs on it in CI in 0.3 s (19 tests); golden files for every catalogue number, identifier, credit string and name in it; the twin test in the root suite |
| **M21.3 The build** · image and job 2026-09-12, full run pending | `fetch.ts`, `run.ts`, the `fidelity-catalogue` image and the compose service: the five steps of §4, the two-generation swap, `status.json` as the health date | A full run on home-deb, timed and sized; the numbers replace the estimates in §4 and §8 |
| **M21.4 Two routes** · done 2026-09-12 | `family` and `artist` in the service; `familyFacts` and the horizon's artist expansion ask the catalogue first; the service in the image beside the job, at `/catalogue` on the home lab | 34 catalogue tests; the app's twin tests; a pressing family and a person's names with zero requests once the URL is set |
| **M21.5 The signals** · done 2026-09-12 | `credits` and `run` as rows, packed by the app's `packChunk`; the horizon build asks the catalogue per candidate first — labels of any size, a person's whole credit list, a master's versions; the second golden test | 37 catalogue tests; the golden dig through the catalogue ranks identically; per-dig lookups for names the horizon does not know wait for `resolve` |
| **M21.6 The shop and the map** | `identify`, `stats`, the comparison line in the year on the shelf | Barcode and run-out without a search request; "3× the catalogue's" on the map |
| later | `resolve` for every listing artist, co-occurrence, shards behind a CDN | when there are users to serve |

M21.1 and M21.2 were a day each and touched no server. M21.3 is the first weekend with the
home lab. M21.4 is where the first user notices something.

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
