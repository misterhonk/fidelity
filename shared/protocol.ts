/**
 * The main ↔ worker contract.
 *
 * Everything except rendering runs in the worker, so this is the only seam
 * between the UI and the actual work. It is a request/response protocol with
 * an open-ended progress channel in between: a dig runs for four minutes and
 * has to report while it runs, not only when it finishes.
 *
 * All payloads must be structured-cloneable — plain objects, arrays and
 * TypedArrays. That is deliberate: the horizon crosses this boundary as
 * Int32Array, and copying it as JSON would cost an order of magnitude.
 *
 * The Personal Access Token crosses it exactly once, on sign-in. It never
 * comes back the other way (CLAUDE.md rule 6).
 */
import type {
  BasketPlan,
  BasketView,
  CollectionGaps,
  CreditGroup,
  CreditHarvest,
  CreditPerson,
  Dealer,
  DealerCandidate,
  Dig,
  DiscoveryResult,
  Feedback,
  Identity,
  MarkedOverview,
  Match,
  MatchDetail,
  Preferences,
  ShelfResult,
  ShelfSort,
  ShelfView,
  ShippingTier,
  TasteProfile,
  VaultStatus,
  VaultTarget,
  Verdict,
  WantlistOverview,
  WatchAlert,
} from './types'

export interface PingResult {
  pong: true
  /** Round-trip marker so the caller can prove the worker is really alive. */
  echo: string
}

export interface DbStats {
  counts: Record<string, number>
  /** From navigator.storage.estimate(); null where the browser withholds it. */
  usageBytes: number | null
  quotaBytes: number | null
  /** Whether the browser promised not to evict us after seven idle days. */
  persisted: boolean
}

/**
 * One entry per operation the worker can perform. `progress` is `never` for
 * operations that finish in one step; the scan in M2 will carry a real
 * progress type here.
 */
export interface WorkerContract {
  ping: { params: { echo: string }; progress: never; result: PingResult }
  'db.stats': { params: undefined; progress: never; result: DbStats }

  /** Validates the token against /oauth/identity and only then stores it. */
  'auth.signIn': { params: { token: string }; progress: never; result: Identity }
  'auth.identity': { params: undefined; progress: never; result: Identity | null }
  /** Deletes the whole database, not just the token. */
  'auth.signOut': { params: undefined; progress: never; result: { signedOut: true } }

  /**
   * Mirrors collection and wantlist. Reports per page, because the first run
   * takes ~25 requests and a spinner for half a minute is not an answer.
   */
  'library.sync': { params: undefined; progress: SyncProgress; result: SyncResult }
  'library.summary': { params: undefined; progress: never; result: LibrarySummary }

  /** Everything the start screen shows, from this device only. */
  'home.overview': { params: undefined; progress: never; result: HomeOverview }
  /**
   * Where the shelf has holes, and which labels you really collect. Costs no
   * requests: it is a reading of the horizon that already exists.
   */
  'collection.gaps': { params: undefined; progress: never; result: CollectionGaps }
  /** The wantlist, with pressing counts and where a dig last saw each album. */
  'collection.wantlist': { params: undefined; progress: never; result: WantlistOverview }
  /**
   * "Habe ich die schon?" — collection and wantlist, by name. No requests, so
   * it answers in a shop basement with no signal.
   */
  'collection.shelf': { params: { query: string }; progress: never; result: ShelfResult }
  /** The collection itself, filtered and sorted in the worker, a page at a time. */
  'collection.records': {
    params: { query?: string; sort?: ShelfSort; offset?: number; limit?: number }
    progress: never
    result: ShelfView
  }
  /** Recomputed after every sync; null until there has been one. */
  'taste.profile': { params: undefined; progress: never; result: TasteProfile | null }

