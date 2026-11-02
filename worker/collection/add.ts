import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import type { OutboxJob } from '~~/db/schema'
import type { AddedCopy, AddState, CollectionItem, Match, Pressing } from '#shared/types'
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
  releases: z.array(z.object({ id: z.number().int(), instance_id: z.number().int() })),
})

/**
 * The copies of this release on the shelf, over at Discogs, by instance id.
 *
 * The lookup that replaces a retry. Adding is the one call that files
 * something new, so after an unreadable failure the question is not "did it
 * work" — which cannot be known — but "is there a copy now that was not there
 * before", which can. Not "any copy": a second copy of a record already owned
 * would be taken for having arrived, and dropped. And ids, not a count: a copy
 * removed meanwhile would hide ours, and it would be sent twice.
 */
export async function instancesOf(
  client: DiscogsClient,
  username: string,
  releaseId: number,
): Promise<number[]> {
  const answer = await client.get(
    `/users/${encodeURIComponent(username)}/collection/releases/${releaseId}`,
    ownedSchema,
  )
  return answer.releases.map((copy) => copy.instance_id)
}

/*
 * And it deliberately does not catch.
 *
 * Not knowing is neither "it is there" nor "it is not". Answering "new" would
 * drop a job that may never have arrived; answering "nothing new" would send the add
 * again on a guess, which is the duplicate this whole mechanism exists to
 * prevent. Letting the error out leaves the job queued for the next round —
 * the only honest third answer.
 */

export type ProvisionalCopy = Omit<CollectionItem, 'instanceId' | 'folderId'>

/** What somebody chose for a copy before Discogs has given it an id. */
export interface CopyChoices {
  /** Where it is filed at Discogs. Folder 1 is "Uncategorized", which every account has. */
  folderId?: number
  placeId?: string | null
  /** Discogs' own fields (media, sleeve, notes) — sent once the copy has an entry to address. */
  fields?: Record<number, string>
}

/**
 * A shelf row built from what the dig already knows.
 *
 * Deliberately provisional: no entry behind it, so it cannot be rated until
 * Discogs has answered with one — and the sync is asked for straight after
 * the add lands, so the rest of the row follows within minutes. Better a
 * record that is visibly there and not yet editable than a shelf that
 * disagrees with what somebody just did.
 */
function provisional(match: Match & { title: string; artist: string }): ProvisionalCopy {
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
  }
}

/*
 * Its own key until Discogs hands over a real one — one per copy.
 *
 * `-releaseId` was one per release, so a second copy of the same record
 * overwrote the first one's row while both were waiting. Negative, so no write
 * path takes it for an entry; and far below any `-releaseId`, which is still
 * the sync's stand-in for a row without an instance, so the two never collide.
 */
let sequence = 0
const provisionalKey = () => -(Date.now() * 1000 + (sequence++ % 1000))

/** The key a queued add's row waits under — `-releaseId` for one queued before per-copy keys. */
export const provisionalKeyOf = (job: OutboxJob): number =>
  Number(job.payload.instanceId ?? -Number(job.payload.releaseId))

/**
 * Puts one copy on the shelf and queues it for Discogs. Returns its provisional key.
 *
 * Never asks whether the record is already owned: a second copy is a real
 * thing to own, and a caller that wants "only once" asks first, as
 * `addRecord` does.
 */
export async function addCopy(
  copy: ProvisionalCopy,
  choices: CopyChoices = {},
): Promise<number> {
  // Folder 0 is Discogs' virtual "All" and cannot be written to.
  const folderId = choices.folderId && choices.folderId > 0 ? choices.folderId : 1
  const db = await openFidelityDb()
  const tx = db.transaction(['collection', 'placements', 'fieldValues'], 'readwrite')
  // A taken key would be overwritten here and its job replaced by `queueJob`: one bought copy gone.
  let instanceId = provisionalKey()
  while ((await tx.objectStore('collection').getKey(instanceId)) !== undefined)
    instanceId = provisionalKey()
  await tx.objectStore('collection').put({ ...copy, instanceId, folderId })
  if (choices.placeId)
    await tx
      .objectStore('placements')
      .put({ instanceId, placeId: choices.placeId, at: Date.now() })
  if (choices.fields && Object.keys(choices.fields).length > 0)
    await tx.objectStore('fieldValues').put({ instanceId, values: choices.fields })
  await tx.done

  await queueJob({
    id: `collection.add:${instanceId}`,
    kind: 'collection.add',
    payload: { releaseId: copy.releaseId, folderId, instanceId },
    revert: {},
    queuedAt: Date.now(),
  })
  return instanceId
}

