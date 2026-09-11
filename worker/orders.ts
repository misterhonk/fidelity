import { z } from 'zod'

import { openFidelityDb } from '~~/db/open'
import type { DiscogsClient } from './discogs/client'
import type { Feedback, OrderImport } from '#shared/types'

/**
 * Reading an order — and asking the arrival questions from it (M14).
 *
 * **Why this can exist at all.** `GET /marketplace/orders` is the seller side;
 * for somebody who only buys it answers `items: 0` forever (measured twice on
 * 2026-09-11, ten hours apart, `docs/02`). A **single** order, by contrast, is
 * readable by its buyer: `GET /marketplace/orders/{id}` returns it in full.
 *
 * **Why it needs a typed-in number.** Because the list is the seller side,
 * there is no API route from "I am the buyer" to "here are my order numbers".
 * The number is on the web under `/sell/purchases` and nowhere else. That is
 * not a convenience decision but the only shape the API allows.
 *
 * **What it saves:** three records in one order are otherwise three ticks at
 * "bought", by hand, after the dig has long been cleared away. Here it is one
 * number and one request.
 *
 * **`items[].id` is the listing id** — measured by its shape (ten digits like
 * any other) and by the fact that `GET /marketplace/listings/{that id}`
 * answers **403 "authenticate as the owner"**: a sold listing belongs only to
 * its seller any more. That is why an import duplicates nothing: a record a
 * dig found carries the same number, and the row is filled out rather than
 * created a second time.
 */

/**
 * What is read from an order — and therefore also: what is not.
 *
 * **The schema is the promise here, not a comment.** The answer contains
 * `media_condition`, `sleeve_condition`, `condition_comments`, `price` and
 * `seller.email`. None of it is named below, so none of it exists past this
 * line — it cannot be passed on by accident in the first place.
 *
 * - The **promised grade** would be Discogs content and could not be shown
 *   after six hours (rule 4). M14 therefore stores only the *comparison*,
 *   never the grade — and an import that brought it along would be the back
 *   door into precisely that promise.
 * - **Prices** are out for the same reason.
 * - **`seller.email`** is a third party's address in an answer this app has no
 *   business with.
 *
 * Title, artist and shop stay: that is catalogue, not a listing, and without
 * them a purchase list is two bare integers (`docs/03` §7).
 */
const orderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  created: z.string().optional(),
  seller: z.object({ username: z.string().min(1) }).optional(),
  items: z
    .array(
      z.object({
        id: z.number().int(),
        release: z.object({
          id: z.number().int(),
          title: z.string().optional(),
          artist: z.string().optional(),
        }),
      }),
    )
    .default([]),
})

/**
 * The shape of an order number: `259022-32308`.
 *
 * Measured against a real one. It is checked so that a typo costs no request —
 * not to be clever: what gets through is still Discogs' decision.
 */
export function cleanOrderId(raw: string): string | null {
  const getrimmt = raw.trim()
  /*
   * A whole address is an input too. Anyone copying the number out of the
   * browser often has `discogs.com/sell/order/259022-32308` on the clipboard,
   * and failing on that would be pettiness.
   */
  const ausAdresse = getrimmt.match(/(\d+-\d+)\s*$/)
  const kandidat = ausAdresse ? ausAdresse[1]! : getrimmt
  return /^\d{1,12}-\d{1,12}$/.test(kandidat) ? kandidat : null
}

export async function importOrder(
  client: DiscogsClient,
  rawId: string,
  now = Date.now(),
): Promise<OrderImport> {
  const id = cleanOrderId(rawId)
  if (!id) return { ok: false, reason: 'shape' }

  const order = await client.get(`/marketplace/orders/${id}`, orderSchema)

  const db = await openFidelityDb()
  const dealer = order.seller?.username ?? null

  /*
   * The purchase date comes from the order, not from the clock.
   *
   * The ripening time in `worker/grading.ts` hangs off it: an order from three
   * weeks ago has arrived, and its question is due immediately. With
   * `Date.now()` every imported purchase would start at zero, and the whole
   * point of the import — being able to ask the question when it is due —
   * would be pushed out by ten days.
   */
  const gekauftAm = order.created ? Date.parse(order.created) : NaN
  const at = Number.isNaN(gekauftAm) ? now : gekauftAm

  let added = 0
  let enriched = 0

  for (const item of order.items) {
    const existing = await db.get('feedback', item.id)

    /*
     * An existing row is filled out, not replaced.
     *
     * It may come from a dig, in which case it carries signals and a score —
     * the appraisal this store exists for in the first place (`docs/03` §7).
     * And it may already carry a verdict: anyone who has answered how the
     * record arrived should not be asked again after an import.
     */
    const row: Feedback = {
      ...(existing ?? {
        listingId: item.id,
        releaseId: item.release.id,
        signals: [],
        score: 0,
      }),
      listingId: item.id,
      releaseId: item.release.id,
      title: existing?.title ?? item.release.title ?? null,
      artist: existing?.artist ?? item.release.artist ?? null,
      dealer: dealer ?? existing?.dealer ?? null,
      verdict: 'bought',
      createdAt: at,
      updatedAt: now,
    }

    await db.put('feedback', row)
    if (existing) enriched += 1
    else added += 1
  }

  return {
    ok: true,
    dealer,
    at,
    added,
    enriched,
    records: order.items.map((item) => ({
      listingId: item.id,
      title: item.release.title ?? null,
      artist: item.release.artist ?? null,
    })),
  }
}