  /** One request, so the UI can be honest about coverage before committing. */
  'dig.preflight': { params: { dealer: string }; progress: never; result: DigPreflight }
  /** The scan. Reports per page — first matches appear after a few seconds. */
  /**
   * `depth: 'deep'` walks every sort key Discogs accepts rather than one.
   * The only way past 20.000 listings, and up to 1.400 requests — so it is
   * always something somebody asked for, never a default.
   */
  'dig.run': {
    params: { dealer: string; depth?: 'normal' | 'deep' }
    progress: ScanProgress
    result: Dig
  }
  'dig.get': { params: { digId: string }; progress: never; result: DigWithMatches | null }
  /**
   * Re-reads each match's own listing. One request per match instead of a
   * whole rescan — and `status` says which ones have sold (docs/02).
   */
  'dig.refresh': {
    params: { digId: string }
    progress: RefreshProgress
    result: { refreshed: number; sold: number; requests: number; gone: number }
  }
  'dig.latest': { params: undefined; progress: never; result: DigWithMatches | null }
  /** An interrupted dig still inside its six-hour window, if there is one. */
  'dig.resumable': { params: undefined; progress: never; result: Dig | null }
  'dig.resume': { params: { digId: string }; progress: ScanProgress; result: Dig }
  /**
   * The style pass: fifty requests over the best matches, because S7 needs
   * per-release styles that nothing else in this app can reach.
   */
  'dig.enrich': {
    params: { digId: string }
    progress: EnrichProgress
    result: { enriched: number; fired: number; requests: number }
  }

  /**
   * The horizon: the collection expanded into release-id sets, once, so that
   * every later dig is a set lookup at no request cost.
   */
  'horizon.status': { params: undefined; progress: never; result: HorizonStatus }
  'horizon.build': { params: undefined; progress: HorizonProgress; result: HorizonResult }
  /**
   * A day's worth of revalidation, oldest first. Cheap enough to offer on a
   * visit rather than schedule (docs/11 §3: ~20 Requests/Tag, gestaffelt).
   */
  'horizon.revalidate': {
    params: undefined
    progress: HorizonProgress
    result: HorizonResult & { stale: number; reason: string }
  }
  /**
   * Reads the credits off the records you rated highest. One request each,
   * bounded, resumable — what makes "Conny Plank hat 9 deiner Platten
   * produziert" answerable at all (docs/11 §3).
   */
  'credits.harvest': {
    params: { limit?: number }
    progress: HarvestProgress
    result: CreditHarvest
  }
  'credits.status': { params: undefined; progress: never; result: CreditStatus }

  /**
   * Stage two of the master/release two-step: the pressings the last dig
   * showed were missing. One request each, and permanent (docs/11 §4).
   */
  'horizon.fillGaps': {
    params: undefined
    progress: HorizonProgress
    result: { expanded: number; requests: number; titles: string[] }
  }

  /**
   * Feedback. Carries the signal snapshot, because a verdict without the
   * reasoning behind it is unusable once the weights move (docs/03 §7).
   */
  'feedback.set': {
    params: { match: FeedbackSubject; verdict: Verdict }
    progress: never
    result: Record<number, Verdict>
  }
  'feedback.clear': {
    params: { listingId: number }
    progress: never
    result: Record<number, Verdict>
  }
  'feedback.verdicts': { params: undefined; progress: never; result: Record<number, Verdict> }
  /** The shortlist, grouped by shop — what outlives a pruned dig. */
  'feedback.marked': { params: undefined; progress: never; result: MarkedOverview }
  /**
   * Changing your mind from the shortlist, where no `Match` exists any more.
   * Keeps the signal snapshot, which is the reason the store exists at all.
   */
  'feedback.verdict': {
    params: { listingId: number; verdict: Verdict }
    progress: never
    result: MarkedOverview
  }
  /** Taking a record off the shortlist entirely. */
  'feedback.forget': { params: { listingId: number }; progress: never; result: MarkedOverview }
  /**
   * Are the shortlisted records still there? One request per record still open
   * (docs/02). Fresh prices come back in the result and are never stored — a
   * price on disk past six hours is exactly what CLAUDE.md rule 4 forbids.
   */
  'feedback.check': {
    params: undefined
    progress: RefreshProgress
    result: {
      prices: Record<
        number,
        { price: number | null; currency: string | null; condition: string | null }
      >
      sold: number
      requests: number
    }
  }
  /** The whole store, for the offline analysis docs/03 §7 describes. */
  'feedback.export': { params: undefined; progress: never; result: Feedback[] }

