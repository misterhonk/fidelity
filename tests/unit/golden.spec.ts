import { describe, expect, it } from 'vitest'

import collectionJson from '../fixtures/golden/collection.json'
import horizonJson from '../fixtures/golden/horizon.json'
import inventoryJson from '../fixtures/golden/inventory.json'
import relevantJson from '../fixtures/golden/relevant.json'
import wantlistJson from '../fixtures/golden/wantlist.json'

import type { CollectionItem, HorizonChunk, WantlistItem } from '#shared/types'
import { buildIndex, evaluate, type Listing } from '~~/worker/match'
import { computeTasteProfile } from '~~/worker/match/taste'

/**
 * The golden file: a whole dig, end to end, against a universe with a known
 * answer (docs/06 M3).
 *
 * `tests/unit/score.spec.ts` pins the formula. This pins what the formula
 * *does* to a shelf — which signals fire on which record, in what order they
 * come out. Every weight change moves this snapshot, and the diff has to be
 * explained in the pull request. That is the point: a scoring change with no
 * visible effect on the ranking is either harmless or untested, and this says
 * which.
 */

const collection = collectionJson as unknown as CollectionItem[]
const wantlist = wantlistJson as unknown as WantlistItem[]
const inventory = inventoryJson as unknown as Listing[]
const relevant = new Set(relevantJson as number[])

/** JSON cannot hold TypedArrays; the horizon is written flat and rebuilt here. */
const horizon = (horizonJson as unknown as Record<string, unknown>[]).map(
  (chunk) =>
    ({
      ...chunk,
      releaseIds: Int32Array.from(chunk.releaseIds as number[]),
      roles: Uint8Array.from(chunk.roles as number[]),
      years: Int16Array.from(chunk.years as number[]),
      ...(chunk.catnoNums ? { catnoNums: Int32Array.from(chunk.catnoNums as number[]) } : {}),
    }) as unknown as HorizonChunk,
)

const taste = computeTasteProfile(collection, 0)
const index = buildIndex(collection, wantlist, taste, horizon)

/** No hard filters: this measures the ranking, not the preferences. */
const filters = {
  formatsAllow: [],
  maxPrice: null,
  shipsFromBlock: [],
  prefMediaCondition: 'Very Good (VG)' as const,
  targetPrice: null,
}

const ranked = inventory
  .map((listing) => ({ listing, result: evaluate(listing, index, filters) }))
  .filter((row): row is { listing: Listing; result: NonNullable<typeof row.result> } =>
    Boolean(row.result),
  )
  .sort((a, b) => b.result.score - a.result.score || a.listing.releaseId - b.listing.releaseId)

describe('the golden dig', () => {
  it('ranks the shelf-related records the way the engine is documented to', () => {
    expect(
      ranked.map((row) => ({
        release: row.listing.releaseId,
        who: `${row.listing.artist} – ${row.listing.title}`,
        score: row.result.score,
        signals: row.result.signals.map((signal) => signal.type).sort(),
      })),
    ).toMatchSnapshot()
  })

  it('finds every record that has a real relation to the collection', () => {
    const found = new Set(ranked.map((row) => row.listing.releaseId))
    const missed = [...relevant].filter((id) => !found.has(id))
    expect(missed).toEqual([])
  })

  /**
   * Precision@5, the number docs/06 puts a target on. Of the five records the
   * app puts in front of somebody first, how many are actually related to
   * their shelf.
   */
  it('has a precision@5 of at least 0,6', () => {
    const top5 = ranked.slice(0, 5)
    const hits = top5.filter((row) => relevant.has(row.listing.releaseId)).length
    const precision = hits / top5.length

    // Reported, so a regression shows the number and not only a red cross.
    expect({ precision, hits, of: top5.length }).toMatchSnapshot()
    expect(precision).toBeGreaterThanOrEqual(0.6)
  })

  it('has a precision@10 that does not collapse either', () => {
    const top10 = ranked.slice(0, 10)
    const hits = top10.filter((row) => relevant.has(row.listing.releaseId)).length
    expect(hits / top10.length).toBeGreaterThanOrEqual(0.6)
  })
})

describe('the traps in the fixture', () => {
  const scoreOf = (releaseId: number) =>
    ranked.find((row) => row.listing.releaseId === releaseId)?.result.score ?? 0
  const signalsOf = (releaseId: number) =>
    ranked
      .find((row) => row.listing.releaseId === releaseId)
      ?.result.signals.map((s) => s.type) ?? []

  it('does not call a huge catalogue a taste', () => {
    // The shelf owns exactly one Warner record out of 90.000. That is not an
    // affinity, and the lift is the thing that knows the difference.
    expect(signalsOf(9702)).not.toContain('LABEL_AFFINITY')
  })

  it('does not call two hundred numbers apart a series', () => {
    expect(signalsOf(9703)).not.toContain('CATALOG_RUN')
    // BRAIN 1003 sits among four owned numbers and does.
    expect(signalsOf(9301)).toContain('CATALOG_RUN')
  })

  it('does not offer a CD as an upgrade for a CD', () => {
    expect(signalsOf(9704)).not.toContain('FORMAT_UPGRADE')
    expect(signalsOf(9501)).toContain('FORMAT_UPGRADE')
  })

  it('keeps a near-miss name below every genuine hit', () => {
    // "Pop Stars" is not "Pop Star". The trigram cascade may well fire on it —
    // what must not happen is it outranking a record that is really related.
    const genuine = ranked.filter((row) => relevant.has(row.listing.releaseId))
    expect(scoreOf(9701)).toBeLessThan(Math.min(...genuine.map((row) => row.result.score)))
  })
})