/**
 * The copy has an entry at Discogs now: what waited under its provisional key moves there.
 *
 * The row, its place and its condition — so a record put in a compartment
 * while it was on its way is still there afterwards. Condition goes to
 * Discogs from here, because only now is there an entry to write it to.
 */
export async function settleCopy(job: OutboxJob, instanceId: number): Promise<void> {
  const key = provisionalKeyOf(job)
  const db = await openFidelityDb()
  const tx = db.transaction(['collection', 'placements', 'fieldValues', 'outbox'], 'readwrite')

  const collection = tx.objectStore('collection')
  const row = await collection.get(key)
  // A sync that already brought the real entry wins: it knows more than the find did.
  // The folder it was sent to: a row queued before per-copy keys still says 0, which no write can address.
  if (row && !(await collection.get(instanceId)))
    await collection.put({ ...row, instanceId, folderId: Number(job.payload.folderId ?? 1) })
  await collection.delete(key)

  const placements = tx.objectStore('placements')
  const placement = await placements.get(key)
  if (placement?.placeId) {
    const at = Date.now()
    await placements.put({ instanceId, placeId: placement.placeId, at })
    // Written down, not deleted: the vault merges placements by their stamp (places.ts).
    await placements.put({ instanceId: key, placeId: null, at })
  }

  const fieldValues = tx.objectStore('fieldValues')
  const fields = (await fieldValues.get(key))?.values ?? {}
  await fieldValues.delete(key)

  /*
   * Another copy of this release, sent earlier and not yet heard back from,
   * must not take this one for its own: what it saw before it went out could
   * not include an id that only exists now.
   */
  const outbox = tx.objectStore('outbox')
  for (const other of await outbox.getAll()) {
    if (
      other.kind === 'collection.add' &&
      other.id !== job.id &&
      other.payload.releaseId === job.payload.releaseId &&
      other.instancesBefore !== undefined
    )
      await outbox.put({ ...other, instancesBefore: [...other.instancesBefore, instanceId] })
  }
  await tx.done

  const { setFieldValue } = await import('./fields')
  for (const [fieldId, value] of Object.entries(fields))
    await setFieldValue(instanceId, Number(fieldId), value)
}

/** Takes a copy that never reached Discogs off the shelf again, with what hung off it. */
export async function dropCopy(job: OutboxJob): Promise<void> {
  const key = provisionalKeyOf(job)
  const db = await openFidelityDb()
  const tx = db.transaction(['collection', 'placements', 'fieldValues'], 'readwrite')
  await tx.objectStore('collection').delete(key)
  await tx.objectStore('fieldValues').delete(key)
  // Left in a place, it would go on being counted there (places.ts counts placements).
  if ((await tx.objectStore('placements').get(key))?.placeId)
    await tx.objectStore('placements').put({ instanceId: key, placeId: null, at: Date.now() })
  await tx.done
}

export async function addRecord(match: Match, folderId?: number): Promise<boolean> {
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
  /*
   * Already on the shelf — asked by release, not by key.
   *
   * "Bought" fires this every time the button lights up, so a find adds its
   * record once: filing it again would make a second copy of a record
   * somebody owns once, the mirror image of the bug that made this store
   * instance-keyed. A second copy on purpose goes through `addCopy`.
   */
  if ((await db.getAllFromIndex('collection', 'by-release', match.releaseId)).length > 0) {
    return false
  }

  await addCopy(provisional({ ...match, title: match.title, artist: match.artist }), {
    folderId,
  })
  return true
}

/*
 * Add mode (#233): a pressing named by its barcode or run-out, put on the shelf
 * as a copy of its own. Zero requests here — the lookup was the request, and
 * the add travels through the outbox like every other write.
 */