  /** The Clerk's Take: what a shop is, and how it ranks against your others. */
  /**
   * The shops Discogs already knows you deal with. Orders always (documented),
   * friends only when the device asked for it (ADR-009).
   */
  /** Where this device syncs, and whether it can right now. */
  'vault.status': { params: undefined; progress: never; result: VaultStatus }
  /**
   * One round: read what is out there, merge, write back. The passphrase never
   * leaves the worker and is never stored beside the data it protects.
   */
  'vault.sync': {
    params: { passphrase: string }
    progress: never
    result: { counts: Record<string, number>; hadRemote: boolean; syncedAt: number }
  }
  'vault.setTarget': { params: { target: VaultTarget }; progress: never; result: VaultStatus }
  /**
   * The middle of a round, for destinations the worker cannot reach itself.
   *
   * A file lives behind a picker, and a picker needs a click — so the main
   * thread does the reading and writing while the passphrase, the decryption
   * and the merge stay in here. What crosses is ciphertext in both directions.
   */
  'vault.merge': {
    params: { passphrase: string; remote: unknown | null }
    progress: never
    result: {
      sealed: unknown
      counts: Record<string, number>
      hadRemote: boolean
      syncedAt: number
    }
  }

  'dealer.discover': {
    params: undefined
    progress: { done: number; total: number; requests: number }
    result: DiscoveryResult
  }
  /** Writes the chosen shops down; returns how many were new. */
  'dealer.remember': {
    params: { candidates: DealerCandidate[] }
    progress: never
    result: { added: number; dealers: Dealer[] }
  }

  'dealer.profile': {
    params: { dealer: string }
    progress: never
    result: DealerProfile | null
  }
  /** Every shop you have scanned, best first. */
  'dealer.list': { params: undefined; progress: never; result: Dealer[] }

  /**
   * The watchlist. One request per shop, not a hundred — `num_for_sale` off
   * the profile is the whole change detector (docs/06 M6).
   */
  'watch.set': {
    params: { dealer: string; watching: boolean }
    progress: never
    result: Dealer[]
  }
  'watch.list': { params: undefined; progress: never; result: Dealer[] }
  'watch.check': { params: { force?: boolean }; progress: never; result: WatchCheck }
  /**
   * The credit graph, regrouped by person. Costs nothing: every edge was paid
   * for when the horizon was built.
   */
  'dig.credits': { params: { digId: string }; progress: never; result: CreditGroup[] }
  /**
   * Taking your data with you. Never carries the token and never carries
   * marketplace data — see worker/export.ts for why.
   */
  'data.exportDig': { params: { digId: string }; progress: never; result: unknown | null }
  'data.exportAll': { params: undefined; progress: never; result: unknown }
  /** Deletes the database outright, token included. There is no undo. */
  'data.deleteAll': { params: undefined; progress: never; result: { deleted: true } }

  /** Settings. The hub URL lives here; the token never does. */
  'preferences.get': { params: undefined; progress: never; result: Preferences }
  'preferences.set': { params: Partial<Preferences>; progress: never; result: Preferences }
  /**
   * Is that hub there? Answered before anything is saved, because a broken
   * hub is invisible by design (ADR-008) and this is the only place somebody
   * can tell "pointing at nothing" from "working".
   */
  'hub.check': {
    params: { url: string; secret?: string }
    progress: never
    result: { ok: boolean; horizon: number; shipping: number; secured: boolean }
  }

  /** Every dig, newest first — what the command palette offers to jump to. */
  'dig.list': { params: undefined; progress: never; result: Dig[] }

