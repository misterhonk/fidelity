# 18 – Places: the wall

> **Status:** concept agreed on 2026-09-12, M27.1 shipped the same day · **Decision:**
> [ADR-015](adr/015-places-as-a-wall.md) · **Plan:** `docs/06` M27
>
> Where a record stands, in three words: room · furniture · compartment. The German
> concept page this grew from is linked from the assistant's memory; this is the version
> that binds.

---

## 1. How collections stand at home

Five patterns, most collections several of them at once:

| Pattern | What it is | What it tells the model |
|---|---|---|
| The cube shelf | Kallax and Expedit, 2×2 to 5×5; a compartment is 33 cm and takes 60–80 LPs | The compartment is the smallest thing a person can name — "third from the left, second row". A position *inside* it, nobody knows |
| The crate | Wooden crates, the moving box under the table, often with a theme or a time ("new") | A compartment without a shelf |
| The pile | New arrivals, "at the player", "still to sort" | Unordered, moving, and real: where the record you look for most often is |
| The box | 7" boxes, archive cartons in the cellar | Closed, labelled, rarely opened, contents forgotten |
| The order behind it | Alphabetical by artist, by label, by genre, by year, or "as they came"; dividers mark sections | The order is a **rule**, not a list. Nobody maintains positions by hand |

**So:** a record's address is room → furniture → compartment. Inside the compartment a rule
applies, not a coordinate. A model that tracks single slots is wrong within two weeks.

## 2. The model

Built on what M19 had — `Place` as a tree, `Placement` as one row per copy, both merged
through the vault — with fields added, none replaced. Rows from before M27 carry no `kind`
and are rooms.

| Field | On | Meaning |
|---|---|---|
| `kind` | every place | `room`, `unit` (furniture), `compartment`. Only rooms take children by hand; a unit's children are its compartments and come with it |
| `shape` | unit | `shelf` (a wall of cubes), `crate`, `box`, `pile` — how it is drawn |
| `grid` | unit | `{ columns, rows }` |
| `slot` | compartment | `{ column, row }`, zero-based; A1 is `{0, 0}`, read from the front like a spreadsheet |
| `capacity` | unit, compartment | An estimate of what fits — 70 for a Kallax cube, 90 for a crate, 150 for a 7" box, `null` for a pile. A fill level, never a lock |
| `rule` | unit | M27.2: `artist`, `label`, `year`, `added`, `manual`. A rule **proposes** where a record goes and never moves one by itself; an explicit placement always wins |
| `dealing` | unit | M28 #3: `even` spreads the records across every compartment, `front` fills each to 80 % of its capacity before the next — a small collection stands in two cubes, the rest waits empty. Absent means `even` |
| `range` | compartment | M27.2: the divider, "A–Bo" |
| `pin` | compartment | M27.6: where its stretch ends, said by hand — the key, the rule it was said under, and the record it names |

A unit may stand at the top level: not everybody wants to name the room first. Dissolving
a unit takes its compartments with it; what they held moves to the room, or to nowhere.
Coordinates come from `shared/places.ts` (`slotLabel`, `labelOf`, `addressOf`), which app
and worker share.

## 3. The screen

