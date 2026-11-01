import { z } from 'zod'

import type { DemoKnown } from '#shared/protocol'
import type { CollectionItem, Match } from '#shared/types'

import type { DiscogsClient } from './discogs/client'
import { inventoryPageSchema, toListing } from './discogs/inventory'
import { buildIndex, evaluate } from './match'
import { norm } from './match/normalize'
import { computeTasteProfile } from './match/taste'
import { fail } from './fail'

/**
 * Fidelity without a token, on one or two records.
 *
 * The setup asks for the key to somebody's Discogs account before it has shown
 * them anything. This is the other order: name a record you like from a shop,
 * and the app says what else that shop has that belongs next to it.
 *
 * **It is not a mock-up.** Every step below is the machinery a real dig uses —
 * `computeTasteProfile`, `buildIndex`, `evaluate`, `buildReason` — with a
 * collection of one or two records instead of two thousand. A demo that faked
 * its own results would be worthless the first time somebody compared them to
 * the real thing.
 *
 * What it cannot show is the half that needs your data: no wantlist means no
 * wantlist hits, no horizon means no credits and no other pressings. It says
 * so rather than letting the app look thinner than it is.
 *
 * Everything here works unauthenticated — measured 2026-08-10:
 * `/marketplace/listings/{id}`, `/releases/{id}` and `/users/{u}/inventory`
 * all answer 200 with `access-control-allow-origin: *` and no token. The
 * budget is 25 requests a minute rather than 60, which the pacer handles.
 */

/**
 * How much of the shop the demo reads: at most this many inventory pages.
 *
 * It used to read the newest five hundred, which in a shop of thirty thousand
 * almost never held the artist the welcome screen had just promised, and the
 * demo ended on "nothing fitted". Now it reads the shop sorted by artist and
 * halves its way to the clue's page — seven requests for a hundred pages — and
 * spends what is left on the pages either side. Ten requests at the token-less
 * 2.4 s is under half a minute; a whole shop would be a dig. The number read
 * is still stated on screen, because a sample is not a claim.
 */
export const DEMO_PAGES = 10
const PER_PAGE = 100

/** Discogs serves a stranger 10,000 listings per sort order; page 101 is a 403. */
const WINDOW_PAGES = 100

/** Seed listings, capped: two records make the point and four make it slower. */
export const MAX_SEEDS = 2

const seedListingSchema = z.object({
  id: z.number().int(),
  price: z
    .object({
      value: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  seller: z.object({ username: z.string() }),
  release: z.object({ id: z.number().int(), title: z.string(), artist: z.string().optional() }),
})

/** Just enough of a release to become a collection item. */
const releaseSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  year: z.number().int().optional(),
  master_id: z.number().int().optional(),
  artists: z.array(z.object({ id: z.number().int(), name: z.string() })).optional(),
  labels: z
    .array(z.object({ id: z.number().int(), name: z.string(), catno: z.string().optional() }))
    .optional(),
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
})

export interface DemoSeed {
  listingId: number
  releaseId: number
  title: string
  artist: string
}

export interface DemoResult {
  dealer: string
  seeds: DemoSeed[]
  finds: Match[]
  /** Listings read, and how many the shop holds — a sample, said out loud. */
  scanned: number
  listingsTotal: number
  requests: number
}

export interface DemoProgress {
  step: 'seeds' | 'shop' | 'matching'
  done: number
  total: number
}

/**
 * A release, as the collection would have stored it.
 *
 * The ids are the point. A marketplace listing carries an artist *string* and
 * no ids at all, and the taste profile is keyed by id — so a seed built from
 * the listing alone produces no facets, and no facets means no signals and an
 * empty demo. One `/releases/{id}` per seed buys the real thing.
 *
 * Two requests is not the loop CLAUDE.md rule 2 forbids; that rule is about
 * walking ten thousand releases, which is three hours.
 */
