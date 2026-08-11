import { DIG_TTL_MS, pruneDigs } from '~~/db/expire'
import { getPreferences } from '~~/db/meta'
import { openFidelityDb, type FidelityDatabase } from '~~/db/open'
import type { Dig, Match } from '#shared/types'
import type { ScanProgress } from '#shared/protocol'

import type { DiscogsClient } from '../discogs/client'
import { dealerSchema, inventoryPageSchema, toListing } from '../discogs/inventory'
import { buildIndex, evaluate, type MatchFilters, type MatchIndex } from '../match'

import { NearMissAccumulator, type NearMiss } from '../horizon/nearmiss'
import { blankDealer } from '~~/db/dealer'

import { FingerprintAccumulator, matchesPerThousand } from './fingerprint'

export const PER_PAGE = 100

/**
 * The pagination wall: page 101 of a foreign inventory answers 403, and
 * `pagination.pages` cheerfully claims otherwise (docs/01 RB-3).
 */
export const MAX_PAGES = 100

/** asc and desc give two disjoint windows, so up to 20.000 listings. */
export const REACHABLE = PER_PAGE * MAX_PAGES * 2

/**
 * Wie man an einem Laden vorbeikommt, der mehr als 20.000 Platten hat.
 *
 * The wall is on the page number, not on the offset — `page=101` is 403 no
 * matter how small `per_page` is, and `per_page` itself is clamped to 100
 * (measured 2026-08-10, docs/02). So one ordering can never yield more than
 * 10.000, and the only lever left is to ask for a *different* ordering.
 *
 * Discogs accepts eight sort keys; seven of them work on a foreign inventory
 * (`status` is ignored there). Each one puts different records in the first
 * 10.000, so each pass is a different window onto the same shop.
 *
 * The order here is the order they run in, and it is by usefulness, not by
 * coverage: `listed` first because the newest stock is what somebody wants,
 * `price` next because the cheap end is where finds hide. The alphabetical
 * ones come last — `artist`, `label` and `catno` sort the same records almost
 * the same way, so each adds less than the one before.
 */
export const SCAN_PASSES = [
  { sort: 'listed', order: 'asc' },
  { sort: 'listed', order: 'desc' },
  { sort: 'price', order: 'asc' },
  { sort: 'price', order: 'desc' },
  { sort: 'audio', order: 'desc' },
  { sort: 'item', order: 'asc' },
  { sort: 'item', order: 'desc' },
  { sort: 'artist', order: 'asc' },
  { sort: 'artist', order: 'desc' },
  { sort: 'label', order: 'asc' },
  { sort: 'label', order: 'desc' },
  { sort: 'catno', order: 'asc' },
  { sort: 'catno', order: 'desc' },
] as const

export type ScanPass = (typeof SCAN_PASSES)[number]

/**
 * What an ordinary dig walks: one ordering, both ends.
 *
 * These two must stay first and stay in this order — `dig.cursor` records
 * `order` rather than a pass index, so a dig interrupted before the deep scan
 * existed still resumes into the right half.
 */
export const NORMAL_PASSES = SCAN_PASSES.slice(0, 2)

/**
 * What an incremental visit runs: newest first, and only that far.
 *
 * `listed desc` is the one ordering where stopping early is sound — everything
 * after the first already-known listing is older still. Any other key would
 * have to walk the whole shop to be sure it had seen the new records.
 */
export const SINCE_PASSES = [SCAN_PASSES[1]!] as const

/**
 * When an incremental visit counts what it finds.
 *
 * Normally the newest listing the last dig actually saw. Shops scanned before
 * that was recorded fall back to when they were last walked, minus an hour:
 * the scan itself takes minutes, and a record listed while it ran would sit
 * just under a finish-time anchor and never be seen again. An hour of slack
 * costs a handful of records read twice — writing a match twice is idempotent
 * — and it is the difference between the feature working on every shop today
 * and only on shops dug from today on.
 */
const ANCHOR_SLACK_MS = 60 * 60 * 1000

