/**
 * Domain types. These cross the main ↔ worker boundary and are the value types
 * of the IndexedDB stores, so they must stay structured-cloneable: plain
 * objects, arrays and TypedArrays only. No class instances, no functions.
 */

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** The eleven match signals (docs/04-MATCHING-ENGINE.md §3). */
export const SIGNAL_TYPES = [
  'WANTLIST_EXACT',
  'WANTLIST_PRESSING',
  'ARTIST_KNOWN',
  'ARTIST_GAP',
  'LABEL_AFFINITY',
  'CATALOG_RUN',
  'STYLE_ADJACENT',
  'CREDIT_GRAPH',
  'FORMAT_UPGRADE',
  'PRICE_SIGNAL',
  'SCARCITY',
] as const

export type SignalType = (typeof SIGNAL_TYPES)[number]

export interface Signal {
  type: SignalType
  /** 0–1. How sure the match is, independent of how much the signal is worth. */
  confidence: number
  /** Whatever the reason sentence needs to name the evidence. */
  evidence: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

/** Discogs grading, best to worst. The order is meaningful — do not sort it. */
export const CONDITIONS = [
  'Mint (M)',
  'Near Mint (NM or M-)',
  'Very Good Plus (VG+)',
  'Very Good (VG)',
  'Good Plus (G+)',
  'Good (G)',
  'Fair (F)',
  'Poor (P)',
] as const

export type Condition = (typeof CONDITIONS)[number]

export interface Preferences {
  // SOFT — below this we dampen the score, we do not discard the listing
  prefMediaCondition: Condition
  /** The price you are comfortable with, not the one you refuse to exceed. */
  targetPrice: number | null

  // HARD — above/below this the listing is discarded, or the dig never starts
  maxPrice: number | null
  minSellerRating: number
  formatsAllow: string[]
  shipsFromBlock: string[]
  excludeReissues: boolean

  /** Per-user tuning of the Barry score. Multiplied onto the signal weight. */

  currency: string
  shipsToCountry: string

  /**
   * Whether the dealer import may also read the Discogs friends list.
   *
   * Off by default and per device. `/users/{username}/friends` is not in the
   * Discogs API documentation, which CLAUDE.md rule 5 forbids relying on —
   * ADR-009 allows this one exception on the condition that it stays a
   * deliberate choice and that nothing breaks when it disappears.
   */
  importFriends: boolean

  /**
   * Where this device keeps the block that carries it to the others.
   *
   * 'none' is the default and a complete configuration: a single device needs
   * no vault, and nothing in the app depends on one.
   */
  vaultTarget: VaultTarget
  vaultSyncedAt: number | null
  /**
   * Whether this device keeps the passphrase.
   *
   * A stored choice, not one derived from whether a passphrase happens to be
   * lying around: inferring it meant somebody who had already synced once got
   * the option silently switched off, and a default that depends on history
   * is not a default.
   */
  vaultRemember: boolean
  /**
   * Your own OAuth client id, per provider.
   *
   * Public by design — PKCE needs no secret — and yours rather than the app's,
   * because there is no Fidelity server to register one against (ADR-007). You
   * create an app in your own Dropbox or Google console and paste the id, the
   * same arrangement as the Discogs token and the hub secret.
   */
  cloudClientIds: Partial<Record<'dropbox' | 'drive', string>>

