import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import { shelfView } from '~~/worker/collection/records'
import {
  createPlace,
  createUnit,
  MAX_DEPTH,
  placeRecords,
  setFinish,
  moveAll,
  movePlace,
  placeContents,
  placeOf,
  placeRecord,
  placesOverview,
  removePlace,
  renamePlace,
} from '~~/worker/places'
import { addressOf, finishStyle, labelOf, slotLabel, textOn } from '#shared/places'
import type { CollectionItem } from '#shared/types'

/**
 * Where the record stands (M12).
 *
 * The one feature in this app that costs **zero requests** — so there is
 * nothing to mock and no reason to avoid the database. It is checked against a
 * real IndexedDB, because that is exactly where the decisions are: which
 * store, which key, what happens on deletion.
 */
const record = (instanceId: number, title: string): CollectionItem => ({
  releaseId: instanceId * 10,
  instanceId,
  folderId: 1,
  masterId: 0,
  title,
  artistIds: [],
  artistNames: ['Probe'],
  artistNorms: ['probe'],
  labelIds: [],
  labelNames: ['Label'],
  labelNorms: ['label'],
  catnos: [],
  genres: [],
  styles: [],
  formats: ['Vinyl'],
  year: 1999,
  rating: 0,
  thumbUrl: '',
  coverUrl: '',
  addedAt: '2020-01-01T00:00:00-00:00',
})

beforeEach(async () => {
  const db = await openFidelityDb()
  for (const store of ['places', 'placements', 'collection'] as const) {
    await db.clear(store)
  }
})