export function anchorFor(
  dealer: { newestListedAt?: string | null; lastScannedAt: number | null } | undefined,
): string | null {
  if (!dealer) return null
  if (dealer.newestListedAt) return dealer.newestListedAt
  if (dealer.lastScannedAt === null) return null
  return new Date(dealer.lastScannedAt - ANCHOR_SLACK_MS).toISOString()
}

/** Roughly one request every 1.2 s, which is what the pacer enforces. */
const MS_PER_REQUEST = 1200

/**
 * The dig this worker is scanning right now, if any.
 *
 * A record in status 'scanning' means one of two very different things: a run
 * that died with its tab, or one that is in flight this second. The database
 * cannot tell them apart — but the worker can, because a freshly started
 * worker is by definition not scanning anything. Without this, opening the
 * page mid-scan offers to "resume" the run that is already going, and
 * accepting would put two scans on the same rate limit.
 */
let running: string | null = null

/*
 * Re-exported rather than declared twice.
 *
 * There were two of these — one here, one in the protocol — and they agreed
 * only because nobody had changed either. Adding `unique` to this one left the
 * page compiling against a shape without it, which is the whole reason the
 * protocol exists in `shared/`.
 */
export type { ScanProgress }

export interface ScanOptions {
  client: DiscogsClient
  report?: (progress: ScanProgress) => void
  signal?: AbortSignal
  now?: () => number
}

interface ScanContext {
  client: DiscogsClient
  db: FidelityDatabase
  index: MatchIndex
  nearMisses: NearMissAccumulator
  filters: MatchFilters
  report?: (progress: ScanProgress) => void
  signal?: AbortSignal
  now: () => number
  /** The newest listing a previous dig saw here; only a 'neu' run reads it. */
  since?: string | null
}

async function prepare({
  client,
  report,
  signal,
  now = Date.now,
}: ScanOptions): Promise<ScanContext> {
  const db = await openFidelityDb()
  const preferences = await getPreferences()

  const [collection, wantlist, taste, chunks] = await Promise.all([
    db.getAll('collection'),
    db.getAll('wantlist'),
    db
      .get('meta', 'tasteProfile')
      .then((row) => (row?.key === 'tasteProfile' ? row.value : null)),
    // The horizon. Empty before it is built, and everything still works —
    // just with three signals instead of eight.
    db.getAll('horizon'),
  ])

  const index = buildIndex(collection, wantlist, taste, chunks)

  return {
    client,
    db,
    index,
    // Stage two of the master/release two-step (docs/11 §4). Collected while
    // the scan runs and expanded afterwards, one request each.
    nearMisses: new NearMissAccumulator(index.horizon, collection, wantlist, chunks),
    filters: {
      formatsAllow: preferences.formatsAllow,
      maxPrice: preferences.maxPrice,
      shipsFromBlock: preferences.shipsFromBlock,
      prefMediaCondition: preferences.prefMediaCondition,
      targetPrice: preferences.targetPrice,
    },
    report,
    signal,
    now,
  }
}

/**
 * Walks the inventory from wherever `dig.cursor` left off.
 *
 * A fresh dig starts at asc page 1; a resumed one at the page after the last
 * one that was fully written. Matches are keyed by [digId, listingId], so a
 * page written twice is idempotent — which matters, because "resume" has to be
 * safe even when the interruption happened mid-page.
 */
/**
 * What the last dig noticed the horizon was missing.
 *
 * Module state rather than a return value because `runDig` and `resumeDig`
 * both promise a `Dig` and the protocol is typed on that. It is read once,
 * immediately after the scan, by the same worker that wrote it.
 */
let pendingNearMisses: NearMiss[] = []

export function takeNearMisses(): NearMiss[] {
  const found = pendingNearMisses
  pendingNearMisses = []
  return found
}

