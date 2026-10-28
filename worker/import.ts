import { openFidelityDb } from '~~/db/open'
import type { MetaValue } from '~~/db/schema'
import type { Preferences } from '#shared/types'

import { withoutKeys } from './export'
import { fail } from './fail'

/**
 * A backup, read back in (docs/17 §8.4, M24).
 *
 * The file is what `exportEverything` wrote: the shelf, the wantlist, the
 * shops, the basket, the ratings, the places — and, on purpose, not the
 * prices. Digs travel without their matches (rule 4: marketplace data does
 * not go into a file), so they are not brought back at all: a dig without
 * its finds is a heading over nothing, and every one of them is older than
 * six hours by the time a backup is read.
 *
 * Rows are put, not replaced: importing on a device that already has a
 * shelf merges, the way the vault merges — a backup from the phone must not
 * wipe what the laptop did since. Meta (preferences, the taste profile, the
 * credit harvest) is taken from the file when the device has none.
 *
 * **Across versions.** The file carries the database version it came from.
 * The database's own migrations up to v6 refetch the shelf rather than
 * reshape rows, so rows written by a database older than that are skipped
 * here and the report says "sync again" — which is the same path the
 * migration takes. Everything since v6 has only added stores, and a store
 * the file does not know is simply left alone.
 */
export const OLDEST_ROW_VERSION = 6

/** Each store with its key path — a row without that value cannot be put. */
const KEY_PATH = {
  collection: 'instanceId',
  wantlist: 'releaseId',
  dealers: 'username',
  feedback: 'listingId',
  basket: 'listingId',
  places: 'id',
  placements: 'instanceId',
  valueHistory: 'day',
  followed: 'artistId',
  watched: 'releaseId',
} as const
const STORES = Object.keys(KEY_PATH) as (keyof typeof KEY_PATH)[]
type Store = (typeof STORES)[number]

export interface ImportReport {
  /** The version the file was written by, and the one it came from. */
  version: number
  dbVersion: number
  /** Rows put, per store. */
  imported: Partial<Record<Store, number>>
  /** What the file had that did not come back, and why. */
  skipped: { store: string; rows: number; reason: 'no-prices' | 'too-old' | 'invalid' }[]
  /** Which meta came from the file because the device had none. */
  meta: ('preferences' | 'tasteProfile' | 'credits')[]
}

interface BackupFile {
  kind?: unknown
  version?: unknown
  dbVersion?: unknown
  [store: string]: unknown
}

export async function importEverything(file: unknown): Promise<ImportReport> {
  const backup = (file ?? {}) as BackupFile
  if (backup.kind !== 'fidelity-backup' || typeof backup.version !== 'number') {
    throw fail('not-a-backup', 'not a fidelity backup file')
  }
  if (backup.version > 1) {
    throw fail(
      'backup-too-new',
      `backup version ${backup.version} is newer than this app knows`,
    )
  }
  // A file from before the stamp is from v1 of the export, written by v10 or
  // v11 of the database — v6 rows at the least, which is the shape kept.
  const dbVersion = typeof backup.dbVersion === 'number' ? backup.dbVersion : 10
  const tooOld = dbVersion < OLDEST_ROW_VERSION

  const db = await openFidelityDb()
  const report: ImportReport = {
    version: backup.version,
    dbVersion,
    imported: {},
    skipped: [],
    meta: [],
  }

  // One transaction: a file the database refuses halfway leaves nothing behind.
  const tx = db.transaction([...STORES, 'meta'], 'readwrite')
  try {
    for (const store of STORES) {
      const rows = backup[store]
      if (!Array.isArray(rows) || rows.length === 0) continue
      if (tooOld && (store === 'collection' || store === 'wantlist')) {
        report.skipped.push({ store, rows: rows.length, reason: 'too-old' })
        continue
      }
      const target = tx.objectStore(store)
      let put = 0
      let invalid = 0
      for (const row of rows) {
        if (!isValidRow(store, row)) {
          invalid += 1
          continue
        }
        // A backup's basket line and watched record carry no prices; they must not replace ones that do.
        if (store === 'basket' && (await target.count(row.listingId as number)) > 0) continue
        if (store === 'watched' && (await target.count(row.releaseId as number)) > 0) continue
        await target.put(row as never)
        put += 1
      }
      report.imported[store] = put
      if (invalid > 0) report.skipped.push({ store, rows: invalid, reason: 'invalid' })
    }

    for (const store of ['digs', 'matches'] as const) {
      const rows = backup[store]
      if (Array.isArray(rows) && rows.length > 0) {
        report.skipped.push({ store, rows: rows.length, reason: 'no-prices' })
      }
    }

    const meta = tx.objectStore('meta')
    if (
      backup.preferences &&
      typeof backup.preferences === 'object' &&
      !(await meta.get('preferences'))
    ) {
      // A file is no place for a hub's key, and one older than 0.112 may hold
      // them: they stay with whoever entered them on this device.
      await meta.put({
        key: 'preferences',
        value: withoutKeys(backup.preferences as Preferences)!,
      })
      report.meta.push('preferences')
    }
    for (const key of ['tasteProfile', 'credits'] as const) {
      const value = backup[key]
      if (value && typeof value === 'object' && !(await meta.get(key))) {
        await meta.put({ key, value } as MetaValue)
        report.meta.push(key)
      }
    }

    await tx.done
  } catch (cause) {
    // A put that throws synchronously (DataCloneError) does not abort by itself.
    try {
      tx.abort()
    } catch {
      // Already aborted by the failed request.
    }
    tx.done.catch(() => undefined)
    throw cause
  }

  return report
}

/** The fields later code reads without checking; a row missing them is skipped. */
function isValidRow(
  store: keyof typeof KEY_PATH,
  row: unknown,
): row is Record<string, unknown> {
  if (!row || typeof row !== 'object') return false
  const record = row as Record<string, unknown>
  const key = record[KEY_PATH[store]]
  const keyOk =
    (typeof key === 'number' && Number.isFinite(key)) || (typeof key === 'string' && key !== '')
  if (!keyOk) return false
  if (store === 'collection' && typeof key !== 'number') return false
  if (store === 'dealers' && !Array.isArray(record.shippingTiers)) return false
  if (store === 'watched' && !Array.isArray(record.points)) return false
  return true
}