describe('a place', () => {
  it('holds records, and counts the ones below it too', async () => {
    const cellar = (await createPlace('Keller', null))!
    const crate = (await createPlace('Kiste 3', cellar.id))!

    const db = await openFidelityDb()
    await db.put('collection', record(1, 'Eins'))
    await db.put('collection', record(2, 'Zwei'))
    await placeRecord(1, cellar.id)
    await placeRecord(2, crate.id)

    const nodes = await placesOverview()
    const cellarNode = nodes.find((n) => n.id === cellar.id)!

    expect(cellarNode.records).toBe(1)
    // "In the cellar" means the whole cellar. A cellar showing 1 while two
    // records are in it is a lie.
    expect(cellarNode.recordsBelow).toBe(2)
  })

  /** Three levels: room → furniture → compartment. Anyone needing a fourth
   * should name things better. */
  it('stops at three levels', async () => {
    const a = (await createPlace('Wohnzimmer', null))!
    const b = (await createPlace('Regal', a.id))!
    const c = (await createPlace('Fach 2', b.id))!
    expect(c).not.toBeNull()

    expect(await createPlace('Noch tiefer', c.id)).toBeNull()
    expect(MAX_DEPTH).toBe(3)
  })

  it('refuses a name that is only whitespace', async () => {
    expect(await createPlace('   ', null)).toBeNull()
  })

  /**
   * Dissolving a place throws no records away.
   *
   * Taking the shelf apart does not mean giving the records away — they become
   * placeless. And places underneath move up instead of dying with it.
   */
  it('lets go of its records without losing them', async () => {
    const cellar = (await createPlace('Keller', null))!
    const crate = (await createPlace('Kiste', cellar.id))!

    const db = await openFidelityDb()
    await db.put('collection', record(1, 'Eins'))
    await placeRecord(1, cellar.id)

    await removePlace(cellar.id)

    expect(await db.get('collection', 1)).toBeTruthy()
    expect(await placeOf(1)).toBeNull()

    /*
     * And the row is **there** — with `placeId: null`.
     *
     * It used to be deleted, and for a single device that was right. Through
     * the vault it is the wrong message: a missing row is not a statement to
     * the merge but a gap, and the other device puts the record back next time
     * onto a shelf that no longer exists. "Sits nowhere" has to be written to
     * win.
     */
    expect(await db.get('placements', 1)).toMatchObject({ placeId: null })

    // And the crate now stands at the top rather than nowhere.
    const nodes = await placesOverview()
    expect(nodes.find((n) => n.id === crate.id)?.parentId).toBeNull()
  })

  /**
   * And the same for taking a single record down.
   *
   * `placeRecord(x, null)` was a `delete`, and for a single device that was
   * right. Through the vault it is the wrong message — checked separately from
   * `removePlace`, because both routes are their own lines and a mutation
   * probe got through exactly here.
   */
  it('writes "nowhere" instead of forgetting the row', async () => {
    const shelf = (await createPlace('Regal', null))!
    const db = await openFidelityDb()
    await db.put('collection', record(1, 'Eins'))

    await placeRecord(1, shelf.id)
    await placeRecord(1, null)

    expect(await placeOf(1)).toBeNull()
    expect(await db.get('placements', 1)).toMatchObject({ placeId: null })
    expect((await placesOverview()).find((n) => n.id === shelf.id)?.records).toBe(0)
  })

  /**
   * Renaming leaves a timestamp.
   *
   * Without it, the merge is settled by chance: `createdAt` is the same number
   * on both devices, and then the winner is not the more recent name but
   * whichever was read last.
   */
  it('stamps a rename so the newer name can win elsewhere', async () => {
    const shelf = (await createPlace('Regal', null))!
    const db = await openFidelityDb()
    const vorher = (await db.get('places', shelf.id))!.updatedAt ?? 0

    await new Promise((done) => setTimeout(done, 2))
    expect(await renamePlace(shelf.id, 'Wohnzimmer')).toBe(true)

    const nachher = (await db.get('places', shelf.id))!
    expect(nachher.name).toBe('Wohnzimmer')
    expect(nachher.updatedAt ?? 0).toBeGreaterThan(vorher)
  })

  /**
   * The dissolved place itself stays behind as a tombstone — for the same
   * reason, and without appearing anywhere.
   */
  it('leaves a marker so another device cannot bring it back', async () => {
    const cellar = (await createPlace('Keller', null))!
    await removePlace(cellar.id)

    const db = await openFidelityDb()
    expect(await db.get('places', cellar.id)).toMatchObject({ removedAt: expect.any(Number) })
    expect((await placesOverview()).map((n) => n.id)).not.toContain(cellar.id)
    // And it accepts nothing more: neither a new name nor a compartment.
    expect(await renamePlace(cellar.id, 'Dachboden')).toBe(false)
    expect(await createPlace('Fach', cellar.id)).toBeNull()
  })
})

describe('finding things again', () => {
  it('answers what is in the cellar, boxes included', async () => {
    const cellar = (await createPlace('Keller', null))!
    const crate = (await createPlace('Kiste', cellar.id))!

    const db = await openFidelityDb()
    await db.put('collection', record(1, 'Oben'))
    await db.put('collection', record(2, 'In der Kiste'))
    await placeRecord(1, cellar.id)
    await placeRecord(2, crate.id)

    const drin = await placeContents(cellar.id)
    expect(drin.map((r) => r.title).sort()).toEqual(['In der Kiste', 'Oben'])
  })

  /**
   * A record that has disappeared from the collection leaves its location
   * behind. The place then knows more than the collection — it is still not
   * shown, or there would be a hole there.
   */
  it('skips a record that is no longer in the collection', async () => {
    const cellar = (await createPlace('Keller', null))!
    await placeRecord(99, cellar.id)
    expect(await placeContents(cellar.id)).toEqual([])
  })

  /** Somebody moving carries crates, not records. */
  it('moves a whole box at once', async () => {
    const alt = (await createPlace('Kiste 3', null))!
    const neu = (await createPlace('Regal 2', null))!

    const db = await openFidelityDb()
    for (const id of [1, 2, 3]) {
      await db.put('collection', record(id, `Platte ${id}`))
      await placeRecord(id, alt.id)
    }

    expect(await moveAll(alt.id, neu.id)).toBe(3)
    expect(await placeContents(alt.id)).toEqual([])
    expect((await placeContents(neu.id)).length).toBe(3)
  })

  /**
   * And a crate does not move into itself.
   *
   * The first version of this test was green for the wrong reason: the place
   * was empty, so 0 came out without the check too. A mutation probe showed
   * it — now there are records in it, and only the check keeps the number at
   * zero.
   */
  it('does not move a box onto itself', async () => {
    const a = (await createPlace('A', null))!

    const db = await openFidelityDb()
    for (const id of [1, 2]) {
      await db.put('collection', record(id, `Platte ${id}`))
      await placeRecord(id, a.id)
    }

    expect(await moveAll(a.id, a.id)).toBe(0)
    // And they are still sitting there.
    expect((await placeContents(a.id)).length).toBe(2)
  })
})