  /**
   * Optional, self-hosted hub (ADR-008). Empty by default and empty forever
   * for most users — no feature may depend on it.
   */
  hubUrl: string | null
  /** Shared secret for that hub, if it asks for one. Never a Discogs token. */
  hubSecret: string | null
}

export interface SyncState {
  collectionSyncedAt: number | null
  wantlistSyncedAt: number | null
  horizonBuiltAt: number | null
  horizonProgress: { done: number; total: number } | null
  /** When the staggered revalidation last spent its daily budget. */
  horizonRevalidatedAt: number | null
  /** Newest `date_added` seen, so the daily sync is a delta and not a full run. */
  lastCollectionAdd: string | null
  /**
   * When the whole collection was last read, rather than only what is new.
   *
   * The delta cannot see a rating changed on the Discogs website — that leaves
   * `date_added` alone — and Discogs offers no modification date to ask about.
   * So this is the only honest answer to "how far can the two have drifted",
   * and the shelf shows it.
   */
  collectionReadFullyAt: number | null
}

/**
 * One person credited on the records you rated highest.
 *
 * `appearances` is a count, not a lift: a lift needs a baseline for how often
 * this person turns up in music at large, and no browser can measure that
 * (docs/11 §3 asks for one anyway — see `worker/horizon/credits.ts`).
 */
/**
 * A watched dealer whose stock count moved since the last check.
 *
 * `newListings` is the change in `num_for_sale`, not a count of records that
 * are genuinely new: a shop that sells five and lists five moves by zero. What
 * it says truthfully is that this shop changed — the interface words it that
 * way and never promises more.
 */
/**
 * A mark in the runout groove, or the plant that pressed it.
 *
 * Read out of `identifiers[].value` and `formats[].text`, which is where
 * whoever catalogued the release transcribed the groove by hand (docs/02).
 */
export interface PressingStamp {
  key: 'RVG' | 'PLASTYLITE' | 'STERLING' | 'MASTERDISK' | 'RL' | 'PORKY' | 'KENDUN'
  label: string
  note: string
}

export interface PressingProfile {
  /** Discogs' own word, from formats[].descriptions — stated, not inferred. */
  statedReissue: boolean
  /** Promo, Test Pressing, White Label … — not a normal commercial copy. */
  special: string[]
  country: string | null
  /** The year *this pressing* was made, not the album's. */
  year: number | null
  /** The album's own first year, from the horizon. */
  masterYear: number | null
  /** Positive when the pressing is younger than the album. */
  yearGap: number | null
  stamps: PressingStamp[]
  runouts: string[]
  plant: string | null
  freeText: string[]
}

/**
 * What a buyer could get wrong about *this* pressing.
 *
 * Facts, not a sentence. The wording lives in `app/i18n/pressing.ts`, for the
 * same reason the Barry sentence does: this is assembled in a thread that does
 * not know what language the interface is in, and a warning frozen in the
 * language of the scan is a warning that stops matching the screen around it.
 *
 * The two contradictions are separate kinds rather than one with a flag —
 * "the dealer says original, Discogs says reissue" and "the dealer says
 * original, the pressing is fifteen years younger" are different claims, and
 * a shared kind would have made them share a sentence.
 */
export type PressingWarningKind =
  | 'reissue'
  | 'late-pressing'
  | 'special'
  | 'claims-original-but-reissue'
  | 'claims-original-but-late'

export interface PressingWarning {
  kind: PressingWarningKind
  severity: 'high' | 'medium'
  /** Whatever the sentence for this kind needs to name. */
  facts: {
    country?: string | null
    year?: number | null
    masterYear?: number | null
    special?: string
  }
}

export interface WatchAlert {
  dealer: string
  newListings: number
  seenAt: number
}

/**
 * This device's address for a push notification.
 *
 * `PushSubscription.toJSON()` in the three fields anybody needs: where to
 * deliver, and the two keys that let the push service encrypt for a browser
 * nobody else can decrypt for. It crosses `postMessage`, so it is a plain
 * object rather than the live subscription, which does not survive the trip.
 *
 * The endpoint **is** the identity of this device at the hub. There is no
 * account and no name — which is the point: the hub knows an address and a
 * list of shops, and nothing at all about whose they are.
 */
export interface PushRegistration {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/**
 * An artist whose discography the shelf has holes in.
 *
 * `total` counts main credits only — producing somebody else's record is not
 * a hole in your own collection of that artist (docs/04 §S4).
 */
export interface ShelfGap {
  entityId: number
  name: string
  owned: number
  total: number
  /** owned / total, so the interface can rank by "how close am I". */
  share: number
  missing: number
  /** The years you actually collect them across; 0 when unknown. */
  from: number
  to: number
}

/** A label, with the denominator that makes its count mean something. */
export interface LabelStanding {
  entityId: number
  name: string
  owned: number
  catalogueSize: number
  /** Against your own labels, not against all of Discogs. Null when unknowable. */
  lift: number | null
}

export interface CollectionGaps {
  /** False before the horizon exists — the map then says so instead of lying. */
  built: boolean
  artists: ShelfGap[]
  labels: LabelStanding[]
}

/** One record on the wantlist, with what the device already knows about it. */
export interface WantedRecord {
  releaseId: number
  masterId: number
  title: string
  artist: string
  year: number
  /** ISO 8601 from Discogs, so it sorts as a string. */
  addedAt: string
  /**
   * The sleeve, in both sizes the sync already brought along.
   *
   * Empty when Discogs holds no image. These were in the store from the first
   * wantlist sync and simply never left the worker — which is how the one
   * screen carrying the two strongest signals in the app ended up the only
   * one made of text.
   */
  thumbUrl: string
  coverUrl: string
  /**
   * What you wrote down about this one.
   *
   * The most useful thing on the whole screen and the last to arrive: "only
   * the German press", "not the 2016 repress", "must be the gatefold". A dig
   * that does not know it offers you the wrong pressing with a straight face.
   */
  note: string
  want: number
  /** Pressings the horizon knows of. Null means it has not expanded this album. */
  pressings: number | null
  /** Where a dig last offered this album — by master, so any pressing counts. */
  lastSeen: { dealer: string; at: number; score: number } | null
}

export interface WantlistOverview {
  total: number
  records: WantedRecord[]
  withPressings: number
  seenRecently: number
}

export interface CreditPerson {
  entityId: number
  name: string
  /** Harvested favourites they shaped. */
  appearances: number
  roles: string[]
}

export interface CreditHarvest {
  harvestedAt: number | null
  /** Which records have been read, so a run resumes instead of restarting. */
  harvestedReleaseIds: number[]
  totalFavourites: number
  people: CreditPerson[]
}

export interface Identity {
  userId: number
  username: string
  avatarUrl: string
}

/** One facet of the collection: how much of it is this thing. */
export interface TasteFacet {
  /** Readable, for the map and the reason sentences. */
  name: string
  /** Releases in the collection carrying it. */
  n: number
  /** n / releaseCount — share within this collection. */
  weight: number
  /**
   * Share here divided by share globally; above 1 means it is collected on
   * purpose rather than by accident (docs/04 §S5).
   *
   * null until the horizon can supply the denominator. The catalog dumps that
   * would have provided it are gone with ADR-007, and the per-entity release
   * counts only arrive with the horizon expansion in M2 — so LABEL_AFFINITY
   * cannot fire before then, and pretending otherwise would mean inventing a
   * number that silently steers the score.
   */
  lift: number | null
}

/**
 * Barry's knowledge base. Recomputed after every collection sync, never during
 * a dig — a dig has a two-minute budget and none of it belongs here.
 *
 * No country facet: basic_information does not carry one (docs/02 §4).
 * No credits facet: those come out of the horizon (M2+).
 */
export interface TasteProfile {
  computedAt: number
  releaseCount: number
  /** Keyed by Discogs id. */
  artists: Record<string, TasteFacet>
  labels: Record<string, TasteFacet>
  /** Keyed by the name itself. */
  styles: Record<string, TasteFacet>
  genres: Record<string, TasteFacet>
  decades: Record<string, TasteFacet>
  /** Normalised style centroid, for the style-adjacency signal (M3). */
  styleCentroid: Record<string, number>
}

// ---------------------------------------------------------------------------
// Collection & wantlist
// ---------------------------------------------------------------------------

export interface CollectionItem {
  releaseId: number
  /** 0 when the release has no master. */
  masterId: number
  title: string
  artistIds: number[]
  /** Normalised once at sync time — that is the difference between 40 ms and 40 ms per dig. */
  artistNorms: string[]
  /**
   * Kept alongside the normalised form, unlike docs/03 §3: the map and the
   * reason sentences have to say "AC/DC", and "ac dc" cannot be turned back
   * into it. Costs roughly 70 KB for 2.400 releases.
   */
  artistNames: string[]
  labelIds: number[]
  labelNorms: string[]
  labelNames: string[]
  catnos: string[]
  genres: string[]
  styles: string[]
  /**
   * Format name and its descriptions, flattened: `['Vinyl', '12"', '45 RPM']`.
   *
   * The matching engine compares these, so the list stays exactly what it was:
   * words that describe the *kind* of record. How many discs and what colour
   * they are do not belong in that comparison and sit beside it instead.
   */
  formats: string[]
  /**
   * How many discs — 2 for a double LP, 1 for everything ordinary.
   *
   * Optional because it arrives with a full sync and rows written before this
   * existed have none. Undefined means "not known", which reads as one.
   */
  discs?: number
  /**
   * The free line the submitter typed: "Blue Translucent", "Etched", "Numbered".
   *
   * Not part of `formats` on purpose. It is prose, not a category — matching a
   * listing against "Blue Translucent" would compare pressing colours as
   * though they were formats.
   */
  formatText?: string[]
  year: number
  /** The 150px cover from Discogs, '' when there is none. */
  thumbUrl: string
  /** The 600px one, for a grid with room. Same response, no extra request. */
  coverUrl: string
  rating: number
  addedAt: string
  /**
   * Which entry this is — and the key this record is stored under.
   *
   * A release can stand in the shelf more than once: two pressings, one played
   * and one sealed, one kept and one to sell. Discogs models that as separate
   * instances, each with its own rating and condition, and addresses every
   * write at one of them.
   *
   * **Negative means provisional.** A record put on the shelf from a find has
   * no instance until Discogs has been asked, so it gets `-releaseId` — unique
   * per release, impossible to confuse with a real id (those are positive),
   * and refused by every write path until the next sync replaces it.
   */
  instanceId: number
  folderId: number
}

/** Whether this entry can be written back to Discogs. */
export function isOwnEntry(item: { instanceId: number; folderId: number }): boolean {
  return item.instanceId > 0 && item.folderId > 0
}

/**
 * A record you are looking for.
 *
 * No entry to address — a want is keyed by release alone — but it carries two
 * things of its own that a collection row does not: a note about *which*
 * pressing will do, and how much you want it. Both come back with every sync
 * and both are writable.
 */
export type WantlistItem = Omit<CollectionItem, 'rating' | 'instanceId' | 'folderId'> & {
  /** Free text from Discogs. Empty when nothing was written. */
  note: string
  /** 0–5, and 0 means "never said" rather than "not much". */
  want: number
}

/**
 * One answer to "habe ich die schon?", asked with a record in your hand.
 *
 * Read straight out of IndexedDB, so it works in a basement with no signal —
 * which is where record shops are.
 */
export interface ShelfHit {
  source: 'collection' | 'wantlist'
  releaseId: number
  title: string
  artist: string
  year: number
  formats: string[]
  /** Collection only; 0 when unrated. */
  rating: number
  /** Wantlist only: how many pressings the horizon knows of the album. */
  pressings: number | null
  /** Wantlist only: how long it has been on the list. */
  waitingDays: number | null
}

/** One record on the shelf, as the grid needs it. */
export interface ShelfRecord {
  /** The copy. What the sheet opens and what a rating is written against. */
  instanceId: number
  releaseId: number
  title: string
  artist: string
  label: string
  year: number
  formats: string[]
  rating: number
  thumbUrl: string
  coverUrl: string
  addedAt: string
}

export type ShelfSort = 'added' | 'artist' | 'year' | 'rating'

/**
 * Auf- oder absteigend.
 *
 * Jeder der vier Schlüssel hatte bisher genau eine Richtung, und jede war für
 * sich gut begründet — die neueste Platte zuerst, das älteste Jahr zuerst,
 * weil eine nach Jahren sortierte Sammlung eine Zeitachse ist. Gut begründet
 * heißt aber nicht: für jede Frage richtig. Wer wissen will, was am längsten
 * ungehört im Regal steht, braucht dieselbe Liste andersherum.
 *
 * Die bisherige Richtung bleibt die Vorgabe je Schlüssel (siehe
 * `DEFAULT_SHELF_DIRECTION`), damit sich nichts ändert, solange niemand dreht.
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Womit ein Schlüssel anfängt, wenn man ihn zum ersten Mal wählt.
 *
 * Nicht überall dasselbe, und das ist der Punkt: bei Namen erwartet man A–Z,
 * bei allem anderen „das Interessanteste zuerst" — die neueste Platte, die
 * beste Bewertung. Nur das Jahr fängt vorne an, weil eine Zeitachse vorwärts
 * läuft.
 */
export const DEFAULT_SHELF_DIRECTION = {
  added: 'desc',
  artist: 'asc',
  year: 'asc',
  rating: 'desc',
} as const satisfies Record<ShelfSort, SortDirection>

export interface ShelfView {
  records: ShelfRecord[]
  /** How many the current filter leaves. */
  total: number
  /** How many there are altogether — the denominator. */
  collection: number
}

/** A shop Discogs says you already deal with. */
export interface DealerCandidate {
  username: string
  /** Where it came from — 'order' is documented, 'friend' is not (ADR-009). */
  source: 'order' | 'friend'
  numForSale: number
  sellerRating: number | null
  ratingCount: number
  location: string
  /** Already in your list, so importing changes nothing. */
  known: boolean
}

export interface DiscoveryResult {
  candidates: DealerCandidate[]
  requests: number
  /** Whether the undocumented source was consulted at all. */
  friendsUsed: boolean
}

/**
 * Everything worth carrying between devices.
 *
 * Not the token (rule 6) and not digs — marketplace data expires after six
 * hours by rule, and syncing prices through a server is the one thing this
 * app promised not to do.
 */
export interface VaultSnapshot {
  savedAt: number
  preferences: Preferences | null
  stores: Partial<Record<string, unknown[]>>
}

/**
 * OAuth tokens for a cloud destination.
 *
 * Credentials, and handled like the Discogs token (rule 6): IndexedDB only,
 * never logged, never in a URL.
 */
export interface CloudTokens {
  accessToken: string
  refreshToken: string | null
  /** Epoch ms. Renewed a minute early, because clocks disagree. */
  expiresAt: number
}

/** Where a device keeps its snapshot. Chosen once, during setup. */
export type VaultTarget = 'none' | 'hub' | 'file' | 'dropbox' | 'drive'

/**
 * Why a vault target cannot be used right now.
 *
 * A reason rather than a sentence. The worker used to return the German text
 * straight out, which put user-facing prose in a thread that has no idea what
 * language the interface is in — and made the message untranslatable without
 * touching the scanner.
 */
export type VaultBlocked = 'no-hub' | 'signed-out' | 'not-built'

export interface VaultStatus {
  target: VaultTarget
  /** Whether this device can actually use the chosen target right now. */
  ready: boolean
  lastSyncedAt: number | null
  /** Why it cannot, when it cannot. The interface turns this into a sentence. */
  blocked: VaultBlocked | null
}

export interface ShelfResult {
  hits: ShelfHit[]
  collection: number
  wantlist: number
}

// ---------------------------------------------------------------------------
// Horizon
// ---------------------------------------------------------------------------

/** Index into this table is what `HorizonChunk.roles` stores. */
export const ROLE_TABLE = [
  'main',
  'Producer',
  'Engineer',
  'Mixed By',
  'Mastered By',
  'Remix',
  'Co-producer',
] as const

export type HorizonKind = 'artist' | 'label' | 'master'

/**
 * One expanded entity from the collection, as parallel TypedArrays rather than
 * an object list: 200.000 release ids cost 800 KB this way and ~9 MB the other.
 */
export interface HorizonChunk {
  /** `artist:40135` | `label:1234` | `master:2598` */
  key: string
  kind: HorizonKind
  entityId: number
  name: string
  fetchedAt: number
  /** false when the entity was too large to page through completely. */
  complete: boolean
  requests: number
  /**
   * How many releases the entity has in total, straight from
   * pagination.items.
   *
   * Not in docs/03 §4, and the reason it is here: this is the denominator the
   * lift has been missing since the catalog dumps went away with ADR-007. Ten
   * Warner records mean nothing and three Ohr records mean everything, and
   * without a catalogue size there is no way to tell those apart.
   */
  catalogueSize?: number