`/places`: a room is a heading, its furniture stands under it as the wall it is —
`PlaceWall.vue`, a `grid` with roving focus, each compartment with its coordinate, its name
if it has one, the first three covers of what it holds and a fill bar against its capacity.
A tap opens the compartment off the canvas, from the right, in the same frame the record's
sheet uses (`PlaceSheet.vue`, M27.1d — under the wall at first, moved on Martin's request):
its records as covers, a name for the compartment, "fill" from the collection, "move all"
to any other place. The wall stays where it is. Furniture is created from a preset
(`UnitPicker.vue`): Kallax 2×2 to 5×5, crate, 7" box, pile, or a custom grid up to 10×10 —
the preset is the input, and it draws itself.

The record's sheet (`ShelfSheet.vue`) lists compartments in its "where it is" select and
reads the address back as a plate: `Living room · Kallax · B1`.

**The look (M27.1b).** The way a rack picks its theme on ModularGrid, a piece of furniture
has a `finish`: a material for the walls (white, black, birch, oak, walnut, steel,
cardboard), a thickness (thin, medium, thick) and a colour where the furniture has one —
USM's panels, stocubo's cubes. Drawn with CSS on the wall, a gradient with a grain for
wood and a brushed one for steel, nothing loaded. The presets bring their own: Kallax
white and thick, Billy birch and thin, USM Haller steel with ruby red panels, Tylko birch
and thin, stocubo blue cubes, the HHV record box cardboard. `FinishPicker.vue` changes it
before saving and after.

## 4. Sorting in and re-sorting (M27.2–M27.4)

Three ways in, from the commonest: **by rule for the whole unit** (the app distributes by
capacity and writes the dividers, the person moves a boundary and sees how many records
follow); **from the record** (the sheet proposes the compartment the rule gives, remembers
the last one, and the wall is the picker on a phone); **from the compartment** (select mode
over the collection with the filter *not placed yet*, "12 records to C1").

The third way shipped first (M27.1c): a compartment's drawer has "Fill", the collection
with *not placed yet* on by default, a tick per record and one button.

Re-sorting: select, then "move to …" with the wall as picker — the main road on touch
(M27.3); pointer-based drag and drop on top of it (M27.4): a mouse drags after six pixels, a
finger has to rest for a moment first and the phone buzzes once — until then a finger is
scrolling, and scrolling wins. A sleeve from the open compartment lands on a cube of the
wall behind it, a whole compartment moves as one onto another, furniture drags by its name
into another room. Every move leaves a line with "Undo". Arrow keys walk the grid, `M`
opens the compartment on "move all", a letter jumps to the compartment whose divider covers
it (M27.5); and the shelf has "Select" with "Put n in …" over the same small wall.

### The end of a compartment, set by hand (M27.6)

This stood open from M27.3 to 2026-09-16 on a real objection: *a rule proposes, and a
boundary moved by hand would be a second rule.* It holds only if a rule is one thing.

**It is two.** A rule **orders** the records and it **divides** them into compartments, and
those are separable. A pin takes over the dividing for one compartment and never the
ordering — so records stay in the rule's sequence across the whole wall, a pin can never put
one out of order, and there is no second rule for the first to disagree with. What a pin
costs is not correctness but the boundary's freedom to move, which is the point of it.

- **Said by pointing, never typed.** The compartment's sheet asks for "the record that
  should be the last one here", and the sleeves answer. The sort key — `"bowie low"` — is an
  implementation nobody should meet. For that to be answerable by looking, a compartment of
  a ruled unit now lists its records **in the rule's order** rather than by title, which is
  also what is physically in the cube.
- **The rest deals around it.** Pins are cut points; the unpinned compartments between two
  of them share their stretch the way they always did. One pin fixes one boundary instead of
  freezing the wall.
- **A later boundary never runs backwards.** Ending A2 before A1 ends is not a shelf, so the
  cut is held where it is and that compartment simply gets nothing. The pin is kept as it
  was said.
- **The last compartment keeps the remainder**, pin or no pin — it has no next one to hand
  to. The plan says how many rather than letting a pin swallow the difference.
- **Another rule lets every pin go**, because the key is in the old rule's language. Said on
  the screen before it happens, not discovered afterwards.
- **The wall marks them**, dotted, and says so to a screen reader: a counted boundary moves
  on the next "sort in" and a pinned one does not, and a wall that hid the difference would
  show the result while hiding what will hold.

## 5. What not

No slot numbers inside a compartment. No photos, no 3D, no centimetres. No lock on a full
compartment. Nothing leaves the device except sealed through the vault, as before.
