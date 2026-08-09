import { z } from 'zod'

import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Match, Signal, TasteProfile } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { priceSignal, scarcitySignal, type MarketStats } from '../match/market'
import { pressingContradictions, pressingWarnings, readPressing } from '../match/pressing'
import { buildReason } from '../match/reason'
import { barryScore, type ScoreContext } from '../match/score'

/**
 * The enrichment pass.
 *
 * Four things need data that nothing reachable in bulk carries. S7 needs a
 * release's styles and the pressing advice needs its runout and format
 * descriptions, both of which live only in `/releases/{id}`. S10 and S11 need
 * the marketplace's lowest price and how many copies are for sale, which live
 * only in `/marketplace/stats/{id}`. Calling either per listing is the single
 * most expensive mistake available here — twenty thousand records would be
 * hours.
 *
 * So it runs as one bounded pass over the best fifty matches after scoring
 * (docs/04 §S10): two requests per record, about two minutes, and only for
 * records that already earned their place. Both lookups happen in the same
 * loop over the same fifty rather than as two phases, because a second pass
 * would mean a second sort, a second write and a second wait for the same
 * fifty records.
 */

export const TOP_N = 50

/** Fires from here up (docs/04 §S7). */
export const STYLE_THRESHOLD = 0.6

/**
 * One request, three jobs.
 *
 * `styles` feeds S7, and `identifiers`/`formats`/`country`/`year` feed the
 * pressing advice (M7). Asking for them separately would be fifty more
 * requests for data that arrives in this response anyway (docs/02).
 */
