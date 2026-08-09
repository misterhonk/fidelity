import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { Match, Signal, TasteProfile } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { buildReason } from '../match/reason'
import { barryScore, type ScoreContext } from '../match/score'

/**
 * The style pass.
 *
 * S7 needs the styles of a release, and nothing the client can reach in bulk
 * carries them: not the inventory listing, not any horizon endpoint. The only
 * source is /releases/{id}, and calling that per listing is the single most
 * expensive mistake available here — twenty thousand records would be three
 * hours.
 *
 * So it runs as a bounded pass over the best fifty matches after scoring, the
 * same shape docs/06 gives S10 and S11 in M4: fifty requests, about a minute,
 * and only for records that already earned their place.
 */

export const TOP_N = 50

/** Fires from here up (docs/04 §S7). */
export const STYLE_THRESHOLD = 0.6

export const releaseStylesSchema = z.object({
  id: z.number().int(),
  styles: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  country: z.string().optional(),
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

export async function enrichTopMatches({
  client,
  digId,
  taste,
  scoreContext = {},
  report,
  signal,
}: EnrichOptions): Promise<{ enriched: number; fired: number; requests: number }> {
  const centroid = taste?.styleCentroid ?? {}
  if (Object.keys(centroid).length === 0) {
    // No centroid, no adjacency. Spending fifty requests to compare against
    // nothing would be worse than not running.
    return { enriched: 0, fired: 0, requests: 0 }
  }

  const db = await openFidelityDb()
  const stored = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity]))

  const candidates = stored
    .filter((match) => !match.signals.some((s) => s.type === 'STYLE_ADJACENT'))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)

  let requests = 0
  let fired = 0
  let done = 0

  report?.({ done, total: candidates.length, requests })

  for (const match of candidates) {
    signal?.throwIfAborted()

    const release = await client.get(`/releases/${match.releaseId}`, releaseStylesSchema, {
      signal,
    })
    requests += 1
    done += 1

    const similarity = styleSimilarity(release.styles ?? [], centroid)
    if (similarity >= STYLE_THRESHOLD) {
      const signals: Signal[] = [
        ...match.signals,
        {
          type: 'STYLE_ADJACENT',
          confidence: similarity,
          evidence: { styles: release.styles ?? [], similarity },
        },
      ]

      const updated: Match = {
        ...match,
        signals,
        score: barryScore(signals, scoreContext),
        reason: buildReason(signals),
      }
      await db.put('matches', updated)
      fired += 1
    }

    report?.({ done, total: candidates.length, requests })
  }

  return { enriched: candidates.length, fired, requests }
}