  /**
   * The basket. One dealer at a time, because postage is per shipment.
   * Every mutation answers with the whole view, so the UI never has to
   * reconstruct what the worker already knows.
   */
  'basket.add': {
    params: { digId: string; listingId: number }
    progress: never
    result: BasketView
  }
  'basket.remove': { params: { listingId: number }; progress: never; result: BasketView }
  'basket.clear': { params: undefined; progress: never; result: BasketView }
  'basket.get': { params: undefined; progress: never; result: BasketView }
  /**
   * Ask the marketplace whether the basket is still buyable — one request per
   * line (docs/02). The answer that matters is not the price but `status`.
   */
  'basket.refresh': { params: undefined; progress: RefreshProgress; result: BasketView }
  /**
   * From the shortlist into the basket. One fresh request per record — the
   * dig is long gone, so there is no `Match` left to add, and a basket total
   * is not something to build out of a remembered price.
   */
  'basket.fromMarked': {
    params: { listingIds: number[] }
    progress: RefreshProgress
    result: { view: BasketView; added: number; sold: number }
  }
  /** A hand-entered postage table. Replaces any earlier one for this dealer. */
  'basket.setShipping': {
    params: { dealer: string; tiers: Omit<ShippingTier, 'source'>[] }
    progress: never
    result: BasketView
  }
  /** Greedy plus swap improvement over what this dealer has that you want. */
  'basket.plan': { params: { budget: number }; progress: never; result: BasketPlan | null }
  /**
   * Everything the detail sheet shows. Costs no request: it is all horizon and
   * stored match, which is the whole reason the collection was expanded.
   */
  'dig.detail': {
    params: { digId: string; listingId: number }
    progress: never
    result: MatchDetail | null
  }
}

/** What a verdict needs to keep: the identity plus the reasoning behind it. */
/**
 * What a verdict carries. The signals are the part that makes it analysable
 * later; the title, artist and dig are the part that makes it *readable* later,
 * once the dig itself has been pruned.
 */
export type FeedbackSubject = Pick<
  Match,
  'listingId' | 'releaseId' | 'signals' | 'score' | 'digId' | 'title' | 'artist'
>

export interface EnrichProgress {
  done: number
  total: number
  requests: number
}

export interface DealerProfile {
  dealer: Dealer
  /** Matches per thousand listings — comparable between shops. */
  rate: number
  /**
   * How this shop compares to the median of your others. null until a second
   * one has been scanned, rather than a made-up 1.0.
   */
  factor: number | null
  /**
   * Median price against the median of your other shops' medians. Above 1 is
   * the expensive end of your dealers, below 1 the cheap one — and that is all
   * it claims, because a browser cannot see the wider market.
   */
  priceFactor: number | null
  scannedDealers: number
}

export interface RefreshProgress {
  done: number
  total: number
  requests: number
  sold: number
}

export interface WatchCheck {
  alerts: WatchAlert[]
  checked: number
  requests: number
  /** Watched but looked at recently enough to leave alone. */
  skipped: number
}

export interface HarvestProgress {
  done: number
  total: number
  requests: number
  current: string
  people: number
  etaMs: number
}

export interface CreditStatus {
  /** Records rated 4 or 5 — how big the job is at all. */
  favourites: number
  harvested: number
  harvestedAt: number | null
  /** People appearing often enough to be worth expanding. */
  worthExpanding: number
  people: CreditPerson[]
}

export interface HorizonStatus {
  entities: number
  expanded: number
  releaseIds: number
  builtAt: number | null
  estimatedRequests: number
}

export interface HorizonProgress {
  done: number
  total: number
  requests: number
  /** What is being expanded right now, so the wait has a subject. */
  current: string
  releaseIds: number
  etaMs: number
}

export interface HorizonResult {
  expanded: number
  skipped: number
  /** Entities that could not be expanded this run; a later run retries them. */
  failed: number
  requests: number
  releaseIds: number
}

export interface DigPreflight {
  dealer: string
  displayName: string
  numForSale: number
  /** At most 20.000 — asc and desc give two disjoint windows. */
  reachable: number
  /** True when one ordering is not enough and the UI has to say so. */
  truncated: boolean
  /**
   * What a deep scan would cost at most, or null when it would buy nothing.
   *
   * A ceiling rather than an estimate: the run stops as soon as an ordering
   * turns up nothing new, which on most shops is well before the last pass.
   */
  deepRequests: number | null
  /** How far a deep scan could reach, against `numForSale`. */
  deepReachable: number | null
  sellerRating: number | null
  location: string | null
}