  /** Sorted, so a binary search is possible and so it compresses well. */
  releaseIds: Int32Array
  /** Same length, same index as releaseIds. Values are ROLE_TABLE indices. */
  roles: Uint8Array
  years: Int16Array
  /** Labels only — CATALOG_RUN needs the numeric part of the catalogue number. */
  catnoNums?: Int32Array
  /** Constant per chunk, e.g. 'BRAIN'. */
  catnoPrefix?: string
}

// ---------------------------------------------------------------------------
// Digs & matches
// ---------------------------------------------------------------------------

export type DigStatus = 'queued' | 'scanning' | 'done' | 'failed' | 'cancelled' | 'expired'

export interface Dig {
  /** ULID — time-sortable. */
  id: string
  dealer: string
  status: DigStatus
  startedAt: number
  finishedAt: number | null
  /**
   * startedAt + 6 h. Marketplace data may not be displayed once it is older
   * than this — the ToS rule as a field, not as a policy in someone's head.
   */
  expiresAt: number
  /** What the dealer has according to the API. */
  listingsTotal: number
  listingsScanned: number
  /** uniqueSeen / listingsTotal — the honesty metric the UI shows. */
  coverage: number
  /**
   * Distinct listings actually seen.
   *
   * The numerator behind `coverage`, and not the same as `listingsScanned`:
   * that counts rows, and a shop walked from both ends — or in thirteen
   * orderings by a deep scan — returns plenty of them twice.
   *
   * Absent on digs written before the deep scan existed.
   */
  uniqueSeen?: number
  /**
   * How hard the shop was walked.
   *
   * 'normal' is one ordering from both ends, up to 20.000 listings. 'deep'
   * works through every sort key Discogs accepts, which is the only way past
   * that number — and costs up to 1.400 requests, so it is always asked for
   * by hand. Absent means 'normal'.
   *
   * 'neu' is the opposite end: newest first, stopping at the first listing the
   * shop had on the last visit. Usually one or two requests, and the only kind
   * of dig worth running on a shop you check every week.
   */
  depth?: 'normal' | 'deep' | 'neu'
  /** Did the scan hit the 10k pagination wall? */
  truncated: boolean
  matchCount: number
  apiRequests: number
  /** Persisted after every page, so a closed tab does not mean starting over. */
  cursor: { page: number; order: 'asc' | 'desc' } | null
}

export interface Match {
  digId: string
  listingId: number
  releaseId: number

