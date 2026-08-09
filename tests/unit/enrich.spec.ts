import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteFidelityDb, openFidelityDb } from '~~/db/open'
import type { Match, TasteProfile } from '#shared/types'
import type { DiscogsClient } from '~~/worker/discogs/client'
import { enrichTopMatches, STYLE_THRESHOLD, styleSimilarity, TOP_N } from '~~/worker/dig/enrich'
import {
  FingerprintAccumulator,
  affinityFactor,
  matchesPerThousand,
} from '~~/worker/dig/fingerprint'

afterEach(async () => {
  await deleteFidelityDb()
})

/**
 * Intl puts a non-breaking space before the currency symbol. That is correct
 * German typography and wrong to type into a test by hand, so it is normalised
 * here rather than smuggled into every expectation as a \u00a0 escape.
 */
const plain = (text: string | undefined) => (text ?? '').replace(/\u00a0/g, ' ')

const taste = {
  computedAt: 0,
  releaseCount: 10,
  artists: {},
  labels: {},
  styles: {},
  genres: {},
  decades: {},
  // Unit length, as computeTasteProfile produces.
  styleCentroid: { Minimal: 0.8, 'Tech House': 0.6 },
} satisfies TasteProfile

function match(listingId: number, score: number): Match {
  return {
    digId: '01A',
    listingId,
    releaseId: listingId,
    score,
    signals: [
      { type: 'ARTIST_KNOWN', confidence: 1, evidence: { artist: 'Robag Wruhme', owned: 5 } },
    ],
    reason: '',
    title: 'Platte',
    artist: 'Wer',
    label: null,
    catno: null,
    format: '12"',
    year: 2004,
    condition: 'Mint (M)',
    sleeve: null,
    price: 10,
    currency: 'EUR',
    comments: null,
    thumbUrl: null,
    marketLowestPrice: null,
    marketNumForSale: null,
    expired: false,
  }
}

interface Market {
  lowest?: number | null
  currency?: string
  numForSale?: number
}

/**
 * The pass now asks two endpoints per record. The mock answers both and counts
 * them separately, so a test can say "no style lookups happened" without also
 * claiming no requests happened at all.
 */
function client(
  stylesByRelease: Record<number, string[]>,
  market: Record<number, Market> = {},
) {
  const releases = vi.fn()
  const stats = vi.fn()

  const get = vi.fn(
    async (
      path: string,
      schema: { parse: (v: unknown) => unknown },
      options?: { query?: Record<string, unknown> },
    ) => {
      const releaseMatch = /\/releases\/(\d+)/.exec(path)
      if (releaseMatch) {
        const id = Number(releaseMatch[1])
        releases(id)
        return schema.parse({ id, styles: stylesByRelease[id] ?? [] })
      }

      const id = Number(/\/marketplace\/stats\/(\d+)/.exec(path)?.[1] ?? 0)
      stats(id, options?.query)
      const entry = market[id]
      return schema.parse({
        num_for_sale: entry?.numForSale ?? 40,
        lowest_price:
          entry?.lowest === undefined || entry.lowest === null
            ? null
            : { value: entry.lowest, currency: entry.currency ?? 'EUR' },
      })
    },
  )

  return { client: { get } as unknown as DiscogsClient, get, releases, stats }
}

describe('style similarity', () => {
  it('is high for a release squarely in the centroid', () => {
    expect(styleSimilarity(['Minimal'], taste.styleCentroid)).toBeCloseTo(0.8)
  })

  it('is zero for a release with nothing in common', () => {
    expect(styleSimilarity(['Bluegrass'], taste.styleCentroid)).toBe(0)
  })

  it('is zero when the release has no styles at all', () => {
    expect(styleSimilarity([], taste.styleCentroid)).toBe(0)
  })

  it('does not reward a release for listing the same style twice', () => {
    expect(styleSimilarity(['Minimal', 'Minimal'], taste.styleCentroid)).toBeCloseTo(
      styleSimilarity(['Minimal'], taste.styleCentroid),
    )
  })

  it('dilutes a match buried among unrelated styles', () => {
    const focused = styleSimilarity(['Minimal'], taste.styleCentroid)
    const scattered = styleSimilarity(
      ['Minimal', 'Bluegrass', 'Polka', 'Gospel'],
      taste.styleCentroid,
    )
    expect(scattered).toBeLessThan(focused)
  })
})

