import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import {
  applyUnitPlan,
  distinctLabels,
  planUnit,
  proposePlace,
  rangeLabel,
  setDealing,
  setRule,
  sortKey,
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
