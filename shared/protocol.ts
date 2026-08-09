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
  CreditGroup,
  CreditHarvest,
  CreditPerson,
  Dealer,
  Dig,
  Feedback,
  Identity,
  Match,
  MatchDetail,
  ShippingTier,
  TasteProfile,
  Verdict,
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
  /** Recomputed after every sync; null until there has been one. */
  'taste.profile': { params: undefined; progress: never; result: TasteProfile | null }

  /** One request, so the UI can be honest about coverage before committing. */
  'dig.preflight': { params: { dealer: string }; progress: never; result: DigPreflight }
  /** The scan. Reports per page — first matches appear after a few seconds. */
  'dig.run': { params: { dealer: string }; progress: ScanProgress; result: Dig }
  'dig.get': { params: { digId: string }; progress: never; result: DigWithMatches | null }
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
  /** The whole store, for the offline analysis docs/03 §7 describes. */
  'feedback.export': { params: undefined; progress: never; result: Feedback[] }

  /** The Clerk's Take: what a shop is, and how it ranks against your others. */
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
export type FeedbackSubject = Pick<Match, 'listingId' | 'releaseId' | 'signals' | 'score'>

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
  /** True when full coverage is impossible and the UI has to say so. */
  truncated: boolean
  sellerRating: number | null
  location: string | null
}

export interface ScanProgress {
  status: Dig['status']
  scanned: number
  total: number
  reachable: number
  matches: number
  requests: number
  order: 'asc' | 'desc'
  etaMs: number | null
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

export interface LibrarySummary {
  collection: number
  wantlist: number
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
