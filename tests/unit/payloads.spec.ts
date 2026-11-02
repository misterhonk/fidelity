import { describe, expect, it } from 'vitest'

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
        placements: [
          { instanceId: 1, paid: { cents: 1250, currency: 'EUR' }, arrivedOn: '2026-10-01' },
          { instanceId: 2, paid: null },
          { instanceId: 3, paid: { cents: 12.5, currency: 'EUR' } },
          { instanceId: 4, paid: { cents: 100, currency: 'euro' } },
          { instanceId: 5, arrivedOn: 'yesterday' },
        ],
      },
    })
    expect(parsed.preferences).toEqual({ maxPrice: 1000 })
    expect(parsed.stores.feedback).toEqual([{ listingId: 1, updatedAt: 3 }])
    expect(parsed.stores.dealers).toEqual([{ username: 'tom', shippingTiers: [] }])
    expect(
      parsed.stores.placements?.map((row) => (row as { instanceId: number }).instanceId),
    ).toEqual([1, 2])
  })

  it('refuses a sealed block whose contents are not a snapshot, with a code', async () => {
    const sealed = await seal({ hello: 'world' }, 'a good passphrase')
    await expect(open(sealed, 'a good passphrase', vaultSnapshotSchema)).rejects.toMatchObject({
      code: 'malformed-payload',
    })
  }, 30_000)
})

const find = {
  releaseId: 2,
  listingId: 1,
  score: 80,
  artist: 'A',
  title: 'T',
  label: null,
  catno: null,
  format: null,
  year: 1990,
  signals: [{ type: 'WANTLIST_EXACT', confidence: 1, evidence: {} }],
}

const shared = { version: 2, coverage: 1, matchesTotal: 1, matches: [find] }

describe('a shared find list', () => {
  it('reads a well-formed one', () => {
    expect(sharedDigSchema.parse(shared).matches[0]!.listingId).toBe(1)
  })

  it('rejects a broken one', () => {
    expect(sharedDigSchema.safeParse({ ...shared, matches: 'many' }).success).toBe(false)
    expect(sharedDigSchema.safeParse({ ...shared, coverage: undefined }).success).toBe(false)
    expect(
      sharedDigSchema.safeParse({ ...shared, matches: [{ ...find, listingId: 'x' }] }).success,
    ).toBe(false)
    expect(
      sharedDigSchema.safeParse({
        ...shared,
        matches: [{ ...find, signals: [{ type: 'NOPE' }] }],
      }).success,
    ).toBe(false)
  })

  it('keeps nothing it does not read — a cover or a price among them', () => {
    const parsed = sharedDigSchema.parse({
      ...shared,
      dealer: 'tom',
      matches: [{ ...find, thumbUrl: 'javascript:alert(1)', price: 1200 }],
    })
    expect(parsed).not.toHaveProperty('dealer')
    expect(parsed.matches[0]).not.toHaveProperty('thumbUrl')
    expect(parsed.matches[0]).not.toHaveProperty('price')
  })
})
