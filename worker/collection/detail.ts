import type { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { ReleaseDetail } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { releaseDetailSchema } from '../discogs/schemas'

/**
 * What a record actually is — one request, and then never again.
 *
 * The collection sync gives a shelf names, a cover and a format. What is on
 * the record, who played on it, and the number stamped in the run-out groove
 * are not in that response at all (docs/02: `basic_information` carries no
 * `identifiers`, no `tracklist`, no `released` date — measured 2026-08-12).
 *
 * All of it is one `/releases/{id}` away, and that is the endpoint rule 2
 * forbids walking: ten thousand of them is three hours. The rule is about
 * loops, not about the endpoint — so this is the same bargain the covers
 * make (worker/covers.ts): fetched only for a record somebody has actually
 * opened, one at a time through the paced lane, and kept for ever after.
 *
 * "For ever" is the right word here and would not be for a price. A tracklist
 * does not change; when Discogs corrects one, the correction is not worth a
 * request on every open for the rest of the app's life.
 */

/** A heading is a section of a tracklist, not a song. */
const isTrack = (type?: string) => type === undefined || type === 'track'

export async function releaseDetail(
  client: DiscogsClient,
  releaseId: number,
  now: () => number = Date.now,
): Promise<ReleaseDetail | null> {
  const db = await openFidelityDb()

  const kept = await db.get('releaseDetail', releaseId)
  if (kept) return kept

  let answer: z.infer<typeof releaseDetailSchema>
  try {
    answer = await client.get(`/releases/${releaseId}`, releaseDetailSchema)
  } catch {
    /*
     * No detail is a screen with less on it, not a screen with an error on it.
     *
     * Everything above this line — cover, rating, label, condition — came from
     * storage and is already on screen. A shop basement with no signal should
     * cost the tracklist and nothing else.
     */
    return null
  }

  const detail: ReleaseDetail = {
    releaseId,
    country: answer.country ?? '',
    released: answer.released ?? '',
    tracks: (answer.tracklist ?? [])
      .filter((track) => isTrack(track.type_))
      .map((track) => ({
        position: track.position ?? '',
        title: track.title ?? '',
        duration: track.duration ?? '',
      }))
      .filter((track) => track.title.length > 0),
    credits: (answer.extraartists ?? [])
      .map((artist) => ({ name: artist.name, role: artist.role ?? '' }))
      .filter((credit) => credit.name.length > 0),
    identifiers: (answer.identifiers ?? [])
      .map((identifier) => ({
        type: identifier.type ?? '',
        value: identifier.value ?? '',
        ...(identifier.description ? { description: identifier.description } : {}),
      }))
      .filter((identifier) => identifier.value.length > 0),
    /*
     * A rating nobody has given is not a rating of zero.
     *
     * Discogs sends `average: 0, count: 0` for a record nobody has voted on,
     * and drawing that as "0.0 out of 5" would invent a verdict the community
     * never reached — the same mistake the stars above already refuse to make.
     */
    community:
      answer.community?.rating?.count && answer.community.rating.count > 0
        ? {
            rating: answer.community.rating.average ?? 0,
            votes: answer.community.rating.count,
          }
        : null,
    videos: (answer.videos ?? []).map((video) => ({
      title: video.title ?? '',
      uri: video.uri,
    })),
    notes: answer.notes ?? '',
    fetchedAt: now(),
  }

  await db.put('releaseDetail', detail)
  return detail
}

/** What is already known, without asking Discogs anything. */
export async function keptDetail(releaseId: number): Promise<ReleaseDetail | null> {
  const db = await openFidelityDb()
  return (await db.get('releaseDetail', releaseId)) ?? null
}
