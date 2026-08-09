import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { CollectionItem, HorizonChunk } from '#shared/types'
import { collectionGaps, LIMIT, MIN_OWNED } from '~~/worker/collection/gaps'

afterEach(async () => {
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
  return {
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
    year: 2004,
    rating: 0,
    addedAt: '',
    ...over,
  }
}

async function seed(chunks: HorizonChunk[], collection: CollectionItem[]) {
  const db = await openFidelityDb()
  for (const c of chunks) await db.put('horizon', c)
  for (const item of collection) await db.put('collection', item)
}

describe('what the shelf is missing', () => {
  it('says the horizon is not built rather than showing nothing', async () => {
    await seed([], [record()])
    expect(await collectionGaps()).toEqual({ built: false, artists: [], labels: [] })
  })

  it('counts what you own against what exists under that name', async () => {
    const artist = chunk({
      kind: 'artist',
      entityId: 40135,
      name: 'Robag Wruhme',
      releaseIds: Int32Array.from([1, 2, 3, 4, 5, 6]),
      roles: Uint8Array.from([0, 0, 0, 0, 0, 0]),
      years: Int16Array.from([2002, 2003, 2004, 2005, 2006, 2007]),
    })
    await seed(
      [artist],
      [1, 2, 3].map((id) => record({ releaseId: id })),
    )

    const { artists } = await collectionGaps()
    expect(artists[0]).toMatchObject({ name: 'Robag Wruhme', owned: 3, total: 6, missing: 3 })
  })

  it('ranks by how many you own, not by how small the catalogue is', async () => {
    // Sorting by share was tried against a real shelf and put "2 von 24" above
    // "5 von 252", calling the first nearly complete. It is not a completion
    // percentage — Discogs files singles, remixes and sampler tracks under the
    // same name.
    const small = chunk({
      kind: 'artist',
      entityId: 1,
      name: 'Kleiner Katalog',
      releaseIds: Int32Array.from([1, 2, 10, 11]),
      roles: new Uint8Array(4),
      years: new Int16Array(4),
    })
    const big = chunk({
      kind: 'artist',
      entityId: 2,
      name: 'Großer Katalog',
      releaseIds: Int32Array.from([3, 4, 5, ...Array.from({ length: 90 }, (_, i) => 100 + i)]),
      roles: new Uint8Array(93),
      years: new Int16Array(93),
    })
    await seed(
      [small, big],
      [1, 2, 3, 4, 5].map((id) => record({ releaseId: id })),
    )

    const { artists } = await collectionGaps()
    expect(artists.map((a) => a.name)).toEqual(['Großer Katalog', 'Kleiner Katalog'])
  })

  it('ignores an artist you own one record of', async () => {
    const artist = chunk({
      kind: 'artist',
      entityId: 1,
      name: 'Zufall',
      releaseIds: Int32Array.from([1, 2, 3]),
      roles: new Uint8Array(3),
      years: new Int16Array(3),
    })
    await seed([artist], [record({ releaseId: 1 })])

    expect((await collectionGaps()).artists).toEqual([])
    expect(MIN_OWNED).toBe(2)
  })

  it('leaves out an artist you already own everything of', async () => {
    const artist = chunk({
      kind: 'artist',
      entityId: 1,
      name: 'Komplett',
      releaseIds: Int32Array.from([1, 2]),
      roles: new Uint8Array(2),
      years: new Int16Array(2),
    })
    await seed(
      [artist],
      [1, 2].map((id) => record({ releaseId: id })),
    )
    expect((await collectionGaps()).artists).toEqual([])
  })

  it('counts only main credits, not production work', async () => {
    // Producing somebody else's record is not a hole in your own shelf.
    const producer = chunk({
      kind: 'artist',
      entityId: 55,
      name: 'Conny Plank',
      // Three records of his own, two he produced for other people.
      releaseIds: Int32Array.from([1, 2, 3, 4, 5]),
      roles: Uint8Array.from([0, 0, 0, 1, 1]),
      years: new Int16Array(5),
    })
    await seed(
      [producer],
      [1, 2].map((id) => record({ releaseId: id })),
    )

    // Two of three, not two of five: the productions are somebody else's
    // records and their absence is not a hole in this shelf.
    expect((await collectionGaps()).artists[0]).toMatchObject({ owned: 2, total: 3 })
  })

  it('stops before it becomes a database', async () => {
    const chunks = Array.from({ length: LIMIT + 5 }, (_, i) =>
      chunk({
        kind: 'artist',
        entityId: i + 1,
        name: `Künstler ${i}`,
        releaseIds: Int32Array.from([i * 10 + 1, i * 10 + 2, i * 10 + 3]),
        roles: new Uint8Array(3),
        years: new Int16Array(3),
      }),
    )
    const owned = chunks.flatMap((_, i) => [
      record({ releaseId: i * 10 + 1 }),
      record({ releaseId: i * 10 + 2 }),
    ])
    await seed(chunks, owned)

    expect((await collectionGaps()).artists).toHaveLength(LIMIT)
  })
})

describe('which labels you really collect', () => {
  const ohr = chunk({ kind: 'label', entityId: 1, name: 'Ohr', catalogueSize: 100 })
  const warner = chunk({ kind: 'label', entityId: 2, name: 'Warner', catalogueSize: 100_000 })

  const on = (id: number, name: string) => ({
    labelIds: [id],
    labelNorms: [name.toLowerCase()],
    labelNames: [name],
  })

  it('rates a small label you buy from heavily far above a huge one', async () => {
    // The question the bare counts could not answer: six of Cocoon's 1.499 is
    // a different fact from five of Border Community's 238.
    await seed(
      [ohr, warner],
      [
        ...Array.from({ length: 3 }, (_, i) => record({ releaseId: i + 1, ...on(1, 'Ohr') })),
        ...Array.from({ length: 10 }, (_, i) =>
          record({ releaseId: 100 + i, ...on(2, 'Warner') }),
        ),
      ],
    )

    const { labels } = await collectionGaps()
    expect(labels[0]?.name).toBe('Ohr')
    expect(labels[0]?.lift).toBeGreaterThan(2)
    expect(labels.find((l) => l.name === 'Warner')?.lift).toBeLessThan(1)
  })

  it('carries the denominator, so the number can be read', async () => {
    await seed([ohr], [record({ releaseId: 1, ...on(1, 'Ohr') })])
    expect((await collectionGaps()).labels[0]).toMatchObject({ owned: 1, catalogueSize: 100 })
  })

  it('leaves out a label whose catalogue size nobody knows', async () => {
    await seed([], [record({ releaseId: 1, ...on(9, 'Unbekannt') })])
    expect((await collectionGaps()).labels).toEqual([])
  })

  it('counts a record once per label, however often it names one', async () => {
    await seed(
      [ohr],
      [
        {
          ...record({ releaseId: 1 }),
          labelIds: [1, 1],
          labelNorms: ['ohr', 'ohr'],
          labelNames: ['Ohr', 'Ohr'],
        },
      ],
    )
    expect((await collectionGaps()).labels[0]?.owned).toBe(1)
  })
})
