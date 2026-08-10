import { DIG_TTL_MS, pruneDigs } from '~~/db/expire'
import { getPreferences } from '~~/db/meta'
import { openFidelityDb, type FidelityDatabase } from '~~/db/open'
import type { Dig, Match } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { dealerSchema, inventoryPageSchema, toListing } from '../discogs/inventory'
import { buildIndex, evaluate, type MatchFilters, type MatchIndex } from '../match'
import { buildReason } from '../match/reason'

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

export interface ScanProgress {
  status: Dig['status']
  scanned: number
  /** What the dealer has; scanned will not reach it above 20.000. */
  total: number
  reachable: number
  matches: number
  requests: number
  order: 'asc' | 'desc'
  etaMs: number | null
}

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

  const emit = (order: 'asc' | 'desc') => {
    const reachable = Math.min(dig.listingsTotal, REACHABLE)
    const remaining = Math.max(0, reachable - scanned) / PER_PAGE
    report?.({
      status: dig.status,
      scanned,
      total: dig.listingsTotal,
      reachable,
      matches,
      requests,
      order,
      etaMs: Math.round(remaining * MS_PER_REQUEST),
    })
  }

  const startOrder = dig.cursor?.order ?? 'asc'
  const startPage = dig.cursor ? dig.cursor.page + 1 : 1

  emit(startOrder)

  // Two passes over disjoint windows. The second only runs when the first hit
  // the wall — below 10.000 listings it would return the same records again.
  for (const order of ['asc', 'desc'] as const) {
    if (order === 'asc' && startOrder === 'desc') continue
    if (order === 'desc' && dig.listingsTotal <= PER_PAGE * MAX_PAGES) break

    const from = order === startOrder ? startPage : 1

    for (let page = from; page <= MAX_PAGES; page++) {
      signal?.throwIfAborted()

      const response = await client.get(
        `/users/${encodeURIComponent(dig.dealer)}/inventory`,
        inventoryPageSchema,
        { query: { page, per_page: PER_PAGE, sort: 'listed', sort_order: order }, signal },
      )
      requests += 1

      const fresh: Match[] = []
      for (const row of response.listings) {
        scanned += 1
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
          reason: buildReason(result.signals),
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
      dig.coverage = dig.listingsTotal > 0 ? Math.min(1, scanned / dig.listingsTotal) : 0
      dig.cursor = { page, order }
      await db.put('digs', dig)

      emit(order)

      if (response.listings.length < PER_PAGE) break
      if (page >= response.pagination.pages) break
    }
  }

  dig.status = 'done'
  dig.finishedAt = now()
  dig.cursor = null
  await db.put('digs', dig)
  await saveDealer(ctx, dig, fingerprint)
  await pruneDigs(db)

  // What this dig taught the horizon. Handed back rather than acted on here:
  // the scan's job is over, and paying for it is a decision the caller makes
  // (and reports on) as its own phase.
  pendingNearMisses = nearMisses.build()

  emit('desc')
  return dig
}

/**
 * Claims the scanning slot. Check and set sit in the same synchronous block on
 * purpose: split by an await, two callers both pass the check before either
 * sets it, and two scans end up sharing one rate limit.
 */
function acquire(digId: string): void {
  if (running !== null) {
    throw new DigNotResumable(
      running === digId ? 'Dieser Dig läuft gerade.' : 'Es läuft bereits ein Dig.',
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

export async function runDig(
  options: ScanOptions & { dealer: string; digId: string },
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

  // Pre-check. One request buys an honest answer up front instead of a
  // surprise at page 101.
  const profile = await ctx.client
    .get(`/users/${encodeURIComponent(options.dealer)}`, dealerSchema, { signal: ctx.signal })
    .catch((error: unknown) => {
      running = null
      throw error
    })

  const total = profile.num_for_sale ?? 0

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
    coverage: 0,
    truncated: total > REACHABLE,
    matchCount: 0,
    apiRequests: 1,
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
    if (dig.status !== 'scanning') throw new DigNotResumable('Dieser Dig läuft nicht.')

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
): Promise<void> {
  const { db } = ctx

  const rate = matchesPerThousand(dig.matchCount, dig.listingsScanned)
  const existing = await db.get('dealers', dig.dealer)

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
    // Stored as the comparable rate; the factor is derived on read, because it
    // changes as soon as another shop is scanned.
    affinity: rate,
    fingerprint: fingerprint.build(dig.listingsTotal),
  })
}