async function walk(dig: Dig, ctx: ScanContext): Promise<Dig> {
  const { client, db, index, filters, report, signal, now } = ctx

  let scanned = dig.listingsScanned
  let matches = dig.matchCount
  let requests = dig.apiRequests

  // Built while the listings stream past. Keeping them to compute this
  // afterwards would mean holding 40 MB of inventory for a few percentages.
  const fingerprint = new FingerprintAccumulator()
  const { nearMisses } = ctx

  /*
   * Which listings this run has actually laid eyes on.
   *
   * A shop between 10.000 and 20.000 is walked from both ends and the two
   * windows overlap in the middle; a deep scan walks the same record in up to
   * thirteen orderings. `scanned` counts rows and cannot answer "how much of
   * this shop have I seen" — this can, exactly, because listing ids are unique
   * and the dealer profile said how many there are.
   *
   * Seeded from the record on a resume rather than rebuilt: the ids from
   * before the interruption are gone, and re-walking half an hour of pages to
   * recover them would cost more than the small overcount it prevents.
   */
  const seen = new Set<number>()
  let unique = dig.uniqueSeen ?? 0

  const passes =
    dig.depth === 'deep' ? SCAN_PASSES : dig.depth === 'neu' ? SINCE_PASSES : NORMAL_PASSES

  /**
   * Das neueste Angebot, das dieser Lauf gesehen hat.
   *
   * Written to the dealer at the end, and read by the *next* "nur das Neue"
   * visit as the line to stop at. Kept as the string Discogs sent rather than
   * a parsed date: it is only ever compared to another one of its own kind,
   * and ISO 8601 with an offset does not compare as a string across offsets.
   */
  let newestSeen: string | null = null

  /** Where a "nur das Neue" run stops. Null on every other kind. */
  const anchor = dig.depth === 'neu' ? (ctx.since ?? null) : null
  let reachedKnown = false

  const emit = (passIndex: number, order: 'asc' | 'desc') => {
    const reachable = Math.min(dig.listingsTotal, PER_PAGE * MAX_PAGES * passes.length)
    const remaining = Math.max(0, reachable - unique) / PER_PAGE
    report?.({
      status: dig.status,
      scanned,
      total: dig.listingsTotal,
      reachable,
      matches,
      requests,
      order,
      unique,
      pass: passLabel(passes[passIndex] ?? passes[0]!),
      passIndex,
      passCount: passes.length,
      etaMs: Math.round(remaining * MS_PER_REQUEST),
    })
  }

  const startOrder = dig.cursor?.order ?? 'asc'
  const startPage = dig.cursor ? dig.cursor.page + 1 : 1

  emit(0, startOrder)

  for (const [passIndex, pass] of passes.entries()) {
    // A resumed dig skips whatever it already finished. The cursor records the
    // *order*, not a pass number, because it predates the deep scan — which is
    // also why the two ordinary passes have to stay first in the list.
    if (passIndex === 0 && startOrder === 'desc') continue

    /*
     * Every pass after the first is a second look at the same shop through a
     * different ordering. Below the wall there is nothing for it to find: one
     * pass already returned every record, so the rest would be 100 requests
     * each for a set that cannot grow.
     */
    if (passIndex > 0 && dig.listingsTotal <= PER_PAGE * MAX_PAGES) break

    const from = passIndex < NORMAL_PASSES.length && pass.order === startOrder ? startPage : 1
    let freshThisPass = 0

    for (let page = from; page <= MAX_PAGES; page++) {
      signal?.throwIfAborted()

      const response = await client.get(
        `/users/${encodeURIComponent(dig.dealer)}/inventory`,
        inventoryPageSchema,
        {
          query: { page, per_page: PER_PAGE, sort: pass.sort, sort_order: pass.order },
          signal,
        },
      )
      requests += 1

      const fresh: Match[] = []
      for (const row of response.listings) {
        /*
         * The line between "new since last time" and "was already here".
         *
         * `sort=listed&sort_order=desc` hands the shop back newest first, so
         * the first listing that is not newer than the anchor means every one
         * after it is older too. Breaking here rather than filtering is the
         * whole point: it is what turns two hundred requests into one.
         *
         * A listing without a `posted` is treated as new. Discogs has always
         * sent one; if that ever changes, over-reporting a few records is a
         * better failure than silently stopping the scan at the first gap.
         */
        if (anchor !== null && row.posted && Date.parse(row.posted) <= Date.parse(anchor)) {
          reachedKnown = true
          break
        }

        scanned += 1
        if (
          row.posted &&
          (newestSeen === null || Date.parse(row.posted) > Date.parse(newestSeen))
        )
          newestSeen = row.posted

        if (!seen.has(row.id)) {
          seen.add(row.id)
          unique += 1
          freshThisPass += 1
        }

        // The status filter is ignored for foreign inventories, so it is
        // applied here (docs/02).
        if (row.status && row.status !== 'For Sale') continue

        const listing = toListing(row)
        fingerprint.add(listing)
        nearMisses.add(listing)

        const result = evaluate(listing, index, filters)
        if (!result) continue

        fresh.push({
          digId: dig.id,
          listingId: listing.listingId,
          releaseId: listing.releaseId,
          score: result.score,
          signals: result.signals,
          title: listing.title,
          artist: listing.artist,
          label: listing.label,
          catno: listing.catno,
          format: listing.format,
          year: listing.year,
          condition: listing.condition,
          sleeve: listing.sleeve,
          price: listing.price,
          currency: listing.currency,
          comments: listing.comments,
          thumbUrl: listing.thumbUrl,
          marketLowestPrice: null,
          marketNumForSale: null,
          expired: false,
        })
      }

      if (fresh.length > 0) {
        const tx = db.transaction('matches', 'readwrite')
        for (const match of fresh) await tx.store.put(match)
        await tx.done
        matches += fresh.length
      }

      // Written after every page, so an interruption costs one page rather
      // than the run. The raw listings are dropped here — 20.000 of them
      // would be 40 MB of nothing.
      dig.listingsScanned = scanned
      dig.matchCount = matches
      dig.apiRequests = requests
      dig.uniqueSeen = unique
      dig.coverage = dig.listingsTotal > 0 ? Math.min(1, unique / dig.listingsTotal) : 0
      // A deep scan is not resumed — see `resumeDig`. Leaving the cursor null
      // is what says so, rather than a second field that could disagree.
      dig.cursor = dig.depth === 'deep' ? null : { page, order: pass.order }
      await db.put('digs', dig)

      emit(passIndex, pass.order)

      if (reachedKnown) break
      if (response.listings.length < PER_PAGE) break
      if (page >= response.pagination.pages) break
    }

    if (reachedKnown) break

    /*
     * Loop until dry, rather than to a fixed number of passes.
     *
     * A pass that walked its hundred pages and turned up nothing this run has
     * shown that this ordering is exhausted, and the alphabetical ones that
     * follow are the most correlated of the set — they would spend another
     * twelve minutes on the same records. The two ordinary passes are exempt:
     * asc finding nothing new is normal on a small shop, where desc never runs
     * anyway.
     */
    if (passIndex >= NORMAL_PASSES.length && freshThisPass === 0) break
  }

  /*
   * A "nur das Neue" run is complete by construction: it stopped at the line
   * where the known stock begins, so it saw every listing that was new. Its
   * denominator is therefore what it found, not what the shop holds — the
   * shop's total lives on the dealer record, where it is not a coverage claim.
   */
  if (dig.depth === 'neu') {
    dig.listingsTotal = unique
    dig.coverage = 1
    dig.truncated = false
  }

  dig.status = 'done'
  dig.finishedAt = now()
  dig.cursor = null
  await db.put('digs', dig)
  await saveDealer(ctx, dig, fingerprint, newestSeen)
  await pruneDigs(db)

  // What this dig taught the horizon. Handed back rather than acted on here:
  // the scan's job is over, and paying for it is a decision the caller makes
  // (and reports on) as its own phase.
  pendingNearMisses = nearMisses.build()

  emit(passes.length - 1, 'desc')
  return dig
}

