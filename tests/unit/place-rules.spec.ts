import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import {
  applyUnitPlan,
  distinctLabels,
  pinCompartment,
  planUnit,
  proposePlace,
  rangeLabel,
  setDealing,
  setRule,
  sortKey,
  unpinCompartment,
} from '~~/worker/place-rules'
import {
  createUnit,
  placeContents,
  placeOf,
  placeRecord,
  placesOverview,
} from '~~/worker/places'
import type { CollectionItem } from '#shared/types'

/**
 * The order inside a piece of furniture (M27.2, ADR-015).
 *
 * A rule proposes and never moves: `planUnit` says what would happen,
 * `applyUnitPlan` does it, and until then an explicit placement stands.
 * The dividers it writes are what a person would pencil on the compartment.
 */
const record = (
  instanceId: number,
  artist: string,
  title: string,
  year = 1999,
): CollectionItem => ({
  releaseId: instanceId * 10,
  instanceId,
  folderId: 1,
  masterId: 0,
  title,
  artistIds: [],
  artistNames: [artist],
  artistNorms: [artist.toLowerCase().replace(/^the /, '')],
  labelIds: [],
  labelNames: ['Label'],
  labelNorms: ['label'],
  catnos: [],
  genres: [],
  styles: [],
  formats: ['Vinyl'],
  year,
  rating: 0,
  thumbUrl: '',
  coverUrl: '',
  addedAt: `2020-01-${String(instanceId).padStart(2, '0')}T00:00:00-00:00`,
})

const kallax = (columns: number, rows: number, rule: 'artist' | 'manual' = 'artist') =>
  createUnit({
    name: 'Kallax',
    parentId: null,
    shape: 'shelf',
    columns,
    rows,
    capacity: 70,
    finish: { material: 'white', thickness: 'thick', colour: null },
    rule,
  })

beforeEach(async () => {
  const db = await openFidelityDb()
  for (const store of ['places', 'placements', 'collection'] as const) await db.clear(store)
})

describe('a rule', () => {
  it('sorts by the artist without the article, and by the year as a number', () => {
    expect(sortKey(record(1, 'The Beatles', 'Revolver'), 'artist')).toMatch(/^beatles/)
    expect(sortKey(record(1, 'Air', 'Moon Safari', 1998), 'year')).toMatch(/^1998/)
    expect(sortKey(record(1, 'Air', 'Moon Safari', 0), 'year')).toMatch(/^0000/)
  })

  it('writes a divider the way a person would pencil it', () => {
    expect(rangeLabel('air moon safari', 'bowie low', 'artist')).toBe('A–B')
    expect(rangeLabel('air', 'aphex twin', 'artist')).toBe('A')
    expect(rangeLabel('1965 x', '1972 y', 'year')).toBe('1965–1972')
  })

  it('adds a letter where two neighbours would read the same', () => {
    const labels = distinctLabels(
      [
        { from: 'radiohead', to: 'ricardo villalobos' },
        { from: 'robag wruhme', to: 'robert hood' },
        { from: 'roman fluegel', to: 'rune' },
      ],
      'artist',
    )
    expect(labels).toEqual(['Ra–Ri', 'Ro', 'Ro–Ru'])
  })

  it('deals the unit and the pile across the compartments in reading order, evenly', async () => {
    const db = await openFidelityDb()
    const names = ['Zappa', 'Air', 'Bowie', 'Can', 'Dinky', 'Eno', 'Fela']
    for (const [i, name] of names.entries())
      await db.put('collection', record(i + 1, name, 'X'))
    const unit = (await kallax(2, 2))!
    const cubes = (await placesOverview()).filter((n) => n.parentId === unit.id)
    // Zappa was put in A1 by hand; it will move, because the plan is asked for.
    await placeRecord(1, cubes[0]!.id)

    const plan = (await planUnit(unit.id, true))!
    expect(plan.total).toBe(7)
    expect(plan.fromPile).toBe(6)
    expect(plan.ranges.map((r) => r.count)).toEqual([2, 2, 2, 1])
    // Reading order: A1, B1, A2, B2 — the first slice is Air and Bowie.
    expect(plan.ranges[0]!.label).toBe('A–B')
    expect(plan.ranges.at(-1)!.label).toBe('Z')
    expect(plan.moves.some((m) => m.instanceId === 1 && m.from === cubes[0]!.id)).toBe(true)

    // Nothing has moved yet: the plan is a proposal.
    expect(await placeOf(1)).toBe(cubes[0]!.id)
    expect((await placeContents(cubes[1]!.id)).length).toBe(0)

    expect(await applyUnitPlan(unit.id, true)).toBe(plan.moves.length)
    const after = (await placesOverview()).filter((n) => n.parentId === unit.id)
    expect(after.map((n) => n.range?.label)).toContain('A–B')
    expect(
      (await placeContents(after.find((n) => n.name === 'B2')!.id)).map((r) => r.instanceId),
    ).toEqual([1])
  })

  it('fills from the front, and leaves the rest of the wall empty', async () => {
    const db = await openFidelityDb()
    for (const [i, name] of ['Air', 'Bowie', 'Can', 'Dinky', 'Eno'].entries())
      await db.put('collection', record(i + 1, name, 'X'))
    const unit = (await kallax(2, 2))!
    expect(await setDealing(unit.id, 'front')).toBe(true)

    const plan = (await planUnit(unit.id, true))!
    expect(plan.dealing).toBe('front')
    // Five records, seventy per cube: all of them in A1, the divider spans them.
    expect(plan.ranges.map((r) => r.count)).toEqual([5])
    expect(plan.ranges[0]!.label).toBe('A–E')

    expect(await applyUnitPlan(unit.id, true)).toBe(5)
    const after = (await placesOverview()).filter((n) => n.parentId === unit.id)
    expect(after.filter((n) => n.range).length).toBe(1)
    expect(after.find((n) => n.name === 'A1')!.records).toBe(5)
  })

  it('has no plan for a unit sorted by hand', async () => {
    const unit = (await kallax(1, 1, 'manual'))!
    expect(await planUnit(unit.id, true)).toBeNull()
    expect(await setRule(unit.id, 'artist')).toBe(true)
    expect(await planUnit(unit.id, true)).not.toBeNull()
  })

  it('proposes the compartment whose divider covers the record', async () => {
    const db = await openFidelityDb()
    for (const [i, name] of ['Air', 'Bowie', 'Can', 'Dinky'].entries()) {
      await db.put('collection', record(i + 1, name, 'X'))
    }
    const unit = (await kallax(2, 1))!
    await applyUnitPlan(unit.id, true)
    const cubes = (await placesOverview()).filter((n) => n.parentId === unit.id)
    // A new arrival: "Bonobo" sits between Air/Bowie and Can/Dinky — first stretch ends at Bowie.
    await db.put('collection', record(9, 'Bonobo', 'X'))
    expect((await proposePlace(9))?.placeId).toBe(cubes.find((c) => c.name === 'A1')!.id)
    await db.put('collection', record(10, 'Zappa', 'X'))
    expect((await proposePlace(10))?.placeId).toBe(cubes.find((c) => c.name === 'B1')!.id)
    await db.put('collection', record(11, 'Aa', 'X'))
    expect((await proposePlace(11))?.placeId).toBe(cubes.find((c) => c.name === 'A1')!.id)
  })
})

