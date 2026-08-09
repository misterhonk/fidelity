import { getMeta, updateSyncState } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'

import { log } from '../log'
import type { DiscogsClient } from '../discogs/client'

import { expandEntity } from './expand'
import { candidateKey, selectCandidates, type Candidate } from './select'

/** Revalidation interval from docs/01 §6. */
export const HORIZON_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface HorizonProgress {
  done: number
  total: number
  requests: number
  /** What is being expanded right now, so the wait has a subject. */
  current: string
  releaseIds: number
  etaMs: number
}

export interface HorizonResult {
  expanded: number
  skipped: number
  /** Entities that could not be expanded this run; a later run retries them. */
  failed: number
  requests: number
  releaseIds: number
}

/**
 * How many entities may fail in a row before the run gives up.
 *
 * One failure is a hiccup and the next entity is worth trying. Three in a row
 * is the rate limit, the network or Discogs being down, and hammering it makes
 * all three worse.
 */
const MAX_CONSECUTIVE_FAILURES = 3

const MS_PER_REQUEST = 1200

export interface BuildOptions {
  client: DiscogsClient
  report?: (progress: HorizonProgress) => void
  signal?: AbortSignal
  now?: () => number
  /** Re-expand entities older than this. */
  ttlMs?: number
}

/**
 * Builds the horizon: every entity the collection points at, expanded into
 * release-id edges, once.
 *
 * The first run is the expensive one — a few hundred requests, minutes rather
 * than seconds. Everything about the loop is arranged so that it survives
 * being interrupted: each entity is written the moment it is done, and a
 * restart skips whatever is already there and fresh. Closing the tab costs one
 * entity, not the run.
 */
export async function buildHorizon({
  client,
  report,
  signal,
  now = Date.now,
  ttlMs = HORIZON_TTL_MS,
}: BuildOptions): Promise<HorizonResult> {
  const db = await openFidelityDb()

  const [collection, wantlist] = await Promise.all([
    db.getAll('collection'),
    db.getAll('wantlist'),
  ])

  const candidates = selectCandidates(collection, wantlist)
  const existing = new Map((await db.getAll('horizon')).map((chunk) => [chunk.key, chunk]))

  let done = 0
  let expanded = 0
  let skipped = 0
  let failed = 0
  let consecutiveFailures = 0
  let requests = 0
  let releaseIds = [...existing.values()].reduce(
    (sum, chunk) => sum + chunk.releaseIds.length,
    0,
  )

  const emit = (current: string) => {
    report?.({
      done,
      total: candidates.length,
      requests,
      current,
      releaseIds,
      etaMs: Math.round((candidates.length - done) * 2 * MS_PER_REQUEST),
    })
  }

  emit('')

  for (const candidate of candidates) {
    signal?.throwIfAborted()

    const known = existing.get(candidateKey(candidate))
    if (known && now() - known.fetchedAt < ttlMs) {
      // Already known and still fresh. This is what makes the run resumable
      // without any bookkeeping of its own.
      done += 1
      skipped += 1
      emit(candidate.name)
      continue
    }

    emit(candidate.name)

    let result
    try {
      result = await expandEntity(candidate, { client, signal, now })
      consecutiveFailures = 0
    } catch (error) {
      if (signal?.aborted) throw error

      // One entity failing is not the run failing. It stays unexpanded and the
      // next attempt picks it up, because nothing was written for it.
      failed += 1
      done += 1
      consecutiveFailures += 1
      log.warn('[horizon] konnte nicht expandieren', candidate.kind, candidate.id, error)

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) throw error
      emit(candidate.name)
      continue
    }

    await db.put('horizon', { ...result.chunk, catalogueSize: result.catalogueSize })
    releaseIds += result.chunk.releaseIds.length - (known?.releaseIds.length ?? 0)
    requests += result.requests
    expanded += 1
    done += 1

    // Written after every entity, not at the end.
    await updateSyncState({ horizonProgress: { done, total: candidates.length } })
    emit(candidate.name)
  }

  await updateSyncState({ horizonBuiltAt: now(), horizonProgress: null })
  emit('')

  return { expanded, skipped, failed, requests, releaseIds }
}

/** How much of the horizon exists, for the UI. */
export async function horizonStatus(now: number = Date.now()) {
  const db = await openFidelityDb()
  const [collection, wantlist, chunks] = await Promise.all([
    db.getAll('collection'),
    db.getAll('wantlist'),
    db.getAll('horizon'),
  ])

  const candidates = selectCandidates(collection, wantlist)
  const fresh = new Set(
    chunks.filter((chunk) => now - chunk.fetchedAt < HORIZON_TTL_MS).map((chunk) => chunk.key),
  )

  const syncState = await getMeta('syncState')

  return {
    entities: candidates.length,
    expanded: candidates.filter((candidate: Candidate) => fresh.has(candidateKey(candidate)))
      .length,
    releaseIds: chunks.reduce((sum, chunk) => sum + chunk.releaseIds.length, 0),
    builtAt: syncState?.horizonBuiltAt ?? null,
    /** Requests still to spend, at roughly two per entity. */
    estimatedRequests:
      (candidates.length -
        candidates.filter((candidate: Candidate) => fresh.has(candidateKey(candidate)))
          .length) *
      2,
  }
}
