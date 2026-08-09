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

export const DEFAULT_PREFERENCES: Preferences = {
  prefMediaCondition: 'Very Good Plus (VG+)',
  prefSleeveCondition: 'Very Good (VG)',
  targetPrice: null,
  maxPrice: null,
  minSellerRating: 98,
  formatsAllow: ['Vinyl'],
  shipsFromBlock: [],
  excludeReissues: false,
  signalWeights: {},
  currency: 'EUR',
  shipsToCountry: 'Germany',
  // Empty, and empty is the supported configuration. No feature may require it.
  hubUrl: null,
}

export const DEFAULT_SYNC_STATE: SyncState = {
  collectionSyncedAt: null,
  wantlistSyncedAt: null,
  horizonBuiltAt: null,
  horizonProgress: null,
  horizonRevalidatedAt: null,
  lastCollectionAdd: null,
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
