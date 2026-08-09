import { afterEach, describe, expect, it } from 'vitest'

import { setMeta } from '~~/db/meta'
import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Dig, Match } from '#shared/types'
import { exportDig, exportEverything } from '~~/worker/export'

afterEach(async () => {
  await deleteFidelityDb()
})

const dig: Dig = {
  id: '01A',
  dealer: '430AM_Studio',
  status: 'done',
  startedAt: 1000,
  finishedAt: 2000,
  expiresAt: 1000 + 6 * 60 * 60 * 1000,
  listingsTotal: 35_903,
  listingsScanned: 20_000,
  coverage: 0.56,
  matchCount: 1,
  apiRequests: 200,
  cursor: null,
}

function match(over: Partial<Match> = {}): Match {
  return {
    digId: '01A',
    listingId: 7,
    releaseId: 70,
    score: 87,
    signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
    reason: 'Steht genau so auf deiner Wantlist.',
    title: 'Dummy',
    artist: 'Portishead',
    label: 'Go! Beat',
    catno: '828 522-1',
    format: 'LP',
    year: 2017,
    condition: 'Mint (M)',
    sleeve: 'Mint (M)',
    price: 33.99,
    currency: 'EUR',
    comments: 'SEALED NEW ITEM',
    thumbUrl: 'https://i.discogs.com/x.jpg',
    marketLowestPrice: 25,
    marketNumForSale: 40,
    expired: false,
    ...over,
  }
}

async function seed() {
  const db = await openFidelityDb()
  await db.put('digs', dig)
  await db.put('matches', match())
  return db
}

/** Every field docs/09 §1.3 calls Restricted Data. */
const MARKETPLACE_FIELDS = [
  'price',
  'currency',
  'condition',
  'sleeve',
  'comments',
  'marketLowestPrice',
  'marketNumForSale',
  'thumbUrl',
]

describe('exporting a dig to share', () => {
  it('carries the reasoning', async () => {
    await seed()
    const file = (await exportDig('01A', 5000))!

    expect(file).toMatchObject({ kind: 'fidelity-dig', dealer: '430AM_Studio', coverage: 0.56 })
    expect(file.matches[0]).toMatchObject({
      listingId: 7,
      score: 87,
      reason: 'Steht genau so auf deiner Wantlist.',
    })
  })

  it('carries no marketplace data at all', async () => {
    await seed()
    const file = (await exportDig('01A', 5000))!
    const serialised = JSON.stringify(file)

    // docs/09 §1.3: Restricted Data must not be passed to third parties, and
    // an export file is the most third-party-shaped thing in the app.
    for (const field of MARKETPLACE_FIELDS) {
      expect(Object.keys(file.matches[0]!)).not.toContain(field)
    }
    expect(serialised).not.toContain('33.99')
    expect(serialised).not.toContain('SEALED NEW ITEM')
    expect(serialised).not.toContain('i.discogs.com')
  })

  it('links to the listing instead of copying its price', async () => {
    await seed()
    const file = (await exportDig('01A', 5000))!
    expect(file.matches[0]?.discogsUrl).toBe('https://www.discogs.com/sell/item/7')
  })

  it('says in the file itself why the prices are missing', async () => {
    await seed()
    expect((await exportDig('01A', 5000))!.note).toContain('Marktplatzdaten')
  })

  it('sorts strongest first', async () => {
    const db = await seed()
    await db.put('matches', match({ listingId: 8, score: 40 }))
    await db.put('matches', match({ listingId: 9, score: 95 }))

    const file = (await exportDig('01A', 5000))!
    expect(file.matches.map((m) => m.score)).toEqual([95, 87, 40])
  })

  it('returns nothing for a dig that is not there', async () => {
    expect(await exportDig('nope', 5000)).toBeNull()
  })
})

describe('exporting everything', () => {
  it('never writes the token into a file', async () => {
    await seed()
    await setMeta('token', 'super-secret-personal-access-token')
    await setMeta('identity', { userId: 1, username: 'mm', avatarUrl: 'x' })

    const file = await exportEverything(5000)

    // CLAUDE.md rule 6. A token in a file is a credential in a file.
    expect(JSON.stringify(file)).not.toContain('super-secret')
    expect(file.identity).toEqual({ username: 'mm' })
  })

  it('leaves marketplace data out of the backup too', async () => {
    await seed()
    expect(JSON.stringify(await exportEverything(5000))).not.toContain('SEALED NEW ITEM')
  })

  it('leaves the horizon out, because it is reproducible', async () => {
    await seed()
    const file = await exportEverything(5000)
    // A few hundred thousand ids that JSON would inflate tenfold, all of it
    // fetchable again. A backup holds what cannot be refetched.
    expect(Object.keys(file)).not.toContain('horizon')
    expect(file.note).toContain('Horizont')
  })

  it('carries the parts that cannot be fetched again', async () => {
    const db = await seed()
    await db.put('feedback', {
      listingId: 7,
      releaseId: 70,
      verdict: 'interesting',
      signals: [],
      score: 87,
      createdAt: 1,
    })

    const file = await exportEverything(5000)
    // Verdicts are the one thing in the app that exists nowhere else.
    expect(file.feedback).toHaveLength(1)
  })
})
