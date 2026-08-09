import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { Dig, Match } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'

/**
 * Bringing an expired dig back to life.
 *
 * Six hours after a scan, prices and conditions are deleted — that is the ToS
 * and it is not negotiable (CLAUDE.md rule 4). What *was* negotiable is the
 * price of getting them back: until now the only way was another full scan,
 * two hundred requests and four minutes, to look again at nineteen records
 * somebody had already found.
 *
 * `GET /marketplace/listings/{id}` (docs/02, verified 2026-08-09) answers for
 * one offer at a time. Nineteen matches are nineteen requests and twenty-three
 * seconds — and the response carries `status`, so a record that sold in the
 * meantime says so instead of quietly keeping its old price.
 *
 * ⚠️ This is not a substitute for a dig. It looks again at offers a dig has
 * already found; new stock is only ever discovered by scanning.
 */

export const listingSchema = z.object({
  id: z.number().int(),
  status: z.string().optional(),
  condition: z.string().nullable().optional(),
  sleeve_condition: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  ships_from: z.string().nullable().optional(),
  price: z
    .object({
      value: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})

/** Discogs' word for "still buyable". Anything else means gone. */
export const FOR_SALE = 'For Sale'

export interface RefreshProgress {
  done: number
  total: number
  requests: number
  /** How many turned out to be sold, so the number moves while it runs. */
  sold: number
}

export interface RefreshResult {
  refreshed: number
  sold: number
  requests: number
  /** Matches whose listing has disappeared entirely. */
  gone: number
}

export interface RefreshOptions {
  client: DiscogsClient
  digId: string
  currency: string
  now?: number
  report?: (progress: RefreshProgress) => void
  signal?: AbortSignal
}

export async function refreshDig({
  client,
  digId,
  currency,
  now = Date.now(),
  report,
  signal,
}: RefreshOptions): Promise<RefreshResult> {
  const db = await openFidelityDb()
  const dig = await db.get('digs', digId)
  if (!dig) throw new Error('Diesen Dig gibt es nicht mehr.')

  const matches = await db
    .transaction('matches')
    .store.index('by-dig-score')
    .getAll(IDBKeyRange.bound([digId, -Infinity], [digId, Infinity]))

  // Strongest first: an interrupted refresh has done the records that matter.
  const ordered = [...matches].sort((a, b) => b.score - a.score)

  let requests = 0
  let refreshed = 0
  let sold = 0
  let gone = 0
  let done = 0

  report?.({ done, total: ordered.length, requests, sold })

  for (const match of ordered) {
    signal?.throwIfAborted()

    let listing
    try {
      listing = await client.get(`/marketplace/listings/${match.listingId}`, listingSchema, {
        query: { curr_abbr: currency },
        signal,
      })
      requests += 1
    } catch (error) {
      if (signal?.aborted) throw error
      /*
       * A listing that will not load is almost always one that was taken down.
       * It is marked expired rather than deleted: the score, the signals and
       * the sentence are ours and survive (docs/03 §5) — only the marketplace
       * half goes, which is what expiry does anyway.
       */
      await db.put('matches', { ...match, ...stripMarketplace(match), expired: true })
      gone += 1
      done += 1
      report?.({ done, total: ordered.length, requests, sold })
      continue
    }

    const stillForSale = (listing.status ?? FOR_SALE) === FOR_SALE

    const updated: Match = stillForSale
      ? {
          ...match,
          price: listing.price?.value ?? null,
          currency: listing.price?.currency ?? null,
          condition: listing.condition ?? null,
          sleeve: listing.sleeve_condition ?? null,
          comments: listing.comments ?? null,
          expired: false,
        }
      : // Sold. The marketplace half goes for the same reason it goes at six
        // hours — it is no longer true — and `expired` says the price is not
        // showable, which for a sold record is exactly right.
        { ...match, ...stripMarketplace(match), expired: true }

    await db.put('matches', updated)
    if (stillForSale) refreshed += 1
    else sold += 1

    done += 1
    report?.({ done, total: ordered.length, requests, sold })
  }

  /*
   * The clock restarts on the dig, because the data on it is new.
   *
   * Only when something is actually still for sale: a dig where every record
   * sold has nothing to show and should stay expired rather than look fresh.
   */
  if (refreshed > 0) {
    const refreshedDig: Dig = {
      ...dig,
      status: 'done',
      expiresAt: now + 6 * 60 * 60 * 1000,
    }
    await db.put('digs', refreshedDig)
  }

  return { refreshed, sold, requests, gone }
}

/** Everything the six-hour rule deletes, in one place (docs/03 §5). */
function stripMarketplace(match: Match) {
  return {
    title: match.title,
    artist: match.artist,
    price: null,
    currency: null,
    condition: null,
    sleeve: null,
    comments: null,
    marketLowestPrice: null,
    marketNumForSale: null,
  }
}