describe('the style pass', () => {
  it('spends requests only on the best fifty', async () => {
    const db = await openFidelityDb()
    for (let i = 1; i <= 60; i++) await db.put('matches', match(i, i))

    const { client: api, releases, stats } = client({})
    const result = await enrichTopMatches({ client: api, digId: '01A', taste })

    expect(result.enriched).toBe(TOP_N)
    // Two lookups apiece — styles and market — over the same fifty records.
    expect(releases).toHaveBeenCalledTimes(TOP_N)
    expect(stats).toHaveBeenCalledTimes(TOP_N)
    expect(result.requests).toBe(TOP_N * 2)
  })

  it('adds the signal and rescores when the style fits', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api } = client({ 1: ['Minimal'] })
    const result = await enrichTopMatches({ client: api, digId: '01A', taste })

    expect(result.fired).toBe(1)
    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.signals.map((s) => s.type)).toContain('STYLE_ADJACENT')
    // A second reason lifts the score above the artist-only 48.
    expect(updated?.score).toBeGreaterThan(48)
    // The artist is still the stronger reason and keeps the lead; the style
    // joins as context. A signal weighing 24 does not get to open a sentence
    // ahead of one weighing 55.
    expect(updated?.reason).toMatch(/^Du hast 5 Platten von Robag Wruhme/)
    expect(updated?.reason).toContain('Stil passt (Minimal)')
  })

  it('lets the style lead when nothing stronger is there', async () => {
    const db = await openFidelityDb()
    await db.put('matches', {
      ...match(2, 30),
      signals: [
        { type: 'LABEL_AFFINITY', confidence: 0.2, evidence: { label: 'X', owned: 2 } },
      ],
    })

    const { client: api } = client({ 2: ['Minimal'] })
    await enrichTopMatches({ client: api, digId: '01A', taste })

    expect((await db.get('matches', ['01A', 2]))?.reason).toMatch(/^Minimal – dein Kernrevier/)
  })

  it('leaves a release below the threshold untouched', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api } = client({ 1: ['Bluegrass'] })
    await enrichTopMatches({ client: api, digId: '01A', taste })

    const untouched = await db.get('matches', ['01A', 1])
    expect(untouched?.score).toBe(48)
    expect(untouched?.signals).toHaveLength(1)
    expect(STYLE_THRESHOLD).toBe(0.6)
  })

  it('looks up no styles without a centroid to compare against', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api, releases, stats } = client({ 1: ['Minimal'] })
    const result = await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    // Comparing against nothing is not worth a request. The market lookups
    // are still worth making, so only the style half is skipped.
    expect(releases).not.toHaveBeenCalled()
    expect(stats).toHaveBeenCalledTimes(1)
    expect(result.requests).toBe(1)
  })

  it('does not pay twice for a match it already enriched', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api } = client({ 1: ['Minimal'] })
    await enrichTopMatches({ client: api, digId: '01A', taste })

    const { client: again, get } = client({ 1: ['Minimal'] })
    await enrichTopMatches({ client: again, digId: '01A', taste })

    expect(get).not.toHaveBeenCalled()
  })
})

