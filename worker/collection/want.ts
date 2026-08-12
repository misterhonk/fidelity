import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import type { Match, WantlistItem } from '#shared/types'
import { norm } from '../match/normalize'

/**
 * Wanting a record, and stopping wanting it.
 *
 * Simpler than the collection in one way that matters: a want is addressed by
 * release alone. There is no instance to create, so nothing a repeated call
 * can duplicate — which is why both directions may be retried freely, and why
 * this works for a record that was never synced with entry ids.
 */

function provisional(match: Match & { title: string; artist: string }): WantlistItem {
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
    addedAt: new Date().toISOString(),
  }
}

export async function wantRecord(match: Match): Promise<boolean> {
  // Six hours on, a find no longer knows what the record was called — see
  // `collection/add.ts` for why a nameless row is worse than none.
  if (!match.title || !match.artist) return false

  const db = await openFidelityDb()
  if (await db.get('wantlist', match.releaseId)) return true

  await db.put('wantlist', provisional({ ...match, title: match.title, artist: match.artist }))
  await queueJob({
    id: `wantlist.add:${match.releaseId}`,
    kind: 'wantlist.add',
    payload: { releaseId: match.releaseId },
    revert: {},
    queuedAt: Date.now(),
  })

  return true
}

export async function unwantRecord(releaseId: number): Promise<boolean> {
  const db = await openFidelityDb()
  const want = await db.get('wantlist', releaseId)
  if (!want) return false

  await db.delete('wantlist', releaseId)
  await queueJob({
    id: `wantlist.remove:${releaseId}`,
    kind: 'wantlist.remove',
    payload: { releaseId },
    // The row itself, for the same reason the collection carries one: Discogs
    // cannot hand back a want it never removed.
    revert: { want: JSON.stringify(want) },
    queuedAt: Date.now(),
  })

  return true
}