/**
 * Which ordering a deep scan is on, for the progress line.
 *
 * The Discogs sort keys themselves rather than translated words. That is not
 * laziness: this is the only string the worker still puts on screen, it is a
 * technical name for a technical thing, and giving it a language would mean
 * carrying a language into the scanner for seven words nobody reads twice.
 */
const SORT_LABELS: Record<ScanPass['sort'], string> = {
  listed: 'listed',
  price: 'price',
  audio: 'audio',
  item: 'title',
  artist: 'artist',
  label: 'label',
  catno: 'catalogue number',
}

function passLabel(pass: ScanPass): string {
  return `${SORT_LABELS[pass.sort]} ${pass.order === 'asc' ? '↑' : '↓'}`
}

/**
 * Claims the scanning slot. Check and set sit in the same synchronous block on
 * purpose: split by an await, two callers both pass the check before either
 * sets it, and two scans end up sharing one rate limit.
 */
function acquire(digId: string): void {
  if (running !== null) {
    throw new DigNotResumable(
      running === digId ? 'this dig is already running' : 'another dig is already running',
    )
  }
  running = digId
}

async function walkExclusively(dig: Dig, ctx: ScanContext): Promise<Dig> {
  try {
    return await walk(dig, ctx)
  } finally {
    running = null
  }
}

