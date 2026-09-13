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
import type { OriginFilter } from './countries'
import type { CoverProgress } from '~~/worker/covers'
import type { KeeperProgress, KeeperResult } from '~~/worker/keeper'
import type { DrainResult } from '~~/worker/outbox'
import type { CheckProgress, WatchedCheck } from '~~/worker/watched/check'
import type { DemoProgress, DemoResult } from '~~/worker/demo'
import type { ImportReport } from '../worker/import'
import type {
  BasketPlan,
  BasketView,
  CollectionField,
  CollectionFolder,
  CollectionGaps,
  CollectionItem,
  CollectionValue,
  CreditGroup,
  CreditHarvest,
  CreditPerson,
  Dealer,
  DealerCandidate,
  Dig,
  DiscoveryResult,
  Feedback,
  GradingRecord,
  Identified,
  PressingFamily,
  Identity,
  LandedContext,
  MarkedOverview,
  Match,
  MatchDetail,
  OrderImport,
  Place,
  PlaceNode,
  Preferences,
  PushRegistration,
  ReleaseDetail,
  SharedDig,
  ShelfResult,
  ShelfSort,
  ShelfView,
  ShippingTier,
  Signal,
  SortDirection,
  StackShop,
  Stand,
  StockRow,
  TasteComparison,
  TasteProfile,
  ValuePoint,
  VaultStatus,
  VaultTarget,
  Verdict,
  WantlistOverview,
  WantPlan,
  YearReview,
  WatchAlert,
  WatchedRelease,
  UnitShape,
  Finish,
  PlaceDealing,
  PlaceRule,
  UnitPlan,
} from './types'

export interface PingResult {
  pong: true
  /** Round-trip marker so the caller can prove the worker is really alive. */
  echo: string
}

export interface PasteProgress {
  done: number
  total: number
  requests: number
  added: number
}