function toCollectionItem(release: z.infer<typeof releaseSchema>): CollectionItem {
  const artists = release.artists ?? []
  const labels = release.labels ?? []

  return {
    releaseId: release.id,
    masterId: release.master_id ?? 0,
    title: release.title,
    artistIds: artists.map((artist) => artist.id),
    artistNorms: artists.map((artist) => norm(artist.name)),
    artistNames: artists.map((artist) => artist.name),
    labelIds: labels.map((label) => label.id),
    labelNorms: labels.map((label) => norm(label.name)),
    labelNames: labels.map((label) => label.name),
    catnos: labels.map((label) => label.catno ?? '').filter(Boolean),
    genres: release.genres ?? [],
    styles: release.styles ?? [],
    year: release.year ?? 0,
    rating: 0,
    formats: [],
    addedAt: '',
    // Covers belong to the shelf, and the demo has no shelf to draw.
    thumbUrl: '',
    coverUrl: '',
    /*
     * Zero, and that is the point.
     *
     * A demo record belongs to nobody's collection, so there is no entry to
     * write to — and zero is exactly what the write path refuses. The rule
     * that the demo never touches a real account is enforced here by the data
     * rather than by a flag somebody has to remember to check.
     */
    instanceId: 0,
    folderId: 0,
  }
}

