# ADR-015: Places are a wall — furniture with compartments, rules instead of slots

**Status:** Accepted · **Date:** 2026-09-12
**Relates to:** M19 (places), ADR-012 (vault) · **Concept:** `docs/18-PLACES.md`

## Context

M19 gave a record a place: a name in a tree, a row per copy, merged through the vault. It
answered "cellar or living room" and nothing finer, and the request that followed was the
obvious one: *I want to see which records are in the living room, and I want my Kallax as
a wall I can look at, fill and re-sort.* The question was what a place should be so that
the wall is real without becoming a chore.

## Decision

**A place has a kind: room, furniture, compartment.** Furniture carries a grid and is
created with its compartments in one transaction from a preset; compartments are ordinary
places named by their coordinate, read from the front like a spreadsheet (A1 top left). A
unit may stand without a room.

**The smallest named thing is the compartment.** No slot inside it: nobody maintains
positions, and a model that tracks them is wrong within two weeks. Inside a compartment a
**rule** applies (alphabetical by artist, by label, by year), which the app uses to propose
where a record goes and to write the dividers — and which never moves a record by itself.
An explicit placement always wins. Capacity is an estimate and a fill level, not a lock.

**Everything M19 had keeps working.** Old rows are rooms; placements are unchanged; the
vault merges compartments like any place; dissolving furniture takes its compartments and
moves what they held to the room.

## Alternatives

**Slots inside compartments** — rejected: precision nobody maintains, and the rule knows
better. **A separate "furniture" store** — rejected: compartments as places get assign,
move, dissolve and the vault for free, and the tree depth of three (room, unit,
compartment) is the one M19 already enforced. **Reading colours off the covers for the
wall's spines** — impossible: `i.discogs.com` sends no CORS header (docs/02); the wall
shows the first three cached thumbnails instead.

## Consequences

Easier: the wall is a `grid` of places, the picker on a phone is the wall itself, and the
address reads the same everywhere — sheet, wall, search. Harder: the rule engine of M27.2
has to be honest about proposing rather than doing, and a dissolved unit has to leave its
records somewhere sensible; both are written down above so they are not decided twice.
