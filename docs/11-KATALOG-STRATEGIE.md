# 11 – Catalogue strategy: a horizon instead of a full dump

> **Decision:** the 10.4 GB releases dump is **not** needed.
> Instead we build a **horizon** on demand — the subset of the Discogs catalogue that is
> relevant to *this user*.
> Supersedes the original approach in ADR-005.

---

## 1. The error of thinking in the first design

The original reasoning went:

> "An inventory listing carries no `master_id`, no genres, no credits. So we have to look
> up the metadata for each of the 10,000 listings. That costs 10,000 requests ≈ 3 hours. So
> we need the full dump."

The error is in "for each listing". **The direction of the query was the wrong way round.**

```
WRONG:  10,000 inventory listings  →  1 request each  →  metadata
        expensive, volatile, redone every dig

RIGHT:  ~150 entities from MY collection  →  1–11 requests each  →  sets of release ids
        once, long-lived, and every dig after that is a free set intersection
```

My collection is small (2,412 records, 418 artists, 197 labels) and changes slowly. The
inventory is large and changes constantly. **You cache the small, stable side — not the
large, volatile one.**

---

## 2. Verified live against the API (2026-08-09)

### `GET /artists/{id}/releases` returns a `role` field

```
GET /artists/40135/releases?per_page=100    (Conny Plank)
→ 1,095 entries · 11 requests · no page limit

Role distribution on page 1:  { Main: 13, Remix: 11, Producer: 76 }
Types on page 3:              { master: 72, release: 28 }
```

**That is the decisive find.** The endpoint returns not only the albums somebody is the main
artist on but **also the ones they produced, mixed or remixed** — with the role stated
explicitly.

That puts the **credit graph (signal S8) within reach without a dump.** Eleven requests for
Conny Plank's complete works. After that, "does this dealer have a Conny Plank production I
am missing?" is a `WHERE release_id = ANY(...)` — zero extra requests, however often it is
asked.

### `GET /masters/{id}/versions` returns every pressing

```
GET /masters/2598/versions?per_page=100     (Neu! – Neu! 2)
→ 55 pressings · 1 request

release_id 29630659 · Germany · 1973 · brain 1028
release_id  2248441 · France  · 1973 · 6499 591
release_id  1086110 · UK      · 1973 · UAG 29500
   …
```

That puts **signal S2 (a different pressing) within reach without a dump.** One request per
wantlist album, once.

---

## 3. The horizon

After the collection sync the app works out which entities are relevant to the user and
expands them into sets of release ids.

| What | Selection criterion | Endpoint | Requests |
|---|---|---|---|
| **Wantlist albums** | all with `master_id ≠ 0` | `/masters/{id}/versions` | ~1 per album |
| **Artists** | ≥ 2 records in the collection | `/artists/{id}/releases` | 1–11 per artist |
| **Labels** | lift ≥ 2 **and** < 1,500 releases | `/labels/{id}/releases` | 1–15 per label |
| **Credits** | people with lift ≥ 3 in the collection | `/artists/{id}/releases` | 1–11 per person |

### The cost for a real collection (2,412 records)

| Item | Entities | Requests |
|---|---:|---:|
| Wantlist masters | 184 | ~190 |
| Artists with ≥ 2 records | ~80 | ~210 |
| Labels with lift ≥ 2, small enough | ~30 | ~160 |
| Producers/engineers with lift ≥ 3 | ~20 | ~110 |
| **Total, once** | ~314 | **~670 ≈ 12 minutes** |

After that only deltas: a new record in the collection → 1–11 requests.
Routine revalidation: 30 days, staggered, ~20 requests a day.

**For comparison, the dump route:** a 10.4 GB download, ~110 GB of unpacked XML, hours of
parsing, a ~6 GB database, 1.5–3 GB of rsync — **every month.**

---

## 4. How a dig runs afterwards

```
Before (the dump approach):
  fetch the inventory → look each listing up in a 20-million-row catalogue

Now (the horizon, in the browser):
  fetch the inventory → horizonIndex.get(listing.releaseId)
                        one map lookup in O(1) over a few hundred thousand ids
```