  // Ours, derived — survives expiry
  score: number
  /**
   * What the score was made of — and what the Barry sentence is written from.
   *
   * The sentence itself is no longer stored beside them. It used to be, built
   * in the worker at scan time, which froze its language at the moment the dig
   * ran. `app/i18n/reason.ts` builds it where it is read.
   */
  signals: Signal[]

  // Marketplace data — nulled after six hours
  title: string | null
  artist: string | null
  label: string | null
  catno: string | null
  format: string | null
  year: number | null
  condition: string | null
  sleeve: string | null
  price: number | null
  currency: string | null
  comments: string | null
  thumbUrl: string | null
  /** From /marketplace/stats/ — the lowest price, NOT a median. */
  marketLowestPrice: number | null
  marketNumForSale: number | null

  /**
   * What this pressing is (M7). Filled by the top-fifty pass at no extra
   * request cost; null for everything below it.
   *
   * Derived from public release facts, not from marketplace content, so it
   * outlives the six-hour window — unlike the price beside it.
   */
  pressing?: PressingProfile | null
  pressingWarnings?: PressingWarning[]
  expired: boolean
}

/** Every marketplace field of a match, i.e. exactly what expiry has to null. */
export const MARKETPLACE_FIELDS = [
  'title',
  'artist',
  'label',
  'catno',
  'format',
  'year',
  'condition',
  'sleeve',
  'price',
  'currency',
  'comments',
  'thumbUrl',
  'marketLowestPrice',
  'marketNumForSale',
] as const satisfies readonly (keyof Match)[]

// ---------------------------------------------------------------------------
// Dealers, basket, feedback
// ---------------------------------------------------------------------------

export interface ShippingTier {
  minItems: number
  /** null = open ended. */
  maxItems: number | null
  price: number
  currency: string
  source: 'user' | 'bundled' | 'parsed'
}

export interface DealerFingerprint {
  sampledItems: number
  totalItems: number
  coverage: number
  labelDist: Record<string, number>
  styleDist: Record<string, number>
  decadeDist: Record<string, number>
  medianPrice: number
  /**
   * The currency `medianPrice` is in, or `null` when the shop does not price
   * in one currency.
   *
   * A median is a plain number and carries no unit. The dealer screen printed
   * it with a hard-coded euro sign, so a shop listing in pounds showed its
   * median as euros — a real number under a wrong symbol, which is worse than
   * no number. Inventory prices always come back in the *seller's* currency;
   * `curr_abbr` has no effect on that endpoint (measured 2026-08-10), so this
   * is the only place the unit can come from.
   */
  priceCurrency?: string | null
}

export interface Dealer {
  username: string
  displayName: string
  shipsFrom: string
  sellerRating: number
  ratingCount: number
  numForSale: number
  minOrderTotal: number
  /** Free text from seller.shipping. */
  shippingNote: string
  lastScannedAt: number | null
  /**
   * Das neueste Angebot, das ein Dig hier gesehen hat — ISO 8601.
   *
   * The anchor for "nur das Neue". `sort=listed&sort_order=desc` hands the
   * shop back newest first, so a later visit walks until it reaches something
   * not newer than this and stops — usually after one page instead of two
   * hundred.
   *
   * Absent on dealers scanned before this existed; the app then offers a full
   * dig, which is what it always did.
   */
  newestListedAt?: string | null
  /** Overlap with this collection as a factor over chance. */
  affinity: number | null
  /** Derived, not marketplace content — so it outlives the six-hour window. */
  fingerprint: DealerFingerprint | null
  shippingTiers: ShippingTier[]

