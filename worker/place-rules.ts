import { openFidelityDb } from '~~/db/open'
import type { CollectionItem, Place, PlaceDealing, PlaceRule, UnitPlan } from '#shared/types'

import { norm } from './match/normalize'

/**
 * The order inside a piece of furniture (M27.2, ADR-015).
 *
 * Nobody keeps positions inside a compartment; they keep a rule — by
 * artist, by label, by year — and dividers that say where one compartment's
 * stretch ends. So the app does the same: given the rule, it sorts what the
 * unit holds (and, on request, the pile of the unplaced), deals the records
 * across the compartments in the order the wall is read, and writes the
 * dividers. **It proposes, and moves nothing until told to**: `planUnit` is
 * the proposal, `applyUnitPlan` the deed, and an explicit placement is never
 * undone by a rule on its own.
 */

const alive = (place: Place) => !place.removedAt

/**
 * A pin only means something under the rule that produced its key: "bowie
 * low" is not a year. One made under another rule is ignored rather than
 * obeyed or deleted behind somebody's back — `setRule` is what clears them.
 */
function livePin(cube: Place, rule: PlaceRule) {
  return cube.pin && cube.pin.rule === rule ? cube.pin : null
}

/** What the rule sorts by. `norm` already drops a leading "The". */
export function sortKey(item: CollectionItem, rule: PlaceRule): string {
  switch (rule) {
    case 'artist':
      return `${item.artistNorms[0] ?? norm(item.artistNames[0])} ${norm(item.title)}`
    case 'label':
      return `${item.labelNorms[0] ?? norm(item.labelNames[0])} ${norm(item.title)}`
    case 'year':
      return `${String(item.year || 0).padStart(4, '0')} ${norm(item.title)}`
    case 'added':
      return item.addedAt
    case 'manual':
      return ''
  }
}

/**
 * The divider as it is written on the compartment: "A–Bo" for names, the
 * years for years, the days for arrivals. Short enough for a cube.
 */
export function rangeLabel(from: string, to: string, rule: PlaceRule, depth = 1): string {
  const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
  if (rule === 'year') return `${from.slice(0, 4)}–${to.slice(0, 4)}`
  if (rule === 'added') return `${from.slice(0, 10)}–${to.slice(0, 10)}`
  const first = cap(from.slice(0, depth))
  const last = cap(to.slice(0, depth))
  // One word when the stretch stays inside it — "A", not "A–A"; "Ro", not "Ro–Ro".
  return first === last ? first : `${first}–${last}`
}

/**
 * Three compartments of "R" in a row say nothing. Where two neighbours
 * would carry the same label, both get a letter more — "Ri–Ro", "Rob–Ru" —
 * until they differ, the way a person adds letters to a divider by hand.
 */
export function distinctLabels(
  stretches: { from: string; to: string }[],
  rule: PlaceRule,
): string[] {
  const labels = stretches.map((s) => rangeLabel(s.from, s.to, rule))
  if (rule === 'year' || rule === 'added') return labels
  /*
   * A run of neighbours under the same first letter shares one depth — the
   * smallest at which they all read differently — so "R", "R", "R" becomes
   * "Ra–Ri", "Ro", "Ro–Ru" and never "Ra–Ri", "Ro", "R".
   */
  let start = 0
  while (start < stretches.length) {
    let end = start
    while (
      end + 1 < stretches.length &&
      stretches[end + 1]!.from[0] === stretches[start]!.from[0]
    ) {
      end += 1
    }
    if (end > start) {
      for (let depth = 2; depth <= 4; depth += 1) {
        const run = stretches
          .slice(start, end + 1)
          .map((s) => rangeLabel(s.from, s.to, rule, depth))
        const distinct = run.every((l, i) => i === 0 || l !== run[i - 1])
        if (distinct || depth === 4) {
          run.forEach((l, i) => {
            labels[start + i] = l
          })
          break
        }
      }
    }
    start = end + 1
  }
  return labels
}

