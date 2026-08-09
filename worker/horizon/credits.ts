import { z } from 'zod'

import { getMeta, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { CreditHarvest } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { isAnonymousArtist, norm } from '../match/normalize'

export { creditCandidates, MIN_APPEARANCES } from './credit-select'

/**
 * Harvesting the credits off your favourite records.
 *
 * docs/11 §3 wants "Personen mit Lift ≥ 3 in der Sammlung" as a fourth class
 * of entity, and never says how they are found. They cannot be: `extraartists`
 * exists only in `/releases/{id}`, so knowing who produced your collection
 * means one request per record — 2.412 of them for a real shelf, and exactly
 * the loop CLAUDE.md rule 2 forbids.
 *
 * So this harvests the favourites only. Records you rated four or five are the
 * ones whose production you actually care about, they are a few hundred rather
 * than a few thousand, and the run is bounded, resumable and started by hand.
 *
 * What it buys: the case docs/00 §5 opens with — "Conny Plank hat 9 deiner
 * Platten produziert, du besitzt aber keine *von* ihm". Without it S8 only ever
 * fires for people you own records by, because those are the only ones the
 * horizon has a chunk for.
 */

/** Records rated this high are the ones worth a request. */
export const MIN_RATING = 4

/** Roles that mean somebody shaped the record rather than appearing on it. */
export const SHAPING_ROLES =
  /produc|engineer|mix|master|record|arrang|compos|written|remix|conduct/i

export const releaseCreditsSchema = z.object({
  id: z.number().int(),
  extraartists: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        role: z.string().optional(),
      }),
    )
    .optional(),
})

export interface HarvestProgress {
  done: number
  total: number
  requests: number
  /** The record being read, so the wait has a subject. */
  current: string
  people: number
  etaMs: number
}

export interface HarvestOptions {
  client: DiscogsClient
  report?: (progress: HarvestProgress) => void
  signal?: AbortSignal
  now?: () => number
  /** Stop after this many requests, so a run can be split over sittings. */
  limit?: number
}

const MS_PER_REQUEST = 1200

/**
 * Reads the credits off every favourite that has not been read yet.
 *
 * Resumable by construction: the set of release ids already harvested is
 * written after every record, so closing the tab costs one request rather than
 * the run. Nothing here is displayable content — names and roles only, which
 * is the same ID-and-edge shape the rest of the horizon stores (docs/11 §7).
 */
export async function harvestCredits({
  client,
  report,
  signal,
  now = Date.now,
  limit = Infinity,
}: HarvestOptions): Promise<CreditHarvest> {
  const db = await openFidelityDb()
  const collection = await db.getAll('collection')

  const stored = (await getMeta('credits')) ?? emptyHarvest()
  const seen = new Set(stored.harvestedReleaseIds)

  // Best first: if the run is interrupted, the records that mattered most are
  // the ones already read.
  const favourites = collection
    .filter((item) => item.rating >= MIN_RATING)
    .sort((a, b) => b.rating - a.rating || a.releaseId - b.releaseId)

  const todo = favourites.filter((item) => !seen.has(item.releaseId))

  const people = new Map(stored.people.map((person) => [person.entityId, { ...person }]))
  let requests = 0
  let done = favourites.length - todo.length

  const emit = (current: string) =>
    report?.({
      done,
      total: favourites.length,
      requests,
      current,
      people: people.size,
      etaMs: Math.round(Math.min(todo.length, limit) * MS_PER_REQUEST),
    })

  emit('')

  for (const item of todo) {
    if (requests >= limit) break
    signal?.throwIfAborted()
    emit(item.title)

    let release
    try {
      release = await client.get(`/releases/${item.releaseId}`, releaseCreditsSchema, {
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      // A release that will not load is one record's worth of credits, not the
      // run. It is marked seen so the next run does not stall on it forever.
      seen.add(item.releaseId)
      requests += 1
      done += 1
      continue
    }

    requests += 1
    done += 1
    seen.add(item.releaseId)

    for (const credit of dedupe(release.extraartists ?? [])) {
      const existing = people.get(credit.id)
      if (existing) {
        existing.appearances += 1
        for (const role of credit.roles) {
          if (!existing.roles.includes(role)) existing.roles.push(role)
        }
      } else {
        people.set(credit.id, {
          entityId: credit.id,
          name: credit.name,
          appearances: 1,
          roles: [...credit.roles],
        })
      }
    }

    const harvest: CreditHarvest = {
      harvestedAt: now(),
      harvestedReleaseIds: [...seen],
      totalFavourites: favourites.length,
      people: [...people.values()].sort((a, b) => b.appearances - a.appearances),
    }
    // Written after every record, not at the end.
    await setMeta('credits', harvest)
    emit(item.title)
  }

  return (await getMeta('credits')) ?? emptyHarvest()
}

function emptyHarvest(): CreditHarvest {
  return { harvestedAt: null, harvestedReleaseIds: [], totalFavourites: 0, people: [] }
}

/**
 * One person counts once per record — but keeps every role they had on it.
 *
 * A release that credits somebody as both "Producer" and "Mixed By" is one
 * record they shaped, and counting it twice would double every producer who
 * also mixes, which is most of them. The roles themselves are worth keeping:
 * "Producer, Mixed By" is a different kind of involvement from "Remix", and
 * the interface says which.
 */
function dedupe(
  credits: { id: number; name: string; role?: string }[],
): { id: number; name: string; roles: string[] }[] {
  const byId = new Map<number, { id: number; name: string; roles: string[] }>()

  for (const credit of credits) {
    if (credit.id <= 0 || isAnonymousArtist(norm(credit.name))) continue
    // Only roles that mean shaping the record. "Photography By" and "Design"
    // are real credits and say nothing about how a record sounds.
    if (credit.role && !SHAPING_ROLES.test(credit.role)) continue

    const existing = byId.get(credit.id)
    if (existing) {
      if (credit.role && !existing.roles.includes(credit.role)) existing.roles.push(credit.role)
    } else {
      byId.set(credit.id, {
        id: credit.id,
        name: credit.name,
        roles: credit.role ? [credit.role] : [],
      })
    }
  }

  return [...byId.values()]
}