export class NoAnchorYet extends Error {}

export async function runDig(
  options: ScanOptions & { dealer: string; digId: string; depth?: 'normal' | 'deep' | 'neu' },
): Promise<Dig> {
  // Claimed before the pre-check, so a second start cannot slip in during it.
  acquire(options.digId)

  let ctx: ScanContext
  try {
    ctx = await prepare(options)
  } catch (error) {
    running = null
    throw error
  }
  const startedAt = ctx.now()
  const known = await ctx.db.get('dealers', options.dealer)

  /*
   * A "nur das Neue" visit spends no request finding out what it already
   * knows. The shop's total and the line where its new stock begins are both
   * on the dealer record, put there by the full dig that has to come first —
   * so this kind of run costs exactly the pages it reads, usually one.
   */
  const incremental = options.depth === 'neu'
  const anchor = anchorFor(known)
  if (incremental && !anchor) {
    running = null
    throw new NoAnchorYet('no earlier dig for this shop to attach to')
  }

  let total = known?.numForSale ?? 0
  if (!incremental) {
    // Pre-check. One request buys an honest answer up front instead of a
    // surprise at page 101.
    const profile = await ctx.client
      .get(`/users/${encodeURIComponent(options.dealer)}`, dealerSchema, { signal: ctx.signal })
      .catch((error: unknown) => {
        running = null
        throw error
      })

    total = profile.num_for_sale ?? 0

    /*
     * Das Ladenschild, sobald es vorbeikommt.
     *
     * Written here rather than threaded through to the end of the dig, because
     * this is the one moment the profile is in hand — and a scan that is
     * cancelled four minutes later should still have learned what the shop
     * looks like. Merged onto whatever row exists so a postage table and the
     * watch state survive, same rule as `finishDealer`.
     */
    if (profile.avatar_url) {
      const row = await ctx.db.get('dealers', options.dealer)
      await ctx.db.put('dealers', {
        ...(row ?? blankDealer(options.dealer)),
        avatarUrl: profile.avatar_url,
      })
    }
  }

  ctx.since = anchor

  const dig: Dig = {
    id: options.digId,
    dealer: options.dealer,
    status: 'scanning',
    startedAt,
    finishedAt: null,
    // The ToS deadline, anchored at the start and never recomputed — not even
    // by a resume, or an interrupted dig could be stretched past six hours.
    expiresAt: startedAt + DIG_TTL_MS,
    listingsTotal: total,
    listingsScanned: 0,
    uniqueSeen: 0,
    coverage: 0,
    depth: options.depth ?? 'normal',
    truncated: total > REACHABLE,
    matchCount: 0,
    apiRequests: incremental ? 0 : 1,
    cursor: null,
  }
  await ctx.db.put('digs', dig)

  return walkExclusively(dig, ctx)
}

export class DigNotResumable extends Error {}

/**
 * Picks an interrupted dig back up.
 *
 * No pre-check request: the dealer's total was recorded at the start, and the
 * six-hour window is anchored there too. A dig that has run out of window is
 * not resumed but retired — continuing it would produce marketplace data that
 * may no longer be displayed.
 */
