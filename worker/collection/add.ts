import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import type { CollectionItem, Match } from '#shared/types'
import type { DiscogsClient } from '../discogs/client'
import { norm } from '../match/normalize'

/**
 * Putting a record you just bought on your own shelf.
 *
 * "Bought" and "it is in my collection now" are one thought, and until this
 * existed they were two: a note in Fidelity, and a visit to Discogs later that
 * evening that half the time never happened. The next dig should know.
 */

const ownedSchema = z.object({
  releases: z.array(z.object({ id: z.number().int() })),
})

/**
 * Does the shelf already hold this release, over at Discogs?
 *
 * The lookup that replaces a retry. Adding is the one call that files
 * something new, so after an unreadable failure the question is not "did it
 * work" — which cannot be known — but "is it there now", which can.
 */
export async function ownsRelease(
  client: DiscogsClient,
  username: string,
  releaseId: number,
): Promise<boolean> {
  const answer = await client.get(
    `/users/${encodeURIComponent(username)}/collection/releases/${releaseId}`,
    ownedSchema,
  )
  return answer.releases.length > 0
}

/*
 * And it deliberately does not catch.
 *
 * Not knowing is neither "it is there" nor "it is not". Answering "yes" would
 * drop a job that may never have arrived; answering "no" would send the add
 * again on a guess, which is the duplicate this whole mechanism exists to
 * prevent. Letting the error out leaves the job queued for the next round —
 * the only honest third answer.
 */

/**
 * A shelf row built from what the dig already knows.
 *
 * Deliberately provisional: no entry ids, so it cannot be rated until the
 * sync has been round — and the sync is asked for straight after the add
 * lands, so that is minutes, not the half hour the staleness clock allows.
 * Better a record that is visibly there and not yet editable than a shelf
 * that disagrees with what somebody just did.
 */
function provisional(match: Match & { title: string; artist: string }): CollectionItem {
  return {
    releaseId: match.releaseId,
    masterId: 0,
    title: match.title,
    artistIds: [],
    artistNorms: [norm(match.artist)],
    artistNames: [match.artist],
    labelIds: [],
    labelNorms: match.label ? [norm(match.label)] : [],
    labelNames: match.label ? [match.label] : [],
    catnos: match.catno ? [match.catno] : [],
    genres: [],
    styles: [],
    formats: match.format ? match.format.split(', ') : [],
    year: match.year ?? 0,
    thumbUrl: match.thumbUrl ?? '',
    coverUrl: '',
    rating: 0,
    addedAt: new Date().toISOString(),
    instanceId: 0,
    folderId: 0,
  }
}

export async function addRecord(match: Match): Promise<boolean> {
  /*
   * A find whose six hours are up no longer knows what the record was called.
   *
   * Title and artist are marketplace fields and expiry nulls them (rule 4), so
   * a row built from one would be a nameless entry in somebody's shelf. The
   * record is still a real purchase — it is just not this screen's job to
   * invent a name for it, and Discogs' own page is one button away.
   */
  if (!match.title || !match.artist) return false

  const db = await openFidelityDb()
  // Already on the shelf: nothing to file, and filing it would make a second
  // copy of a record somebody owns once.
  if (await db.get('collection', match.releaseId)) return false

  await db.put(
    'collection',
    provisional({ ...match, title: match.title, artist: match.artist }),
  )
  await queueJob({
    id: `collection.add:${match.releaseId}`,
    kind: 'collection.add',
    payload: { releaseId: match.releaseId },
    revert: {},
    queuedAt: Date.now(),
  })

  return true
}
