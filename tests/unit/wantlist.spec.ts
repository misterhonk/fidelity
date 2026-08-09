import { afterEach, describe, expect, it } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, HorizonChunk, Match, WantlistItem } from '#shared/types'
import { wantlistOverview } from '~~/worker/collection/wantlist'

afterEach(async () => {
  await deleteFidelityDb()
})

const NOW = 1_800_000_000_000
const DAY = 86_400_000

function want(over: Partial<WantlistItem> = {}): WantlistItem {
  return {
    releaseId: 9001,
    masterId: 77,
    title: 'Dummy',
    artistIds: [610],
    artistNorms: ['portishead'],
    artistNames: ['Portishead'],
    labelIds: [],
    labelNorms: [],
    labelNames: [],
    catnos: [],
    genres: [],
    styles: [],
    formats: ['Vinyl', 'LP'],
    year: 1994,
    addedAt: '2021-03-01T00:00:00-08:00',
    ...over,
  } as WantlistItem
}

const master = (entityId: number, pressings: number): HorizonChunk =>
  ({
    key: `master:${entityId}`,
    kind: 'master',
    entityId,
    name: 'Album',
    fetchedAt: 1,
    complete: true,
    requests: 1,
    releaseIds: Int32Array.from(Array.from({ length: pressings }, (_, i) => i + 1)),
    roles: new Uint8Array(pressings),
    years: new Int16Array(pressings),
  }) as HorizonChunk

const dig = (id: string, dealer: string, startedAt: number): Dig =>
  ({
    id,
    dealer,
    status: 'done',
    startedAt,
    finishedAt: startedAt,
    expiresAt: startedAt + 6 * 3600_000,
    listingsTotal: 100,
    listingsScanned: 100,
    coverage: 1,
    matchCount: 1,
    apiRequests: 1,
    cursor: null,
  }) as Dig

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 1,
    releaseId: 500,
    score: 70,
    signals: [],
    reason: '',
    title: 'X',
    artist: 'Y',
    label: null,
    catno: null,
    format: 'LP',
    year: 2017,
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

async function seed(parts: {
  wantlist?: WantlistItem[]
  chunks?: HorizonChunk[]
  digs?: Dig[]
  matches?: Match[]
}) {
  const db = await openFidelityDb()
  for (const item of parts.wantlist ?? []) await db.put('wantlist', item)
  for (const chunk of parts.chunks ?? []) await db.put('horizon', chunk)
  for (const entry of parts.digs ?? []) await db.put('digs', entry)
  for (const entry of parts.matches ?? []) await db.put('matches', entry)
}

describe('the wantlist, finally visible', () => {
  it('says how many pressings the horizon knows of', async () => {
    // The number that makes an entry actionable: one of 160 turns up far more
    // often than the only pressing there is.
    await seed({ wantlist: [want()], chunks: [master(77, 160)] })

    const { records, withPressings } = await wantlistOverview(NOW)
    expect(records[0]).toMatchObject({ title: 'Dummy', artist: 'Portishead', pressings: 160 })
    expect(withPressings).toBe(1)
  })

  it('says "not expanded" rather than zero', async () => {
    // Nought pressings would be a claim; not knowing is the truth.
    await seed({ wantlist: [want()] })
    expect((await wantlistOverview(NOW)).records[0]?.pressings).toBeNull()
  })

  it('distinguishes an album with no master at all', async () => {
    await seed({ wantlist: [want({ masterId: 0 })] })
    const [record] = (await wantlistOverview(NOW)).records
    expect(record?.masterId).toBe(0)
    expect(record?.pressings).toBeNull()
  })

  it('reports where a dig offered the exact pressing', async () => {
    await seed({
      wantlist: [want({ releaseId: 9001 })],
      digs: [dig('01A', '430AM_Studio', NOW - 3 * DAY)],
      matches: [match({ releaseId: 9001, score: 87 })],
    })

    expect((await wantlistOverview(NOW)).records[0]?.lastSeen).toMatchObject({
      dealer: '430AM_Studio',
      score: 87,
    })
  })

  it('counts a different pressing of the same album as seen', async () => {
    // That is the entire point of S2 — a wantlist screen matching only exact
    // release ids would report "never seen" about a record somebody was
    // offered last week.
    await seed({
      wantlist: [want({ releaseId: 9001, masterId: 77 })],
      digs: [dig('01A', 'vinyl-tom', NOW - DAY)],
      matches: [
        match({
          releaseId: 9999,
          signals: [{ type: 'WANTLIST_PRESSING', confidence: 0.9, evidence: { masterId: 77 } }],
        }),
      ],
    })

    expect((await wantlistOverview(NOW)).records[0]?.lastSeen?.dealer).toBe('vinyl-tom')
  })

  it('keeps the most recent sighting when there are several', async () => {
    await seed({
      wantlist: [want({ releaseId: 9001 })],
      digs: [dig('01A', 'alt', NOW - 40 * DAY), dig('01B', 'neu', NOW - 2 * DAY)],
      matches: [
        match({ digId: '01A', listingId: 1, releaseId: 9001 }),
        match({ digId: '01B', listingId: 2, releaseId: 9001 }),
      ],
    })

    expect((await wantlistOverview(NOW)).records[0]?.lastSeen?.dealer).toBe('neu')
  })

  it('counts only sightings from the last thirty days as recent', async () => {
    await seed({
      wantlist: [want({ releaseId: 9001 })],
      digs: [dig('01A', 'alt', NOW - 90 * DAY)],
      matches: [match({ releaseId: 9001 })],
    })

    const overview = await wantlistOverview(NOW)
    expect(overview.records[0]?.lastSeen).not.toBeNull()
    expect(overview.seenRecently).toBe(0)
  })

  it('puts the longest-wanted record first', async () => {
    // A wantlist is a queue of disappointments; the 2019 entry is the one
    // worth being reminded of.
    await seed({
      wantlist: [
        want({ releaseId: 1, addedAt: '2024-01-01T00:00:00-08:00', title: 'Neu' }),
        want({ releaseId: 2, addedAt: '2019-05-01T00:00:00-08:00', title: 'Alt' }),
      ],
    })

    expect((await wantlistOverview(NOW)).records.map((r) => r.title)).toEqual(['Alt', 'Neu'])
  })

  it('says nothing rather than breaking on an empty wantlist', async () => {
    expect(await wantlistOverview(NOW)).toEqual({
      total: 0,
      records: [],
      withPressings: 0,
      seenRecently: 0,
    })
  })
})
