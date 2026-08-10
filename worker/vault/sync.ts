import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Preferences, VaultSnapshot } from '#shared/types'
import type { VaultTargetPort } from '#shared/ports'

import { open, seal, type SealedVault } from './crypto'
import { describeSnapshot, mergeSnapshots, SYNCABLE_STORES, type SyncableStore } from './merge'

/**
 * One round: read what is out there, merge, write back, keep the result.
 *
 * Deliberately not a live sync. Nothing watches for changes and pushes them;
 * a round happens when the app opens and when somebody asks. Two reasons: a
 * PWA is not running while it is closed, so "live" would be a promise the
 * platform cannot keep — and a merge that happens while you are looking at a
 * list is a list that changes under your hands.
 */

export interface SyncReport {
  /** What the merged snapshot holds, per store. */
  counts: Record<SyncableStore, number>
  /** Whether anything was out there to merge with. */
  hadRemote: boolean
  syncedAt: number
}

export async function snapshotLocal(now: number): Promise<VaultSnapshot> {
  const db = await openFidelityDb()

  const stores: VaultSnapshot['stores'] = {}
  for (const store of SYNCABLE_STORES) {
    const rows = await db.getAll(store)
    if (rows.length > 0) stores[store] = rows as unknown[]
  }

  return { savedAt: now, preferences: await getPreferences(), stores }
}

/**
 * Writes a merged snapshot back into IndexedDB.
 *
 * Per record rather than clearing the store first: a store that is emptied and
 * refilled is a store that is briefly empty, and a tab that reads it in that
 * moment sees a collection that vanished.
 */
export async function applySnapshot(snapshot: VaultSnapshot): Promise<void> {
  const db = await openFidelityDb()

  for (const store of SYNCABLE_STORES) {
    const rows = snapshot.stores[store]
    if (!rows?.length) continue

    const tx = db.transaction(store, 'readwrite')
    for (const row of rows) await tx.store.put(row as never)
    await tx.done
  }

  if (snapshot.preferences) {
    const { setMeta } = await import('~~/db/meta')
    /*
     * The token is not in here and never was — but preferences arriving from
     * another device must not be able to smuggle one in either, so this writes
     * the preferences key and nothing else.
     */
    await setMeta('preferences', snapshot.preferences as Preferences)
  }
}

export interface SyncOptions {
  target: VaultTargetPort
  passphrase: string
  now?: number
}

export async function syncVault({
  target,
  passphrase,
  now = Date.now(),
}: SyncOptions): Promise<SyncReport> {
  const mine = await snapshotLocal(now)

  /*
   * Reading first, and surviving a failure to read.
   *
   * A target that answers nothing yet is the normal first run. A target that
   * is broken is a different matter — but writing over it would turn "I cannot
   * reach my other device" into "I no longer have what my other device knew",
   * so a read that throws stops the round.
   */
  const remote = (await target.read()) as SealedVault | null

  let merged = mine
  let hadRemote = false

  if (remote) {
    const theirs = await open<VaultSnapshot>(remote, passphrase)
    merged = mergeSnapshots(mine, theirs)
    hadRemote = true
    await applySnapshot(merged)
  }

  await target.write(await seal(merged, passphrase))

  return { counts: describeSnapshot(merged), hadRemote, syncedAt: now }
}
