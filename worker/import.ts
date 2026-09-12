import { DB_VERSION } from '~~/db/schema'
import { getMeta, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { Preferences } from '#shared/types'

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

const STORES = [
  'collection',
  'wantlist',
  'dealers',
  'feedback',
  'basket',
  'places',
  'placements',
  'valueHistory',
] as const
type Store = (typeof STORES)[number]

export interface ImportReport {
  /** The version the file was written by, and the one it came from. */
  version: number
  dbVersion: number
  /** Rows put, per store. */
  imported: Partial<Record<Store, number>>
  /** What the file had that did not come back, and why. */
  skipped: { store: string; rows: number; reason: 'no-prices' | 'too-old' }[]
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

  for (const store of STORES) {
    const rows = backup[store]
    if (!Array.isArray(rows) || rows.length === 0) continue
    if (tooOld && (store === 'collection' || store === 'wantlist')) {
      report.skipped.push({ store, rows: rows.length, reason: 'too-old' })
      continue
    }
    const tx = db.transaction(store, 'readwrite')
    let put = 0
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      await tx.store.put(row as never)
      put += 1
    }
    await tx.done
    report.imported[store] = put
  }

  for (const store of ['digs', 'matches'] as const) {
    const rows = backup[store]
    if (Array.isArray(rows) && rows.length > 0) {
      report.skipped.push({ store, rows: rows.length, reason: 'no-prices' })
    }
  }

  if (
    backup.preferences &&
    typeof backup.preferences === 'object' &&
    !(await getMeta('preferences'))
  ) {
    await setMeta('preferences', backup.preferences as Preferences)
    report.meta.push('preferences')
  }
  for (const key of ['tasteProfile', 'credits'] as const) {
    const value = backup[key]
    if (value && typeof value === 'object' && !(await getMeta(key))) {
      await setMeta(key, value as never)
      report.meta.push(key)
    }
  }

  return report
}

/** What the export stamps itself with, so a later app can read it back. */
export const CURRENT_DB_VERSION = DB_VERSION