export interface ScanProgress {
  status: Dig['status']
  /** Rows read. Not the same as `unique` — see below. */
  scanned: number
  total: number
  reachable: number
  matches: number
  requests: number
  order: 'asc' | 'desc'
  etaMs: number | null
  /**
   * Distinct listings actually seen, and the only honest numerator.
   *
   * `scanned` counts rows: a shop between 10.000 and 20.000 is walked from
   * both ends and the windows overlap, and a deep scan reads the same record
   * in up to thirteen orderings. A bar built on rows sails past 100 %.
   */
  unique: number
  /** Which ordering is running, in words, for a run that takes minutes. */
  pass: string
  passIndex: number
  passCount: number
}

export interface DigWithMatches {
  dig: Dig
  /** Best copy per release, strongest first. */
  matches: Match[]
  /** The shortlist: up to five, at most one record per artist. */
  topFive: Match[]
  /** Extra copies of the same record that were folded away. */
  folded: number
}

export interface SyncProgress {
  kind: 'collection' | 'wantlist'
  stored: number
  total: number
  requests: number
}

export interface SyncSummary {
  stored: number
  requests: number
  total: number
}

export interface SyncResult {
  collection: SyncSummary
  wantlist: SyncSummary
}

/** One cover on the start screen, from the collection or the wantlist. */
export interface HomeCover {
  releaseId: number
  title: string
  artist: string
  year: number
  thumbUrl: string
  coverUrl: string
  /** ISO 8601 from Discogs. */
  addedAt: string
}

/** One find from the last dig, trimmed to what a cover rail shows. */
export interface HomeFind {
  digId: string
  listingId: number
  releaseId: number
  score: number
  reason: string
  title: string | null
  artist: string | null
  thumbUrl: string | null
  price: number | null
  currency: string | null
  /** Past the six-hour window, so the price above is null (rule 4). */
  expired: boolean
}

export interface HomeShop {
  username: string
  displayName: string
  affinity: number | null
  numForSale: number
  lastScannedAt: number | null
}

/**
 * The whole start screen, in one message.
 *
 * Assembled in the worker so the page makes one round trip rather than five,
 * and arrives at once rather than in five flickers. Nothing in it costs a
 * Discogs request — opening the app must not spend from a budget that belongs
 * to the dig somebody is about to start.
 */
export interface HomeOverview {
  library: LibrarySummary
  dig: {
    id: string
    dealer: string
    startedAt: number
    expiresAt: number
    matches: number
  } | null
  finds: HomeFind[]
  shelf: HomeCover[]
  wanted: HomeCover[]
  shops: HomeShop[]
}

export interface LibrarySummary {
  collection: number
  wantlist: number
  /** The shortlist — records judged worth a second look and not yet bought. */
  marked: number
  /** Shops scanned so far — what decides whether The Clerk's Take has anything to say. */
  dealers: number
  basket: number
  collectionSyncedAt: number | null
  wantlistSyncedAt: number | null
}

export type RequestKind = keyof WorkerContract
export type ParamsOf<K extends RequestKind> = WorkerContract[K]['params']
export type ProgressOf<K extends RequestKind> = WorkerContract[K]['progress']
export type ResultOf<K extends RequestKind> = WorkerContract[K]['result']

// --- main → worker ---------------------------------------------------------

export type WorkerRequest = {
  [K in RequestKind]: { id: string; kind: K; params: ParamsOf<K> }
}[RequestKind]

export interface CancelRequest {
  id: string
  kind: '$cancel'
}

export type WorkerInbound = WorkerRequest | CancelRequest

// --- worker → main ---------------------------------------------------------

export interface WorkerError {
  message: string
  /** Set when the failure is one the UI has to react to specifically. */
  code?: 'rate-limited' | 'unauthorized' | 'offline' | 'cancelled'
}

export type WorkerOutbound =
  | { id: string; type: 'progress'; progress: unknown }
  | { id: string; type: 'result'; result: unknown }
  | { id: string; type: 'error'; error: WorkerError }

export function isWorkerOutbound(value: unknown): value is WorkerOutbound {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Partial<WorkerOutbound>
  return (
    typeof message.id === 'string' &&
    (message.type === 'progress' || message.type === 'result' || message.type === 'error')
  )
}
