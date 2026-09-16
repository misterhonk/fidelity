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
    // Nothing said yet, on either count — and zero is "never said", not "meh".
    note: '',
    want: 0,
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

/**
 * What you wrote down about a record you are looking for.
 *
 * Note and rating travel together because Discogs takes them together: the
 * endpoint replaces both, so sending one alone would silently clear the other.
 * That is a trap worth naming rather than discovering.
 */
export async function noteWant(
  releaseId: number,
  note: string,
  want: number,
): Promise<boolean> {
  const db = await openFidelityDb()
  const stored = await db.get('wantlist', releaseId)
  if (!stored) return false
  if (stored.note === note && stored.want === want) return true

  await db.put('wantlist', { ...stored, note, want })
  await queueJob({
    id: `wantlist.note:${releaseId}`,
    kind: 'wantlist.note',
    payload: { releaseId, note, want },
    revert: { note: stored.note, want: stored.want },
    queuedAt: Date.now(),
  })

  return true
}

/**
 * Taking an armful off the wantlist at once (M27).
 *
 * The shelf has had "Select" since M27.5 and the wantlist never did, so
 * clearing out records you have since bought meant opening each sheet in turn
 * — twelve sheets for twelve records nobody wants any more.
 *
 * **It is not a loop around `unwantRecord`, and the reason is the row, not the
 * request.** Every call in that function opens the database again; a hundred
 * removals would be a hundred transactions, and the list is re-read afterwards
 * anyway. One transaction for the rows, then the jobs — which cost nothing
 * here, because the outbox is what carries them to Discogs later, one paced
 * slot at a time (`worker/outbox.ts`).
 *
 * What it returns is the rows as they were. That is what the way back is built
 * from, and it is the only moment they still exist to be handed over.
 */
export async function unwantRecords(releaseIds: number[]): Promise<WantlistItem[]> {
  const db = await openFidelityDb()

  const tx = db.transaction('wantlist', 'readwrite')
  const removed: WantlistItem[] = []
  for (const releaseId of releaseIds) {
    const want = await tx.store.get(releaseId)
    if (!want) continue
    removed.push(want)
    await tx.store.delete(releaseId)
  }
  await tx.done

  const queuedAt = Date.now()
  for (const want of removed) {
    await queueJob({
      id: `wantlist.remove:${want.releaseId}`,
      kind: 'wantlist.remove',
      payload: { releaseId: want.releaseId },
      revert: { want: JSON.stringify(want) },
      queuedAt,
    })
  }

  return removed
}

/**
 * And the way back, which is usually free.
 *
 * A removal is local first and reaches Discogs through the outbox, so for the
 * seconds or minutes before the drain runs, **Discogs has not been told
 * anything yet**. Undoing then is not a second write — it is dropping the job
 * that was waiting and putting the row back. Zero requests, and the wantlist
 * over there never moved.
 *
 * Once the job has drained there is no such luck: the want is gone at Discogs
 * and the way back is `wantlist.add`, one request per record, paced like any
 * other. Which of the two happened is not guessed — the outbox is asked.
 *
 * ⚠️ **The row goes back before the job is dropped.** The other order has a
 * window in which the job is gone and the record is not yet on the wantlist,
 * and a drain landing inside it would leave the record nowhere — removed at
 * Discogs, absent here, with nothing left that remembers it.
 */
export async function rewantRecords(records: WantlistItem[]): Promise<number> {
  const db = await openFidelityDb()
  const { pendingJobs, dropJob } = await import('~~/db/outbox')

  const waiting = new Set((await pendingJobs()).map((job) => job.id))

  const tx = db.transaction('wantlist', 'readwrite')
  for (const want of records) await tx.store.put(want)
  await tx.done

  let resent = 0
  const queuedAt = Date.now()
  for (const want of records) {
    const jobId = `wantlist.remove:${want.releaseId}`
    if (waiting.has(jobId)) {
      await dropJob(jobId)
      continue
    }
    // Drained already, so Discogs really has lost it. Ask for it back.
    await queueJob({
      id: `wantlist.add:${want.releaseId}`,
      kind: 'wantlist.add',
      payload: { releaseId: want.releaseId },
      revert: {},
      queuedAt,
    })
    resent += 1
  }

  return resent
}
