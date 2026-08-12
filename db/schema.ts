import type { DBSchema } from 'idb'

import type {
  BasketItem,
  CloudTokens,
  CollectionField,
  CollectionValue,
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
 *
 * 4 — added the `covers` store. Additive: nothing existing is touched.
 */
export const DB_VERSION = 5

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
   * The three collection fields and their options, as Discogs defines them.
   *
   * Fetched once and kept: same ids on every account, and the option lists are
   * the only ones the server accepts. Never expires — a list that has not
   * changed is not worth a request.
   */
  | { key: 'collectionFields'; value: CollectionField[] }
  /** Refreshed with the collection sync, never on its own. */
  | { key: 'collectionValue'; value: CollectionValue }
  /**
   * When the last Discogs request went out, in epoch milliseconds.
   *
   * Here rather than in a worker variable because the rate limit is per IP and
   * a tab is not. Two tabs each pacing themselves perfectly still hit Discogs
   * twice as often as either believes; a row every tab can read is what makes
   * the gap one gap. Written under a Web Lock, so no two tabs claim the same
   * slot (worker/discogs/pacer.ts).
   */
  | { key: 'lastRequestAt'; value: number }
  /**
   * The file the vault is written to, when that is the chosen destination.
   *
   * A `FileSystemFileHandle` survives structured clone, so IndexedDB can hold
   * it — which is the whole reason the file only has to be picked once. The
   * permission attached to it does not survive as reliably and is re-requested
   * from the main thread, because only a click can grant it.
   */
  | { key: 'vaultFile'; value: FileSystemFileHandle }
  /**
   * OAuth tokens for the cloud destinations, one entry per provider.
   *
   * Credentials, and treated like the Discogs token (rule 6): IndexedDB only,
   * never logged, never in a URL. The authorization *code* arrives in one by
   * necessity — OAuth has no other way — and is stripped from the address bar
   * the moment it is read.
   */
  | { key: 'cloudTokens'; value: Record<string, CloudTokens> }
  /**
   * The vault passphrase, when the device was told to remember it.
   *
   * Looks like the key beside the lock and is not: the lock is on the *remote*
   * copy. This database is plaintext and always was — the collection, the
   * shortlist and the Discogs token are already here. What it buys is a
   * feature somebody uses rather than one they set up once and abandon.
   */
  | { key: 'vaultPassphrase'; value: string }

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
  /**
   * Cover, nach Release-Id — die einzige Ablage, die alle Bildschirme teilen.
   *
   * It exists because the marketplace will not hand them over. Every one of
   * 1.200 inventory rows measured on 2026-08-10 came back with an empty
   * `release.thumbnail`, across four shops, while the releases behind them held
   * 1 to 29 images each. So `Match.thumbUrl` was null for every find the app
   * has ever produced, and every result card drew the grey placeholder.
   *
   * Keyed by release rather than by listing on purpose: a release is bought
   * once and seen many times — in a dig, in the basket, on the watchlist, in
   * the shelf — and the same picture serves all of them. The collection sync
   * fills most of it for nothing (`basic_information` *does* carry a cover),
   * and the rest is fetched only for records somebody actually looks at.
   */
  covers: { key: number; value: CoverEntry }
  /**
   * Changes on their way to Discogs.
   *
   * Every write lands here first and in the shelf at the same moment, so a
   * star lights up the instant it is tapped instead of 1.2 seconds later when
   * the pacer gets round to it. The keeper drains the queue in the background,
   * through the one slot every other request uses.
   *
   * Which also means a rating given in a shop basement with no signal is not
   * lost — it waits. That is the same reason the collection is mirrored at all
   * (ADR-007): the app has to work where record shops are.
   *
   * Keyed by what the job *targets*, not by when it was made, so three taps on
   * the same row collapse into one request rather than three.
   */
  outbox: { key: string; value: OutboxJob }
  /**
   * Media condition, sleeve condition and notes, per record.
   *
   * Kept apart from the collection row for one hard reason: the sync writes
   * that row wholesale from Discogs' answer, so anything of ours living inside
   * it is destroyed on the next walk. And Discogs hands these values back in
   * no listing — not folder 0, not a real folder, not the per-release endpoint
   * (measured 2026-08-11, docs/02) — so this store is the only copy the app
   * has. Losing it would mean losing them for good.
   */
  fieldValues: { key: number; value: FieldValues }
}

/** The three fields Discogs offers, as far as this device knows them. */
export interface FieldValues {
  releaseId: number
  /** Field id → value. Ids are 1 Media, 2 Sleeve, 3 Notes on every account. */
  values: Record<number, string>
}

/** What a queued change is, and what to put back if it never lands. */
export interface OutboxJob {
  /** `${kind}:${what it addresses}` — the same target overwrites itself. */
  id: string
  kind: OutboxKind
  /** Everything the call needs. Shaped per kind, checked where it is sent. */
  payload: Record<string, number | string>
  /**
   * The value the app showed before, to put back when the job is given up on.
   *
   * A change that is shown but never arrives is worse than one that was
   * refused outright: the shelf and Discogs disagree, and nothing on screen
   * says so. Whoever gives up on a job owes the user the old value back.
   */
  revert: Record<string, number | string>
  attempts: number
  queuedAt: number
  lastError?: string
}

export type OutboxKind =
  | 'collection.rating'
  | 'collection.field'
  | 'collection.remove'
  | 'collection.add'
  | 'wantlist.add'
  | 'wantlist.remove'

export interface CoverEntry {
  releaseId: number
  /** 150 px, for rows and small tiles. */
  thumbUrl: string
  /** ~600 px, for anything larger than a thumbnail. Empty when there is none. */
  coverUrl: string
  /**
   * When this was written, epoch ms.
   *
   * Not an expiry — a sleeve does not change, and re-fetching it would spend
   * the request budget on a picture that is already correct. It is here so a
   * negative result (a release Discogs holds no image for) can be told apart
   * from one never asked about, without storing a third state.
   */
  fetchedAt: number
}
