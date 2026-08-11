import { z } from 'zod'

import type { CollectionItem, Match } from '#shared/types'

import type { DiscogsClient } from './discogs/client'
import { inventoryPageSchema, toListing } from './discogs/inventory'
import { buildIndex, evaluate } from './match'
import { norm } from './match/normalize'
import { computeTasteProfile } from './match/taste'

/**
 * Fidelity ohne Token, an ein oder zwei Platten.
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
 * How much of the shop the demo reads.
 *
 * Five pages, five hundred listings, five requests. A whole shop is 200 and
 * four minutes, which is a dig — and a dig is what somebody does *after* they
 * decide to use this. The number is stated on screen, because "500 von 2.881"
 * is the difference between a sample and a claim.
 */
export const DEMO_PAGES = 5
const PER_PAGE = 100

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
  }
}

export async function runDemo(options: {
  client: DiscogsClient
  listingIds: number[]
  report?: (progress: DemoProgress) => void
  signal?: AbortSignal
}): Promise<DemoResult> {
  const { client, report, signal } = options
  const listingIds = options.listingIds.slice(0, MAX_SEEDS)
  if (listingIds.length === 0) throw new Error('Kein Angebot angegeben.')

  let requests = 0

  // 1 — the seeds, and which shop they belong to.
  const seeds: DemoSeed[] = []
  const collection: CollectionItem[] = []
  let dealer = ''

  for (const [index, listingId] of listingIds.entries()) {
    report?.({ step: 'seeds', done: index, total: listingIds.length })

    const listing = await client.get(`/marketplace/listings/${listingId}`, seedListingSchema, {
      signal,
    })
    requests += 1

    /*
     * All seeds must come from one shop, because the whole question is what
     * *this* shop has next to it. Two shops would produce a list nobody can
     * buy in one shipment, which is the opposite of the point.
     */
    if (!dealer) dealer = listing.seller.username
    else if (listing.seller.username !== dealer) continue

    const release = await client.get(`/releases/${listing.release.id}`, releaseSchema, {
      signal,
    })
    requests += 1

    seeds.push({
      listingId: listing.id,
      releaseId: listing.release.id,
      title: listing.release.title,
      artist: listing.release.artist ?? '',
    })
    collection.push(toCollectionItem(release))
  }

  if (!dealer) throw new Error('Zu diesem Angebot gibt es keinen Händler.')

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
  }

  // 3 — a slice of the shop, newest first.
  const seeded = new Set(seeds.map((seed) => seed.releaseId))
  const finds: Match[] = []
  let scanned = 0
  let listingsTotal = 0

  for (let page = 1; page <= DEMO_PAGES; page++) {
    signal?.throwIfAborted()
    report?.({ step: 'shop', done: page - 1, total: DEMO_PAGES })

    const response = await client.get(
      `/users/${encodeURIComponent(dealer)}/inventory`,
      inventoryPageSchema,
      { query: { page, per_page: PER_PAGE, sort: 'listed', sort_order: 'desc' }, signal },
    )
    requests += 1
    listingsTotal = response.pagination.items

    for (const row of response.listings) {
      const listing = toListing(row)
      scanned += 1

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

    if (page * PER_PAGE >= listingsTotal) break
  }

  report?.({ step: 'matching', done: 1, total: 1 })
  finds.sort((a, b) => b.score - a.score)

  return { dealer, seeds, finds, scanned, listingsTotal, requests }
}