export async function runDemo(options: {
  client: DiscogsClient
  listingIds: number[]
  known?: DemoKnown[]
  report?: (progress: DemoProgress) => void
  signal?: AbortSignal
}): Promise<DemoResult> {
  const { client, report, signal } = options
  const listingIds = options.listingIds.slice(0, MAX_SEEDS)
  if (listingIds.length === 0) throw fail('no-listing', 'no listing given')

  let requests = 0
  const known = options.known ?? []

  /*
   * A pasted listing: which shop, which record. Sold or taken down, Discogs
   * answers 404 — or 401 without a token, the same words it uses for a bad
   * one — and either way the record is not for sale any more.
   */
  async function ask(listingId: number): Promise<DemoKnown> {
    let listing
    try {
      listing = await client.get(`/marketplace/listings/${listingId}`, seedListingSchema, {
        signal,
      })
    } catch (error) {
      const status = (error as { status?: number } | null)?.status
      if (status === 404 || status === 401) throw fail('listing-gone', 'the listing is gone')
      throw error
    } finally {
      requests += 1
    }
    return {
      listingId: listing.id,
      releaseId: listing.release.id,
      dealer: listing.seller.username,
      title: listing.release.title,
      artist: listing.release.artist ?? '',
    }
  }

  // 1 — the seeds, and which shop they belong to.
  const seeds: DemoSeed[] = []
  const collection: CollectionItem[] = []
  let dealer = ''

  for (const [index, listingId] of listingIds.entries()) {
    report?.({ step: 'seeds', done: index, total: listingIds.length })

    const seed = known.find((entry) => entry.listingId === listingId) ?? (await ask(listingId))

    /*
     * All seeds must come from one shop, because the whole question is what
     * *this* shop has next to it. Two shops would produce a list nobody can
     * buy in one shipment, which is the opposite of the point.
     */
    if (!dealer) dealer = seed.dealer
    else if (seed.dealer !== dealer) continue

    const release = await client.get(`/releases/${seed.releaseId}`, releaseSchema, {
      signal,
    })
    requests += 1

    seeds.push({
      listingId: seed.listingId,
      releaseId: seed.releaseId,
      title: seed.title,
      artist: seed.artist,
    })
    collection.push(toCollectionItem(release))
  }

  if (!dealer) throw fail('no-listing', 'no dealer behind this listing')

  // 2 — the same index a dig builds, from a collection of one or two.
  const taste = computeTasteProfile(collection, Date.now())
  const index = buildIndex(collection, [], taste, [])

  /*
   * No filters. Somebody who has not set any must not be cut down by
   * defaults they cannot see — and the default allows only vinyl, which in a
   * general shop hides most of the classics.
   */
  const filters = {
    formatsAllow: [],
    maxPrice: null,
    shipsFromBlock: [],
    prefMediaCondition: 'Poor (P)',
    targetPrice: null,
    // No price filters, so nothing is compared in it.
    currency: '',
  }

  // 3 — the shop sorted by artist, around the clue's artist.
  const seeded = new Set(seeds.map((seed) => seed.releaseId))
  const read = new Set<number>()
  const finds: Match[] = []
  let listingsTotal = 0
  let shopRequests = 0

  /** One page, and its artists in sort order. Every row on it is scored. */
  async function readPage(page: number, order: 'asc' | 'desc'): Promise<string[]> {
    signal?.throwIfAborted()
    report?.({ step: 'shop', done: shopRequests, total: DEMO_PAGES })
    shopRequests += 1
    requests += 1

    let response
    try {
      response = await client.get(
        `/users/${encodeURIComponent(dealer)}/inventory`,
        inventoryPageSchema,
        { query: { page, per_page: PER_PAGE, sort: 'artist', sort_order: order }, signal },
      )
    } catch (error) {
      // Past the 10,000-listing wall: an empty page, so the search turns back.
      if ((error as { status?: number } | null)?.status === 403) return []
      throw error
    }
    listingsTotal = response.pagination.items

    for (const row of response.listings) {
      const listing = toListing(row)
      // Both ends overlap in a shop under 20,000 listings; a row counts once.
      if (read.has(listing.listingId)) continue
      read.add(listing.listingId)

      // The seed itself is not a find.
      if (seeded.has(listing.releaseId)) continue

      const result = evaluate(listing, index, filters)
      if (!result) continue

      finds.push({
        digId: 'demo',
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

    return response.listings.map((row) => artistKey(row.release.artist ?? ''))
  }

  const target = artistKey(seeds[0]?.artist ?? '')
  const pages = new Map<number, string[]>()
  const budget = () => shopRequests < DEMO_PAGES

  pages.set(1, await readPage(1, 'asc'))
  const lastPage = Math.max(1, Math.ceil(listingsTotal / PER_PAGE))
  let order: 'asc' | 'desc' = 'asc'
  const last = Math.min(lastPage, WINDOW_PAGES)

  /*
   * A shop bigger than the window can be read from both ends of the alphabet
   * but not in the middle. One look at the window's edge says which end the
   * clue is nearer. A clue in the middle is searched for anyway: what the
   * search passes on its way is scored all the same.
   */
  if (lastPage > WINDOW_PAGES) {
    const edge = await readPage(WINDOW_PAGES, 'asc')
    pages.set(WINDOW_PAGES, edge)
    if (side(edge, target, false) > 0) {
      order = 'desc'
      pages.clear()
    }
  }

  let found = 0
  let lo = 1
  let hi = last
  while (lo <= hi && budget()) {
    const mid = Math.floor((lo + hi) / 2)
    const keys = pages.get(mid) ?? (await readPage(mid, order))
    pages.set(mid, keys)
    const where = side(keys, target, order === 'desc')
    if (where === 0) {
      found = mid
      break
    }
    if (where < 0) hi = mid - 1
    else lo = mid + 1
  }

  // An artist with forty records runs over a page edge: read the neighbours.
  const keys = pages.get(found) ?? []
  if (keys[0] === target && found > 1 && !pages.has(found - 1) && budget()) {
    await readPage(found - 1, order)
  }
  if (keys.at(-1) === target && found < last && !pages.has(found + 1) && budget()) {
    await readPage(found + 1, order)
  }

  report?.({ step: 'matching', done: 1, total: 1 })
  finds.sort((a, b) => b.score - a.score)

  return { dealer, seeds, finds, scanned: read.size, listingsTotal, requests }
}

/**
 * An artist the way the shop's artist sort orders it.
 *
 * Measured 2026-11-01: Discogs sorts by the artist's own name, without a
 * leading "The" and ignoring case — "The 2 German Latinos" sits among the 2s.
 * shortcut: a name written as a variation ("Two Sinners*") sorts by a name the
 * listing does not carry; `side` reads inside a page's edges so a few such
 * rows do not turn the search. A wrong turn costs finds, never correctness.
 */
export function artistKey(artist: string): string {
  return artist
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\*|\s\(\d+\)/g, '')
    .replace(/^the\s+/, '')
    .trim()
}

/**
 * Where the clue lies from this page: before it (-1), on it (0), after it (1).
 *
 * Judged by the tenth and the ninetieth row rather than the first and last, so
 * an odd row at the edge of a page does not send the search the wrong way.
 */
export function side(keys: string[], target: string, descending: boolean): -1 | 0 | 1 {
  if (keys.length === 0) return -1
  if (keys.includes(target)) return 0
  const early = keys[Math.floor((keys.length - 1) * 0.1)]!
  const late = keys[Math.ceil((keys.length - 1) * 0.9)]!
  const before = descending ? target > early : target < early
  const after = descending ? target < late : target > late
  return before ? -1 : after ? 1 : 0
}
