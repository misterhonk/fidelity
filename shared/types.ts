/**
 * Domain types. These cross the main ↔ worker boundary and are the value types
 * of the IndexedDB stores, so they must stay structured-cloneable: plain
 * objects, arrays and TypedArrays only. No class instances, no functions.
 */

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** The twelve match signals (docs/04-MATCHING-ENGINE.md §3). */
export const SIGNAL_TYPES = [
  'WANTLIST_EXACT',
  'WANTLIST_PRESSING',
  'ARTIST_KNOWN',
  /**
   * A band on your radar that you own nothing by (M29, 2026-09-13).
   *
   * Deliberately not folded into ARTIST_KNOWN. That signal's sentence is "you
   * have 10 records by Anne Clark — not this one", and for a followed artist
   * the number is zero: it would read as certainty the evidence does not
   * carry, which is the same mistake the Clark mis-match made on the same day.
   */
  'ARTIST_FOLLOWED',
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
   * Audio preview in the stack — **off by default** (ADR-012).
   *
   * Discogs' one source of sound is YouTube, and an embedded player loads
   * Google. What flows out is not the collection — shelf, wantlist and token
   * stay where they are — but the IP address and which record is being looked
   * at. That is less than the sentence on the privacy page makes you fear, and
   * more than nothing.
   *
   * Hence the same shape as ADR-009 for the friends import: a switch per
   * device, off by default, and no feature hangs off it — the stack works
   * completely without sound.
   *
   * **And even switched on, no byte goes to Google beforehand.** The
   * `<iframe>` is created on the first deliberate tap, not when a card is
   * drawn.
   */
  audioPreview: boolean

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
  /**
   * The catalogue service (ADR-013), same shape as the hub: empty means none,
   * and everything works without one. No secret — it is public CC0 data.
   */
  catalogueUrl: string | null
  /**
   * The access key for a hosted hub and catalogue (docs/17 §6.2) — a signed
   * statement that identifies a payer, not a Discogs account. Rule 6 applies
   * to it as to the token: IndexedDB only, never logged, never in a URL.
   */
  accessKey: string | null
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
  /**
   * When the estimate was last *asked for*, whether or not Discogs answered
   * (M19 #3). The attempt is what is rationed, not the answer: a value the
   * endpoint refuses would otherwise be asked for again every half hour.
   */
  valueTriedAt?: number | null
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

/**
 * What only `GET /releases/{id}` knows — one request, then kept.
 *
 * The sync gives a shelf its names, its cover and its format. Everything a
 * record actually *is* — what is on it, who played on it, the number stamped
 * in the run-out groove — lives one request away, and that request is the one
 * rule 2 forbids in a loop. So it happens exactly when somebody opens a
 * record and never again for that record: on demand, cached, one at a time
 * through the same paced lane as everything else.
 */
export interface ReleaseTrack {
  position: string
  title: string
  /** "4:32", or empty — Discogs has no duration for a great many tracks. */
  duration: string
}

export interface ReleaseCredit {
  name: string
  /** "Producer", "Mastered By", "Remix" — Discogs' own wording. */
  role: string
}

export interface ReleaseIdentifier {
  /** "Matrix / Runout", "Barcode", "Mastering SID Code". */
  type: string
  value: string
  /** Which side or disc it was read off, when the submitter said. */
  description?: string
}

export interface ReleaseDetail {
  releaseId: number
  /** Where this pressing was made. Absent from the collection sync entirely. */
  country: string
  /** The full date where there is one — the sync only ever knows the year. */
  released: string
  tracks: ReleaseTrack[]
  credits: ReleaseCredit[]
  identifiers: ReleaseIdentifier[]
  /** What everybody else thinks, beside what you gave it. */
  community: { rating: number; votes: number } | null
  /** Discogs' own video links, for hearing it before deciding. */
  videos: { title: string; uri: string }[]
  notes: string
  /**
   * What it goes for — and the one part of this that expires.
   *
   * Everything else here is a fact about a pressing and keeps for ever. This
   * is marketplace data, so rule 4 applies to it and to nothing else in this
   * record: never shown once it is six hours old. `releaseDetail()` nulls it
   * on the way out rather than deleting it, exactly as `expireDigs` nulls the
   * marketplace fields of a match — the tracklist beside it stays.
   *
   * Integer cents, because the rule about money has no exceptions, and in the
   * currency that was asked for: Discogs prices in the caller's, so a bare
   * number without one would be a figure nobody can act on.
   */
  market: { priceCents: number; currency: string; numForSale: number; at: number } | null
  /** When this was fetched, so a stale copy can be told from a fresh one. */
  fetchedAt: number
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

/**
 * A year on the shelf (docs/06 M19 #8).
 *
 * Read off what the device already holds — the shelf with its `addedAt`, the
 * digs, the verdicts, the horizon — and nothing from the marketplace. What
 * arrived, where it came from, who shaped it, what Fidelity had to do with
 * it. The figures a catalogue app sells as a subscription, from CC0 fields.
 */
export interface YearReview {
  year: number
  /** Every year with an addition, newest first — the chips to switch between. */
  years: number[]
  /** Copies added this year, and the year before it, for the comparison. */
  added: number
  addedBefore: number
  /** January to December. */
  byMonth: number[]
  /** Artists whose first record on the shelf arrived this year. */
  newArtists: number
  newArtistNames: string[]
  artists: TasteFacet[]
  labels: TasteFacet[]
  styles: TasteFacet[]
  /** Pressing decades of this year's additions, chronological. */
  decades: TasteFacet[]
  media: TasteFacet[]
  oldest: ReviewRecord | null
  newest: ReviewRecord | null
  /** How many of the additions got four or five stars, and how many any at all. */
  loved: number
  rated: number
  digs: { runs: number; shops: number; finds: number; bought: number }
  /** People from the horizon who shaped this year's additions, most often first. */
  people: { name: string; n: number; role: string }[]
}

export interface ReviewRecord {
  releaseId: number
  title: string
  artist: string
  year: number
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

/**
 * Your wants, across the shops you scanned (docs/06 M19 #9).
 *
 * Waxrunner answers this over every seller on Discogs; this app can only
 * answer it over the shops it has scanned inside the six hours — and says so.
 * What it adds is the postage: three shops at €41 instead of five at €67,
 * from the same tier tables the basket uses.
 */
export interface WantPlan {
  /** How many records are on the wantlist at all. */
  wanted: number
  /** How many of them some scanned shop offers, in any currency, postage known or not. */
  available: number
  /** The currency the plan is in — the one most offers carry. Null without offers. */
  currency: string | null
  /** Offers left out because they are priced in another currency. */
  otherCurrencies: number
  /** Shops whose offers could not be planned: no postage table. Display names. */
  unknownPostage: string[]
  /** Wants only those shops have — seen, but not in the plan. */
  onlyWithoutPostage: number
  /** The cheapest set of shops that covers every plannable want. */
  best: PlannedShops | null
  /** Each want from wherever it is cheapest — the plan the best one beats. */
  naive: PlannedShops | null
  /** When the earliest dig behind this plan runs out (rule 4). */
  expiresAt: number | null
  /** How many shops had a dig inside the six hours. */
  shopsScanned: number
  /** Your country, for the "from …" chip. */
  home: string
  /** Shops with a fresh dig left out by the origin filter, including ones with no origin. */
  originLeftOut: number
}

export interface PlannedShops {
  shops: PlannedShop[]
  goods: number
  postage: number
  total: number
}

export interface PlannedShop {
  dealer: string
  displayName: string
  digId: string
  items: PlannedItem[]
  goods: number
  postage: number
  minOrderTotal: number
  belowMinimum: boolean
}

export interface PlannedItem {
  /** The wantlist entry this covers. */
  wantedReleaseId: number
  listingId: number
  releaseId: number
  title: string
  artist: string
  price: number
  /** False when it is another pressing of the wanted album. */
  exact: boolean
  /** Discogs' 0–5 for this want; the plan lists the important ones first. */
  want: number
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

/** The map's comparison line (M21.6): share here divided by share in the catalogue. */
export interface TasteComparison {
  build: string
  /** Facet key → lift; a decade's key is "1970", a style's or genre's its name. */
  decades: Record<string, number>
  styles: Record<string, number>
  genres: Record<string, number>
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
 * From this priority up a want is one of the ones you want most (M20 #1).
 *
 * Four and five, on Discogs' five. It changes what a find says and the order
 * of the wantlist and the plan — never the score, which stays comparable.
 */
export const WANT_MOST = 4

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
 * Ascending or descending.
 *
 * Each of the four keys used to have exactly one direction, and each was well
 * argued on its own — newest record first, earliest year first, because a
 * collection sorted by year is a timeline. Well argued does not mean right for
 * every question, though. Anyone wanting to know what has stood unplayed on
 * the shelf longest needs the same list the other way round.
 *
 * The previous direction stays the default per key (see
 * `DEFAULT_SHELF_DIRECTION`), so nothing changes until somebody turns it.
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Where a key starts when it is chosen for the first time.
 *
 * Not the same everywhere, and that is the point: for names you expect A–Z,
 * for everything else "the most interesting first" — the newest record, the
 * best rating. Only the year starts at the front, because a timeline runs
 * forwards.
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
 * Another name an artist answers to.
 *
 * `alias` covers Discogs' name variations and aliases alike — the same
 * person, a different spelling or a different project. `member` is somebody
 * in this group; `group` is a group this person is in. Names, not ids: the
 * inventory only ever gives a name.
 */
export interface Kin {
  name: string
  relation: 'alias' | 'member' | 'group'
}

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

  /**
   * Artists only — every other name the artist goes by, from `/artists/{id}`.
   *
   * The inventory hands over one string per listing and no id, and the
   * string is often not the name on the shelf: "Miss Dinky*" is Dinky, and
   * Holger Czukay's solo record is a Can record to somebody with five of
   * them. One request per artist buys the lexicon (docs/04 §S3, stage 0).
   *
   * `undefined` means the chunk predates the field; the staggered
   * revalidation treats that as due. An artist with nobody else stores `[]`.
   */
  kin?: Kin[]

  /**
   * When this chunk reached the hub — if it ever did.
   *
   * Without the field, the hub learns nothing about anything that was already
   * local when it was entered: `horizon/build.ts` skips fresh entries, and
   * with them the contribution. Measured 2026-08-13 — the hub stood at one
   * entry while hundreds sat locally, which made the shared cache dead for the
   * commonest case.
   *
   * `undefined` means "never yet", and that is exactly why the field needs no
   * version bump: an old record without it reads correctly.
   */
  sharedAt?: number
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
  /**
   * How far the stack (M15) has got in this dig.
   *
   * On the dig rather than in a store of its own: a second record per dig
   * would have to keep step with the first and would be orphaned the moment a
   * dig is cleared away. Absent on everything written before the stack — and
   * "absent" reads as "nothing seen yet", which is true.
   */
  stackSeen?: number
  /** Did the scan hit the 10k pagination wall? */
  truncated: boolean
  matchCount: number
  apiRequests: number
  /** Persisted after every page, so a closed tab does not mean starting over. */
  cursor: { page: number; order: 'asc' | 'desc' } | null
}

/**
 * One row of a shop's inventory — including the ones that match nothing.
 *
 * Until 2026-08-13 a dig kept only the matches; everything else went into the
 * fingerprint's counting and was thrown away. That left "what does this shop
 * actually have on Warp?" unanswerable — and unanswerable exactly when it is
 * interesting: for a label you own nothing by, there is by definition no
 * match.
 *
 * Why store it at all rather than fetch on demand: the inventory endpoint has
 * no label filter. The rows come past exactly once, while the scan runs.
 * Anyone not writing them down gets them back only through a complete second
 * scan — minutes and thousands of requests, which is precisely what rules 2
 * and 3 forbid.
 *
 * **Everything here is marketplace data, none of it is derived.** Unlike
 * `Match`, where the score and the signals are an appraisal and survive
 * expiry, nothing showable is left here after six hours. So these rows are
 * **deleted** with the dig rather than thinned out (rule 4).
 *
 * Kept narrow: measured on real rows at 198 bytes instead of 606, so about
 * 3.8 MB in the worst case of 20,000 — and those are gone after six hours.
 */
export interface StockRow {
  digId: string
  listingId: number
  releaseId: number
  /** Written exactly as in the fingerprint, so that the bar and the list mean
   *  the same set. */
  label: string | null
  /** `1990` for the nineties. Zero when Discogs does not know the year. */
  decade: number | null
  title: string | null
  artist: string | null
  catno: string | null
  format: string | null
  year: number | null
  condition: string | null
  price: number | null
  currency: string | null
}

/**
 * A find list, as it arrives at somebody else.
 *
 * A snapshot and not a link: the recipient has no dig, no collection and
 * perhaps not even a token. What they see is entirely inside this object — and
 * it is encrypted in transit, because the hub carrying it has no business with
 * it.
 *
 * `matchesTotal` travels along so that the snapshot does not claim the hundred
 * matches it carries were all of them.
 */
/**
 * What is behind a barcode (M13).
 *
 * `candidates` is deliberately a list: a barcode names a release and not a
 * pressing — measured 2026-09-11, eight releases across five countries for a
 * single barcode. Pretending to a single result would be a promise the data
 * does not cover.
 *
 * `owned` and `wanted` answer the question somebody is standing in the shop
 * for, and come from the **local** database — which costs nothing and works
 * when the connection has gone again.
 */
export interface Identified {
  barcode: string
  candidates: {
    releaseId: number
    title: string
    year: number | null
    country: string
    thumbUrl: string
    format: string
    /** The first label and its catalogue number — what is printed on the record. */
    label: string
    catno: string
    /** 0 when Discogs has no master for it. */
    masterId: number
  }[]
  owned: CollectionItem[]
  wanted: WantlistItem[]
  /**
   * Another pressing of the same album on the shelf or the wantlist (M20 #3).
   *
   * Found through the master every search row carries (measured 2026-09-11,
   * eight of eight rows). Only records that are not already in `owned` or
   * `wanted` by their exact id — the same line S2 draws beside S1.
   */
  ownedAlbums: CollectionItem[]
  wantedAlbums: WantlistItem[]
}

/**
 * The pressing in your hand, placed among all the others (docs/06 M19 #7).
 *
 * M7 reads a pressing off `/releases/{id}` for the top finds of a dig, and
 * the year it compares against comes from the horizon — so it reaches as far
 * as the collection does. A record identified in a shop is usually beyond
 * that. This is the same reading with the album's own versions list beside
 * it: one `/masters/{id}/versions` sorted by release date says how many
 * pressings exist, which came first, and where this one stands.
 *
 * Facts only, no marketplace data: nothing here expires.
 */
export interface PressingFamily {
  releaseId: number
  masterId: number | null
  profile: PressingProfile
  warnings: PressingWarning[]
  /** How many pressings the album has, per Discogs. 0 without a master. */
  total: number
  /** The earliest year any pressing carries, or null when none has one. */
  firstYear: number | null
  /** Pressings from that first year, this one's medium first. At most six. */
  first: PressingSibling[]
  /** Whether this pressing is among them. */
  amongFirst: boolean
}

/**
 * The CC0 half of a pressing family, as the hub caches it (M20 #7).
 *
 * What `/masters/{id}/versions` says about an album: how many pressings, and
 * the first page of them, earliest first. No prices, nothing that expires —
 * pressings are added, never taken away, so thirty days is plenty.
 */
export interface PressingFamilyFacts {
  masterId: number
  total: number
  siblings: PressingSibling[]
  fetchedAt: number
}

export interface PressingSibling {
  releaseId: number
  year: number | null
  country: string
  label: string
  catno: string
  format: string
}

/**
 * A place where records stand (M12).
 *
 * Stored flat with a pointer upwards rather than nested: "everything under
 * the cellar" becomes a question about one field instead of a walk through a
 * tree, and a move changes a pointer instead of a subtree.
 *
 * **Three levels, and nobody builds more.** Room → furniture → compartment.
 * Anyone needing a fourth names their compartment more fully.
 */
/**
 * What a place is (M27, ADR-015).
 *
 * A room holds units; a unit is a piece of furniture with a grid of
 * compartments; a compartment holds records. Rows from before M27 carry no
 * kind and are rooms. A unit may stand at the top level — not everybody
 * wants to name the room first.
 */
export type PlaceKind = 'room' | 'unit' | 'compartment'
/** How a unit is drawn: a wall of cubes, or one open box. */
export type UnitShape = 'shelf' | 'crate' | 'box' | 'pile'
/**
 * The order inside a unit (M27.2). A rule proposes where a record goes and
 * never moves one by itself; an explicit placement always wins.
 */
export type PlaceRule = 'artist' | 'label' | 'year' | 'added' | 'manual'
/** What the walls are made of (M27.1b) — drawn with CSS, never loaded. */
export type FinishMaterial =
  'white' | 'black' | 'birch' | 'oak' | 'walnut' | 'steel' | 'cardboard'
export interface Finish {
  material: FinishMaterial
  /** Kallax walls are thick, USM tubes and Tylko plywood thin. */
  thickness: 'thin' | 'medium' | 'thick'
  /** A hex colour where the furniture has one — USM panels, stocubo cubes — or none. */
  colour: string | null
}

export interface Place {
  id: string
  name: string
  /** `null` is the topmost level — living room, cellar, loft. */
  parentId: string | null
  /** Absent on rows from before M27, which are rooms. */
  kind?: PlaceKind
  shape?: UnitShape
  /** On a unit: how many compartments across and down. */
  grid?: { columns: number; rows: number }
  /** On a compartment: where in the unit's grid, zero-based, A1 is `{0, 0}`. */
  slot?: { column: number; row: number }
  /** Records this compartment holds comfortably; `null` for a pile. An estimate, not a lock. */
  capacity?: number | null
  /** On a unit: how it looks. Absent means white and thick, a Kallax. */
  finish?: Finish
  /** On a unit (M27.2): what the compartments are sorted by. */
  rule?: PlaceRule
  /**
   * On a unit (M28 #3): how "sort in" deals. `even` spreads the records
   * across every compartment; `front` fills each to a comfortable share of
   * its capacity before starting the next, so a small collection stands in
   * two cubes and the rest waits empty. Absent means `even`.
   */
  dealing?: PlaceDealing
  /**
   * On a compartment (M27.2): the divider. `from` and `to` are sort keys the
   * rule can compare, `label` is what the wall shows — "A–Bo", "1965–1972".
   */
  range?: { from: string; to: string; label: string }
  createdAt: number
  /**
   * Last touched — renamed, moved, dissolved.
   *
   * The vault decides per row by the more recent write
   * (`worker/vault/merge.ts`). Without this stamp, a renamed shelf would be
   * settled by chance: `createdAt` is identical on both devices. Absent on
   * rows from before the vault was connected; `createdAt` applies there.
   */
  updatedAt?: number
  /**
   * Dissolved — and still here all the same (M12, vault).
   *
   * A tombstone instead of a deletion. The merge knows only "this row is
   * newer"; a genuinely deleted row is not a message to it but a gap, and the
   * other device fills it in again next time. A dissolved shelf would come
   * back.
   *
   * The filtering happens in `worker/places.ts`, and only there — no other
   * module reads this store.
   */
  removedAt?: number | null
}

/**
 * Where a **copy** sits — not a release.
 *
 * On the `instanceId`, because two pressings of the same record sit in two
 * places. Pinned to the release, the second would be unfindable.
 *
 * **A store of its own, not a field on the collection row.** The sync rewrites
 * every row with `put()` (`worker/sync/library.ts`) — a location kept there
 * would be gone after the next full pass, and silently so. Looked up on
 * 2026-09-11, not assumed.
 */
export interface Placement {
  instanceId: number
  /**
   * `null` means "sits nowhere" — as a **statement**, not as a missing row.
   *
   * Taking a record down used to be a `delete`. Through the vault that would
   * be the wrong message: the other device still knows the row, holds it
   * valid, and puts the record back on the shelf it no longer sits on. A
   * `null` with a fresh `at` wins every comparison instead.
   *
   * As a side effect the row drops out of the `by-place` index: `null` is not
   * a valid key, so IndexedDB does not take it in at all.
   */
  placeId: string | null
  at: number
}

/** A place with what the interface needs to know about it. */
export interface PlaceNode extends Place {
  /** Records directly here — not counting those in places below. */
  records: number
  /** And counting them, because "in the cellar" means the whole cellar. */
  recordsBelow: number
  depth: number
  /** Up to three cover addresses of what is directly here, for the wall's cubes. */
  covers: string[]
}

/**
 * What sorting a unit by its rule would do (M27.2). A proposal: nothing
 * moves until `places.apply` — an explicit placement always wins until then.
 */
export type PlaceDealing = 'even' | 'front'

export interface UnitPlan {
  unitId: string
  rule: PlaceRule
  dealing: PlaceDealing
  /** Every record that would change compartment, with where from and where to. */
  moves: { instanceId: number; from: string | null; to: string }[]
  /** Records that would come in from the pile of the unplaced. */
  fromPile: number
  /** How many the unit would hold afterwards. */
  total: number
  /** The dividers the wall would show. */
  ranges: { placeId: string; from: string; to: string; label: string; count: number }[]
}

/**
 * A record that is being watched (M11).
 *
 * **Why a selection and not the whole collection:** `/marketplace/stats/`
 * costs one request per release per round. Fifty records are a minute with a
 * token, five hundred are ten — and doing that daily would have exactly the
 * shape rule 2 forbids. You watch what you would sell, and what you are
 * really after.
 *
 * `kind` says which direction it is being watched from, and that changes the
 * message: on a record you own, a **rising** price is the news; on one you
 * want, a **falling** one.
 */
export interface WatchedRelease {
  releaseId: number
  kind: 'shelf' | 'wantlist'
  artist: string
  title: string
  since: number
  /**
   * The threshold at which it is worth saying something.
   *
   * On `shelf` a rise in percent, on `wantlist` a price in the device's
   * currency. With no threshold nothing is reported — a watcher that calls out
   * at every wobble gets switched off.
   */
  threshold: number | null
  /**
   * What was measured last, oldest first.
   *
   * A history and not just the latest value: 40 to 95 is news, 40 to 44 is
   * noise, and you can only see that from two points. Capped, because a record
   * is watched over years and nobody reads three hundred measurements.
   */
  points: WatchPoint[]
  /** When it was last looked up — null means: never yet. */
  checkedAt: number | null
  /** What was last reported, so the same message does not arrive twice. */
  notifiedAt: number | null
  /**
   * Offers from our own digs that are demonstrably gone (M11).
   *
   * So that the same copy does not cost a request on every pass — and so that
   * the same message does not arrive twice. Absent on rows created before this
   * field existed; that is not a schema break but an empty history.
   */
  goneOffers?: number[]
}

export interface WatchPoint {
  at: number
  /** Zero when nobody is offering it right now — a statement, not a gap. */
  lowestPrice: number | null
  currency: string | null
  numForSale: number
}

/**
 * A shop in the top row of the stack.
 *
 * The coloured ring is `matches - seen > 0` and nothing else — not a second
 * truth about whether there is "something new", but the same number the stack
 * itself works through.
 */
/**
 * One stand at a record fair (M19 #4): the newest dig of a shop scanned in
 * the last day, expired or not. See `worker/stands.ts`.
 */
export interface Stand {
  dealer: string
  displayName: string
  avatarUrl?: string
  digId: string
  scannedAt: number
  expiresAt: number
  matches: number
  status: DigStatus
}

export interface StackShop {
  dealer: string
  displayName: string
  avatarUrl?: string
  digId: string
  scannedAt: number
  expiresAt: number
  matches: number
  seen: number
}

export interface SharedDig {
  version: number
  dealer: string
  scannedAt: number
  /** The dig's clock, not the sharing's — otherwise a find list five hours
   *  old would end up eleven hours old (rule 4). */
  expiresAt: number
  coverage: number
  listingsTotal: number
  matchesTotal: number
  matches: Match[]
}

/** Up to this many pressings an album is rare enough to say so on a find (M20 #6). */
export const FEW_PRESSINGS = 5

export interface Match {
  digId: string
  listingId: number
  releaseId: number
  /**
   * How many pressings the album has, per the horizon at scan time (M20 #6).
   *
   * Catalogue, not marketplace: it does not expire. Absent on matches from
   * before, and null when the horizon did not know the album.
   */
  pressings?: number | null

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
   * Audio previews for this record — YouTube addresses from Discogs (ADR-012).
   *
   * They come along with the lookup on the top matches, so they cost nothing
   * extra. Absent on everything below that, and on records nobody has entered
   * anything for; both mean "no sound", not "error".
   *
   * The addresses only. Nothing plays until somebody has thrown the switch
   * **and** then tapped — before that, no byte goes to Google.
   */
  videos?: { title: string; uri: string }[]
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

/**
 * Every marketplace field of a match, i.e. exactly what expiry has to null.
 *
 * Title, artist, label, catalogue number, format and year are **not** on
 * this list since 2026-09-12. They stood here from M1, and after six hours a
 * find turned into "Release 3189681" with an empty sheet — a rail of numbers
 * on the start screen, reported with a screenshot. They are catalogue facts
 * about the release, the same words the collection and the CC0 dump carry,
 * not the marketplace content the six-hour rule is about (docs/09 §1.1: the
 * rule locks price and condition). What the listing itself says — condition,
 * sleeve, price, seller comments, the market statistics, the listing's own
 * image address — is what goes. `tests/unit/export.spec.ts` names the same
 * set as Restricted Data, which is the other side of the same line.
 */
export const MARKETPLACE_FIELDS = [
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

/**
 * What the find list needs to say what a record costs with its postage.
 *
 * One per shop, read once per dig and again whenever the basket changes —
 * the tiers for the reader's country, where they came from, and how many
 * records are already going in this shop's parcel. See `shared/shipping.ts`.
 */
export interface LandedContext {
  dealer: string
  /** Empty when nobody knows this shop's postage. */
  tiers: ShippingTier[]
  source: ShippingTier['source'] | null
  /** The destination heading the rates were read under, when the text had one. */
  section: string | null
  /** Live lines already in this shop's basket. */
  inBasket: number
  /** Their listing ids — a record already in the parcel does not pay twice. */
  listingIds: number[]
  /** The tiers' currency; a listing priced in another gets no number. */
  currency: string | null
}

/** A record's price plus the postage it adds to the parcel. */
export interface LandedPrice {
  total: number
  postage: number
  currency: string
  /** Which record in the parcel this would be. */
  items: number
  source: ShippingTier['source'] | null
}

/**
 * A band you have on your radar and own nothing by.
 *
 * Asked for by a tester on 2026-09-13: "Exit North — I think they are great,
 * have no record by them, but I would like to be shown one if it turns up."
 * Nothing in the app could carry that. S3 matches against the taste profile,
 * which is computed from the collection alone, and the horizon expands
 * wantlist *masters* rather than wantlist artists — so a band you own nothing
 * by does not exist for the engine. Putting one record on the wantlist finds
 * that record and other pressings of that album, and no other album.
 *
 * Stored rather than derived, and with the id rather than the name: the name
 * is what somebody typed, the id is what the horizon expands and what survives
 * Discogs renaming an act.
 */
export interface FollowedArtist {
  artistId: number
  /** As Discogs spells it, which is what the horizon and the sentence use. */
  name: string
  followedAt: number
  /** Last touched, which is what a merge between two devices compares. */
  updatedAt?: number
}

/**
 * The round: one visit to every watched shop, in one go.
 *
 * Its own small record rather than a reading over the digs it made, because
 * those do not survive it: five digs are kept (docs/03 §5), so a round over
 * ten shops loses the first five find lists before it is finished. This is
 * what is left — which shop had something, and what the best of it was.
 */
export interface RoundStop {
  dealer: string
  displayName: string
  /** The dig this stop made, while it is still one of the five kept. */
  digId: string | null
  /** How many listings the shop had put up since the last visit. */
  newListings: number
  matches: number
  /** Named, not referenced: the dig may be gone by the time this is read. */
  best: { artist: string; title: string; score: number } | null
  /**
   * `never-dug` is not a failure. "Only what is new" needs a line to stop at,
   * and a shop nobody has dug yet has none — a full dig is two hundred
   * requests and is somebody's decision, not a round's.
   */
  status: 'found' | 'nothing' | 'never-dug' | 'failed'
}

export interface RoundSummary {
  startedAt: number
  finishedAt: number | null
  requests: number
  stops: RoundStop[]
}

export interface RoundProgress {
  done: number
  total: number
  /** The shop being visited this second, so the wait has a subject. */
  dealer: string | null
  /** Finds so far, across every shop of this round. */
  found: number
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
   * The newest listing a dig has seen here — ISO 8601.
   *
   * The anchor for "only what is new". `sort=listed&sort_order=desc` hands the
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
  /**
   * When somebody said "never show this one again" (M19 #2), or null.
   *
   * A hidden shop is left out of every list the app draws and is no longer
   * watched. A dig started by name still runs and brings it back. Absent on
   * rows written before this existed, which reads as "not hidden".
   */
  hiddenAt?: number | null
  /** `num_for_sale` at the last check — the whole change detector. */
  watchNumForSale?: number | null
  watchCheckedAt?: number | null
  /** Last touched, which is what a merge between two devices compares. */
  updatedAt?: number
  /**
   * The shop sign, where the shop has set one.
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
  /** When this line was opened at Discogs on the way to its cart (M20 #9). */
  atDiscogsAt?: number | null
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
  /**
   * When the listing was opened at Discogs on the way to its cart (M20 #9).
   * The cart itself is not in the API; this is the memory of which of the
   * ten links have been tapped, so the hand-over can be picked up again.
   */
  atDiscogsAt?: number | null
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
  /**
   * How the record arrived, where it was asked and answered (M14).
   *
   * Filled only on bought rows. A saved list has no arrival.
   */
  arrived: 'as-described' | 'better' | 'worse' | null
}

export interface MarkedOverview {
  groups: { dealer: string | null; records: MarkedRecord[]; open: number }[]
  bought: MarkedRecord[]
  total: number
  stillOpen: number
}

/**
 * How honestly a shop grades — out of one's own purchases (M14).
 *
 * `rate` is `null` while too few records have been judged: two out of two is
 * 100 %, and that reads like a verdict on a shop one knows nothing about.
 */
export interface GradingRecord {
  dealer: string
  judged: number
  asDescribed: number
  better: number
  worse: number
  /** The share of "as described or better", or null when there are too few. */
  rate: number | null
}

/**
 * What came out of reading an order (M14).
 *
 * `added` and `enriched` kept apart, because they are two different messages:
 * "three records newly entered" and "three records you had already saved are
 * now marked as bought".
 */
export type OrderImport =
  | { ok: false; reason: 'shape' }
  | {
      ok: true
      dealer: string | null
      /** The purchase date from the order — the ripening time hangs off it. */
      at: number
      added: number
      enriched: number
      records: { listingId: number; title: string | null; artist: string | null }[]
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
  /**
   * How the record arrived, against what was promised (M14).
   *
   * **The verdict only, never the promised grade.** That would be Discogs
   * content, and it may not be shown after six hours (`docs/09` §1.1). A
   * comparison, by contrast, is **derived** data — the same category as scores
   * and the dealer fingerprint, and those may stay.
   *
   * This is the gap Discogs structurally does not close: feedback there
   * measures "quality of transaction" and says nothing about grading accuracy;
   * negative ratings for overgrading are removed on the seller's complaint.
   * What is built here is not a rating of somebody else, but a private record
   * of one's own purchases.
   */
  arrived?: 'as-described' | 'better' | 'worse' | null
  arrivedAt?: number | null
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
 * One day of Discogs' estimate, kept (M19 #3).
 *
 * Discogs keeps no history of the number it shows — the most reliable hook in
 * every collecting app (Collectr, BrickEconomy, Vizcogs) is a line that goes
 * up and to the right, and here it is drawn from what this device saw. One row
 * per day, the latest fetch of the day wins. The three strings are exactly as
 * they came; the cents beside them are parsed for the chart and `null` where
 * the string could not be read, so the line has a gap rather than a lie.
 *
 * Stays on this device and in the JSON backup. An aggregate of your own
 * collection, never per record, never anybody else's.
 */
export interface ValuePoint {
  /** ISO day, `YYYY-MM-DD`, in the device's local time — the key. */
  day: string
  minimum: string
  median: string
  maximum: string
  minimumCents: number | null
  medianCents: number | null
  maximumCents: number | null
  /** The account's currency at the time, from the preferences. */
  currency: string
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