/**
 * And the decision that is visible in the source alone, not in any test run.
 */
describe('where the location is kept', () => {
  /**
   * **Not on the collection row.**
   *
   * `worker/sync/library.ts` rewrites every row with `put()`. A location there
   * would be silently gone after the next full pass — and "silently" is the
   * bad part: nobody notices half the flat has been forgotten until they go
   * looking for a record.
   */
  it('lives in a store the sync never touches', () => {
    const schema = readFileSync('db/schema.ts', 'utf8')
    expect(schema).toMatch(/placements: \{ key: number; value: Placement/)

    const sync = readFileSync('worker/sync/library.ts', 'utf8')
    expect(sync).not.toMatch(/placement|placeId/i)

    const types = readFileSync('shared/types.ts', 'utf8')
    const item = types.slice(types.indexOf('export interface CollectionItem'))
    expect(item.slice(0, item.indexOf('\n}'))).not.toMatch(/placeId/)
  })

  /** On the copy, not on the release: two pressings sit in two places. */
  it('hangs on the copy, not on the record', () => {
    const types = readFileSync('shared/types.ts', 'utf8')
    const placement = types.slice(types.indexOf('export interface Placement'))
    expect(placement.slice(0, placement.indexOf('\n}'))).toMatch(/instanceId: number/)
    expect(placement.slice(0, placement.indexOf('\n}'))).not.toMatch(/releaseId/)
  })

  /** And none of it goes anywhere. */
  it('never leaves the device', () => {
    const source = readFileSync('worker/places.ts', 'utf8')
    expect(source).not.toMatch(/fetch\(|DiscogsClient|hub|discogs\.com/i)
  })
})

/**
 * The wall (M27.1, ADR-015).
 *
 * A piece of furniture is a grid of compartments that exist together: sixteen
 * places for a Kallax 4×4, named by their coordinate, read like a spreadsheet
 * from the front. They are ordinary places from the first day — assign, move,
 * dissolve, the vault — which is why the tests below use the same calls the
 * older ones do.
 */
describe('a unit with compartments', () => {
  const kallax = (parentId: string | null, columns = 2, rows = 2) =>
    createUnit({
      name: 'Kallax',
      parentId,
      shape: 'shelf',
      columns,
      rows,
      capacity: 70,
      finish: { material: 'white', thickness: 'thick', colour: null },
      rule: 'artist',
    })

  it('reads its coordinates like a spreadsheet', () => {
    expect(slotLabel(0, 0)).toBe('A1')
    expect(slotLabel(3, 1)).toBe('D2')
    expect(slotLabel(25, 0)).toBe('Z1')
    expect(slotLabel(26, 2)).toBe('AA3')
  })

  it('comes with every compartment, column by column', async () => {
    const room = (await createPlace('Living room', null))!
    const unit = (await kallax(room.id, 3, 2))!
    const nodes = await placesOverview()
    const cubes = nodes.filter((node) => node.parentId === unit.id)
    expect(cubes.map((cube) => cube.name)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
    expect(cubes.every((cube) => cube.kind === 'compartment' && cube.capacity === 70)).toBe(
      true,
    )
    expect(nodes.find((node) => node.id === unit.id)?.grid).toEqual({ columns: 3, rows: 2 })
    expect(addressOf(cubes[3]!.id, nodes)).toEqual(['Living room', 'Kallax', 'B2'])
  })

  it('keeps the coordinate in front of a name somebody gives a compartment', async () => {
    const unit = (await kallax(null, 1, 1))!
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!
    await renamePlace(cube.id, 'Jazz')
    const renamed = (await placesOverview()).find((node) => node.id === cube.id)!
    expect(labelOf(renamed)).toBe('A1 · Jazz')
    expect(labelOf(cube)).toBe('A1')
  })

  it('takes no places inside a compartment, and none inside a unit by hand', async () => {
    const unit = (await kallax(null))!
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!
    expect(await createPlace('Box', cube.id)).toBeNull()
    expect(await createPlace('Box', unit.id)).toBeNull()
    expect(await kallax(unit.id)).toBeNull()
  })

  it('refuses a wall nobody could build', async () => {
    expect(await kallax(null, 0, 4)).toBeNull()
    expect(await kallax(null, 11, 1)).toBeNull()
  })

  it('goes with its compartments when dissolved, and the records move up to the room', async () => {
    const db = await openFidelityDb()
    await db.put('collection', record(1, 'Maiden Voyage'))
    const room = (await createPlace('Living room', null))!
    const unit = (await kallax(room.id, 2, 1))!
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!
    await placeRecord(1, cube.id)

    await removePlace(unit.id)

    const nodes = await placesOverview()
    expect(nodes.map((node) => node.id)).toEqual([room.id])
    expect(await placeOf(1)).toBe(room.id)
  })

  it('shows the first covers of what a compartment holds', async () => {
    const db = await openFidelityDb()
    for (const id of [1, 2, 3, 4]) {
      await db.put('collection', {
        ...record(id, `Record ${id}`),
        thumbUrl: `https://i.test/${id}.jpg`,
      })
    }
    const unit = (await kallax(null, 1, 1))!
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!
    for (const id of [1, 2, 3, 4]) await placeRecord(id, cube.id)
    const shown = (await placesOverview()).find((node) => node.id === cube.id)!
    expect(shown.records).toBe(4)
    expect(shown.covers).toHaveLength(3)
    expect(shown.covers[0]).toMatch(/i\.test/)
  })
})

/**
 * The look (M27.1b): a material, a thickness, a colour — on the furniture,
 * changed after the fact, drawn as CSS. A compartment has no look of its own.
 */
describe('a finish', () => {
  it('rides on the furniture and can be changed later', async () => {
    const unit = (await createUnit({
      name: 'USM',
      parentId: null,
      shape: 'shelf',
      columns: 3,
      rows: 2,
      capacity: 70,
      finish: { material: 'steel', thickness: 'thin', colour: '#c8102e' },
      rule: 'artist',
    }))!
    expect(unit.finish?.material).toBe('steel')
    expect(
      await setFinish(unit.id, { material: 'walnut', thickness: 'medium', colour: null }),
    ).toBe(true)
    const after = (await placesOverview()).find((node) => node.id === unit.id)!
    expect(after.finish).toEqual({ material: 'walnut', thickness: 'medium', colour: null })
    expect(after.updatedAt).toBeGreaterThanOrEqual(unit.updatedAt!)
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!
    expect(await setFinish(cube.id, { material: 'oak', thickness: 'thin', colour: null })).toBe(
      false,
    )
  })

  it('draws steel with coloured panels and a cube system in its colour', () => {
    const usm = finishStyle({ material: 'steel', thickness: 'thin', colour: '#c8102e' })
    expect(usm.face).toBe('#c8102e')
    expect(usm.frame).toContain('gradient')
    expect(usm.gap).toBe('2px')
    const stocubo = finishStyle({ material: 'white', thickness: 'medium', colour: '#00589c' })
    expect(stocubo.frame).toBe('#00589c')
    expect(stocubo.face).toBeNull()
    expect(finishStyle(undefined).gap).toBe('12px')
  })

  it('puts dark text on a light face and light text on a dark one', () => {
    expect(textOn('#f5c400')).toBe('#1a1a1a')
    expect(textOn('#00589c')).toBe('#f4f1ea')
  })
})

/**
 * Filling from the wall (M27.1c): the pile still to sort in is what has no
 * living place, and an armful goes into a compartment at once.
 */
describe('carrying furniture (M27.4)', () => {
  it('moves a unit into a room, out of one, and nowhere it does not belong', async () => {
    const room = (await createPlace('Living room', null))!
    const unit = (await createUnit({
      name: 'Kallax',
      parentId: null,
      shape: 'shelf',
      columns: 2,
      rows: 2,
      capacity: 70,
      finish: { material: 'oak', thickness: 'medium', colour: null },
      rule: 'artist',
    }))!
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!

    expect(await movePlace(unit.id, room.id)).toBe(true)
    expect((await placesOverview()).find((node) => node.id === unit.id)?.parentId).toBe(room.id)
    expect(addressOf(cube.id, await placesOverview())).toEqual(['Living room', 'Kallax', 'A1'])

    // The same room again is nothing; a room cannot move; a unit is no room.
    expect(await movePlace(unit.id, room.id)).toBe(false)
    expect(await movePlace(room.id, null)).toBe(false)
    expect(await movePlace(cube.id, null)).toBe(false)
    const other = (await createUnit({
      name: 'Box',
      parentId: null,
      shape: 'crate',
      columns: 1,
      rows: 1,
      capacity: null,
      finish: { material: 'oak', thickness: 'medium', colour: null },
      rule: 'manual',
    }))!
    expect(await movePlace(unit.id, other.id)).toBe(false)

    expect(await movePlace(unit.id, null)).toBe(true)
    expect(addressOf(cube.id, await placesOverview())).toEqual(['Kallax', 'A1'])
  })
})

describe('filling a compartment', () => {
  it('lists what has no place yet, and forgets a place that was dissolved', async () => {
    const db = await openFidelityDb()
    for (const [id, title] of [
      [1, 'One'],
      [2, 'Two'],
      [3, 'Three'],
    ] as const) {
      await db.put('collection', record(id, title))
    }
    const room = (await createPlace('Cellar', null))!
    const crate = (await createPlace('Crate', null))!
    await placeRecord(1, room.id)
    await placeRecord(2, crate.id)
    await removePlace(crate.id)

    const view = await shelfView({ unplaced: true, sort: 'artist' })
    expect(view.records.map((r) => r.instanceId).sort()).toEqual([2, 3])
    expect(view.total).toBe(2)
    expect((await shelfView({})).total).toBe(3)
  })

  it('puts an armful into one compartment at once', async () => {
    const db = await openFidelityDb()
    for (const id of [1, 2, 3]) await db.put('collection', record(id, `Record ${id}`))
    const unit = (await createUnit({
      name: 'Kallax',
      parentId: null,
      shape: 'shelf',
      columns: 1,
      rows: 1,
      capacity: 70,
      finish: { material: 'white', thickness: 'thick', colour: null },
      rule: 'artist',
    }))!
    const cube = (await placesOverview()).find((node) => node.parentId === unit.id)!
    expect(await placeRecords([1, 2, 3], cube.id)).toBe(3)
    expect((await placeContents(cube.id)).map((r) => r.instanceId).sort()).toEqual([1, 2, 3])
    expect((await shelfView({ unplaced: true })).total).toBe(0)
  })
})