Both routes cost **zero extra API requests per dig**. The difference is purely in how the
lookup table came to exist.

### The master/release two-step

`/artists/{id}/releases` returns `type: "master"` and `type: "release"` mixed. Master
entries carry `main_release`. The procedure:

1. **Stage 1 – free:** `main_release_id` and every direct `release` id into the horizon.
   That covers the main pressing.
2. **Stage 2 – on demand:** if an inventory listing does *not* hit but plausibly belongs
   (same artist name, similar title), the master is expanded afterwards via
   `/masters/{id}/versions` — **one** request, and it is in the horizon permanently.

The second stage runs asynchronously after the dig. So the horizon gets a little better with
every dig. That is a feature, not a workaround.

---

## 5. What you lose by this – honestly

| Limitation | Effect | Assessment |
|---|---|---|
| **Large labels cannot be expanded** | RCA has 186,808 releases = 1,869 requests | Does not matter. Completism at majors makes no sense — the signal aims at Brain, Ohr, Blue Note, ECM. A hard limit: 1,500 releases, above which no `CATALOG_RUN`. |
| **The credit graph reaches only as far as the collection** | "All of Conny Plank's second-degree collaborators" is not possible | Does not matter for the core function. That would be an exploration feature, not a buying advisor. |
| **No global `release → master` index** | A listing outside the horizon stays unresolved | Exactly right. A release outside your horizon is by definition not a recommendation. |
| **First-time setup takes ~12 min** | Eats the shared 60/min budget | Once, in the background, with a progress display. With several users, staggered overnight. |
| **Genres/styles per listing are still missing** | S7 only for releases in the horizon | Acceptable — at weight 30, style adjacency is the weakest signal anyway. |
| **ToS: API data instead of CC0** | Formally the six-hour rule applies to all API content | See §7. Arguable, but not as unambiguous as CC0. |

---

## 6. What you gain

- **No 10.4 GB download, no 110 GB parse, no monthly maintenance appointment**
- **Instead of ~6 GB on a server, only ~1.4 MB in the user's browser** — packed as
  `Int32Array` parallel arrays, see `03-DATENMODELL.md` section 4
- **M5 is no longer a lump** but an ordinary milestone. Which moves the five expensive
  signals closer to M2
- **The horizon grows with use** instead of going stale every month
- **No XML streaming parser**, no `pg_dump`/rsync dance, no blue/green schema rotation
- **The data is fresher than a monthly dump**

---

## 7. ToS assessment

By its wording the six-hour rule applies to all API `Content`. So we deliberately move like
this:

- **Only sets of ids and edges are stored** — `artist_id → release_id + role`. No titles, no
  images, no prices, no conditions. That is not displayable content but an index over public
  facts.
- **Everything displayable comes fresh** from the inventory listing of the same dig (title,
  artist, label, catalogue number, price, condition) and expires after 6 hours via
  `app.dig.expires_at`.
- **Revalidation every 30 days** keeps the edges current.
- The same facts are freely available as a **CC0 dump** — we merely fetch them by another
  route.

> **The fallback, should this ever be challenged:** the three *small* dumps
> (`artists.xml.gz` 472 MB, `labels.xml.gz` 86 MB, `masters.xml.gz` 593 MB, 1.15 GB
> together) are CC0 and supply artist and label master data including aliases, name variants
> and sublabel hierarchies. They do not replace the edges, but they cover the master data
> cleanly. The **releases** dump stays out in any case.

---

## 8. When the full dump does make sense after all

Do not be dogmatic. The dump route becomes interesting again with:

- **several hundred users** — then a shared global index amortises against many individual
  horizons
- **exploration features beyond your own horizon** ("show me every krautrock producer of the
  seventies, regardless of what I own")
- **offline analyses** across the whole catalogue
- **plenty of disk** — on a VPS with 40 GB the dump route is no longer a problem

It would then be an **additive** decision: the horizon stays, the global index slides
underneath. Nothing in the matching engine has to change for it — it queries a table, not a
data source.
