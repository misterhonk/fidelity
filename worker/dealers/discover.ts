import { z } from 'zod'

import { blankDealer } from '~~/db/dealer'
import { openFidelityDb } from '~~/db/open'
import type { DealerCandidate, DiscoveryResult } from '#shared/types'

import type { DiscogsClient } from '../discogs/client'

/**
 * Finding the shops you already deal with, so nobody types a username.
 *
 * Two sources, and the difference between them is not cosmetic:
 *
 *   Orders — `GET /marketplace/orders`, documented by Discogs. The shops you
 *   actually bought from, which is the strongest possible evidence that a shop
 *   is one of yours.
 *
 *   Friends — `GET /users/{username}/friends`, **not documented**. It works,
 *   it is CORS-open, and it is where somebody's favourite shops end up when
 *   they never order through Discogs. It is also exactly what CLAUDE.md rule 5
 *   forbids, so it is off by default and switched on per device (ADR-009).
 *
 * A friend is not necessarily a shop. `num_for_sale` on the profile decides
 * that, and it costs one request per candidate — which is why the count is
 * stated before anything is spent.
 */

const orderSchema = z.object({
  seller: z
    .object({
      username: z.string().min(1),
      id: z.number().int().optional(),
    })
    .optional(),
})

const ordersSchema = z.object({
  pagination: z.object({ pages: z.number().int(), items: z.number().int() }).optional(),
  orders: z.array(orderSchema).default([]),
})

const friendsSchema = z.object({
  pagination: z.object({ pages: z.number().int(), items: z.number().int() }).optional(),
  friends: z
    .array(z.object({ user: z.object({ username: z.string().min(1) }).optional() }))
    .default([]),
})

const profileSchema = z.object({
  username: z.string().min(1),
  num_for_sale: z.number().int().optional(),
  seller_rating: z.number().optional(),
  seller_num_ratings: z.number().int().optional(),
  location: z.string().optional(),
})

/** Below this a "shop" is somebody clearing out a shelf, not a dealer. */
export const MIN_LISTINGS = 20

/** One page of each source. Somebody with 500 friends does not need all of them. */
const PER_PAGE = 100

export interface DiscoverOptions {
  client: DiscogsClient
  username: string
  /** The undocumented half. Off unless the device asked for it (ADR-009). */
  includeFriends: boolean
  report?: (progress: { done: number; total: number; requests: number }) => void
  signal?: AbortSignal
}

export async function discoverDealers({
  client,
  username,
  includeFriends,
  report,
  signal,
}: DiscoverOptions): Promise<DiscoveryResult> {
  const db = await openFidelityDb()
  const known = new Set((await db.getAll('dealers')).map((dealer) => dealer.username))

  let requests = 0
  const sources = new Map<string, DealerCandidate['source']>()

  // 1. Orders. Documented, and the strongest signal there is.
  try {
    const answer = await client.get('/marketplace/orders', ordersSchema, {
      query: { status: 'All', per_page: PER_PAGE },
      signal,
    })
    requests += 1
    for (const order of answer.orders) {
      const seller = order.seller?.username
      if (seller && seller !== username) sources.set(seller, 'order')
    }
  } catch (error) {
    if (signal?.aborted) throw error
    // A token without marketplace access answers 401 here. That is not a
    // failure of the whole discovery — the other source may still work.
  }

  // 2. Friends. Undocumented, opt-in, and allowed to disappear without notice.
  if (includeFriends) {
    try {
      const answer = await client.get(
        `/users/${encodeURIComponent(username)}/friends`,
        friendsSchema,
        {
          query: { per_page: PER_PAGE },
          signal,
        },
      )
      requests += 1
      for (const entry of answer.friends) {
        const friend = entry.user?.username
        if (friend && friend !== username && !sources.has(friend)) sources.set(friend, 'friend')
      }
    } catch (error) {
      if (signal?.aborted) throw error
      // The day Discogs removes this, the import quietly loses half its input
      // and nothing else changes. That is the whole point of ADR-009.
    }
  }

  /*
   * Which of them actually sell.
   *
   * A friend is a person; a dealer is a person with stock. `num_for_sale`
   * separates them and costs one request each — the only part of this that
   * scales with the answer, which is why the caller is told the number first.
   */
  const candidates: DealerCandidate[] = []
  const names = [...sources.keys()]
  let done = 0

  report?.({ done, total: names.length, requests })

  for (const name of names) {
    signal?.throwIfAborted()

    try {
      const profile = await client.get(`/users/${encodeURIComponent(name)}`, profileSchema, {
        signal,
      })
      requests += 1

      const listings = profile.num_for_sale ?? 0
      if (listings >= MIN_LISTINGS) {
        candidates.push({
          username: profile.username,
          source: sources.get(name) ?? 'friend',
          numForSale: listings,
          sellerRating: profile.seller_rating ?? null,
          ratingCount: profile.seller_num_ratings ?? 0,
          location: profile.location ?? '',
          known: known.has(profile.username),
        })
      }
    } catch (error) {
      if (signal?.aborted) throw error
      // A profile that will not load is a candidate we cannot judge, and
      // guessing that it is a shop would put a stranger in somebody's list.
    }

    done += 1
    report?.({ done, total: names.length, requests })
  }

  return {
    // Biggest stock first — the shop most likely to be worth four minutes.
    candidates: candidates.sort((a, b) => b.numForSale - a.numForSale),
    requests,
    friendsUsed: includeFriends,
  }
}

/**
 * Writing the chosen shops down.
 *
 * A blank row, exactly as a hand-entered postage table creates one: the scan
 * fills in everything else, and until one runs the screens say honestly that
 * this shop is known only by name.
 */
export async function rememberDealers(candidates: DealerCandidate[]): Promise<number> {
  const db = await openFidelityDb()
  let added = 0

  for (const candidate of candidates) {
    const existing = await db.get('dealers', candidate.username)
    await db.put('dealers', {
      ...(existing ?? blankDealer(candidate.username)),
      numForSale: existing?.numForSale || candidate.numForSale,
      sellerRating: candidate.sellerRating ?? existing?.sellerRating ?? 0,
      ratingCount: candidate.ratingCount || (existing?.ratingCount ?? 0),
      shipsFrom: candidate.location || (existing?.shipsFrom ?? ''),
      updatedAt: Date.now(),
    })
    if (!existing) added += 1
  }

  return added
}