export interface PasteResult {
  added: number
  /** Pasted but already gone — a shipment has to be payable. */
  sold: number
  /** Ids Discogs would not answer for: taken down, or never a listing. */
  unknown: number
  requests: number
  /** Which shops it landed in, so the screen can say where to look. */
  dealers: string[]
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
  /** A new token for the same account; the database stays. Refuses another account. */
  'auth.renew': { params: { token: string }; progress: never; result: Identity }
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
   * Fidelity on one or two records — without a token.
   *
   * Everything it reads answers unauthenticated (docs/02), so this is the one
   * request kind that works before anybody has signed in. It runs the real
   * matcher over a collection of one or two seeds; nothing about it is a
   * mock-up, which is the only reason it is worth showing.
   */
  'demo.run': { params: { listingIds: number[] }; progress: DemoProgress; result: DemoResult }
  /**
   * Look whether anything wants refreshing — and then do it.
   *
   * Called by the app itself rather than by a button (app/composables/
   * useKeeper.ts). Does nothing at all while something somebody started is
   * running, and nothing that costs minutes ever. See worker/keeper.ts for
   * what it deliberately leaves alone.
   */
  /**
   * Look for a hub — here first, then on this machine.
   *
   * Two kinds of candidate, and the order is the whole point.
   *
   * **Same origin first.** A hub deployed beside the app (`/hub` on the same
   * domain, which is what `.github/workflows/hub.yml` sets up) is the one case
   * that can never fail for a reason outside itself: no CORS, no mixed
   * content, no second certificate. It is also the only one that works on a
   * phone away from home.
   *
   * **Then `http://localhost:8787`**, where `hub/compose.yml` puts it —
   * worth one probe before making somebody type an address. Measured
   * 2026-08-10: from an https page Chromium reaches it and WebKit does
   * **not** ("Not allowed to request resource"), which is every iPhone. That
   * case is predictable rather than detectable, so the result names it
   * instead of reporting "nothing found" for something simply forbidden.
   */
  'hub.discover': {
    params: undefined
    progress: never
    result: {
      url: string | null
      /**
       * Whether the one that answered wants a shared secret.
       *
       * `/v1/health` is open by design and says so (`secured`). It decides
       * whether the address can simply be kept or still needs a word typed
       * beside it — without it the app would have to save first and find out
       * afterwards, from a hub that fails silently by design (rule 8).
       */
      secured: boolean
      /** True when this page is https and the candidates are http. */
      blockedByMixedContent: boolean
      tried: string[]
    }
  }
  'keeper.tick': {
    params: { force?: boolean; eager?: boolean }
    /** What is being worked on, so the app can say so. */
    progress: KeeperProgress
    result: KeeperResult
  }
  /**
   * Covers already on hand. Costs no request.
   *
   * Split from the fetch on purpose: every screen asks this first and gets an
   * answer offline, immediately, for the covers the collection sync already
   * paid for. Only what is still missing turns into requests, and only then.
   */
  'covers.known': {
    params: { releaseIds: number[] }
    progress: never
    result: Record<number, { thumbUrl: string; coverUrl: string }>
  }
  /**
   * Fetch the missing ones — a screenful, not a shopful.
   *
   * The marketplace returns listings without images (worker/covers.ts has the
   * measurement), so this is the only way a find ever gets a sleeve. Bounded
   * per call and never asked twice for the same release.
   */
  'covers.fetch': {
    params: { releaseIds: number[]; limit?: number }
    progress: CoverProgress
    result: Record<number, { thumbUrl: string; coverUrl: string }>
  }
  /**
   * Where the shelf has holes, and which labels you really collect. Costs no
   * requests: it is a reading of the horizon that already exists.
   */
  'collection.gaps': { params: undefined; progress: never; result: CollectionGaps }
  /**
   * A year on the shelf (M19 #8). Null when nothing has ever been added; the
   * latest year with an addition when none is asked for. Reads only.
   */
  'collection.review': {
    params: { year: number | null }
    progress: never
    result: YearReview | null
  }
  /** The wantlist, with pressing counts and where a dig last saw each album. */
  'collection.wantlist': { params: undefined; progress: never; result: WantlistOverview }
  /**
   * Your wants across the shops scanned inside the six hours (M19 #9), with
   * the postage. Reads only; the tier tables come the way the basket gets them.
   */
  'wantlist.plan': {
    /** `from` narrows the shops to your country or the EU (M20 #2). */
    params: { from: OriginFilter }
    progress: never
    result: WantPlan
  }
  /**
   * "Habe ich die schon?" — collection and wantlist, by name. No requests, so
   * it answers in a shop basement with no signal.
   */
  'collection.shelf': { params: { query: string }; progress: never; result: ShelfResult }
  /** The collection itself, filtered and sorted in the worker, a page at a time. */
  'collection.records': {
    params: {
      query?: string
      /** "Everything on this label", "everything by this artist" — exact, not a search. */
      label?: string
      artist?: string
      sort?: ShelfSort
      direction?: SortDirection
      offset?: number
      limit?: number
      /** Only records with no living place (M27.1c) — the ones still to sort in. */
      unplaced?: boolean
    }
    progress: never
    result: ShelfView
  }
  /**
   * What only `/releases/{id}` knows: tracklist, credits, run-out numbers.
   *
   * One request, for a record somebody has opened, and kept afterwards — the
   * same bargain the covers make. Null when there is no answer: the sheet then
   * shows everything it already had and no error, because none of this is
   * needed to know what the record is.
   */
  'release.detail': {
    /**
     * `refresh` asks again — the one thing that costs a second request.
     *
     * Needed because the price inside expires after six hours (rule 4) while
     * the tracklist beside it does not. Somebody who wants a current number
     * asks for it; nothing here refetches on its own.
     */
    params: { releaseId: number; refresh?: boolean }
    progress: never
    result: ReleaseDetail | null
  }
  /** One stored record, for the sheet a shelf tile opens. Reads only. */
  'collection.record': {
    params: { instanceId: number }
    progress: never
    result: CollectionItem | null
  }
  /**
   * Sets a rating on a record of your own.
   *
   * Answers as soon as the shelf is written — the request to Discogs is the
   * keeper's problem, not the caller's. `false` means the record has no entry
   * to write to (synced before those were kept), which is a thing to say out
   * loud rather than a failure to swallow.
   */
  'collection.rate': {
    params: { instanceId: number; rating: number }
    progress: never
    result: boolean
  }
  /** The field definitions, and this device's values for one record. */
  'collection.fields': {
    params: { instanceId: number }
    progress: never
    result: { fields: CollectionField[]; values: Record<number, string> }
  }
  /** Sets one field. False when the record has no entry to write to. */
  'collection.setField': {
    params: { instanceId: number; fieldId: number; value: string }
    progress: never
    result: boolean
  }
  /**
   * Sends what is waiting, now.
   *
   * The keeper drains the outbox too, but on its own clock — twenty minutes,
   * which is fine for "did anything change over there" and absurd for "the
   * thing I just did". This is the nudge a change gives on its way out, and
   * it touches nothing else: no sync, no watchlist, no horizon.
   */
  'outbox.flush': { params: undefined; progress: never; result: DrainResult }
  /** The folders this collection is divided into. Empty before the first sync. */
  'collection.folders': { params: undefined; progress: never; result: CollectionFolder[] }
  /** Moves one copy into another folder. */
  'collection.move': {
    params: { instanceId: number; folderId: number }
    progress: never
    result: boolean
  }
  /** Takes a record off the shelf. Destructive — the screen asks first. */
  'collection.remove': {
    params: { instanceId: number }
    progress: never
    result: boolean
  }
  /** Puts a record you just bought on the shelf. False when it is already on it. */
  'collection.add': {
    params: { digId: string; listingId: number }
    progress: never
    result: boolean
  }
  /** Adds a find to the wantlist. False when its six hours are up. */
  'wantlist.add': {
    params: { digId: string; listingId: number }
    progress: never
    result: boolean
  }
  /** Writes the note and the wish rating. Both go together — see want.ts. */
  'wantlist.note': {
    params: { releaseId: number; note: string; want: number }
    progress: never
    result: boolean
  }
  /** Takes a release off the wantlist. */
  'wantlist.remove': { params: { releaseId: number }; progress: never; result: boolean }
  /** When the whole collection was last read from Discogs. Null before the first. */
  'collection.readFullyAt': { params: undefined; progress: never; result: number | null }
  /** Discogs' estimate, as of the last sync. Null before the first one. */
  /** Every day the estimate was kept, oldest first (M19 #3). No request. */
  'collection.valueHistory': { params: undefined; progress: never; result: ValuePoint[] }
  'collection.value': { params: undefined; progress: never; result: CollectionValue | null }
  /** Recomputed after every sync; null until there has been one. */
  'taste.profile': { params: undefined; progress: never; result: TasteProfile | null }
  /**
   * The collection's shares against the catalogue's (M21.6): lift per
   * decade, style and genre, and the build they are measured against. Null
   * without a catalogue — the map then shows no comparison, not a wrong one.
   */
  'taste.compared': { params: undefined; progress: never; result: TasteComparison | null }