/** Compartments in reading order — row by row, left to right — the way records get shelved. */
function readingOrder(compartments: Place[]): Place[] {
  return [...compartments].sort(
    (a, b) =>
      (a.slot?.row ?? 0) - (b.slot?.row ?? 0) || (a.slot?.column ?? 0) - (b.slot?.column ?? 0),
  )
}

export async function setRule(unitId: string, rule: PlaceRule): Promise<boolean> {
  const db = await openFidelityDb()
  const unit = await db.get('places', unitId)
  if (!unit || !alive(unit) || unit.kind !== 'unit') return false
  if (unit.rule === rule) return true

  const at = Date.now()
  const tx = db.transaction('places', 'readwrite')
  await tx.store.put({ ...unit, rule, updatedAt: at })
  /*
   * And the pins go with the old rule (M27.6).
   *
   * A pin is a key in the old rule's language — "bowie low" under `artist`
   * means nothing under `year`, and silently keeping it would leave a boundary
   * nobody could read or explain. Dropped here rather than ignored, so the
   * wall matches what is stored; `livePin` still ignores a stale one, for the
   * day a vault merge brings an old row back.
   */
  for (const cube of await tx.store.getAll()) {
    if (cube.parentId !== unitId || !cube.pin) continue
    await tx.store.put({ ...cube, pin: null, updatedAt: at })
  }
  await tx.done
  return true
}

export async function setDealing(unitId: string, dealing: PlaceDealing): Promise<boolean> {
  const db = await openFidelityDb()
  const unit = await db.get('places', unitId)
  if (!unit || !alive(unit) || unit.kind !== 'unit') return false
  await db.put('places', { ...unit, dealing, updatedAt: Date.now() })
  return true
}

/** How full a compartment is filled "from the front": room left for what comes next. */
const FRONT_SHARE = 0.8

