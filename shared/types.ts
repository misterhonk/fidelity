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
  prefSleeveCondition: Condition
  /** The price you are comfortable with, not the one you refuse to exceed. */
  targetPrice: number | null

  // HARD — above/below this the listing is discarded, or the dig never starts
  maxPrice: number | null
  minSellerRating: number
  formatsAllow: string[]
  shipsFromBlock: string[]
  excludeReissues: boolean

  /** Per-user tuning of the Barry score. Multiplied onto the signal weight. */
  signalWeights: Partial<Record<SignalType, number>>

  currency: string
  shipsToCountry: string

  /**
   * Optional, self-hosted hub (ADR-008). Empty by default and empty forever
   * for most users — no feature may depend on it.
   */
  hubUrl: string | null
}

export interface SyncState {
  collectionSyncedAt: number | null
  wantlistSyncedAt: number | null
  horizonBuiltAt: number | null
  horizonProgress: { done: number; total: number } | null
  /** Newest `date_added` seen, so the daily sync is a delta and not a full run. */
  lastCollectionAdd: string | null
}

export interface Identity {
  userId: number
  username: string
  avatarUrl: string
}

/**
 * Weighted distribution of one facet of the collection.
 * `lift` = share in this collection / share globally. Above 1 means it is
 * collected on purpose rather than by accident.
 */
export interface TasteFacet {
  n: number
  weight: number
  lift: number
}

/** Barry's knowledge base. Recomputed after every collection sync (M1). */
export interface TasteProfile {
  computedAt: number
  releaseCount: number
  artists: Record<string, TasteFacet>
  labels: Record<string, TasteFacet>
  styles: Record<string, TasteFacet>
  genres: Record<string, TasteFacet>
  decades: Record<string, TasteFacet>
  countries: Record<string, TasteFacet>
  credits: Record<string, TasteFacet>
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
  labelIds: number[]
  labelNorms: string[]
  catnos: string[]
  genres: string[]
  styles: string[]
  formats: string[]
  year: number
  rating: number
  addedAt: string
}

export type WantlistItem = Omit<CollectionItem, 'rating'>

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
  /** scanned / total — the honesty metric the UI shows. */
  coverage: number
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
  signals: Signal[]
  /** The Barry sentence. */
  reason: string

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
  /** Overlap with this collection as a factor over chance. */
  affinity: number | null
  /** Derived, not marketplace content — so it outlives the six-hour window. */
  fingerprint: DealerFingerprint | null
  shippingTiers: ShippingTier[]
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
}

export interface Feedback {
  listingId: number
  releaseId: number
  verdict: 'interesting' | 'meh' | 'wrong' | 'bought'
  /** Signal snapshot at the time of the verdict — otherwise it is unusable later. */
  signals: Signal[]
  score: number
  createdAt: number
}
