import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import { openFidelityDb } from '~~/db/open'
import {
  createPlace,
  MAX_DEPTH,
  moveAll,
  placeContents,
  placeRecord,
  placesOverview,
  removePlace,
} from '~~/worker/places'
import type { CollectionItem } from '#shared/types'

/**
 * Wo die Platte steht (M12).
 *
 * Das einzige Feature dieser App, das **null Requests** kostet — es gibt also
 * nichts zu mocken und keinen Grund, die Datenbank zu meiden. Geprüft wird
 * gegen eine echte IndexedDB, weil genau dort die Entscheidungen liegen:
 * welcher Store, welcher Schlüssel, was beim Löschen passiert.
 */
const platte = (instanceId: number, title: string): CollectionItem => ({
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
    const keller = (await createPlace('Keller', null))!
    const kiste = (await createPlace('Kiste 3', keller.id))!

    const db = await openFidelityDb()
    await db.put('collection', platte(1, 'Eins'))
    await db.put('collection', platte(2, 'Zwei'))
    await placeRecord(1, keller.id)
    await placeRecord(2, kiste.id)

    const nodes = await placesOverview()
    const kellerNode = nodes.find((n) => n.id === keller.id)!

    expect(kellerNode.records).toBe(1)
    // „Im Keller" meint den ganzen Keller. Ein Keller, der 1 zeigt, während
    // zwei Platten darin liegen, ist eine Lüge.
    expect(kellerNode.recordsBelow).toBe(2)
  })

  /** Drei Ebenen: Ort → Möbel → Fach. Wer eine vierte braucht, benennt besser. */
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
   * Ein Ort aufzulösen wirft keine Platten weg.
   *
   * Das Regal abzubauen heißt nicht, die Platten wegzugeben — sie werden
   * ortlos. Und Unterorte rücken nach oben statt mitzusterben.
   */
  it('lets go of its records without losing them', async () => {
    const keller = (await createPlace('Keller', null))!
    const kiste = (await createPlace('Kiste', keller.id))!

    const db = await openFidelityDb()
    await db.put('collection', platte(1, 'Eins'))
    await placeRecord(1, keller.id)

    await removePlace(keller.id)

    expect(await db.get('collection', 1)).toBeTruthy()
    expect(await db.get('placements', 1)).toBeUndefined()

    // Und die Kiste steht jetzt oben statt nirgends.
    const nodes = await placesOverview()
    expect(nodes.find((n) => n.id === kiste.id)?.parentId).toBeNull()
  })
})

describe('finding things again', () => {
  it('answers what is in the cellar, boxes included', async () => {
    const keller = (await createPlace('Keller', null))!
    const kiste = (await createPlace('Kiste', keller.id))!

    const db = await openFidelityDb()
    await db.put('collection', platte(1, 'Oben'))
    await db.put('collection', platte(2, 'In der Kiste'))
    await placeRecord(1, keller.id)
    await placeRecord(2, kiste.id)

    const drin = await placeContents(keller.id)
    expect(drin.map((r) => r.title).sort()).toEqual(['In der Kiste', 'Oben'])
  })

  /**
   * Eine Platte, die aus der Sammlung verschwunden ist, hinterlässt ihren
   * Standort. Der Ort weiß dann mehr als die Sammlung — gezeigt wird sie
   * trotzdem nicht, sonst stünde dort ein Loch.
   */
  it('skips a record that is no longer in the collection', async () => {
    const keller = (await createPlace('Keller', null))!
    await placeRecord(99, keller.id)
    expect(await placeContents(keller.id)).toEqual([])
  })

  /** Wer umzieht, trägt Kisten, keine Platten. */
  it('moves a whole box at once', async () => {
    const alt = (await createPlace('Kiste 3', null))!
    const neu = (await createPlace('Regal 2', null))!

    const db = await openFidelityDb()
    for (const id of [1, 2, 3]) {
      await db.put('collection', platte(id, `Platte ${id}`))
      await placeRecord(id, alt.id)
    }

    expect(await moveAll(alt.id, neu.id)).toBe(3)
    expect(await placeContents(alt.id)).toEqual([])
    expect((await placeContents(neu.id)).length).toBe(3)
  })

  /**
   * Und eine Kiste zieht nicht auf sich selbst um.
   *
   * Die erste Fassung dieses Tests war grün aus dem falschen Grund: der Ort
   * war leer, also kam auch ohne die Prüfung 0 heraus. Eine Mutationsprobe hat
   * das gezeigt — jetzt liegen Platten darin, und nur die Prüfung hält die
   * Zahl bei null.
   */
  it('does not move a box onto itself', async () => {
    const a = (await createPlace('A', null))!

    const db = await openFidelityDb()
    for (const id of [1, 2]) {
      await db.put('collection', platte(id, `Platte ${id}`))
      await placeRecord(id, a.id)
    }

    expect(await moveAll(a.id, a.id)).toBe(0)
    // Und sie liegen immer noch dort.
    expect((await placeContents(a.id)).length).toBe(2)
  })
})

/**
 * Und die Entscheidung, die keinem Testlauf, sondern nur dem Quelltext
 * anzusehen ist.
 */
describe('where the location is kept', () => {
  /**
   * **Nicht am Sammlungseintrag.**
   *
   * `worker/sync/library.ts` schreibt jede Zeile mit `put()` neu. Ein
   * Standort dort wäre nach dem nächsten vollen Durchlauf lautlos weg — und
   * „lautlos" ist das Schlimme daran: niemand merkt, dass die halbe Wohnung
   * vergessen wurde, bis er eine Platte sucht.
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

  /** Am Exemplar, nicht am Release: zwei Pressungen liegen an zwei Stellen. */
  it('hangs on the copy, not on the record', () => {
    const types = readFileSync('shared/types.ts', 'utf8')
    const placement = types.slice(types.indexOf('export interface Placement'))
    expect(placement.slice(0, placement.indexOf('\n}'))).toMatch(/instanceId: number/)
    expect(placement.slice(0, placement.indexOf('\n}'))).not.toMatch(/releaseId/)
  })

  /** Und nichts davon geht irgendwohin. */
  it('never leaves the device', () => {
    const source = readFileSync('worker/places.ts', 'utf8')
    expect(source).not.toMatch(/fetch\(|DiscogsClient|hub|discogs\.com/i)
  })
})
