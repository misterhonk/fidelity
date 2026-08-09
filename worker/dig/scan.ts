import { getPreferences } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import { DIG_TTL_MS, pruneDigs } from '~~/db/expire'
import type { Dig, Match } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'
import { dealerSchema, inventoryPageSchema, toListing } from '../discogs/inventory'
import { buildIndex, evaluate, type MatchFilters } from '../match'
import { buildReason } from '../match/reason'

export const PER_PAGE = 100

/**
 * The pagination wall: page 101 of a foreign inventory answers 403, and
 * `pagination.pages` cheerfully claims otherwise (docs/01 RB-3).
 */
export const MAX_PAGES = 100

/** asc and desc give two disjoint windows, so up to 20.000 listings. */
export const REACHABLE = PER_PAGE * MAX_PAGES * 2

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
  dealer: string
  digId: string
  report?: (progress: ScanProgress) => void
  signal?: AbortSignal
  now?: () => number
}

/** Roughly one request every 1.2 s, which is what the pacer enforces. */
const MS_PER_REQUEST = 1200

export async function runDig({
  client,
  dealer,
  digId,
  report,
  signal,
  now = Date.now,
}: ScanOptions): Promise<Dig> {
  const db = await openFidelityDb()
  const preferences = await getPreferences()

  const [collection, wantlist, taste] = await Promise.all([
    db.getAll('collection'),
    db.getAll('wantlist'),
    db
      .get('meta', 'tasteProfile')
      .then((row) => (row?.key === 'tasteProfile' ? row.value : null)),
  ])
  const index = buildIndex(collection, wantlist, taste)

  const filters: MatchFilters = {
    formatsAllow: preferences.formatsAllow,
    maxPrice: preferences.maxPrice,
    shipsFromBlock: preferences.shipsFromBlock,
    prefMediaCondition: preferences.prefMediaCondition,
    targetPrice: preferences.targetPrice,
  }

  const startedAt = now()
  let requests = 0
  let scanned = 0
  let matches = 0

  // Pre-check. One request buys an honest answer up front instead of a
  // surprise at page 101.
  const profile = await client.get(`/users/${encodeURIComponent(dealer)}`, dealerSchema, {
    signal,
  })
  requests += 1

  const total = profile.num_for_sale ?? 0
  const dig: Dig = {
    id: digId,
    dealer,
    status: 'scanning',
    startedAt,
    finishedAt: null,
    // The ToS deadline, set once at the start and never recomputed.
    expiresAt: startedAt + DIG_TTL_MS,
    listingsTotal: total,
    listingsScanned: 0,
    coverage: 0,
    truncated: total > REACHABLE,
    matchCount: 0,
    apiRequests: requests,
    cursor: null,
  }
  await db.put('digs', dig)

  const emit = (order: 'asc' | 'desc') => {
    const remaining = Math.max(0, Math.min(total, REACHABLE) - scanned) / PER_PAGE
    report?.({
      status: dig.status,
      scanned,
      total,
      reachable: Math.min(total, REACHABLE),
      matches,
      requests,
      order,
      etaMs: Math.round(remaining * MS_PER_REQUEST),
    })
  }
  emit('asc')

  // Two passes over disjoint windows. The second only runs when the first hit
  // the wall — below 10.000 listings it would return the same records again.
  for (const order of ['asc', 'desc'] as const) {
    if (order === 'desc' && total <= PER_PAGE * MAX_PAGES) break

    for (let page = 1; page <= MAX_PAGES; page++) {
      signal?.throwIfAborted()

      const response = await client.get(
        `/users/${encodeURIComponent(dealer)}/inventory`,
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
        const result = evaluate(listing, index, filters)
        if (!result) continue

        fresh.push({
          digId,
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

      // The cursor is persisted after every page, so a closed tab or a dead
      // connection costs one page rather than the whole run. The raw listings
      // are dropped here — 20.000 of them would be 40 MB of nothing.
      dig.listingsScanned = scanned
      dig.matchCount = matches
      dig.apiRequests = requests
      dig.coverage = total > 0 ? Math.min(1, scanned / total) : 0
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
  await pruneDigs(db)

  emit('desc')
  return dig
}