describe('the market pass', () => {
  it('fires the price signal well under the going rate', async () => {
    const db = await openFidelityDb()
    // Listed at 10, market lowest 20 — half price.
    await db.put('matches', match(1, 48))

    const { client: api } = client({}, { 1: { lowest: 20, currency: 'EUR' } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.signals.map((s) => s.type)).toContain('PRICE_SIGNAL')
    // The artist is the stronger reason and keeps the lead; the price joins
    // as context. A signal weighing 35 does not open a sentence ahead of 55.
    expect(plain(updated?.reason)).toContain('unter Markt (20,00 €)')
    expect(updated?.marketLowestPrice).toBe(20)
  })

  it('names both numbers when the price is the strongest reason', async () => {
    const db = await openFidelityDb()
    await db.put('matches', {
      ...match(1, 30),
      signals: [
        { type: 'LABEL_AFFINITY', confidence: 0.2, evidence: { label: 'X', owned: 2 } },
      ],
    })

    const { client: api } = client({}, { 1: { lowest: 20, currency: 'EUR' } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    // "0,5×" is arithmetic; two prices side by side is an argument.
    expect(plain((await db.get('matches', ['01A', 1]))?.reason)).toMatch(
      /^10,00 € bei einem Markt-Tiefstpreis von 20,00 €\./,
    )
  })

  it('asks in the currency the listing is priced in', async () => {
    const db = await openFidelityDb()
    await db.put('matches', { ...match(1, 48), currency: 'GBP' })

    const { client: api, stats } = client({}, { 1: { lowest: 20, currency: 'GBP' } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    // Without curr_abbr Discogs answers in the account's currency and the
    // ratio would compare pounds against euros.
    expect(stats).toHaveBeenCalledWith(1, { curr_abbr: 'GBP' })
  })

  it('says nothing when the two currencies disagree', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api } = client({}, { 1: { lowest: 20, currency: 'USD' } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.signals.map((s) => s.type)).not.toContain('PRICE_SIGNAL')
  })

  it('dampens rather than rewards a listing well above the market', async () => {
    const db = await openFidelityDb()
    // Listed at 10 against a market lowest of 5 — twice the going rate.
    await db.put('matches', match(1, 48))

    const { client: api } = client({}, { 1: { lowest: 5, currency: 'EUR' } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.signals.map((s) => s.type)).not.toContain('PRICE_SIGNAL')
    // 48 × 0,75. Never a reason to buy, so it can only ever cost points.
    expect(updated?.score).toBe(36)
  })

  it('fires scarcity for a record barely on the marketplace', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api } = client({}, { 1: { numForSale: 2 } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.signals.map((s) => s.type)).toContain('SCARCITY')
    expect(updated?.reason).toContain('nur 2 im Angebot')
    expect(updated?.marketNumForSale).toBe(2)
  })

  it('leads with scarcity when nothing stronger is there', async () => {
    const db = await openFidelityDb()
    await db.put('matches', {
      ...match(1, 30),
      signals: [
        { type: 'LABEL_AFFINITY', confidence: 0.2, evidence: { label: 'X', owned: 2 } },
      ],
    })

    const { client: api } = client({}, { 1: { numForSale: 2 } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    expect((await db.get('matches', ['01A', 1]))?.reason).toMatch(
      /^Nur 2 Exemplare weltweit im Angebot\./,
    )
  })

  it('counts one copy as one, not as "1 Exemplare"', async () => {
    const db = await openFidelityDb()
    await db.put('matches', {
      ...match(1, 30),
      signals: [
        { type: 'LABEL_AFFINITY', confidence: 0.2, evidence: { label: 'X', owned: 2 } },
      ],
    })

    const { client: api } = client({}, { 1: { numForSale: 1 } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    expect((await db.get('matches', ['01A', 1]))?.reason).toMatch(
      /^Weltweit genau ein Exemplar im Angebot\./,
    )
  })

  it('says nothing about a record everybody has', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api } = client({}, { 1: { numForSale: 120 } })
    await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    const updated = await db.get('matches', ['01A', 1])
    expect(updated?.signals.map((s) => s.type)).not.toContain('SCARCITY')
    // Stored anyway: the request is paid for, and the basket shows it.
    expect(updated?.marketNumForSale).toBe(120)
  })

  it('keeps going when one release has no stats to give', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))
    await db.put('matches', match(2, 47))

    const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
      if (path.includes('/marketplace/stats/1')) throw new Error('404')
      return schema.parse({ num_for_sale: 2, lowest_price: null })
    })

    const result = await enrichTopMatches({
      client: { get } as unknown as DiscogsClient,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    // Forty requests already spent should not be lost to one bad release id.
    expect(result.enriched).toBe(2)
    expect((await db.get('matches', ['01A', 2]))?.marketNumForSale).toBe(2)
  })
})

describe('the dealer fingerprint', () => {
  const listing = (over: Record<string, unknown> = {}) =>
    ({
      listingId: 1,
      releaseId: 1,
      title: 'X',
      artist: 'Y',
      label: 'Border Community',
      catno: null,
      format: '12"',
      year: 2005,
      condition: null,
      sleeve: null,
      price: 10,
      currency: 'EUR',
      shipsFrom: null,
      comments: null,
      thumbUrl: null,
      ...over,
    }) as never

  it('describes the shop, not the matches', () => {
    const acc = new FingerprintAccumulator()
    acc.add(listing())
    acc.add(listing({ label: 'Border Community', price: 20 }))
    acc.add(listing({ label: 'Kompakt', year: 1998, price: 30 }))

    const print = acc.build(300)
    expect(print.sampledItems).toBe(3)
    expect(print.coverage).toBeCloseTo(0.01)
    expect(print.labelDist['Border Community']).toBe(2)
    expect(print.decadeDist['2000er']).toBe(2)
    expect(print.decadeDist['1990er']).toBe(1)
    expect(print.medianPrice).toBe(20)
  })

  it('leaves styles empty rather than describing the matches instead', () => {
    // Inventory listings carry no styles and the horizon carries none either.
    const acc = new FingerprintAccumulator()
    acc.add(listing())
    expect(acc.build(1).styleDist).toEqual({})
  })

  it('ignores a year Discogs does not know', () => {
    const acc = new FingerprintAccumulator()
    acc.add(listing({ year: null }))
    expect(acc.build(1).decadeDist).toEqual({})
  })
})

describe('how much a shop suits you', () => {
  it('counts matches per thousand listings, which needs no baseline', () => {
    expect(matchesPerThousand(19, 20_000)).toBeCloseTo(0.95)
    expect(matchesPerThousand(0, 0)).toBe(0)
  })

  it('has no factor until a second shop exists', () => {
    // Better than inventing a 1.0 that means nothing.
    expect(affinityFactor(0.95, [])).toBeNull()
  })

  it('compares a shop against the median of your others', () => {
    expect(affinityFactor(3, [1, 1, 1])).toBeCloseTo(3)
  })
})
