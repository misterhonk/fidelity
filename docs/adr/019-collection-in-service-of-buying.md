# ADR-019 – Collection management, in service of buying

**Status:** Accepted
**Date:** 2026-11-02

## Context

"Collection cataloguing" has stood under *Deliberately not built* in `docs/00` §8 and
under *Not on the roadmap* in `docs/06` since the first draft: "a dozen apps, a solved
problem". That was right about cataloguing as a product — scanning, browsing, play logs,
shelf photos. Groovv, CLZ, My Vinyl+ and the rest do it well (`docs/15`), and Discogs is
the catalogue they all mirror.

It is no longer right about the four facts a buyer needs about the records already at
home, which the app keeps meeting on its way to the next purchase:

- **Where it stands.** Places (M12, ADR-015) already exist, local and in the vault,
  because Discogs has no field for them.
- **What is wrong with it.** "The B-side crackles in the last track" decides whether a
  second copy is an upgrade. The grade alone does not.
- **What it cost.** Whether €40 for another pressing is sane depends on what the first
  one cost — and that is the one number nobody else has.
- **When it arrived.** The year in review and the shop's grading record (M14) both read
  it; today it exists only for copies bought through the shortlist.

Discogs stores exactly three fields beside a copy — media condition, sleeve condition,
notes (`GET /users/{u}/collection/fields`, measured 2026-09-11) — and has no change date
on a collection entry (CLAUDE.md, measured 2026-08-12). It cannot hold the four.

Gatefold (M41) needs them. This ADR draws the line before any of its code is written.

## Decision

**Sleeveside keeps a small set of its own fields beside a copy you own, in service of
buying. It does not become a catalogue.**

1. **Discogs stays the source of truth** for what is in the collection: which copies,
   in which folder, with which rating and which of Discogs' own three fields. The mirror
   (`db/collection.ts`) is rebuilt from Discogs; writes go back through ADR-011's outbox.
   Sleeveside never adds, removes or moves a copy that Discogs does not know about, and
   never keeps a second list of records.
2. **Sleeveside's fields hang off `instanceId`** and are exactly these:
   - **place** — the existing placement (M12), unchanged;
   - **condition note** — free text, the buyer's own words;
   - **paid price** — integer cents plus currency, **typed by the user**;
   - **arrival** — the date the copy came into the house.

   A fifth field needs this ADR amended.
3. **Local and vault.** They live in IndexedDB, travel in the JSON backup and in the
   vault (`SYNCABLE_STORES`, merged by their timestamp, tombstones instead of deletions),
   never to the hub in clear, never to Discogs. A copy that leaves the Discogs
   collection keeps its row as a tombstone; the fields are the buyer's own and are not
   thrown away by a sync.
4. **Never the order's price.** The order import (`worker/orders.ts`, ADR-017) still
   drops `price`; the guard test that forbids it stays. A paid price exists only when a
   person typed it. Pre-filling it from the order would be the price archive
   `docs/09` §1.3 rules out, one row at a time — and it would not even be right, since
   the order price is per item before postage, tax and the shop's discount.
5. **In service of buying.** Each field earns its place by feeding a decision about the
   next record: the find's sheet ("you paid €18 for yours, NM sleeve, crackle on B4"),
   the upgrade signal, the basket's sense of price, the shop's grading record. A field
   that only describes the shelf for its own sake is cataloguing and stays out.

**Why not Discogs' Notes field for the condition note.** It is one free-text field per
copy, shared with every other app and with the person's own habits. Writing a structure
into it would overwrite what they keep there, and reading one back out of it would parse
somebody else's prose. The note is ours; Discogs' Notes stays theirs and is shown as it is.

## Alternatives

- **Keep the "not built" row.** Rejected: places already broke it in M12, and the
  find's sheet cannot answer "is this an upgrade?" without the other three.
- **Write everything into Discogs' Notes field.** Rejected above.
- **A full catalogue — custom fields, photos, play log, loans.** Rejected: that is the
  dozen apps, and `docs/06` *Not on the roadmap* keeps naming them.
- **Take the paid price from the order.** Rejected: ADR-017 and `docs/09` §1.3.

## Consequences

- `docs/00` §8 and the `docs/06` row change from "not built" to "only this, see
  ADR-019"; cataloguing as a product stays off the roadmap.
- One new store (or new fields on the placement row) keyed by `instanceId`, in the vault
  and the backup; a schema bump and a merge stamp in `worker/vault/merge.ts`.
- Money is integer cents (CLAUDE.md); the currency is the one typed, never converted.
- Zero requests: none of the four fields costs a Discogs call.
- The way out: drop the store. Discogs still holds the collection, and nothing it
  knows was ever changed by these fields.
