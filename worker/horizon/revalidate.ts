import type { HorizonChunk } from '#shared/types'

import { candidateKey, type Candidate } from './select'

/**
 * Keeping the horizon current without a second twelve-minute run.
 *
 * A flat thirty-day TTL means everything expires at once: build the horizon on
 * a Sunday and every Sunday a month later is a 670-request wall. docs/11 §3
 * asks for the opposite — "30 Tage, gestaffelt, ~20 Requests/Tag" — so the
 * work is spread instead of batched.
 *
 * The mechanism is deliberately dumb: sort by age, take a day's worth, stop.
 * No schedule, no background timer, no service-worker sync. It runs when
 * somebody opens the app, which is exactly when spending their rate limit is
 * least in the way.
 */

/** docs/11 §3. A third of a minute's budget, once a day. */
export const DAILY_REQUEST_BUDGET = 20

/** Nothing revalidates twice in one day, however often the app is opened. */
export const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000

/**
 * A rough cost per entity, for turning a request budget into a candidate count.
 *
 * Masters are one request; artists and labels are one to fifteen. Two is the
 * observed middle and being wrong here only makes a day's slice slightly too
 * big or too small, which the next day corrects.
 */
export const REQUESTS_PER_ENTITY = 2

export interface RevalidationPlan {
  /** Entities to re-expand now, oldest first. */
  due: Candidate[]
  /** How many are stale in total, so the interface can say how far behind it is. */
  stale: number
  /** Why nothing is due, when nothing is. */
  reason: 'ok' | 'nothing-stale' | 'too-soon' | 'never-built'
}

export interface RevalidationInput {
  candidates: Candidate[]
  chunks: HorizonChunk[]
  now: number
  /** When a staggered run last happened. */
  lastRunAt: number | null
  ttlMs: number
  budget?: number
}

/**
 * Which entities to refresh on this visit.
 *
 * Entities that were never expanded are *not* in here. Those belong to the
 * initial build, which the user starts deliberately and watches — quietly
 * spending twenty requests on them behind somebody's back would be the same
 * mistake as a silent background sync.
 */
export function planRevalidation({
  candidates,
  chunks,
  now,
  lastRunAt,
  ttlMs,
  budget = DAILY_REQUEST_BUDGET,
}: RevalidationInput): RevalidationPlan {
  const byKey = new Map(chunks.map((chunk) => [chunk.key, chunk]))

  const stale = candidates
    .map((candidate) => ({ candidate, chunk: byKey.get(candidateKey(candidate)) }))
    .filter(
      (entry): entry is { candidate: Candidate; chunk: HorizonChunk } =>
        entry.chunk !== undefined && now - entry.chunk.fetchedAt >= ttlMs,
    )
    .sort((a, b) => a.chunk.fetchedAt - b.chunk.fetchedAt)

  if (chunks.length === 0) return { due: [], stale: 0, reason: 'never-built' }
  if (stale.length === 0) return { due: [], stale: 0, reason: 'nothing-stale' }
  if (lastRunAt !== null && now - lastRunAt < MIN_INTERVAL_MS) {
    return { due: [], stale: stale.length, reason: 'too-soon' }
  }

  const slice = Math.max(1, Math.floor(budget / REQUESTS_PER_ENTITY))
  return {
    due: stale.slice(0, slice).map((entry) => entry.candidate),
    stale: stale.length,
    reason: 'ok',
  }
}