export const releaseDetailSchema = z.object({
  id: z.number().int(),
  styles: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  country: z.string().optional(),
  year: z.number().int().optional(),
  released: z.string().optional(),
  master_id: z.number().int().optional(),
  formats: z
    .array(
      z.object({
        name: z.string().optional(),
        text: z.string().optional(),
        descriptions: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  identifiers: z
    .array(
      z.object({
        type: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
})

/** @deprecated Kept as the old name; the schema grew for M7. */
export const releaseStylesSchema = releaseDetailSchema

/**
 * `/marketplace/stats/{id}`.
 *
 * `lowest_price` is null whenever nothing is currently for sale, and the whole
 * object can carry `blocked_from_sale` for records Discogs will not trade.
 * Everything is optional here because this endpoint is the one that changes
 * shape most often, and a schema error would abort a pass that has already
 * cost forty requests.
 */
export const marketStatsSchema = z.object({
  num_for_sale: z.number().int().nullable().optional(),
  blocked_from_sale: z.boolean().optional(),
  lowest_price: z
    .object({
      value: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

export interface EnrichProgress {
  done: number
  total: number
  requests: number
}

export interface EnrichOptions {
  client: DiscogsClient
  digId: string
  taste: TasteProfile | null
  scoreContext?: ScoreContext
  report?: (progress: EnrichProgress) => void
  signal?: AbortSignal
}

export interface EnrichResult {
  enriched: number
  /** How many records gained at least one new signal. */
  fired: number
  requests: number
}

/**
 * Cosine similarity between a release's styles and the collection centroid.
 *
 * The centroid is already unit length, and a release's styles are unweighted,
 * so this is the dot product over the shared styles divided by the release
 * vector's length.
 */
export function styleSimilarity(styles: string[], centroid: Record<string, number>): number {
  if (styles.length === 0) return 0

  const unique = [...new Set(styles)]
  let dot = 0
  for (const style of unique) dot += centroid[style] ?? 0

  const length = Math.sqrt(unique.length)
  return length > 0 ? Math.min(1, dot / length) : 0
}

/** Which of the three enrichment signals a match already carries. */
const ENRICHED = new Set(['STYLE_ADJACENT', 'PRICE_SIGNAL', 'SCARCITY'])

export async function enrichTopMatches({
  client,
  digId,
  taste,
  scoreContext = {},
  report,
  signal,
}: EnrichOptions): Promise<EnrichResult> {
  const centroid = taste?.styleCentroid ?? {}
  // No centroid, no adjacency. Spending fifty requests to compare against
  // nothing would be worse than not running — but the market lookups are
  // still worth doing, so this only skips the style half.
  const wantStyles = Object.keys(centroid).length > 0
  const { excludeReissues } = await getPreferences()

  // The album's own first year, per master. What turns "pressed 2015" into
  // "a 2015 pressing of a 1959 album" — a year on its own says nothing.
  const masterYears = await firstYearByMaster()

  const db = await openFidelityDb()
  const stored = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity]))

  const candidates = stored
    .filter((match) => !match.signals.some((s) => ENRICHED.has(s.type)))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)

  let requests = 0
  let fired = 0
  let done = 0

  report?.({ done, total: candidates.length, requests })

  for (const match of candidates) {
    signal?.throwIfAborted()

    const signals: Signal[] = [...match.signals]
    let context = scoreContext
    let added = false

    /*
     * The release lookup is unconditional now.
     *
     * It used to be skipped without a style centroid, because S7 was the only
     * thing that needed it. The pressing advice (M7) needs nothing but the
     * release, and it is the more useful half for somebody who has never rated
     * a style — precisely the person the old condition would have skipped.
     *
     * The honest consequence: a pass now costs two requests per record instead
     * of one for those users. Bounded at fifty either way, and the progress
     * panel says the number before it is spent.
     */
    const release = await client.get(`/releases/${match.releaseId}`, releaseDetailSchema, {
      signal,
    })
    requests += 1

    if (wantStyles) {
      const similarity = styleSimilarity(release.styles ?? [], centroid)
      if (similarity >= STYLE_THRESHOLD) {
        signals.push({
          type: 'STYLE_ADJACENT',
          confidence: similarity,
          evidence: { styles: release.styles ?? [], similarity },
        })
        added = true
      }
    }

    const pressing = readPressing(release, masterYears.get(release.master_id ?? 0) ?? null)
    const warnings = [
      ...pressingWarnings(pressing),
      ...pressingContradictions(match.comments, pressing),
    ]
    if (warnings.length > 0) added = true

    // "Originalpressungen bevorzugen", finally readable — this is the first
    // moment in a dig where anybody knows whether a record is a reissue.
    if (excludeReissues && pressing.statedReissue) {
      context = { ...context, reissueAgainstPreference: true }
    }

    const stats = await fetchStats(client, match, signal)
    requests += 1

    const price = priceSignal(match.price, match.currency, stats)
    if (price.signal) {
      signals.push(price.signal)
      added = true
    }
    // Above the going rate is a dampener, not a signal. It never adds a reason
    // to buy, so it must not be able to raise a score.
    if (price.negative) context = { ...context, priceSignalNegative: true }

    const scarcity = scarcitySignal(stats)
    if (scarcity) {
      signals.push(scarcity)
      added = true
    }

    // The market numbers are stored even when neither signal fired: the basket
    // in M4 shows them, and having paid the request once is reason enough not
    // to pay it twice.
    const updated: Match = {
      ...match,
      signals,
      marketLowestPrice: stats.lowestPrice,
      marketNumForSale: stats.numForSale,
      pressing,
      pressingWarnings: warnings,
      score: barryScore(signals, context),
      reason: buildReason(signals),
    }
    await db.put('matches', updated)
    if (added || price.negative) fired += 1

    done += 1
    report?.({ done, total: candidates.length, requests })
  }

  return { enriched: candidates.length, fired, requests }
}

/**
 * The earliest year the horizon knows for each master.
 *
 * Cheap: the chunks are already in IndexedDB and this walks them once. A
 * master the horizon has never expanded simply has no year, and the pressing
 * profile says "unknown" rather than guessing one.
 */
async function firstYearByMaster(): Promise<Map<number, number>> {
  const db = await openFidelityDb()
  const years = new Map<number, number>()

  for (const chunk of await db.getAll('horizon')) {
    if (chunk.kind !== 'master') continue

    let earliest = 0
    for (const year of chunk.years) {
      if (year > 1880 && (earliest === 0 || year < earliest)) earliest = year
    }
    if (earliest > 0) years.set(chunk.entityId, earliest)
  }

  return years
}

/**
 * One market lookup, asked in the listing's own currency.
 *
 * `curr_abbr` is what makes the comparison honest: without it Discogs answers
 * in the account's currency and the ratio would silently compare euros against
 * dollars. A record that fails to answer is treated as "nothing known" rather
 * than aborting the pass — forty requests already spent should not be lost to
 * one bad release id.
 */
async function fetchStats(
  client: DiscogsClient,
  match: Match,
  signal?: AbortSignal,
): Promise<MarketStats> {
  try {
    const stats = await client.get(`/marketplace/stats/${match.releaseId}`, marketStatsSchema, {
      query: match.currency ? { curr_abbr: match.currency } : undefined,
      signal,
    })

    return {
      lowestPrice: stats.blocked_from_sale ? null : (stats.lowest_price?.value ?? null),
      currency: stats.lowest_price?.currency ?? null,
      numForSale: stats.num_for_sale ?? 0,
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return { lowestPrice: null, currency: null, numForSale: 0 }
  }
}
