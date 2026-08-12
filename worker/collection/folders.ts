import { z } from 'zod'

import { getMeta, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import { queueJob } from '~~/db/outbox'
import { isOwnEntry, type CollectionFolder } from '#shared/types'
import type { DiscogsClient } from '../discogs/client'

/**
 * The folders a collection is divided into.
 *
 * Fidelity has always shown one heap, because it only ever asked for folder 0
 * — the virtual "All". Somebody who keeps "Sell" apart from "Play copies"
 * could not see the difference here, and a record moved into storage looked
 * exactly like one on the shelf.
 */

const foldersSchema = z.object({
  folders: z.array(
    z.object({ id: z.number().int(), name: z.string(), count: z.number().int() }),
  ),
})

export async function refreshFolders(
  client: DiscogsClient,
  username: string,
): Promise<CollectionFolder[] | null> {
  try {
    const answer = await client.get(
      `/users/${encodeURIComponent(username)}/collection/folders`,
      foldersSchema,
    )
    // Folder 0 is "All" — every record is in it, so naming it as a place a
    // record could be moved to would be a lie with a dropdown around it.
    const folders = answer.folders.filter((folder) => folder.id !== 0)
    await setMeta('collectionFolders', folders)
    return folders
  } catch {
    // A missing list costs a label, not a feature: the sheet leaves the row
    // out, exactly as it does before the first sync.
    return null
  }
}

export async function knownFolders(): Promise<CollectionFolder[]> {
  return (await getMeta('collectionFolders')) ?? []
}

/**
 * Moves one copy into another folder.
 *
 * The same endpoint as a rating, with `folder_id` instead — so it is
 * idempotent for the same reason: moving a record where it already is leaves
 * it where it is.
 */
export async function moveToFolder(instanceId: number, folderId: number): Promise<boolean> {
  const db = await openFidelityDb()
  const record = await db.get('collection', instanceId)
  if (!record || !isOwnEntry(record)) return false
  if (record.folderId === folderId) return true

  await db.put('collection', { ...record, folderId })
  await queueJob({
    id: `collection.folder:${instanceId}`,
    kind: 'collection.folder',
    payload: {
      releaseId: record.releaseId,
      // Where it is being written *from* — Discogs addresses the entry by the
      // folder it currently sits in, so the old one is part of the address.
      folderId: record.folderId,
      instanceId,
      moveTo: folderId,
    },
    revert: { folderId: record.folderId },
    queuedAt: Date.now(),
  })

  return true
}
