import { z } from 'zod'

import { blankDealer } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'

import type { DiscogsClient } from '../discogs/client'
import { FOR_SALE } from '../dig/refresh'

/**
 * Angebote von Hand in den Korb holen.
 *
 * Discogs' API has no cart — `/marketplace/cart` answers 404 where an endpoint
 * that merely needs a token answers 401 (docs/02, measured 2026-08-10). So
 * Fidelity cannot read what is sitting in somebody's Discogs basket, and no
 * amount of wanting changes that.
 *
 * What it can do is take the other end. Copy the links out of that cart, paste
 * them here, and every one of them becomes a line in the right shop's basket —
 * with the postage ladder, the marginal cost and the fill-up suggestions that
 * Discogs only shows you after you have already committed.
 *
 * One request per listing, which is the same `GET /marketplace/listings/{id}`
 * the basket already uses to ask whether something is still there.
 */

/**
 * Every listing id in a blob of pasted text.
 *
 * Deliberately forgiving about what is pasted, because what people actually
 * paste is a browser address bar, sometimes several at once, sometimes with a
 * language segment and a tracking query in the middle. The one thing it will
 * not do is guess: a number that is not in a Discogs listing URL has to look
 * like a listing id on its own, and prose is ignored rather than mined.
 */
export function parseListingIds(input: string): number[] {
  const found: number[] = []
  const seen = new Set<number>()

  const add = (raw: string) => {
    const id = Number(raw)
    // Listing ids are ten digits today and were seven a decade ago. The lower
    // bound is what keeps a year or a price out of the list.
    if (!Number.isSafeInteger(id) || id < 1_000_000) return
    if (seen.has(id)) return
    seen.add(id)
    found.push(id)
  }

  // Links first: `/sell/item/123`, with or without a language segment.
  for (const match of input.matchAll(/\/sell\/item\/(\d+)/g)) add(match[1]!)

  /*
   * Then bare numbers, but only from lines that are nothing else. A line that
   * still holds a URL has already been read, and mining its query string would
   * turn `?ev=rb&offer=1` into listings that do not exist.
   */
  for (const line of input.split(/[\n,;]+/)) {
    const trimmed = line.trim()
    if (/^\d+$/.test(trimmed)) add(trimmed)
  }

  return found
}

// ---------------------------------------------------------------------------

/**
 * Enough of a listing to make a basket line and to know whose shipment it is.
 *
 * Wider than the schema the refresh uses, because that one only ever asks "is
 * this still there and what does it cost" about a record it already knows. A
 * pasted link is a record nothing knows anything about yet.
 */
const pastedListingSchema = z.object({
  id: z.number().int(),
  status: z.string().optional(),
  condition: z.string().nullable().optional(),
  price: z
    .object({
      value: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  seller: z.object({
    username: z.string(),
    min_order_total: z.number().nullable().optional(),
    shipping: z.string().nullable().optional(),
  }),
  release: z.object({
    id: z.number().int(),
    title: z.string(),
    artist: z.string().optional(),
  }),
})

export interface PasteProgress {
  done: number
  total: number
  requests: number
  added: number
}

export interface PasteResult {
  added: number
  sold: number
  /** Ids Discogs would not answer for — deleted, or never a listing at all. */
  unknown: number
  requests: number
  /** Which shops the paste landed in, so the screen can say where to look. */
  dealers: string[]
}

/**
 * Fetches each pasted listing and files it under the shop that sells it.
 *
 * One request apiece, through the same paced client as everything else. A
 * listing that has sold is reported rather than added: the point of the whole
 * screen is a shipment somebody can actually pay for.
 */
export async function addPastedListings(options: {
  client: DiscogsClient
  ids: number[]
  currency: string
  now: number
  report?: (progress: PasteProgress) => void
  signal?: AbortSignal
}): Promise<PasteResult> {
  const { client, ids, currency, now, report, signal } = options
  const db = await openFidelityDb()

  let requests = 0
  let added = 0
  let sold = 0
  let unknown = 0
  const dealers = new Set<string>()

  report?.({ done: 0, total: ids.length, requests, added })

  for (const [index, id] of ids.entries()) {
    signal?.throwIfAborted()

    let listing
    try {
      listing = await client.get(`/marketplace/listings/${id}`, pastedListingSchema, {
        query: { curr_abbr: currency },
        signal,
      })
      requests += 1
    } catch {
      // A 404 is the ordinary case here: somebody pasted a link to a listing
      // that has since been taken down, or a number that never was one.
      requests += 1
      unknown += 1
      report?.({ done: index + 1, total: ids.length, requests, added })
      continue
    }

    if (listing.status && listing.status !== FOR_SALE) {
      sold += 1
      report?.({ done: index + 1, total: ids.length, requests, added })
      continue
    }

    const dealer = listing.seller.username
    dealers.add(dealer)

    /*
     * A shop nobody has dug yet still needs a row, or the basket has no name
     * to show and no free text for the postage parser to read. Merged rather
     * than written, so a shop that *has* been dug keeps its hit rate.
     */
    const existing = await db.get('dealers', dealer)
    await db.put('dealers', {
      ...(existing ?? blankDealer(dealer)),
      displayName: existing?.displayName || dealer,
      minOrderTotal: listing.seller.min_order_total ?? existing?.minOrderTotal ?? 0,
      shippingNote: listing.seller.shipping ?? existing?.shippingNote ?? '',
      updatedAt: now,
    })

    await db.put('basket', {
      listingId: listing.id,
      dealer,
      releaseId: listing.release.id,
      title:
        [listing.release.artist, listing.release.title].filter(Boolean).join(' – ') ||
        'Unbekannt',
      price: listing.price?.value ?? 0,
      currency: listing.price?.currency ?? currency,
      addedAt: now,
      note: null,
      soldAt: null,
    })
    added += 1

    report?.({ done: index + 1, total: ids.length, requests, added })
  }

  return { added, sold, unknown, requests, dealers: [...dealers] }
}
