import { afterEach, describe, expect, it } from 'vitest'

import { DIG_TTL_MS, expireDigs, pruneDigs } from '~~/db/expire'
import {
  DEFAULT_PREFERENCES,
  getMeta,
  getPreferences,
  setMeta,
  updatePreferences,
} from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, Match } from '#shared/types'

afterEach(async () => {
  await deleteFidelityDb()
})

function dig(id: string, overrides: Partial<Dig> = {}): Dig {
  const startedAt = 1_754_700_000_000
  return {
    id,
    dealer: 'vinyl-tom',
    status: 'done',
    startedAt,
    finishedAt: startedAt + 120_000,
    expiresAt: startedAt + DIG_TTL_MS,
    listingsTotal: 43_234,
    listingsScanned: 20_000,
    coverage: 20_000 / 43_234,
    truncated: true,
    matchCount: 1,
    apiRequests: 201,
    cursor: null,
    ...overrides,
  }
}

function match(digId: string, listingId: number, overrides: Partial<Match> = {}): Match {
  return {
    digId,
    listingId,
    releaseId: 2598,
    score: 91,
    signals: [{ type: 'CREDIT_GRAPH', confidence: 1, evidence: { artist: 'Conny Plank' } }],
    reason: 'Conny Plank am Pult – du hast 9 seiner Produktionen, diese nicht.',
    title: 'Neu! 2',
    artist: 'Neu!',
    label: 'Brain',
    catno: 'BRAIN 1031',
    format: 'Vinyl, LP, Album',
    year: 1973,
    condition: 'Very Good Plus (VG+)',
    sleeve: 'Very Good Plus (VG+)',
    price: 24,
    currency: 'EUR',
    comments: 'Small seam split',
    thumbUrl: 'https://i.discogs.com/x.jpg',
    marketLowestPrice: 41,
    marketNumForSale: 12,
    expired: false,
    ...overrides,
  }
}

describe('database schema', () => {
  it('creates every store with its indexes', async () => {
    const db = await openFidelityDb()

    expect([...db.objectStoreNames].sort()).toEqual([
      'basket',
      'collection',
      'dealers',
      'digs',
      'feedback',
      'horizon',
      'matches',
      'meta',
      'wantlist',
    ])

    const tx = db.transaction(['collection', 'matches'])
    expect([...tx.objectStore('collection').indexNames]).toEqual(['by-master'])
    expect([...tx.objectStore('matches').indexNames]).toEqual(['by-dig-score'])
  })
})

describe('meta store', () => {
  it('merges stored preferences over the defaults', async () => {
    await updatePreferences({ maxPrice: 40 })

    const prefs = await getPreferences()
    expect(prefs.maxPrice).toBe(40)
    expect(prefs.formatsAllow).toEqual(['Vinyl'])
    expect(prefs.prefMediaCondition).toBe(DEFAULT_PREFERENCES.prefMediaCondition)
  })

  it('leaves the hub unconfigured by default — no feature may require one', async () => {
    expect((await getPreferences()).hubUrl).toBeNull()
  })

  it('wipes the token together with everything else on sign-out', async () => {
    await setMeta('token', 'a-personal-access-token')
    expect(await getMeta('token')).toBe('a-personal-access-token')

    await deleteFidelityDb()

    expect(await getMeta('token')).toBeUndefined()
  })
})

describe('the six-hour rule', () => {
  it('nulls marketplace data but keeps our own derivations', async () => {
    const db = await openFidelityDb()
    const expired = dig('01AAA')
    await db.put('digs', expired)
    await db.put('matches', match('01AAA', 500))

    const nulled = await expireDigs(db, expired.expiresAt + 1)
    expect(nulled).toBe(1)

    const after = await db.get('matches', ['01AAA', 500])
    expect(after?.expired).toBe(true)
    expect(after?.price).toBeNull()
    expect(after?.condition).toBeNull()
    expect(after?.thumbUrl).toBeNull()
    expect(after?.marketLowestPrice).toBeNull()
    // Ours — a user still sees that there were 47 matches and why.
    expect(after?.score).toBe(91)
    expect(after?.reason).toContain('Conny Plank')
    expect(after?.signals).toHaveLength(1)

    expect((await db.get('digs', '01AAA'))?.status).toBe('expired')
  })

  it('leaves a dig alone while it is still inside its window', async () => {
    const db = await openFidelityDb()
    const fresh = dig('01BBB')
    await db.put('digs', fresh)
    await db.put('matches', match('01BBB', 501))

    expect(await expireDigs(db, fresh.expiresAt - 1)).toBe(0)
    expect((await db.get('matches', ['01BBB', 501]))?.price).toBe(24)
    expect((await db.get('digs', '01BBB'))?.status).toBe('done')
  })

  it('is idempotent — a second pass finds nothing left to strip', async () => {
    const db = await openFidelityDb()
    const old = dig('01CCC')
    await db.put('digs', old)
    await db.put('matches', match('01CCC', 502))

    await expireDigs(db, old.expiresAt + 1)
    expect(await expireDigs(db, old.expiresAt + 1)).toBe(0)
  })
})

describe('dig history', () => {
  it('keeps the newest five and drops the rest with their matches', async () => {
    const db = await openFidelityDb()
    // ULIDs sort chronologically, so 01A < 01B < … is oldest to newest.
    for (const id of ['01A', '01B', '01C', '01D', '01E', '01F', '01G']) {
      await db.put('digs', dig(id))
      await db.put('matches', match(id, 700))
    }

    expect(await pruneDigs(db)).toEqual(['01B', '01A'])

    expect((await db.getAllKeys('digs')).sort()).toEqual(['01C', '01D', '01E', '01F', '01G'])
    expect(await db.get('matches', ['01A', 700])).toBeUndefined()
    expect(await db.get('matches', ['01G', 700])).toBeDefined()
  })

  it('does nothing while the history still fits', async () => {
    const db = await openFidelityDb()
    await db.put('digs', dig('01A'))

    expect(await pruneDigs(db)).toEqual([])
  })
})