  // --- Watchlist (M6) ------------------------------------------------------
  // Not in docs/03 §6. Deliberately fields on the dealer rather than a store
  // of their own: watching a dealer is a property of that dealer, and a
  // second store keyed by the same username would be two rows to keep in step.
  // Absent on rows written before M6, which reads as "not watched".

  /** Whether the app checks this dealer on start-up. */
  watching?: boolean
  /** `num_for_sale` at the last check — the whole change detector. */
  watchNumForSale?: number | null
  watchCheckedAt?: number | null
  /** Last touched, which is what a merge between two devices compares. */
  updatedAt?: number
  /**
   * Das Ladenschild, wenn der Laden eins gesetzt hat.
   *
   * Comes from `/users/{name}`, which a full dig already fetches to find out
   * how big the shop is — so it costs nothing. Absent on shops scanned before
   * this existed and on the ones who never uploaded a picture; both cases draw
   * initials instead, because Discogs' grey default says less than a letter.
   */
  avatarUrl?: string
}

/**
 * Everything the basket screen renders, in one message.
 *
 * `summary` is null for an empty basket; `candidates` is what else this dealer
 * has that scores well, so "noch eine Platte spart X" can be acted on without
 * a second round trip.
 */
/**
 * One person and everything of theirs a dealer has (docs/00 §5).
 *
 * The credit graph is the feature nothing else consumes, and a sentence on a
 * card only ever shows one record of it at a time. This is the regroup that
 * answers the obvious next question.
 */
export interface CreditGroup {
  entityId: number
  name: string
  /** Main releases of theirs already on the shelf. */
  owned: number
  total: number
  matches: {
    listingId: number
    releaseId: number
    title: string
    score: number
    price: number | null
    currency: string | null
    /** 'Main' for their own record, otherwise Producer, Remix, Engineer … */
    role: string
  }[]
}

export interface BasketView {
  /**
   * One per dealer.
   *
   * Postage is charged per parcel, so every basket does its own arithmetic —
   * that was always so. What is new is that there may be more than one. Before,
   * a record from a second seller deleted the first basket without a word — and
   * shopping at several shops at once, which is what a shopping session *is*,
   * simply lost data.
   *
   * Newest first: the shop being worked on is at the top.
   */
  baskets: BasketSummary[]
  /** Every listing in every basket, so a button knows its own state. */
  listingIds: number[]
}

export interface BasketDig {
  /** `Dig.startedAt`. */
  at: number
  /**
   * Whether it is past `Dig.expiresAt` — startedAt + 6 h.
   *
   * Decided in the worker rather than by comparing timestamps on screen: the
   * six-hour rule is the ToS, and a rule that lives in a template is one
   * `v-if` away from being wrong on one screen and right on another.
   */
  expired: boolean
}

export interface BasketCandidate {
  listingId: number
  releaseId: number
  score: number
  price: number
  currency: string
  title: string
  signals: Signal[]
  /** Whether this one alone lifts the basket over the dealer's minimum. */
  closesGap?: boolean
}

export interface ShippingPoint {
  items: number
  total: number | null
  perItem: number | null
  marginal: number | null
}

export interface ShippingAdvice {
  addItems: number
  perItemNow: number
  perItemThen: number
  savedPerItem: number
}

export interface BasketLine {
  listingId: number
  dealer: string
  releaseId: number
  title: string
  price: number
  currency: string
  addedAt: number
  note: string | null
  /** Six hours on the price may no longer be shown (CLAUDE.md rule 4). */
  priceExpired: boolean
  /** Set once a refresh found the offer gone. */
  soldAt?: number | null
  /** Shown, but not counted: a sold record is not part of the order. */
  sold: boolean
}

export interface BasketSummary {
  dealer: string
  /** What else this shop has that would ride along for less postage. */
  candidates: BasketCandidate[]
  displayName: string
  /** The shop's own picture, where a dig has met it. See `Dealer.avatarUrl`. */
  avatarUrl?: string
  lines: BasketLine[]
  /** null when a price has aged out or two currencies are in play. */
  subtotal: number | null
  currency: string | null
  shipping: number | null
  shippingSource: ShippingTier['source'] | null
  shippingMatched: string[]
  /** The destination heading the rates were read under, when the text had one. */
  shippingSection: string | null
  total: number | null
  perItem: number | null
  advice: ShippingAdvice | null
  curve: ShippingPoint[]
  minOrderTotal: number
  belowMinimum: boolean
  /** How much is still missing to that minimum, when something is. */
  missingToMinimum: number | null
  /**
   * The dig the suggestions were read out of, or `null` for a shop nobody has
   * walked yet.
   *
   * Carried so that an empty suggestion list can say *why* it is empty. Never
   * dug, dug but past `expiresAt` (the six-hour rule, so the prices may not be
   * shown any more), and dug with genuinely nothing else worth having all look
   * the same on screen and mean entirely different things.
   */
  dig: BasketDig | null
}

export interface BasketPlan {
  chosen: BasketCandidate[]
  score: number
  goods: number
  shipping: number | null
  total: number | null
  improvements: number
  /** The dealer would not ship this — the goods stay under `min_order_total`. */
  belowMinimum: boolean
}

export interface BasketItem {
  listingId: number
  dealer: string
  releaseId: number
  title: string
  price: number
  currency: string
  addedAt: number
  note: string | null
  /**
   * When a refresh found this offer gone. Kept rather than removed: taking
   * somebody's basket entry away behind their back is a decision that is
   * theirs to make.
   */
  soldAt?: number | null
}

// ---------------------------------------------------------------------------
// The detail sheet
// ---------------------------------------------------------------------------

/** A catalogue series around one record: Brain's 1000s, Blue Note's 4000s. */
export interface CatalogueContext {
  label: string
  prefix: string
  /** This record's number in the series. */
  number: number
  /** Neighbours around it, with whether the collection already has each. */
  neighbours: { number: number; owned: boolean; isThis: boolean }[]
}

/** How much of an artist's main discography the collection holds. */
export interface DiscographyContext {
  artist: string
  owned: number
  total: number
  from: number
  to: number
}

export interface MatchDetail {
  match: Match
  catalogue: CatalogueContext | null
  discography: DiscographyContext[]
  /** Names from the horizon that point at this release, main credits first. */
  connections: { kind: string; name: string; role: number }[]
  /**
   * What you wrote on the wantlist about this exact release, if anything.
   *
   * The whole reason the note is worth reading back out of Discogs: standing
   * in a shop with a copy in your hand, "only the German press" is the
   * difference between a find and a mistake. Empty when there is no note, or
   * when the record is not on the wantlist at all.
   */
  wantNote: string
}

export type Verdict = 'interesting' | 'meh' | 'wrong' | 'bought'

/** One shortlisted record, stripped of everything the six-hour rule deletes. */
export interface MarkedRecord {
  listingId: number
  releaseId: number
  title: string | null
  artist: string | null
  dealer: string | null
  score: number
  createdAt: number
  soldAt: number | null
}

export interface MarkedOverview {
  groups: { dealer: string | null; records: MarkedRecord[]; open: number }[]
  bought: MarkedRecord[]
  total: number
  stillOpen: number
}

export interface Feedback {
  listingId: number
  releaseId: number
  /** Catalogue, not marketplace — kept so a shortlist is still readable later. */
  title?: string | null
  artist?: string | null
  /** Which shop had it. You cannot go back to a shop you cannot name. */
  dealer?: string | null
  /**
   * When a check found the offer gone. A fact about the past, not a number off
   * the marketplace — and it stops the same request being spent twice.
   */
  soldAt?: number | null
  verdict: Verdict
  /** Signal snapshot at the time of the verdict — otherwise it is unusable later. */
  signals: Signal[]
  score: number
  createdAt: number
  /**
   * Last touched, which is what a merge between two devices compares.
   * `createdAt` cannot answer it: changing a verdict keeps the original.
   */
  updatedAt?: number
}

/**
 * One of the three fields Discogs keeps beside a record you own.
 *
 * The options are the server's, never ours: a hand-written list of conditions
 * would drift from the one Discogs accepts, and the write would fail on a
 * value the app itself offered.
 */
export interface CollectionField {
  id: number
  name: string
  type: 'dropdown' | 'text'
  options: string[]
}

/**
 * What Discogs thinks the shelf is worth.
 *
 * Three formatted strings, not numbers — Discogs sends them with a currency
 * symbol and thousands separators already applied, in whatever currency the
 * account is set to. They are for reading, never for arithmetic: rule
 * "no float for money" is not violated here because nothing is computed.
 *
 * And it is an estimate built from other people's asking prices, so it is
 * always shown with the day it was fetched. A number of this kind with no
 * date beside it gets read as a fact.
 */
export interface CollectionValue {
  minimum: string
  median: string
  maximum: string
  fetchedAt: number
}

/**
 * One shelf inside the shelf.
 *
 * Discogs lets a collection be divided — "Sell", "Storage", "Play copies" —
 * and every entry names the folder it sits in. Fidelity showed one heap.
 *
 * Folder 0 is not a folder: it is the virtual "All", it holds everything, and
 * it is not a valid target for a write. It never reaches this list.
 */
export interface CollectionFolder {
  id: number
  name: string
  count: number
}
