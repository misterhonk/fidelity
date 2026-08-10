import type { VaultSnapshot } from '#shared/types'

/**
 * Two devices, one truth.
 *
 * Deliberately the simplest rule that is actually correct: **per record, the
 * newer write wins.** Not per field — a field-level merge would need a
 * timestamp per field and would still guess wrong about intent. Somebody who
 * edits a postage table on the laptop and watches a shop on the phone gets
 * both, because those are different records.
 *
 * What the rule costs: change the same record on two devices while both are
 * offline and the later change wins outright. For a shortlist and a postage
 * table that is the right trade; for anything where it would not be, the store
 * is not in here.
 *
 * What is deliberately absent:
 *
 *   The token — a credential on three devices is three times the exposure.
 *   Each device signs in once (CLAUDE.md rule 6).
 *
 *   Digs and matches — marketplace data, gone after six hours by rule anyway.
 *   Putting prices on a server to sync them back is the one thing this app
 *   promised not to do.
 */

/** How each store decides which of two records is the newer one. */
const STAMP = {
  horizon: (row: { fetchedAt?: number }) => row.fetchedAt ?? 0,
  feedback: (row: { updatedAt?: number; createdAt?: number }) =>
    row.updatedAt ?? row.createdAt ?? 0,
  basket: (row: { addedAt?: number }) => row.addedAt ?? 0,
  dealers: (row: { updatedAt?: number; lastScannedAt?: number | null }) =>
    row.updatedAt ?? row.lastScannedAt ?? 0,
  collection: (row: { syncedAt?: number }) => row.syncedAt ?? 0,
  wantlist: (row: { syncedAt?: number }) => row.syncedAt ?? 0,
} as const

const KEY = {
  horizon: 'key',
  feedback: 'listingId',
  basket: 'listingId',
  dealers: 'username',
  collection: 'releaseId',
  wantlist: 'releaseId',
} as const

export type SyncableStore = keyof typeof KEY

export const SYNCABLE_STORES = Object.keys(KEY) as SyncableStore[]

type Row = Record<string, unknown>

/**
 * Merges a snapshot from elsewhere into the one from here.
 *
 * Neither side is authoritative. That matters: a device that has been off for
 * a week must not wipe what the others did, and the device doing the merge
 * must not win just because it is the one doing it.
 */
export function mergeSnapshots(mine: VaultSnapshot, theirs: VaultSnapshot): VaultSnapshot {
  const merged: VaultSnapshot = {
    savedAt: Math.max(mine.savedAt, theirs.savedAt),
    // Whichever preferences object was written last. It is one small record
    // and splitting it per field would make "ich habe das abgeschaltet" a
    // question of which knob, on which device, in which order.
    preferences: theirs.savedAt > mine.savedAt ? theirs.preferences : mine.preferences,
    stores: {},
  }

  for (const store of SYNCABLE_STORES) {
    const here = mine.stores[store] ?? []
    const there = theirs.stores[store] ?? []
    if (here.length === 0 && there.length === 0) continue

    merged.stores[store] = mergeRows(store, here as Row[], there as Row[])
  }

  return merged
}

function mergeRows(store: SyncableStore, here: Row[], there: Row[]): Row[] {
  const keyOf = KEY[store]
  const stampOf = STAMP[store] as (row: Row) => number

  const byKey = new Map<unknown, Row>()
  for (const row of here) byKey.set(row[keyOf], row)

  for (const row of there) {
    const key = row[keyOf]
    const existing = byKey.get(key)

    /*
     * Ties go to the local copy. Not arbitrary: two writes with the same
     * timestamp are almost always the same write seen twice, and preferring
     * the remote one would make every sync rewrite rows for nothing.
     */
    if (!existing || stampOf(row) > stampOf(existing)) byKey.set(key, row)
  }

  return [...byKey.values()]
}

/** What a snapshot is worth saying about itself, for the screen. */
export function describeSnapshot(snapshot: VaultSnapshot): Record<SyncableStore, number> {
  const counts = {} as Record<SyncableStore, number>
  for (const store of SYNCABLE_STORES) counts[store] = snapshot.stores[store]?.length ?? 0
  return counts
}