  /** One request, so the UI can be honest about coverage before committing. */
  'dig.preflight': { params: { dealer: string }; progress: never; result: DigPreflight }
  /** The scan. Reports per page — first matches appear after a few seconds. */
  /**
   * `depth: 'deep'` walks every sort key Discogs accepts rather than one.
   * The only way past 20.000 listings, and up to 1.400 requests — so it is
   * always something somebody asked for, never a default.
   */
  'dig.run': {
    params: { dealer: string; depth?: 'normal' | 'deep' | 'neu' }
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
  /**
   * The stands: the newest dig per shop from the last day, expired or not
   * (M19 #4). What the in-store screen offers at a record fair. No request.
   */
  'dig.stands': { params: undefined; progress: never; result: Stand[] }
  /** An interrupted dig still inside its six-hour window, if there is one. */
  'dig.resumable': { params: undefined; progress: never; result: Dig | null }
  /** What this worker is scanning right now — a page opened mid-scan attaches to it. */
  'dig.running': {
    params: undefined
    progress: never
    result: { digId: string; dealer: string | null; progress: ScanProgress | null } | null
  }
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
   * Whether this worker is expanding the horizon right now, and how far.
   *
   * The counterpart to `dig.running`, and it exists for the same report: a
   * build survives leaving the screen that started it, but until 2026-09-13
   * nothing could see that it had. The panel asks on opening and every second
   * and a half while it runs.
   */
  'horizon.running': { params: undefined; progress: never; result: RunningHorizon | null }
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
    result: {
      counts: Record<string, number>
      hadRemote: boolean
      /**
       * Empty, although this device has synced before.
       *
       * Only the hub knows this case: there the id has hung off the
       * passphrase since 2026-08-13, so a different word moves the storage
       * location with it. A file or a cloud folder sits where somebody
       * pointed, and cannot do that.
       */
      emptyThoughSyncedBefore?: boolean
      syncedAt: number
    }
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
  /**
   * A shop's inventory, by label or by decade.
   *
   * Paged by default: a large shop has twenty thousand rows, and a screen
   * wants fifty of them. The rest stays where it is until somebody asks.
   */
  'dealer.stock': {
    params: {
      dealer: string
      label?: string | null
      decade?: number | null
      offset?: number
      limit?: number
    }
    progress: never
    result: { rows: StockRow[]; total: number; scannedAt: number | null }
  }

  'dealer.list': { params: undefined; progress: never; result: Dealer[] }
  /**
   * "Never show this one again", and its undoing.
   *
   * Answers with both lists, because the screen that hides a shop is the one
   * that shows the hidden ones — and the shop just hidden moves from the first
   * to the second in the same breath.
   */
  'dealer.hide': {
    params: { dealer: string; hidden: boolean }
    progress: never
    result: { visible: Dealer[]; hidden: Dealer[] }
  }
  /** The hidden shops, by name — the one place they can be brought back. */
  'dealer.hidden': { params: undefined; progress: never; result: Dealer[] }

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
   * Push, which needs a hub and works without one being embarrassing.
   *
   * `watch.pushKey` answers null when there is no hub, no answer, or nonsense
   * — the screen turns that into "not available here" and offers nothing.
   * Subscribing itself happens on the main thread, because `PushManager`
   * hangs off the service worker registration and a web worker has none;
   * everything after that is hub talk and therefore belongs in here.
   */
  'watch.pushKey': { params: undefined; progress: never; result: string | null }
  'watch.pushOn': {
    params: { registration: PushRegistration }
    progress: never
    result: boolean
  }
  'watch.pushOff': { params: undefined; progress: never; result: true }
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
  /** A backup read back in (M24): rows merged, digs left out, the report says what happened. */
  'data.importAll': { params: { file: unknown }; progress: never; result: ImportReport }
  /**
   * The collection or the wantlist as CSV (M19 #5) — the catalogue columns
   * Discogs' own export leaves out, plus what is yours alone. No prices.
   */
  'data.exportCsv': {
    params: { what: 'collection' | 'wantlist' }
    progress: never
    result: { csv: string; rows: number }
  }
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
  /**
   * The catalogue (ADR-013): is one there, and which build answers.
   *
   * Same two shapes as the hub's, without a secret — the catalogue is public
   * CC0 data and has no door to lock.
   */
  'catalogue.discover': { params: undefined; progress: never; result: { url: string | null } }
  'catalogue.check': {
    params: { url: string }
    progress: never
    result: { ok: boolean; build: string; releases: number }
  }

  'hub.check': {
    params: { url: string; secret?: string; accessKey?: string }
    progress: never
    result: {
      ok: boolean
      horizon: number
      shipping: number
      secured: boolean
      /**
       * Whether the secret opens the door — asked at a secured route, because
       * health is open by design and says "reachable" to a wrong word too.
       * Measured 2026-09-12: a phone with the wrong secret showed "reachable,
       * secured" while every real request came back 401.
       */
      secret: 'ok' | 'wrong' | 'missing' | 'unchecked'
      /** The second door (docs/17 §3.2): whether the access key opens it, when the hub has one. */
      key: 'ok' | 'wrong' | 'missing' | 'unchecked'
      /** Which doors the hub reports; an older hub reports none and is read as before. */
      doors: ('secret' | 'key')[]
    }
  }

  /** Every dig, newest first — what the command palette offers to jump to. */
  'dig.list': { params: undefined; progress: never; result: Dig[] }

  /**
   * The top row of the stack: which shops have fresh finds.
   *
   * The cards themselves come from `dig.get` — the same dig, the same
   * selection. Costs no Discogs request; all of it is in IndexedDB already.
   */
  /**
   * Watched records (M11).
   *
   * `watched.check` costs one request per record that is due, and runs
   * through the same pacer as everything else. The ceiling is `MAX_WATCHED` —
   * without it the pass would be precisely the loop rule 2 forbids.
   */
  /**
   * Where the record is (M12) — the one feature that costs zero requests.
   *
   * A location is a statement about somebody's own flat, not a piece of
   * Discogs data. None of this leaves the device.
   */
  /**
   * Recognising a record you are holding (M13).
   *
   * One request. The result is a **list** of pressings, not one: a barcode
   * names a release, and measured on 2026-09-11, eight releases across five
   * countries shared a single one.
   */
  /**
   * Does this shop grade honestly? (M14)
   *
   * Costs no request — all of it is in the `feedback` store. What is stored
   * is **only the comparison**, never the grade that was promised: that would
   * be Discogs content, and could not be shown after six hours.
   */
  'grading.forDealer': { params: { dealer: string }; progress: never; result: GradingRecord }
  'grading.awaiting': {
    params: undefined
    progress: never
    result: {
      listingId: number
      dealer: string | null
      artist: string | null
      title: string | null
    }[]
  }
  'grading.record': {
    params: { listingId: number; arrived: 'as-described' | 'better' | 'worse' | null }
    progress: never
    result: true
  }

  /**
   * Read an order, and ask the arrival questions from it (M14).
   *
   * Costs **one** request. The number has to be typed in, because
   * `GET /marketplace/orders` is the seller side, which leaves no API route
   * from "I am the buyer" to "here are my order numbers" (`docs/02`, measured
   * 2026-09-11).
   */
  'orders.import': { params: { orderId: string }; progress: never; result: OrderImport }

  'identify.barcode': { params: { barcode: string }; progress: never; result: Identified }
  /**
   * And by the run-out groove — the better identifier on club vinyl.
   *
   * Measured 2026-09-11: of twelve records, ten had a barcode, eleven had a
   * run-out, and the two without a barcode had one. The full string returns
   * **one** hit where a barcode returns eight.
   */
  'identify.runout': { params: { runout: string }; progress: never; result: Identified }
  /**
   * Which pressing this is, among all of them (M19 #7).
   *
   * Two requests, for one record somebody is holding: the release and the
   * album's versions. Null when Discogs will not answer — the candidate list
   * is still there, and nothing in it depended on this.
   */
  'pressing.family': {
    params: { releaseId: number }
    progress: never
    result: PressingFamily | null
  }

  'places.overview': { params: undefined; progress: never; result: PlaceNode[] }
  'places.create': {
    params: { name: string; parentId: string | null }
    progress: never
    result: Place | null
  }
  /** A piece of furniture with its compartments, in one go (M27.1). */
  'places.createUnit': {
    params: {
      name: string
      parentId: string | null
      shape: UnitShape
      columns: number
      rows: number
      capacity: number | null
      finish: Finish
      rule: PlaceRule
    }
    progress: never
    result: Place | null
  }
  /** The order inside a piece of furniture (M27.2): a rule proposes, never moves. */
  'places.rule': { params: { id: string; rule: PlaceRule }; progress: never; result: boolean }
  /** How "sort in" deals (M28 #3): evenly, or from the front. */
  'places.dealing': {
    params: { id: string; dealing: PlaceDealing }
    progress: never
    result: boolean
  }
  /** What sorting a unit by its rule would do — the plan, not the deed. */
  'places.plan': {
    params: { unitId: string; includeUnplaced: boolean }
    progress: never
    result: UnitPlan | null
  }
  /** The deed: the plan as it stands now, written in one transaction. */
  'places.apply': {
    params: { unitId: string; includeUnplaced: boolean }
    progress: never
    result: number
  }
  /** Where a record would go, by the rules and dividers that exist. */
  'places.propose': {
    params: { instanceId: number }
    progress: never
    result: { placeId: string; unitId: string } | null
  }
  /** The look of a piece of furniture, changed after the fact (M27.1b). */
  'places.finish': { params: { id: string; finish: Finish }; progress: never; result: boolean }
  'places.rename': { params: { id: string; name: string }; progress: never; result: boolean }
  /** Dissolves the place; the records become placeless, not deleted. */
  'places.remove': { params: { id: string }; progress: never; result: true }
  'places.assign': {
    params: { instanceId: number; placeId: string | null }
    progress: never
    result: true
  }
  /** Several records into one place at once — filling a compartment (M27.1c). */
  'places.assignMany': {
    params: { instanceIds: number[]; placeId: string | null }
    progress: never
    result: number
  }
  'places.of': { params: { instanceId: number }; progress: never; result: string | null }
  'places.contents': {
    params: { placeId: string }
    progress: never
    result: CollectionItem[]
  }
  /** "Everything from crate 3 to shelf 2" — the ordinary case after a move. */
  'places.moveAll': { params: { from: string; to: string }; progress: never; result: number }
  /** Furniture carried into another room, or out of one (M27.4). */
  'places.move': {
    params: { id: string; parentId: string | null }
    progress: never
    result: boolean
  }

  'watched.list': { params: undefined; progress: never; result: WatchedRelease[] }
  'watched.add': {
    params: {
      releaseId: number
      kind: 'shelf' | 'wantlist'
      artist: string
      title: string
      threshold: number | null
    }
    progress: never
    result: { watched: boolean; full: boolean }
  }
  'watched.remove': { params: { releaseId: number }; progress: never; result: true }
  'watched.check': {
    params: { force?: boolean }
    progress: CheckProgress
    result: WatchedCheck
  }

  'stack.overview': { params: undefined; progress: never; result: StackShop[] }
  /** How far the stack has got. Forwards only. */
  'stack.seen': { params: { digId: string; seen: number }; progress: never; result: true }

  /**
   * Share a find list.
   *
   * Returns an id **and** a key. The key belongs in the `#` fragment of the
   * link and nowhere else — no browser sends a fragment to a server, and that
   * is exactly what the hub's inability to read the contents rests on.
   */
  'share.create': {
    params: { digId: string }
    progress: never
    result: { id: string; key: string; expiresAt: number; matches: number }
  }

  /**
   * And open a shared link — **no token, no sign-in**.
   *
   * Whoever receives one may never have opened Fidelity. The hub address is
   * in the link, because the recipient has not entered one.
   */
  'share.read': {
    params: { hubUrl: string; id: string; key: string }
    progress: never
    result: SharedDig | null
  }

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
  /** The line was opened at Discogs (or, with null, the hand-over starts again). */
  'basket.handedOver': {
    params: { listingId: number; at: number | null }
    progress: never
    result: BasketView
  }
  'basket.clear': { params: undefined; progress: never; result: BasketView }
  /**
   * Take listings over from the Discogs cart, by link.
   *
   * Discogs' API has no cart endpoint — `/marketplace/cart` answers 404 where
   * one that merely needs a token answers 401 — so the records somebody has
   * already put aside over there cannot be read. Pasting their links is the
   * other end of the same job: one request each, and every one lands in the
   * basket of the shop that sells it.
   */
  'basket.paste': {
    params: { input: string }
    progress: PasteProgress
    result: PasteResult & { view: BasketView }
  }
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
  /** Per shop, because postage is: filling up at one says nothing about another. */
  'basket.plan': {
    params: { dealer: string; budget: number }
    progress: never
    result: BasketPlan | null
  }
  /**
   * The shop's postage tiers and basket count, for the find list.
   *
   * The same ladder of sources the basket card uses — hand-entered, hub,
   * repository, parsed — so the number beside a find is the number the basket
   * will show once the record is in it. The arithmetic itself runs on the
   * main thread (`shared/shipping.ts`): one addition per record, and the list
   * is sorted there anyway.
   */
  'basket.landed': { params: { dealer: string }; progress: never; result: LandedContext }
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

/** What `horizon.running` answers — see `worker/horizon/running.ts`. */
export interface RunningHorizon {
  job: 'build' | 'revalidate' | 'gaps'
  progress: HorizonProgress | null
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
  /**
   * How many chunks this run handed to the hub that it already had.
   *
   * Zero means "all shared already" or "no hub" — both of them ordinary.
   * It differs from zero only in the first few runs after a hub is entered.
   */
  shared: number
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
  /**
   * The newest listing a previous dig saw here, or null when there was none.
   *
   * Its presence is what makes "nur das Neue" possible: with it, a visit walks
   * newest-first and stops at the first record it already knows.
   */
  since: string | null
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
  /** The shelf entry, so a cover can open its own page. Null on the wantlist. */
  instanceId: number | null
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
  signals: Signal[]
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
    /**
     * Whether the scan actually got through the shop.
     *
     * A dig that was interrupted — closed tab, lost connection — keeps its
     * matches and its dealer name, and read without this it presents them as
     * the answer: "fatplastics · 3 Treffer" off 1.400 of 2.881 listings. The
     * dig screen has always said so; the screens that borrow its results had
     * no way to.
     */
    complete: boolean
    scanned: number
    listingsTotal: number
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
  code?:
    | 'rate-limited'
    | 'unauthorized'
    | 'offline'
    | 'cancelled'
    /*
     * The hub is somebody's own machine, so it fails in ways Discogs never
     * does — and one of them, mixed content, is not a fault in the hub at all.
     * Codes rather than sentences, because the worker composing them has no
     * language.
     */
    | 'hub-mixed-content'
    | 'hub-unreachable'
    | 'hub-http-error'
    /*
     * And the rest of them, for the same reason one level further in.
     *
     * Until 2026-09-11 the worker threw sentences: `'Kein Token eingegeben.'`,
     * `'Der Sechs-Stunden-Rahmen ist abgelaufen – bitte neu scannen.'`, ten of
     * them in German inside an English interface. Translating them moved the
     * fault rather than removing it — `explain()` ends with
     * `title: message || words.unknown`, so a thrown sentence *is* the red
     * headline, and a worker sentence can never follow `activeLanguage()`.
     *
     * A code can. `worker/fail.ts` is now the only way to throw one, and
     * `tests/unit/template-text.spec.ts` holds the worker to it by shape —
     * no vocabulary, no exception list.
     */
    | 'no-token'
    | 'not-signed-in'
    | 'no-listing'
    | 'dig-gone'
    | 'dig-expired'
    | 'dig-running'
    | 'dig-not-running'
    | 'deep-scan-done'
    | 'no-anchor'
    | 'match-gone'
    | 'no-hub'
    | 'not-a-hub'
    | 'no-catalogue'
    | 'not-a-catalogue'
    | 'token-other-account'
    | 'not-a-backup'
    | 'backup-too-new'
    | 'vault-too-new'
    | 'vault-unusable'
    | 'passphrase-short'
    | 'asset-missing'
  /** The HTTP status, for `hub-http-error`. Nothing else carries one. */
  status?: number
  /** The shop a running scan is at, for `dig-running`. */
  dealer?: string
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
