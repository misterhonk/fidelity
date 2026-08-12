import { afterEach, describe, expect, it } from 'vitest'

import { allCopies, distinctReleases } from '~~/db/collection'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem } from '#shared/types'
import { rateRecord } from '~~/worker/collection/rate'
import { shelfView } from '~~/worker/collection/records'

/**
 * Owning the same record twice.
 *
 * Measured on a real account on 2026-08-12: Discogs reported 34 entries and
 * Fidelity showed 32. Two records stood in the shelf twice — two instances
 * each — and the store was keyed by release, so the second copy overwrote the
 * first without a trace. One sleeve invisible, and a rating landing on
 * whichever instance the sync happened to write last.
 */

afterEach(async () => {
  await deleteFidelityDb()
})

function copy(instanceId: number, over: Partial<CollectionItem> = {}): CollectionItem {
  return {
    releaseId: 2_009_692,
    masterId: 55,
    title: 'Like The First Day EP',
    artistIds: [],
    artistNorms: ['robag wruhme'],
    artistNames: ['Robag Wruhme'],
    labelIds: [],
    labelNorms: ['freude am tanzen'],
    labelNames: ['Freude Am Tanzen'],
    catnos: [],
    genres: ['Electronic'],
    styles: ['Tech House'],
    formats: ['Vinyl'],
    year: 2007,
    thumbUrl: '',
    coverUrl: '',
    rating: 0,
    addedAt: '2024-01-01T00:00:00-00:00',
    instanceId,
    folderId: 1,
    ...over,
  }
}

async function shelve(...items: CollectionItem[]) {
  const db = await openFidelityDb()
  for (const item of items) await db.put('collection', item)
}

describe('the same record, owned twice', () => {
  it('stays two rows instead of quietly becoming one', async () => {
    await shelve(copy(2_172_130_249), copy(2_172_146_706))

    expect(await allCopies()).toHaveLength(2)

    const view = await shelfView({ sort: 'added' })
    expect(view.total).toBe(2)
  })

  /*
   * And each copy is rated on its own — which is the point of the whole
   * change. A sealed one and a played one are not the same opinion, and
   * Discogs has always modelled them apart.
   */
  it('rates one copy without touching the other', async () => {
    await shelve(copy(2_172_130_249), copy(2_172_146_706))

    expect(await rateRecord(2_172_130_249, 5)).toBe(true)

    const db = await openFidelityDb()
    expect((await db.get('collection', 2_172_130_249))?.rating).toBe(5)
    expect((await db.get('collection', 2_172_146_706))?.rating).toBe(0)
  })

  /*
   * But everything that reasons about *records* still sees one.
   *
   * A taste profile that counted the second copy would weight a label by how
   * many spares somebody keeps, and the matching engine would think a shelf
   * of 34 rows covers 34 records. Both questions are legitimate; they are
   * just not the same question.
   */
  it('counts as one record wherever the app reasons rather than displays', async () => {
    await shelve(
      copy(2_172_130_249),
      copy(2_172_146_706),
      copy(2_172_147_937, { releaseId: 469_580 }),
    )

    const releases = await distinctReleases()
    expect(releases).toHaveLength(2)
    expect(releases.map((r) => r.releaseId).sort((a, b) => a - b)).toEqual([469_580, 2_009_692])
  })

  /** Of two copies, the one that has something to say is the one kept. */
  it('keeps the copy with a real entry and a rating', async () => {
    await shelve(copy(-2_009_692, { folderId: 0 }), copy(2_172_146_706, { rating: 4 }))

    const [kept] = await distinctReleases()
    expect(kept?.instanceId).toBe(2_172_146_706)
    expect(kept?.rating).toBe(4)
  })
})