export async function resumeDig(options: ScanOptions & { digId: string }): Promise<Dig> {
  // Claimed first, then verified. The other way round, the record is read
  // before the wait and judged after it — by which point the dig it described
  // may already have finished, and the "resume" walks pages that are done.
  acquire(options.digId)

  try {
    const ctx = await prepare(options)
    const dig = await ctx.db.get('digs', options.digId)

    if (!dig) throw new DigNotResumable('Dieser Dig existiert nicht mehr.')
    if (dig.status !== 'scanning') throw new DigNotResumable('this dig is not running')

    /*
     * A deep scan is not picked up again, and that is a choice rather than an
     * omission. Its whole point is an exact coverage number, and that number
     * lives in a set of listing ids that dies with the tab — resuming would
     * either count records twice or throw away half an hour of pages to avoid
     * it. What was already found stays; starting again starts again.
     */
    if (dig.depth === 'deep') {
      dig.status = 'done'
      await ctx.db.put('digs', dig)
      throw new DigNotResumable('Ein Tiefenscan wird nicht fortgesetzt – die Funde sind da.')
    }

    if (ctx.now() > dig.expiresAt) {
      dig.status = 'expired'
      await ctx.db.put('digs', dig)
      throw new DigNotResumable('Der Sechs-Stunden-Rahmen ist abgelaufen – bitte neu scannen.')
    }

    return await walkExclusively(dig, ctx)
  } finally {
    // walkExclusively releases it on the happy path; this covers every way
    // out before the walk ever starts.
    running = null
  }
}

/** The interrupted dig worth offering to continue, if there is one. */
export async function findResumable(now: number = Date.now()): Promise<Dig | null> {
  const db = await openFidelityDb()
  const digs = await db.getAll('digs')

  const candidate = digs
    // Not the one this worker is scanning right now — that is not an
    // interruption, that is progress.
    .filter((dig) => dig.status === 'scanning' && dig.id !== running)
    .sort((a, b) => b.id.localeCompare(a.id))[0]

  if (!candidate) return null

  if (now > candidate.expiresAt) {
    // Retired rather than offered: what it would fetch may no longer be shown.
    await db.put('digs', { ...candidate, status: 'expired' })
    return null
  }

  return candidate
}

/**
 * The dealer profile: what the shop is, and how it ranks against the others
 * you have scanned. A resumed dig only sees the pages it walked itself, so the
 * fingerprint it writes covers those — coverage says so.
 */
async function saveDealer(
  ctx: ScanContext,
  dig: Dig,
  fingerprint: FingerprintAccumulator,
  newestListedAt: string | null,
): Promise<void> {
  const { db } = ctx
  const existing = await db.get('dealers', dig.dealer)

  /*
   * A "nur das Neue" visit learns one thing and must not claim the others.
   *
   * It saw a handful of records off the top of the shop — so its hit rate is
   * noise, its fingerprint would describe the last week of stock rather than
   * the shop, and its total is the number of new arrivals. Writing any of
   * those would quietly corrupt a profile the full digs built. What it *does*
   * know, and nothing else does, is where the new stock now begins.
   */
  if (dig.depth === 'neu') {
    await db.put('dealers', {
      ...(existing ?? blankDealer(dig.dealer)),
      newestListedAt: newestListedAt ?? existing?.newestListedAt ?? null,
      updatedAt: dig.finishedAt ?? Date.now(),
    })
    return
  }

  const rate = matchesPerThousand(dig.matchCount, dig.listingsScanned)

  /*
   * Merged onto the existing row, not written over it.
   *
   * A scan learns four things about a shop — how much it has, how well it
   * suits you, what it stocks, and when it was last looked at. Everything else
   * on the row came from somewhere else and has to survive: a postage table
   * somebody typed in, and the watch state.
   *
   * Listing the fields by hand is what broke it. The watch fields arrived in
   * M6, this function was written in M3, and nothing connected the two — so
   * scanning a shop you were watching silently stopped watching it, which is
   * exactly the shop somebody most wants watched.
   */
  await db.put('dealers', {
    ...(existing ?? blankDealer(dig.dealer)),
    numForSale: dig.listingsTotal,
    lastScannedAt: dig.finishedAt,
    // The line a later "nur das Neue" visit stops at.
    newestListedAt: newestListedAt ?? existing?.newestListedAt ?? null,
    // Stored as the comparable rate; the factor is derived on read, because it
    // changes as soon as another shop is scanned.
    affinity: rate,
    fingerprint: fingerprint.build(dig.listingsTotal),
    updatedAt: dig.finishedAt ?? Date.now(),
  })
}
