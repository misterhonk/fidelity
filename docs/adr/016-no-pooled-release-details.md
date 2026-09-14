# ADR-016 – The hub does not pool release details

**Status:** Accepted
**Date:** 2026-09-14

## Context

The hub already pools one thing that came from the live API: **cover addresses**
(`worker/covers.ts`, `hub.covers` / `contributeCovers`). A cover costs one `/releases/{id}`,
the answer is identical for everybody, and a sleeve does not change — so a dozen of them are
one round trip instead of a dozen requests and fifteen seconds.

Since 2026-09-13 that same request brings back the whole release: tracklist, credits,
run-out, genres and styles, notes, and the `videos[]` the audio preview plays
(`storeReleaseDetail`). It is filed and never asked for again. The obvious next thought was
to pool **that** the way the covers are pooled — one device fetches a record, everybody on
that hub has it.

The question this settles is whether that is allowed, and whether it is worth anything.

## What the CC0 dump actually contains — measured 2026-09-14

Against the real mini-dump in `catalogue/fixtures/mini-dump` — four hundred releases cut
from `discogs_20260901_releases.xml.gz`, not a hand-picked one:

| | of 400 |
|---|---|
| carry a `<tracklist>` | **400** |
| carry `<videos>` | **362** |
| carry `<identifiers>` (run-out, barcode) | **316** |

Every one of them has its tracklist; nine in ten have the clips. For comparison, the sample
ADR-012 ran against the live API in September was five of seven with videos — the dump is
not a thinner copy of the API here, it is the same thing.

Field by field, against release 1:

| Field the sheet shows | In `discogs_*_releases.xml.gz` |
|---|---|
| Tracklist, with position, title and duration | ✅ `<tracklist>` |
| Credits with roles | ✅ `<extraartists>` with `<role>` |
| Genres and styles | ✅ `<genres>`, `<styles>` |
| Labels and catalogue numbers, formats, country, year | ✅ |
| Run-out and barcode | ✅ `<identifiers>` |
| Notes | ✅ `<notes>` |
| **The clips** | ✅ `<videos src="https://www.youtube.com/…">` |
| **The sleeve** | ❌ — `<images>` carries no address |
| Marketplace numbers, condition, price | ❌ — not in the dump at all |

So **everything a record's sheet says about the record is CC0**, and Discogs gives it away
by the gigabyte, monthly, with no rights reserved. The two things that are not in there are
exactly the two the live API exists for here: the sleeve and the market.

## Decision

**The hub pools cover addresses and nothing else. Release details are not pooled.**

Three reasons, in the order that decided it.

**1. There is nothing to pool that is not already free.** Pooling is worth doing when it
saves somebody a request for a fact only the API has. For a tracklist that is not the case:
the same tracklist is in a file anybody may download and redistribute without conditions.
A hub passing around API-derived copies of CC0 facts would take on the storage clause and
the six-hour rule to obtain something that carries neither.

**2. It would break the project's most important rule.** `docs/01-ARCHITECTURE.md` §1:
catalogue from the dumps, marketplace from the live API, **never mix them.** A pooled
release detail is API data in the place where CC0 data belongs, and once mixed nothing
downstream can tell which half it is holding — including the six-hour rule, which applies to
one half and not the other.

**3. The saving is small, because the cover pass already brings it.** Opening a record whose
cover was fetched costs nothing today: the cover request filed the whole answer. What is
left is the record *below* the cover window — one request, once, kept for ever. Pooling that
would trade a well-understood rule for a request a reader makes a handful of times a
session.

**Covers stay pooled** and the difference is the point: an address is not in the dump, it is
the same for everybody, and it is the one thing here the API is genuinely the only source of.

## Consequences

- `worker/covers.ts` keeps `hub.covers` and `contributeCovers`. Nothing changes today.
- A hub endpoint for release details is not to be added. A future one would need this ADR
  superseded, not extended.
- **If the tracklist below the cover window ever matters enough**, the lawful route is the
  catalogue, not the hub: `catalogue/src/etl` already reads this very file and already keeps
  `release_artist.role_name`, `release_style` and `identifier` from it. Adding `<tracklist>`
  and `<videos>` is an ETL column and a service field, it is CC0, and it needs no new
  agreement with anybody. That is a catalogue milestone if somebody wants it, and it is not
  this decision.
- The rule that follows for anything pooled in future, in one line: **pool what only the API
  has and what is the same for everybody.** Cover addresses pass; tracklists do not; prices
  never could.
