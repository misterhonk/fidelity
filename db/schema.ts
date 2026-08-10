import type { DBSchema } from 'idb'

import type {
  BasketItem,
  CollectionItem,
  CreditHarvest,
  Dealer,
  Dig,
  Feedback,
  HorizonChunk,
  Identity,
  Match,
  Preferences,
  SyncState,
  TasteProfile,
  WantlistItem,
} from '#shared/types'

export const DB_NAME = 'fidelity'
/**
 * 2 — added artistNames/labelNames to the mirrored rows. See db/open.ts for
 * why the upgrade drops and refetches rather than backfilling.
 */
export const DB_VERSION = 3

/**
 * `meta` is a small key-value store rather than nine one-row stores. The union
 * keeps it typed at the call sites in db/meta.ts.
 */
export type MetaValue =
  | { key: 'token'; value: string }
  | { key: 'identity'; value: Identity }
  | { key: 'preferences'; value: Preferences }
  | { key: 'tasteProfile'; value: TasteProfile }
  | { key: 'syncState'; value: SyncState }
  | { key: 'credits'; value: CreditHarvest }
  /**
   * The file the vault is written to, when that is the chosen destination.
   *
   * A `FileSystemFileHandle` survives structured clone, so IndexedDB can hold
   * it — which is the whole reason the file only has to be picked once. The
   * permission attached to it does not survive as reliably and is re-requested
   * from the main thread, because only a click can grant it.
   */
  | { key: 'vaultFile'; value: FileSystemFileHandle }

export type MetaKey = MetaValue['key']

/**
 * No relational database in the browser, because there are no joins to make.
 * Everything here is a key lookup or a set test; SQLite-in-WASM would cost
 * 1 MB of bundle for functionality we do not use.
 */
export interface FidelityDB extends DBSchema {
  meta: { key: MetaKey; value: MetaValue }
  collection: { key: number; value: CollectionItem; indexes: { 'by-master': number } }
  wantlist: { key: number; value: WantlistItem; indexes: { 'by-master': number } }
  horizon: { key: string; value: HorizonChunk }
  dealers: { key: string; value: Dealer }
  digs: { key: string; value: Dig }
  matches: {
    key: [string, number]
    value: Match
    indexes: { 'by-dig-score': [string, number] }
  }
  basket: { key: number; value: BasketItem }
  feedback: { key: number; value: Feedback }
}
