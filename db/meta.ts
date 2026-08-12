import type { Preferences, SyncState } from '#shared/types'

import { openFidelityDb } from './open'
import type { MetaKey, MetaValue } from './schema'

type ValueFor<K extends MetaKey> = Extract<MetaValue, { key: K }>['value']

/** Reads one meta entry, or undefined if it was never written. */
export async function getMeta<K extends MetaKey>(key: K): Promise<ValueFor<K> | undefined> {
  const db = await openFidelityDb()
  const row = await db.get('meta', key)
  return row?.value as ValueFor<K> | undefined
}

export async function setMeta<K extends MetaKey>(key: K, value: ValueFor<K>): Promise<void> {
  const db = await openFidelityDb()
  await db.put('meta', { key, value } as MetaValue)
}

export async function deleteMeta(key: MetaKey): Promise<void> {
  const db = await openFidelityDb()
  await db.delete('meta', key)
}

/**
 * Two fields left here on 2026-08-11, having never been read by anything.
 *
 * `signalWeights` promised per-user signal tuning. It should not be built: the
 * project's own rule is that `SCALE` and `SECONDARY` stay constants because
 * adjusting them makes scores incomparable over time — and per-user weights
 * make them incomparable between people as well, on top of detaching every
 * score from the golden-file test that is supposed to pin them.
 *
 * `prefSleeveCondition` is a reasonable idea with the data already behind it —
 * `listing.sleeve` is fetched, stored and handed to the matcher. It is a
 * *feature*, though: dampening on it moves every score and rewrites the
 * snapshot, so it goes through `docs/04-MATCHING-ENGINE.md` first like every
 * other signal. Filed in the backlog rather than carried as a field nothing
 * reads.
 *
 * Nothing needs migrating. `updatePreferences` merges over what is stored, so
 * an older device's leftover keys simply stop being copied forward.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  prefMediaCondition: 'Very Good Plus (VG+)',
  targetPrice: null,
  maxPrice: null,
  minSellerRating: 98,
  formatsAllow: ['Vinyl'],
  shipsFromBlock: [],
  excludeReissues: false,
  currency: 'EUR',
  shipsToCountry: 'Germany',
  // Off: rule 5 stays the normal case, the exception is switched on by hand.
  importFriends: false,
  // One device needs no vault, so the default configuration is no vault.
  vaultTarget: 'none' as const,
  vaultSyncedAt: null,
  // On, because a vault nobody remembers to open is out of date on the one
  // device they pick up. Off is a deliberate choice for a shared machine.
  vaultRemember: true,
  cloudClientIds: {},
  // Empty, and empty is the supported configuration. No feature may require it.
  hubUrl: null,
  hubSecret: null,
}

export const DEFAULT_SYNC_STATE: SyncState = {
  collectionSyncedAt: null,
  wantlistSyncedAt: null,
  horizonBuiltAt: null,
  horizonProgress: null,
  horizonRevalidatedAt: null,
  lastCollectionAdd: null,
  collectionReadFullyAt: null,
}

/** Stored preferences merged over the defaults, so a new field is never undefined. */
export async function getPreferences(): Promise<Preferences> {
  return { ...DEFAULT_PREFERENCES, ...(await getMeta('preferences')) }
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const next = { ...(await getPreferences()), ...patch }
  await setMeta('preferences', next)
  return next
}

export async function getSyncState(): Promise<SyncState> {
  return { ...DEFAULT_SYNC_STATE, ...(await getMeta('syncState')) }
}

export async function updateSyncState(patch: Partial<SyncState>): Promise<SyncState> {
  const next = { ...(await getSyncState()), ...patch }
  await setMeta('syncState', next)
  return next
}
