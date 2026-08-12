import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem, HorizonChunk, Match } from '#shared/types'
import { forgetLookup, matchDetail, RUN_SPAN } from '~~/worker/dig/detail'

afterEach(async () => {
  forgetLookup()
  await deleteFidelityDb()
})

function chunk(over: Partial<HorizonChunk> & Pick<HorizonChunk, 'kind' | 'entityId'>) {
  const ids = over.releaseIds ?? Int32Array.from([])
  return {
    key: `${over.kind}:${over.entityId}`,
    name: 'Entität',
    fetchedAt: 1,
    complete: true,
    requests: 1,
    releaseIds: ids,
    roles: over.roles ?? new Uint8Array(ids.length),
    years: over.years ?? new Int16Array(ids.length),
    ...over,
  } as HorizonChunk
}

function record(over: Partial<CollectionItem> = {}): CollectionItem {
  const base = {
    releaseId: 1,
    masterId: 0,
    title: 'Platte',
    artistIds: [],
    artistNorms: [],
    artistNames: [],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl', 'LP'],
    year: 2000,
    rating: 0,
    addedAt: '',
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

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 500,
    releaseId: 500,
    score: 60,
    signals: [],
    title: 'Platte',
    artist: 'Wer',
    label: 'Brain',
    catno: 'BRAIN 1003',
    format: 'LP',
    year: 1972,
    condition: null,
    sleeve: null,
    price: 10,
    currency: 'EUR',
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
    ...over,
  }
}

async function seed(chunks: HorizonChunk[], collection: CollectionItem[], m = match()) {
  const db = await openFidelityDb()
  await db.put('matches', m)
  for (const c of chunks) await db.put('horizon', c)
  for (const item of collection) await db.put('collection', item)
  return db
}

const brain = chunk({
  kind: 'label',
  entityId: 5,
  name: 'Brain',
  releaseIds: Int32Array.from([1, 2, 3, 4, 500]),
  catnoNums: Int32Array.from([1001, 1002, 1004, 1005, 1003]),
  catnoPrefix: 'BRAIN',
})

describe('the detail sheet, built from the horizon and nothing else', () => {
  it('returns null for a listing that is not in this dig', async () => {
    await seed([], [])
    expect(await matchDetail('01A', 999)).toBeNull()
  })

  it('places the record in its catalogue series', async () => {
    await seed(
      brain ? [brain] : [],
      [1, 2, 3, 4].map((id) => record({ releaseId: id })),
    )

    const detail = await matchDetail('01A', 500)
    expect(detail?.catalogue).toMatchObject({ label: 'Brain', prefix: 'BRAIN', number: 1003 })

    const grid = detail!.catalogue!.neighbours
    expect(grid.map((n) => n.number)).toEqual([1001, 1002, 1003, 1004, 1005])
    // Four owned around one gap — the whole reason this grid is worth drawing.
    expect(grid.filter((n) => n.owned).map((n) => n.number)).toEqual([1001, 1002, 1004, 1005])
    expect(grid.find((n) => n.isThis)?.number).toBe(1003)
  })

  it('does not call a lone number a series', async () => {
    const lonely = chunk({
      kind: 'label',
      entityId: 5,
      name: 'Brain',
      releaseIds: Int32Array.from([500]),
      catnoNums: Int32Array.from([1003]),
      catnoPrefix: 'BRAIN',
    })
    await seed([lonely], [])
    expect((await matchDetail('01A', 500))?.catalogue).toBeNull()
  })

  it('leaves out numbers too far away to mean anything', async () => {
    const spread = chunk({
      kind: 'label',
      entityId: 5,
      name: 'Brain',
      releaseIds: Int32Array.from([1, 500]),
      catnoNums: Int32Array.from([1003 + RUN_SPAN + 5, 1003]),
      catnoPrefix: 'BRAIN',
    })
    await seed([spread], [record({ releaseId: 1 })])
    expect((await matchDetail('01A', 500))?.catalogue).toBeNull()
  })

  it('says nothing about a catalogue number it cannot read', async () => {
    await seed([brain], [], match({ catno: 'none' }))
    expect((await matchDetail('01A', 500))?.catalogue).toBeNull()
  })

  it('reports how much of an artist you already hold', async () => {
    const artist = chunk({
      kind: 'artist',
      entityId: 40135,
      name: 'Robag Wruhme',
      releaseIds: Int32Array.from([1, 2, 3, 500]),
      roles: Uint8Array.from([0, 0, 0, 0]),
      years: Int16Array.from([2002, 2003, 2004, 2006]),
    })
    await seed(
      [artist],
      [1, 2, 3].map((id) => record({ releaseId: id, year: 2000 + id })),
    )

    // The window comes from the horizon's own years, not the collection row's:
    // the horizon knows the release year, the mirror knows when you filed it.
    const detail = await matchDetail('01A', 500)
    expect(detail?.discography).toEqual([
      { artist: 'Robag Wruhme', owned: 3, total: 4, from: 2002, to: 2004 },
    ])
  })

  it('lists main credits before production work', async () => {
    const main = chunk({
      kind: 'artist',
      entityId: 1,
      name: 'Hauptkünstler',
      releaseIds: Int32Array.from([500]),
      roles: Uint8Array.from([0]),
    })
    const producer = chunk({
      kind: 'artist',
      entityId: 2,
      name: 'Produzent',
      releaseIds: Int32Array.from([500]),
      roles: Uint8Array.from([1]),
    })
    await seed([producer, main], [])

    expect((await matchDetail('01A', 500))?.connections.map((c) => c.name)).toEqual([
      'Hauptkünstler',
      'Produzent',
    ])
  })

  it('does not keep answering from a cache the collection moved under', async () => {
    const artist = chunk({
      kind: 'artist',
      entityId: 40135,
      name: 'Robag Wruhme',
      releaseIds: Int32Array.from([1, 2, 500]),
      roles: Uint8Array.from([0, 0, 0]),
      years: Int16Array.from([2002, 2003, 2006]),
    })
    const db = await seed([artist], [record({ releaseId: 1 })])
    expect((await matchDetail('01A', 500))?.discography[0]?.owned).toBe(1)

    // A library sync arrives. Without invalidation the sheet would keep
    // saying "1 von 3" — which reads as a matching bug, not a stale cache.
    await db.put('collection', record({ releaseId: 2 }))
    forgetLookup()

    expect((await matchDetail('01A', 500))?.discography[0]?.owned).toBe(2)
  })

  it('works with no horizon at all', async () => {
    // Before the horizon is built the sheet still opens; it just has less to
    // say. That is the same graceful degradation the scan has.
    await seed([], [])
    const detail = await matchDetail('01A', 500)
    expect(detail?.match.listingId).toBe(500)
    expect(detail?.catalogue).toBeNull()
    expect(detail?.discography).toEqual([])
    expect(detail?.connections).toEqual([])
  })
})
