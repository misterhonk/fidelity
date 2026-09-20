import { afterEach, describe, expect, it } from 'vitest'

import { blankDealer } from '~~/db/dealer'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, Match, StockRow } from '#shared/types'
import { digVisits, discardQuietCheck, markGone } from '~~/worker/dig/history'

/**
 * A dig is a visit (M36): a quiet check-in leaves no dig, a full dig that
 * saw the whole shop marks what the previous one found and it no longer
 * sees, and the list groups the runs by shop.
 */
afterEach(async () => {
  await deleteFidelityDb()
})

const DAY = 86_400_000

const dig = (id: string, startedAt: number, over: Partial<Dig> = {}): Dig => ({
  id,
  dealer: 'plattenkiste',
  status: 'done',
  startedAt,
  finishedAt: startedAt + 1000,
  expiresAt: startedAt + 6 * 3_600_000,
  listingsTotal: 100,
  listingsScanned: 100,
  coverage: 1,
  truncated: false,
  matchCount: 0,
  apiRequests: 1,
  cursor: null,
  ...over,
})

const match = (digId: string, listingId: number): Match => ({
  digId,
  listingId,
  releaseId: listingId + 1000,
  score: 50,
  signals: [],
  title: 'T',
  artist: 'A',
  label: null,
  catno: null,
  format: 'LP',
  year: null,
  condition: null,
  sleeve: null,
  price: null,
  currency: null,
  comments: null,
  thumbUrl: null,
  marketLowestPrice: null,
  marketNumForSale: null,
  expired: false,
})

const stock = (digId: string, listingId: number): StockRow => ({
  digId,
  listingId,
  releaseId: listingId + 1000,
  label: null,
  decade: null,
  title: null,
  artist: null,
  catno: null,
  format: null,
  year: null,
  condition: null,
})

describe('a quiet check-in', () => {
  it('leaves no dig behind, and the shop remembers the look', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', { ...blankDealer('plattenkiste'), quietChecks: 2 })
    const run = dig('01B', 2 * DAY, { depth: 'neu', listingsTotal: 0 })
    await db.put('digs', run)

    await discardQuietCheck(db, run, 2 * DAY + 5)
    expect(await db.get('digs', '01B')).toBeUndefined()
    expect(await db.get('dealers', 'plattenkiste')).toMatchObject({
      checkedAt: 2 * DAY + 5,
      quietChecks: 3,
    })
  })
})

describe('what a full dig no longer sees', () => {
  it('marks the previous full dig’s finds that are not in this dig’s stock', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('01A', 1 * DAY, { status: 'expired' }))
    for (const id of [1, 2, 3]) await db.put('matches', match('01A', id))
    const later = dig('01C', 9 * DAY)
    await db.put('digs', later)
    // Listing 2 is still there but no longer a find; 3 is gone.
    for (const id of [1, 2, 7]) await db.put('stock', stock('01C', id))
    await db.put('matches', match('01C', 1))

    expect(await markGone(db, later, 9 * DAY)).toBe(1)
    expect((await db.get('matches', ['01A', 3]))?.goneAt).toBe(9 * DAY)
    expect((await db.get('matches', ['01A', 2]))?.goneAt).toBeUndefined()
    expect((await db.get('digs', '01C'))?.checkedGone).toBe(true)
  })

  it('says nothing from a dig that did not see the whole shop, or a check-in', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('01A', 1 * DAY))
    await db.put('matches', match('01A', 3))
    const cut = dig('01C', 9 * DAY, { truncated: true, coverage: 0.4 })
    await db.put('digs', cut)
    expect(await markGone(db, cut, 9 * DAY)).toBe(0)
    expect((await db.get('digs', '01C'))?.checkedGone).toBeUndefined()

    const check = dig('01D', 10 * DAY, { depth: 'neu' })
    await db.put('digs', check)
    expect(await markGone(db, check, 10 * DAY)).toBe(0)
    expect((await db.get('matches', ['01A', 3]))?.goneAt).toBeUndefined()
  })
})

describe('the visits', () => {
  it('groups the runs by shop: the newest full dig, what came since, and the fold', async () => {
    const db = await openFidelityDb()
    await db.put('dealers', {
      ...blankDealer('plattenkiste'),
      displayName: 'Plattenkiste',
      quietChecks: 3,
      checkedAt: 6 * DAY,
    })
    await db.put('digs', dig('01A', 1 * DAY, { status: 'expired', matchCount: 31 }))
    await db.put('digs', dig('01B', 3 * DAY, { depth: 'neu', matchCount: 2, listingsTotal: 9 }))
    await db.put('digs', dig('01C', 4 * DAY, { matchCount: 4, checkedGone: true }))
    await db.put('digs', dig('01D', 5 * DAY, { depth: 'neu', matchCount: 1, listingsTotal: 3 }))
    // A quiet check-in from before M36, still written as a dig: read as a quiet look.
    await db.put('digs', dig('01F', 7 * DAY, { depth: 'neu', matchCount: 0, listingsTotal: 0 }))
    for (const id of [1, 2, 3])
      await db.put('matches', { ...match('01A', id), goneAt: 4 * DAY })
    await db.put('matches', match('01A', 4))
    await db.put('digs', dig('019', 2 * DAY, { dealer: 'other', matchCount: 7 }))

    const visits = await digVisits(db)
    expect(visits.map((v) => v.dealer)).toEqual(['plattenkiste', 'other'])
    const [kiste] = visits
    expect(kiste?.displayName).toBe('Plattenkiste')
    expect(kiste?.full?.id).toBe('01C')
    expect(kiste?.since.map((run) => run.id)).toEqual(['01D'])
    expect(kiste?.newFinds).toBe(1)
    expect(kiste?.quietChecks).toBe(4)
    expect(kiste?.checkedAt).toBe(7 * DAY)
    expect(kiste?.runs.map((run) => [run.id, run.kind, run.gone])).toEqual([
      ['01D', 'new', null],
      ['01C', 'full', null],
      ['01B', 'new', null],
      ['01A', 'full', 3],
    ])
  })
})