/**
 * The boundary a person sets by hand (M27.6).
 *
 * M27.3 left this open with a real objection: "a rule proposes, and a
 * boundary moved by hand would be a second rule". It holds only if a rule is
 * one thing. It is two — it **orders** the records and it **divides** them —
 * and a pin takes over the second alone. The order stays the rule's, which is
 * why a pin can never put a record out of order and has nothing to disagree
 * with.
 *
 * Everything below is about the dividing: the pin holds, what is left deals
 * around it, and the arithmetic degrades sensibly where somebody asks for
 * something a shelf cannot do.
 */
describe('a boundary set by hand', () => {
  /** Eight records, A to H, one letter each, so a cut is easy to read. */
  async function eight(columns = 2, rows = 2) {
    const db = await openFidelityDb()
    const names = ['Air', 'Bowie', 'Can', 'Dinky', 'Eno', 'Fela', 'Gas', 'Hood']
    for (const [i, name] of names.entries())
      await db.put('collection', record(i + 1, name, 'X'))
    const unit = (await kallax(columns, rows))!
    const cubes = (await placesOverview())
      .filter((n) => n.parentId === unit.id)
      .sort(
        (a, b) =>
          (a.slot?.row ?? 0) - (b.slot?.row ?? 0) ||
          (a.slot?.column ?? 0) - (b.slot?.column ?? 0),
      )
    return { unit, cubes }
  }

  const counts = (plan: { ranges: { count: number }[] }) => plan.ranges.map((r) => r.count)

  it('deals evenly with nothing pinned — the arithmetic it always had', async () => {
    const { unit } = await eight()
    expect(counts((await planUnit(unit.id, true))!)).toEqual([2, 2, 2, 2])
  })

  it('ends the compartment where the record says, and deals the rest around it', async () => {
    const { unit, cubes } = await eight()
    // "Can is the last one in A1" — three there, five over the other three.
    expect(await pinCompartment(cubes[0]!.id, 3)).toBe(true)

    const plan = (await planUnit(unit.id, true))!
    expect(counts(plan)).toEqual([3, 2, 2, 1])
    expect(plan.ranges[0]!.label).toBe('A–C')
    expect(plan.ranges[0]!.pinned).toBe(true)
    expect(plan.ranges[1]!.pinned).toBeUndefined()
  })

  /*
   * The point of dealing *around* a pin rather than freezing the wall: one
   * boundary is fixed, and the compartments after it still share what is left.
   */
  it('leaves the compartments after a pin sharing the remainder', async () => {
    const { unit, cubes } = await eight()
    await pinCompartment(cubes[0]!.id, 1) // only Air in A1
    expect(counts((await planUnit(unit.id, true))!)).toEqual([1, 3, 2, 2])
  })

  it('holds two pins at once, with the run between them shared', async () => {
    const { unit, cubes } = await eight(3, 1)
    await pinCompartment(cubes[0]!.id, 2) // A1 ends after Bowie
    await pinCompartment(cubes[1]!.id, 6) // A2 ends after Fela
    expect(counts((await planUnit(unit.id, true))!)).toEqual([2, 4, 2])
  })

  /*
   * A pin can empty a compartment, and that is allowed: an empty cube in the
   * middle of a wall is a thing people do. It gets no divider, because it has
   * no stretch to describe.
   */
  it('lets a pin leave a compartment empty rather than inventing a record for it', async () => {
    const { unit, cubes } = await eight(3, 1)
    await pinCompartment(cubes[0]!.id, 8) // everything in A1
    const plan = (await planUnit(unit.id, true))!
    expect(counts(plan)).toEqual([8])
    expect(plan.ranges).toHaveLength(1)
  })

  /*
   * ⚠️ Nothing stops somebody ending A2 before A1 ends. Read literally that is
   * a compartment that finishes before the one before it, which is not a
   * shelf — so the later cut never runs backwards, and A2 simply gets nothing.
   * The pin is kept as it was said.
   */
  it('does not let a later boundary run backwards', async () => {
    const { unit, cubes } = await eight(3, 1)
    await pinCompartment(cubes[0]!.id, 6) // A1 ends after Fela
    await pinCompartment(cubes[1]!.id, 2) // A2 ends after Bowie — behind A1
    const plan = (await planUnit(unit.id, true))!
    expect(counts(plan)).toEqual([6, 2])
    expect(plan.ranges.map((r) => r.placeId)).toEqual([cubes[0]!.id, cubes[2]!.id])
  })

  /*
   * And the case a pin cannot win: the last compartment has no next one to
   * hand to, so it keeps what is left over. Said out loud rather than swallowed.
   */
  it('gives the last compartment what is left over, and says how much', async () => {
    const { unit, cubes } = await eight(2, 1)
    await pinCompartment(cubes[1]!.id, 5) // A2 ends after Eno, three records short
    const plan = (await planUnit(unit.id, true))!
    // A1 and A2 share the stretch up to the pin — and A2, having nowhere to
    // hand the last three to, keeps them as well.
    expect(counts(plan)).toEqual([3, 5])
    expect(plan.overflow).toBe(3)
  })

  it('reports no overflow in the ordinary case', async () => {
    const { unit, cubes } = await eight()
    await pinCompartment(cubes[0]!.id, 3)
    expect((await planUnit(unit.id, true))!.overflow).toBeUndefined()
  })

  it('writes the divider the pin produced, and keeps the pin through an apply', async () => {
    const { unit, cubes } = await eight()
    await pinCompartment(cubes[0]!.id, 3)
    await applyUnitPlan(unit.id, true)

    const db = await openFidelityDb()
    const a1 = (await db.get('places', cubes[0]!.id))!
    expect(a1.range?.label).toBe('A–C')
    // The pin is intent, not a by-product of the last plan: it survives.
    expect(a1.pin?.rule).toBe('artist')
    expect(a1.pin?.label).toBe('Can – X')
    // And in the order they stand in, which is the rule's — not by title.
    expect((await placeContents(cubes[0]!.id)).map((r) => r.instanceId)).toEqual([1, 2, 3])
    expect((await placeContents(cubes[0]!.id)).map((r) => r.artistNames[0])).toEqual([
      'Air',
      'Bowie',
      'Can',
    ])
  })

  it('lets go again, and the boundary goes back to being a count', async () => {
    const { unit, cubes } = await eight()
    await pinCompartment(cubes[0]!.id, 3)
    expect(counts((await planUnit(unit.id, true))!)).toEqual([3, 2, 2, 1])

    expect(await unpinCompartment(cubes[0]!.id)).toBe(true)
    expect(counts((await planUnit(unit.id, true))!)).toEqual([2, 2, 2, 2])
  })

  /*
   * A pin is a key in its rule's language: "can x" means nothing under
   * `year`. Changing the rule drops them rather than leaving a boundary
   * nobody could read — and the screen is what warns beforehand.
   */
  it('drops the pins when the unit is sorted by something else', async () => {
    const { unit, cubes } = await eight()
    await pinCompartment(cubes[0]!.id, 3)
    await setRule(unit.id, 'year')

    const db = await openFidelityDb()
    expect((await db.get('places', cubes[0]!.id))?.pin).toBeNull()
    expect(counts((await planUnit(unit.id, true))!)).toEqual([2, 2, 2, 2])
  })

  it('refuses a pin where there are no stretches to divide', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record(1, 'Air', 'X'))
    const unit = (await kallax(2, 1, 'manual'))!
    const cubes = (await placesOverview()).filter((n) => n.parentId === unit.id)
    expect(await pinCompartment(cubes[0]!.id, 1)).toBe(false)
  })
})
