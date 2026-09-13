import type { DBSchema } from 'idb'

import type {
  BasketItem,
  CloudTokens,
  CollectionField,
  CollectionFolder,
  CollectionItem,
  CollectionValue,
  CreditHarvest,
  Dealer,
  Dig,
  Feedback,
  FollowedArtist,
  HorizonChunk,
  Identity,
  Match,
  Place,
  Placement,
  Preferences,
  PushRegistration,
  ReleaseDetail,
  RoundSummary,
  StockRow,
  SyncState,
  TasteProfile,
  ValuePoint,
  WantlistItem,
  WatchedRelease,
} from '#shared/types'

export const DB_NAME = 'fidelity'
/**
 * 2 — added artistNames/labelNames to the mirrored rows. See db/open.ts for
 * why the upgrade drops and refetches rather than backfilling.
 *
 * 4 — added the `covers` store. Additive: nothing existing is touched.
 */
export const DB_VERSION = 14

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
   * The last round of the watched shops (`worker/dealers/round.ts`).
   *
   * A meta row and not a store of its own: there is exactly one of these at a
   * time, it is a few hundred bytes, and a store would be a schema version for
   * a single key. It outlives the digs it made on purpose — five are kept, and
   * a round over ten shops prunes the first five before it ends.
   */
  | { key: 'lastRound'; value: RoundSummary }
  /** Folder names, refreshed on a sync that stored something. */
  | { key: 'collectionFolders'; value: CollectionFolder[] }
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
  /**
   * Where the hub should send this device a notification.
   *
   * Kept because the watchlist can change long after the permission was
   * granted: adding a shop has to reach the hub, and the hub takes the whole
   * list at once rather than a difference. Without this row the app would have
   * to ask the browser for its subscription on every change — which works only
   * while a page is open, and this is the one feature about the times it is not.
   *
   * Not a secret in the sense the token is, and not public either: whoever has
   * the endpoint can make this device buzz. It stays where the token stays.
   */
  | { key: 'pushRegistration'; value: PushRegistration }

export type MetaKey = MetaValue['key']

/**
 * No relational database in the browser, because there are no joins to make.
 * Everything here is a key lookup or a set test; SQLite-in-WASM would cost
 * 1 MB of bundle for functionality we do not use.
 */
export interface FidelityDB extends DBSchema {
  meta: { key: MetaKey; value: MetaValue }
  /**
   * The shelf, keyed by *entry* rather than by release.
   *
   * Because a collector can own the same record twice — one played, one
   * sealed, one to sell — and Discogs models exactly that: every row is an
   * instance with its own id, rating and condition. Keyed by release, the
   * second copy silently overwrote the first, which is how a collection of 34
   * showed up here as 32 (measured 2026-08-12).
   *
   * `by-release` is what everything that reasons about *records* rather than
   * copies goes through, so the matching engine's question — "do I own this
   * release?" — costs no more than it did.
   */
  collection: {
    key: number
    value: CollectionItem
    indexes: { 'by-master': number; 'by-release': number }
  }
  wantlist: { key: number; value: WantlistItem; indexes: { 'by-master': number } }
  horizon: { key: string; value: HorizonChunk }
  dealers: { key: string; value: Dealer }
  digs: { key: string; value: Dig }
  matches: {
    key: [string, number]
    value: Match
    indexes: { 'by-dig-score': [string, number] }
  }
  /**
   * A shop's inventory, as one dig saw it.
   *
   * The two indexes are why the view is affordable: a question about a label
   * becomes a range read instead of a walk through twenty thousand rows. The
   * dig comes first in both keys so that two shops cannot bleed into each
   * other.
   */
  stock: {
    key: [string, number]
    value: StockRow
    indexes: {
      'by-dig-label': [string, string]
      'by-dig-decade': [string, number]
      /**
       * Every shop that has this record in stock, across every dig still
       * inside the six-hour window (v13, M29).
       *
       * The basket comparison asks exactly this question five times — once per
       * record in the basket — and there is no other way to ask it: Discogs
       * has no documented endpoint for "who else sells release X", and the
       * undocumented one is rule 5. So the question is answered out of what
       * the digs already read, and this turns a walk over a hundred thousand
       * rows into five range reads.
       */
      'by-release': number
    }
  }
  /**
   * Watched records (M11) — by release id.
   *
   * A record is watched once, whether it stands on the shelf or on the
   * wantlist. Two rows for the same record would be two histories of the same
   * measurement, and asking `/marketplace/stats/` twice would be a request
   * spent on an answer already in hand.
   */
  /**
   * Places and what sits where (M12) — the only stores that never hold
   * anything from Discogs.
   *
   * `placements` is deliberately separate from `collection`: the sync replaces
   * every collection row wholesale, so a location kept there would be silently
   * gone after the next full pass.
   */
  /*
   * No index on `parentId`, for two reasons.
   *
   * **IndexedDB does not index `null`** — the topmost places would simply drop
   * out, and "show me all the rooms" would come back empty. A placeholder
   * value would get round that, but it is not worth it: places are dozens, not
   * thousands. A `getAll()` over twenty rows is cheaper than the index meant
   * to replace it.
   */
  places: { key: string; value: Place }
  placements: { key: number; value: Placement; indexes: { 'by-place': string } }
  watched: { key: number; value: WatchedRelease }
  /** Discogs' estimate, one row per day (M19 #3). Keyed by the ISO day. */
  valueHistory: { key: string; value: ValuePoint }
  /**
   * Bands on the radar that the shelf knows nothing about (v12).
   *
   * Keyed by the Discogs artist id, because that is what the horizon expands
   * and what survives a rename. Small — tens of rows — but its own store
   * rather than a meta row, so the vault carries it between devices like every
   * other list somebody built by hand.
   */
  followed: { key: number; value: FollowedArtist }
  basket: { key: number; value: BasketItem }
  feedback: { key: number; value: Feedback }
  /**
   * Covers, by release id — the one store every screen shares.
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
   * What a record actually is, one request at a time.
   *
   * Tracklist, credits, the number in the run-out groove — none of it comes
   * with the collection sync, all of it comes from `/releases/{id}`, and rule
   * 2 forbids walking that endpoint. So this is filled only for records
   * somebody opens, exactly like `covers` beside it, and kept: a release does
   * not change, and a second look should cost nothing.
   *
   * Keyed by release rather than by entry, because two copies of the same
   * record have the same tracklist — what differs between them is the
   * condition, and that lives in `fieldValues`.
   */
  releaseDetail: { key: number; value: ReleaseDetail }
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
  /** The copy these describe — condition belongs to a copy, not a record. */
  instanceId: number
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
  | 'collection.folder'
  | 'wantlist.add'
  | 'wantlist.remove'
  | 'wantlist.note'

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
