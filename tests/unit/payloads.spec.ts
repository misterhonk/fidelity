import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { isHttps } from '#shared/listen'
import { releaseDetailSchema } from '~~/worker/discogs/schemas'
import { parsePreferences, sharedDigSchema, vaultSnapshotSchema } from '~~/worker/payloads'
import { open, seal } from '~~/worker/vault/crypto'

/**
 * Shared links, vault files and backups are parsed, not cast (#207).
 *
 * Each of them arrives from somewhere this device does not control: a link
 * somebody sent, a block another device wrote, a file somebody picked. A cast
 * believes them; a schema checks them.
 */

describe('addresses that come from data', () => {
  it('lets only https through', () => {
    expect(isHttps('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(isHttps('http://www.youtube.com/watch?v=abc')).toBe(false)
    expect(isHttps('javascript:alert(1)')).toBe(false)
    expect(isHttps('data:text/html,<script>1</script>')).toBe(false)
    expect(isHttps('not a url')).toBe(false)
    expect(isHttps(42)).toBe(false)
  })

  it('drops a release video that is not https rather than the whole release', () => {
    const parsed = releaseDetailSchema.parse({
      id: 1,
      title: 'A',
      videos: [
        { title: 'good', uri: 'https://www.youtube.com/watch?v=abc' },
        { title: 'bad', uri: 'javascript:alert(1)' },
        { title: 'plain', uri: 'http://www.youtube.com/watch?v=def' },
      ],
    })
    expect(parsed.videos).toEqual([
      { title: 'good', uri: 'https://www.youtube.com/watch?v=abc' },
    ])
  })
})

describe('preferences from elsewhere', () => {
  it('keeps what it knows, typed, and nothing that belongs to a device', () => {
    expect(
      parsePreferences({
        maxPrice: 4000,
        currency: 'EUR',
        hubUrl: 'https://evil.example',
        catalogueUrl: 'https://evil.example',
        hubSecret: 's',
        accessKey: 'k',
        whatever: true,
      }),
    ).toEqual({ maxPrice: 4000, currency: 'EUR' })
  })

  it('drops a field of the wrong type and keeps the rest', () => {
    expect(parsePreferences({ maxPrice: 'lots', currency: 'EUR' })).toEqual({ currency: 'EUR' })
    expect(parsePreferences({ prefMediaCondition: 'Brand new' })).toEqual({})
  })

  it('is nothing at all when it is not an object', () => {
    expect(parsePreferences('nope')).toBeNull()
    expect(parsePreferences([1, 2])).toBeNull()
    expect(parsePreferences(null)).toBeNull()
  })
})

describe('a vault snapshot', () => {
  it('rejects what is not a snapshot', () => {
    expect(vaultSnapshotSchema.safeParse({ hello: 'world' }).success).toBe(false)
    expect(vaultSnapshotSchema.safeParse({ savedAt: 'today', stores: {} }).success).toBe(false)
    expect(vaultSnapshotSchema.safeParse(null).success).toBe(false)
  })

  it('drops rows the database could not put, and filters the preferences', () => {
    const parsed = vaultSnapshotSchema.parse({
      savedAt: 5,
      preferences: { maxPrice: 1000, hubUrl: 'https://evil.example' },
      stores: {
        feedback: [{ listingId: 1, updatedAt: 3 }, { verdict: 'no key' }, 'not a row'],
        dealers: [{ username: 'tom', shippingTiers: [] }, { username: 'no-tiers' }],
      },
    })
    expect(parsed.preferences).toEqual({ maxPrice: 1000 })
    expect(parsed.stores.feedback).toEqual([{ listingId: 1, updatedAt: 3 }])
    expect(parsed.stores.dealers).toEqual([{ username: 'tom', shippingTiers: [] }])
  })

  it('refuses a sealed block whose contents are not a snapshot, with a code', async () => {
    const sealed = await seal({ hello: 'world' }, 'a good passphrase')
    await expect(open(sealed, 'a good passphrase', vaultSnapshotSchema)).rejects.toMatchObject({
      code: 'malformed-payload',
    })
  }, 30_000)
})

const match = {
  digId: 'd',
  listingId: 1,
  releaseId: 2,
  score: 80,
  signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
  title: 'T',
  artist: 'A',
  label: null,
  catno: null,
  format: null,
  year: 1990,
  condition: null,
  sleeve: null,
  price: 1200,
  currency: 'EUR',
  comments: null,
  thumbUrl: null,
  marketLowestPrice: null,
  marketNumForSale: null,
  expired: false,
}

const shared = {
  version: 1,
  dealer: 'tom',
  scannedAt: 1,
  expiresAt: 2,
  coverage: 1,
  listingsTotal: 10,
  matchesTotal: 1,
  matches: [match],
}

describe('a shared find list', () => {
  it('reads a well-formed one', () => {
    expect(sharedDigSchema.parse(shared).matches[0]!.listingId).toBe(1)
  })

  it('rejects a broken one', () => {
    expect(sharedDigSchema.safeParse({ ...shared, matches: 'many' }).success).toBe(false)
    expect(sharedDigSchema.safeParse({ ...shared, expiresAt: undefined }).success).toBe(false)
    expect(
      sharedDigSchema.safeParse({ ...shared, matches: [{ ...match, listingId: 'x' }] }).success,
    ).toBe(false)
    expect(
      sharedDigSchema.safeParse({
        ...shared,
        matches: [{ ...match, signals: [{ type: 'NOPE' }] }],
      }).success,
    ).toBe(false)
  })

  it('keeps no address that is not https', () => {
    const parsed = sharedDigSchema.parse({
      ...shared,
      matches: [
        {
          ...match,
          thumbUrl: 'javascript:alert(1)',
          videos: [
            { title: 'x', uri: 'javascript:alert(1)' },
            { title: 'y', uri: 'https://youtu.be/abc' },
          ],
        },
      ],
    })
    expect(parsed.matches[0]!.thumbUrl).toBeNull()
    expect(parsed.matches[0]!.videos).toEqual([{ title: 'y', uri: 'https://youtu.be/abc' }])
  })

  it('opens through the schema and refuses what does not fit', async () => {
    const sealed = await seal({ ...shared, matches: null }, 'k')
    await expect(open(sealed, 'k', sharedDigSchema)).rejects.toMatchObject({
      code: 'malformed-payload',
    })
    expect(await open(await seal(shared, 'k'), 'k', z.unknown())).toEqual(shared)
  }, 30_000)
})