export async function planUnit(
  unitId: string,
  includeUnplaced: boolean,
): Promise<UnitPlan | null> {
  const db = await openFidelityDb()
  const unit = await db.get('places', unitId)
  if (!unit || !alive(unit) || unit.kind !== 'unit') return null
  const rule = unit.rule ?? 'artist'
  if (rule === 'manual') return null

  const places = (await db.getAll('places')).filter(alive)
  const compartments = readingOrder(
    places.filter((p) => p.parentId === unitId && p.kind === 'compartment'),
  )
  if (compartments.length === 0) return null
  const cubeIds = new Set(compartments.map((c) => c.id))
  const livingIds = new Set(places.map((p) => p.id))

  const placements = await db.getAll('placements')
  const where = new Map<number, string | null>()
  for (const row of placements) {
    where.set(row.instanceId, row.placeId && livingIds.has(row.placeId) ? row.placeId : null)
  }

  // What the unit holds, and what could come in from the pile.
  const collection = await db.getAll('collection')
  const inUnit: CollectionItem[] = []
  const pile: CollectionItem[] = []
  for (const item of collection) {
    const at = where.get(item.instanceId) ?? null
    if (at && cubeIds.has(at)) inUnit.push(item)
    else if (includeUnplaced && at === null) pile.push(item)
  }
  const all = [...inUnit, ...pile]
  const dealing: PlaceDealing = unit.dealing ?? 'even'
  if (all.length === 0)
    return { unitId, rule, dealing, moves: [], fromPile: 0, total: 0, ranges: [] }

  const keyed = all
    .map((item) => ({ item, key: sortKey(item, rule) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.item.instanceId - b.item.instanceId)

  /*
   * Two ways to deal (M28 #3). Evenly: every compartment gets its share, the
   * remainder to the first ones, where the eye starts — a shelf sorted by
   * hand leaves room everywhere for what comes next. From the front: each
   * compartment to a comfortable share of its capacity before the next, so
   * sixty records in a Kallax 4×4 stand in one cube and the rest wait empty,
   * instead of four per cube with dividers like "A–An". A pile has no edge
   * to fill to and takes everything that is left.
   */
  /*
   * Pins first, because they are the fixed points everything else deals
   * around (M27.6).
   *
   * A pinned compartment ends after a record somebody chose, so its cut is
   * "how many of the sorted records fall at or before that key". The cuts
   * split the list into segments, and the unpinned compartments inside each
   * segment share it the way they always did. So one pin fixes one boundary
   * and leaves the rest of the wall alone, rather than freezing it.
   *
   * ⚠️ **Cuts are forced to run forwards.** Nothing stops somebody ending A1
   * at "Z" and A2 at "B"; read literally that is a compartment ending before
   * the one before it, which is not a shelf. A later cut is therefore never
   * earlier than the one before it — the pin is kept as said, and the plan
   * simply gives that compartment nothing.
   */
  const cuts = new Map<number, number>()
  let floor = 0
  compartments.forEach((cube, index) => {
    const pin = livePin(cube, rule)
    if (!pin) return
    let at = 0
    while (at < keyed.length && keyed[at]!.key.localeCompare(pin.to) <= 0) at += 1
    floor = Math.max(floor, at)
    cuts.set(index, floor)
  })

  const moves: UnitPlan['moves'] = []
  const ranges: UnitPlan['ranges'] = []
  let cursor = 0
  compartments.forEach((cube, index) => {
    const last = index === compartments.length - 1
    /*
     * The last compartment keeps whatever is left, pin or no pin — it has no
     * next one to hand to, and a record has to be somewhere. `overflow` says
     * how many that was, so a pin cannot quietly swallow the difference.
     */
    const take = last
      ? keyed.length - cursor
      : cuts.has(index)
        ? Math.max(0, cuts.get(index)! - cursor)
        : shareFor(index)
    const slice = keyed.slice(cursor, cursor + take)
    cursor += take
    if (slice.length === 0) return
    for (const { item } of slice) {
      const from = where.get(item.instanceId) ?? null
      if (from !== cube.id) moves.push({ instanceId: item.instanceId, from, to: cube.id })
    }
    const from = slice[0]!.key
    const to = slice.at(-1)!.key
    ranges.push({
      placeId: cube.id,
      from,
      to,
      label: '',
      count: slice.length,
      ...(livePin(cube, rule) ? { pinned: true } : {}),
    })
  })

  /**
   * What an unpinned compartment takes: its share of the stretch it is in.
   *
   * The stretch runs from here to the next pin, or to the end, and is shared
   * with the other unpinned compartments before that pin. Without a single
   * pin this is the old arithmetic exactly — an even share with the remainder
   * going to the first ones, where the eye starts.
   */
  function shareFor(index: number): number {
    if (dealing === 'front') {
      const cube = compartments[index]!
      return cube.capacity ? Math.max(1, Math.floor(cube.capacity * FRONT_SHARE)) : keyed.length
    }
    let until = keyed.length
    let slots = 0
    /*
     * The pinned compartment that *ends* the stretch is inside it, not after
     * it — its pin says where it finishes, not where it begins. Counting it
     * out gave the whole run to the compartments before it and left the
     * pinned one holding nothing but the overflow, which is the opposite of
     * what the pin asked for.
     */
    for (let i = index; i < compartments.length; i += 1) {
      slots += 1
      if (cuts.has(i)) {
        until = cuts.get(i)!
        break
      }
    }
    const left = Math.max(0, until - cursor)
    if (slots <= 1) return left
    const per = Math.floor(left / slots)
    // The remainder to the first ones, as before.
    return per + (left % slots > 0 ? 1 : 0)
  }
  const labels = distinctLabels(ranges, rule)
  ranges.forEach((range, index) => {
    range.label = labels[index]!
  })

  /*
   * What the last compartment took past its own pin. Zero in every ordinary
   * case — it is only ever more than that when somebody has pinned the last
   * compartment short and the records have nowhere else to go.
   */
  const lastCube = compartments.at(-1)
  const lastPin = lastCube ? livePin(lastCube, rule) : null
  const overflow = lastPin ? keyed.filter((k) => k.key.localeCompare(lastPin.to) > 0).length : 0

  return {
    unitId,
    rule,
    dealing,
    moves,
    fromPile: pile.length,
    total: keyed.length,
    ranges,
    ...(overflow > 0 ? { overflow } : {}),
  }
}

export async function applyUnitPlan(unitId: string, includeUnplaced: boolean): Promise<number> {
  const plan = await planUnit(unitId, includeUnplaced)
  if (!plan) return 0
  const db = await openFidelityDb()
  const at = Date.now()
  const tx = db.transaction(['places', 'placements'], 'readwrite')
  const placements = tx.objectStore('placements')
  const places = tx.objectStore('places')
  for (const move of plan.moves)
    await placements.put({ instanceId: move.instanceId, placeId: move.to, at })
  const byId = new Map(plan.ranges.map((range) => [range.placeId, range]))
  for (const cube of await places.getAll()) {
    if (cube.parentId !== unitId || cube.kind !== 'compartment' || !alive(cube)) continue
    const range = byId.get(cube.id)
    const next = range ? { from: range.from, to: range.to, label: range.label } : undefined
    if (JSON.stringify(next) !== JSON.stringify(cube.range)) {
      await places.put({ ...cube, range: next, updatedAt: at })
    }
  }
  await tx.done
  return plan.moves.length
}

/**
 * Where a record would go, by the dividers that exist: the compartment whose
 * stretch covers its key, or the last one whose stretch starts before it.
 * The first unit that has an answer wins; a unit without dividers has none.
 */
export async function proposePlace(
  instanceId: number,
): Promise<{ placeId: string; unitId: string } | null> {
  const db = await openFidelityDb()
  const item = await db.get('collection', instanceId)
  if (!item) return null
  const places = (await db.getAll('places')).filter(alive)
  const units = places.filter((p) => p.kind === 'unit' && p.rule && p.rule !== 'manual')
  for (const unit of units) {
    const cubes = readingOrder(places.filter((p) => p.parentId === unit.id && p.range))
    if (cubes.length === 0) continue
    const key = sortKey(item, unit.rule!)
    let best: Place | null = null
    for (const cube of cubes) {
      const { from, to } = cube.range!
      if (key.localeCompare(from) >= 0 && key.localeCompare(to) <= 0) {
        best = cube
        break
      }
      if (key.localeCompare(from) >= 0) best = cube
    }
    if (!best) best = cubes[0]!
    return { placeId: best.id, unitId: unit.id }
  }
  return null
}

/**
 * Where a compartment's stretch ends, said by pointing at a record (M27.6).
 *
 * By the record rather than by the key, because the key is an implementation
 * — `"bowie low"`, `"1974 diamond dogs"` — and nobody should have to type one.
 * Somebody looking at a compartment knows which record should be the last in
 * it; this turns that into the boundary.
 *
 * The label is taken now rather than derived later: it is what the screen says
 * the pin means ("ends after Bowie — Low"), and a record that leaves the
 * collection afterwards must not turn the pin into a blank.
 */
export async function pinCompartment(placeId: string, instanceId: number): Promise<boolean> {
  const db = await openFidelityDb()
  const cube = await db.get('places', placeId)
  if (!cube || !alive(cube) || cube.kind !== 'compartment' || !cube.parentId) return false

  const unit = await db.get('places', cube.parentId)
  const rule = unit?.rule ?? 'artist'
  // Nothing to pin a boundary in: by hand there are no stretches to divide.
  if (!unit || !alive(unit) || rule === 'manual') return false

  const item = await db.get('collection', instanceId)
  if (!item) return false

  await db.put('places', {
    ...cube,
    pin: {
      to: sortKey(item, rule),
      rule,
      label: `${item.artistNames[0] ?? ''} – ${item.title}`.trim(),
    },
    updatedAt: Date.now(),
  })
  return true
}

/** And letting go of it: the next plan divides this boundary by count again. */
export async function unpinCompartment(placeId: string): Promise<boolean> {
  const db = await openFidelityDb()
  const cube = await db.get('places', placeId)
  if (!cube || !alive(cube) || !cube.pin) return false
  await db.put('places', { ...cube, pin: null, updatedAt: Date.now() })
  return true
}