/** "Portishead - Dummy" → artist and title, the way Discogs' search names a release. */
function splitTitle(title: string): { artist: string; title: string } {
  const at = title.indexOf(' - ')
  return at < 0
    ? { artist: '', title }
    : { artist: title.slice(0, at), title: title.slice(at + 3) }
}

/** The copies of a release on the shelf with an entry at Discogs. */
async function entriesOf(releaseId: number): Promise<number[]> {
  const db = await openFidelityDb()
  return (await db.getAllFromIndex('collection', 'by-release', releaseId))
    .map((copy) => copy.instanceId)
    .filter((id) => id > 0)
}

/**
 * Puts the pressing on the shelf as one more copy. A second copy is allowed on
 * purpose — the screen warns, the collector decides.
 */
export async function addPressing(
  pressing: Pressing,
  choices: { grade?: string; placeId?: string | null; folderId?: number } = {},
): Promise<AddedCopy> {
  const before = await entriesOf(pressing.releaseId)
  const { artist, title } = splitTitle(pressing.title)
  const key = await addCopy(
    {
      releaseId: pressing.releaseId,
      masterId: pressing.masterId,
      title,
      artistIds: [],
      artistNorms: artist ? [norm(artist)] : [],
      artistNames: artist ? [artist] : [],
      labelIds: [],
      labelNorms: pressing.label ? [norm(pressing.label)] : [],
      labelNames: pressing.label ? [pressing.label] : [],
      catnos: pressing.catno ? [pressing.catno] : [],
      genres: [],
      styles: [],
      formats: pressing.format ? pressing.format.split(', ') : [],
      year: pressing.year ?? 0,
      thumbUrl: pressing.thumbUrl,
      coverUrl: '',
      rating: 0,
      addedAt: new Date().toISOString(),
    },
    {
      folderId: choices.folderId,
      placeId: choices.placeId,
      // Field 1 is Media Condition on every account (db/schema.ts).
      fields: choices.grade ? { 1: choices.grade } : undefined,
    },
  )
  return { key, releaseId: pressing.releaseId, before }
}

/**
 * Where each add of this session stands: waiting, failed, or sent — and then
 * under which entry, so undo can address it.
 *
 * Sent is read the way the outbox reads a landing: a copy of the release that
 * was not there before the add. Two adds of one release take one new entry each.
 */
export async function addStatus(adds: AddedCopy[]): Promise<AddState[]> {
  const db = await openFidelityDb()
  const jobs = new Map((await db.getAll('outbox')).map((job) => [job.id, job]))
  const taken = new Set<number>()
  const states: AddState[] = []
  for (const add of adds) {
    const job = jobs.get(`collection.add:${add.key}`)
    if (job) {
      states.push({
        key: add.key,
        status: job.attempts > 0 || job.lastError !== undefined ? 'failed' : 'waiting',
        instanceId: null,
      })
      continue
    }
    const fresh = (await entriesOf(add.releaseId)).find(
      (id) => !add.before.includes(id) && !taken.has(id),
    )
    if (fresh !== undefined) taken.add(fresh)
    // No job and no new entry: given up on, and its row already taken back.
    states.push({
      key: add.key,
      status: fresh === undefined ? 'failed' : 'sent',
      instanceId: fresh ?? null,
    })
  }
  return states
}

/**
 * Takes an add back. Free while it waits: the job is dropped before Discogs
 * hears of it. Once it has landed, it is a removal of that entry like any
 * other. Under the outbox lock — a drain reads the queue once and sends what
 * it read, so dropping a job behind its back would not stop the POST.
 */
export async function undoAdd(add: AddedCopy): Promise<boolean> {
  const { OUTBOX_LOCK } = await import('~~/db/outbox')
  const locks = globalThis.navigator?.locks
  const run = async () => {
    const db = await openFidelityDb()
    const job = await db.get('outbox', `collection.add:${add.key}`)
    if (job) {
      // Cut off mid-send: Discogs may have it. The next drain looks; nothing is guessed here.
      if (job.sentAt !== undefined) return false
      await db.delete('outbox', job.id)
      await dropCopy(job)
      return true
    }
    const [state] = await addStatus([add])
    if (state?.instanceId == null) return false
    const { removeRecord } = await import('./remove')
    return removeRecord(state.instanceId)
  }
  return locks ? locks.request(OUTBOX_LOCK, run) : run()
}
