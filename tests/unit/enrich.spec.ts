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

function client(stylesByRelease: Record<number, string[]>) {
  const get = vi.fn(async (path: string, schema: { parse: (v: unknown) => unknown }) => {
    const id = Number(/\/releases\/(\d+)/.exec(path)?.[1] ?? 0)
    return schema.parse({ id, styles: stylesByRelease[id] ?? [] })
  })
  return { client: { get } as unknown as DiscogsClient, get }
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

    const { client: api, get } = client({})
    const result = await enrichTopMatches({ client: api, digId: '01A', taste })

    expect(result.enriched).toBe(TOP_N)
    expect(get).toHaveBeenCalledTimes(TOP_N)
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

  it('spends nothing at all without a centroid to compare against', async () => {
    const db = await openFidelityDb()
    await db.put('matches', match(1, 48))

    const { client: api, get } = client({ 1: ['Minimal'] })
    const result = await enrichTopMatches({
      client: api,
      digId: '01A',
      taste: { ...taste, styleCentroid: {} },
    })

    expect(result.requests).toBe(0)
    expect(get).not.toHaveBeenCalled()
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
