import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { shelfView } from '~~/worker/collection/records'
import { DEFAULT_SHELF_DIRECTION, type CollectionItem, type ShelfSort } from '#shared/types'

/**
 * Jede Sortierung lässt sich umdrehen.
 *
 * Jeder der vier Schlüssel hatte genau eine Richtung, und jede war gut
 * begründet — die neueste Platte zuerst, das älteste Jahr zuerst, weil eine
 * nach Jahren sortierte Sammlung eine Zeitachse ist. Gut begründet heißt aber
 * nicht: für jede Frage richtig. „Was steht am längsten ungehört im Regal" ist
 * dieselbe Liste andersherum.
 *
 * Der Test prüft beides, und das zweite ist das wichtigere: dass sich mit der
 * Richtung wirklich die *Reihenfolge* ändert und nicht bloß ein Pfeil.
 */

function record(over: Partial<CollectionItem> & { releaseId: number }): CollectionItem {
  return {
    masterId: 0,
    title: 'Titel',
    artistIds: [],
    artistNorms: [],
    artistNames: ['Artist'],
    labelIds: [],
    labelNorms: [],
    labelNames: ['Label'],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl'],
    year: 1970,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    addedAt: '2024-01-01T00:00:00-00:00',
    ...over,
  }
}

const RECORDS = [
  record({
    releaseId: 1,
    artistNames: ['Aaron'],
    year: 1965,
    rating: 2,
    addedAt: '2024-01-01T00:00:00-00:00',
  }),
  record({
    releaseId: 2,
    artistNames: ['Bea'],
    year: 1980,
    rating: 5,
    addedAt: '2024-06-01T00:00:00-00:00',
  }),
  record({
    releaseId: 3,
    artistNames: ['Cee'],
    year: 1972,
    rating: 4,
    addedAt: '2025-02-01T00:00:00-00:00',
  }),
]

async function seed() {
  const db = await openFidelityDb()
  for (const item of RECORDS) await db.put('collection', item)
}

afterEach(async () => {
  await deleteFidelityDb()
})

const SORTS: ShelfSort[] = ['added', 'artist', 'year', 'rating']

describe('the shelf, in both directions', () => {
  it('starts each key on the direction that key is for', async () => {
    await seed()

    // Namen wollen A–Z; alles andere „das Interessanteste zuerst" — die
    // neueste Platte, die beste Bewertung. Nur das Jahr fängt vorne an.
    expect(DEFAULT_SHELF_DIRECTION).toEqual({
      added: 'desc',
      artist: 'asc',
      year: 'asc',
      rating: 'desc',
    })

    const artists = (await shelfView({ sort: 'artist' })).records.map((r) => r.artist)
    expect(artists).toEqual(['Aaron', 'Bea', 'Cee'])
  })

  it('turns the same list around, for every key', async () => {
    await seed()

    for (const sort of SORTS) {
      const forwards = (await shelfView({ sort })).records.map((r) => r.releaseId)
      const backwards = (
        await shelfView({
          sort,
          direction: DEFAULT_SHELF_DIRECTION[sort] === 'asc' ? 'desc' : 'asc',
        })
      ).records.map((r) => r.releaseId)

      expect(backwards, `${sort} did not turn around`).toEqual([...forwards].reverse())
    }
  })

  it('leaves a call that names no direction exactly as it was', async () => {
    await seed()

    // Der ganze Punkt der Vorgabe: alter Aufrufer, altes Verhalten.
    for (const sort of SORTS) {
      const implicit = (await shelfView({ sort })).records.map((r) => r.releaseId)
      const explicit = (
        await shelfView({ sort, direction: DEFAULT_SHELF_DIRECTION[sort] })
      ).records.map((r) => r.releaseId)

      expect(implicit).toEqual(explicit)
    }
  })
})
