import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import { shelfView } from '~~/worker/collection/records'
import { DEFAULT_SHELF_DIRECTION, type CollectionItem, type ShelfSort } from '#shared/types'

/**
 * Every sort can be turned round.
 *
 * Each of the four keys had exactly one direction, and each was well argued —
 * newest record first, earliest year first, because a collection sorted by
 * year is a timeline. Well argued does not mean right for every question,
 * though. "What has stood unplayed on the shelf longest" is the same list the
 * other way round.
 *
 * The test checks both, and the second is the one that matters: that the
 * direction really changes the *order* and not merely an arrow.
 */

function record(over: Partial<CollectionItem> & { releaseId: number }): CollectionItem {
  const base = {
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
  /*
   * A key of its own. The shelf is keyed by entry since v6, so two
   * fixtures sharing a key would silently be one row.
   */
  return {
    ...base,
    instanceId: base.instanceId ?? -base.releaseId,
    folderId: base.folderId ?? 1,
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

    // Names want A–Z; everything else "the most interesting first" — the
    // newest record, the best rating. Only the year starts at the front.
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
