import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { FollowedArtist } from '#shared/types'

import type { DiscogsClient } from './discogs/client'

/**
 * The radar: bands somebody has an eye on and owns nothing by (M29).
 *
 * Asked for by a tester on 2026-09-13: "Exit North — I think they are great,
 * have no record by them, but I would like to be shown one if it turns up."
 * Nothing in the app could carry that. S3 matches against the taste profile,
 * computed from the collection alone; the horizon expands wantlist *masters*
 * rather than wantlist artists. So a band you own nothing by did not exist for
 * the engine, and putting one record on the wantlist found that record and
 * other pressings of that album — never a different album.
 *
 * Three small pieces make it work, and all three already existed:
 *
 * - The horizon expands a followed artist like a collected one, which turns
 *   the whole discography into release ids for one or two requests.
 * - `buildIndex` puts the name into the same map the cascade consults, so
 *   every stage — including the lexicon — finds them.
 * - A signal of their own, `ARTIST_FOLLOWED`, because `ARTIST_KNOWN`'s
 *   sentence counts records and here the count is nought.
 */

/** What a followed artist looks like coming back from a search. */
export interface ArtistHit {
  artistId: number
  name: string
  thumbUrl: string | null
  /** Already on the radar, so adding it changes nothing. */
  known: boolean
}

/**
 * `GET /database/search?type=artist` (docs/02).
 *
 * The same endpoint the barcode lookup uses, asked a different question — so
 * it is already documented, already paced and already inside the one lane.
 * `title` is the artist's name for an artist row; the field is named for
 * releases and Discogs reuses it.
 */
const artistSearchSchema = z.object({
  results: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      thumb: z.string().optional(),
    }),
  ),
})

/** Enough to choose from, few enough to read on a phone. */
const MAX_HITS = 8

export async function searchArtists(
  client: DiscogsClient,
  query: string,
  signal?: AbortSignal,
): Promise<ArtistHit[]> {
  const term = query.trim()
  // An empty field is not a search. It would cost a request and come back
  // with whatever Discogs thinks the most popular artist is.
  if (term.length === 0) return []

  const answer = await client.get('/database/search', artistSearchSchema, {
    query: { q: term, type: 'artist', per_page: String(MAX_HITS) },
    signal,
  })

  const already = new Set((await listFollowed()).map((artist) => artist.artistId))

  return answer.results.slice(0, MAX_HITS).map((row) => ({
    artistId: row.id,
    name: row.title,
    thumbUrl: row.thumb || null,
    known: already.has(row.id),
  }))
}

export async function listFollowed(): Promise<FollowedArtist[]> {
  const db = await openFidelityDb()
  return (await db.getAll('followed')).sort((a, b) => a.name.localeCompare(b.name))
}

export async function follow(
  artistId: number,
  name: string,
  now: number = Date.now(),
): Promise<FollowedArtist[]> {
  const db = await openFidelityDb()
  const existing = await db.get('followed', artistId)

  /*
   * `followedAt` is kept from the first time, `updatedAt` is not.
   *
   * The first is when somebody decided; the second is what a merge between two
   * devices compares, the same pair the dealer rows carry. Following something
   * twice is not a new decision.
   */
  await db.put('followed', {
    artistId,
    name,
    followedAt: existing?.followedAt ?? now,
    updatedAt: now,
  })

  return listFollowed()
}

export async function unfollow(artistId: number): Promise<FollowedArtist[]> {
  const db = await openFidelityDb()
  await db.delete('followed', artistId)

  /*
   * The horizon chunk stays.
   *
   * It was paid for, it is a fact about Discogs rather than about this
   * collection, and it is what "another pressing" and the credit graph read.
   * Unfollowing takes the artist out of the match index; it does not make the
   * app forget what it learned and pay for it again if the answer changes.
   */
  return listFollowed()
}
