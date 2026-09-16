import { z } from 'zod'

import { discogsImageOrNone } from '#shared/images'

import type { Listing } from '../match'

import { paginationSchema } from './schemas'

/** GET /users/{u} — the pre-check before a scan commits to anything. */
export const dealerSchema = z.object({
  id: z.number().int().optional(),
  username: z.string(),
  num_for_sale: z.number().int().optional(),
  seller_rating: z.number().optional(),
  seller_num_ratings: z.number().int().optional(),
  location: z.string().optional(),
  /**
   * The shop sign.
   *
   * Free — this endpoint is fetched anyway, once per dig, to find out how big
   * the shop is. Most sellers have set one; the ones who have not get Discogs'
   * grey default, which is why the screens fall back to initials rather than
   * drawing somebody else's placeholder. And only from i.discogs.com — the
   * field becomes an `<img src>`, and an answer is data until it is checked.
   */
  avatar_url: z.string().optional().transform(discogsImageOrNone),
  /**
   * Two more lines of the trust line (M34.1), free on the same request.
   *
   * `registered` is when the account was opened — "since 2010" says more
   * about a shop than a rating does, because a rating is a percentage and
   * fifteen years is a fact. `marketplace_suspended` is the one flag that
   * makes every other number on the profile moot, so it is read and said.
   */
  registered: z.string().optional(),
  marketplace_suspended: z.boolean().optional(),
})

/**
 * What a `/users/{u}` answer refreshes on the row, in the row's own names.
 *
 * The rating and its count as well as the two trust fields: a profile in hand
 * is the only place they come from, and a shop dug before they were stored
 * showed "no ratings yet" over fifty thousand of them. Absent fields leave
 * the row as it was — a profile that says nothing is not a profile that says
 * zero.
 */
export function trustOf(
  profile: DealerProfile,
  existing?: { sellerRating: number; ratingCount: number },
): {
  registeredAt: string | null
  suspended: boolean
  sellerRating: number
  ratingCount: number
} {
  return {
    registeredAt: profile.registered ?? null,
    suspended: profile.marketplace_suspended === true,
    sellerRating: profile.seller_rating ?? existing?.sellerRating ?? 0,
    ratingCount: profile.seller_num_ratings ?? existing?.ratingCount ?? 0,
  }
}

/**
 * Only the fields a match needs. The seller object is repeated in full inside
 * every listing — 100 copies of the same ~800-byte blob per page — and is
 * dropped here rather than carried around (docs/02 §3).
 *
 * **One field of it survives, since 2026-09-13.** `seller.shipping` is the
 * shop's own postage text, and it was reachable only by pasting a listing into
 * the basket — so a shop met by digging had none, and the screen that shows it
 * showed nothing. Zod keeps what the schema names and throws the rest away, so
 * this is one string per row rather than the blob: the reason the object was
 * dropped still holds for everything else in it.
 */
export const inventoryPageSchema = z.object({
  pagination: paginationSchema,
  listings: z.array(
    z.object({
      id: z.number().int(),
      status: z.string().optional(),
      condition: z.string().optional(),
      sleeve_condition: z.string().optional(),
      comments: z.string().optional(),
      ships_from: z.string().optional(),
      /*
       * When the dealer put it up, as ISO 8601 with an offset.
       *
       * The anchor for "was ist neu seit dem letzten Mal": `sort=listed` orders
       * by exactly this, so a descending walk can stop at the first listing
       * that is not newer than the last visit. Optional because a schema that
       * throws on a field Discogs might one day omit would break the scan for
       * a field the scan can live without.
       */
      posted: z.string().optional(),
      /** The shop's postage text. The same on every row; read once, at the end. */
      seller: z
        .object({
          shipping: z.string().optional(),
          /* Both on every row too (M34.2): the floor an order has to reach, and how the shop is paid. */
          min_order_total: z.number().nullable().optional(),
          payment: z.string().nullable().optional(),
        })
        .optional(),
      price: z.object({ value: z.number(), currency: z.string() }).partial().optional(),
      release: z.object({
        id: z.number().int(),
        title: z.string(),
        artist: z.string().optional(),
        format: z.string().optional(),
        label: z.string().optional(),
        catalog_number: z.string().optional(),
        year: z.number().int().optional(),
        thumbnail: z.string().optional(),
      }),
    }),
  ),
})

export type InventoryPage = z.infer<typeof inventoryPageSchema>
export type DealerProfile = z.infer<typeof dealerSchema>

export function toListing(row: InventoryPage['listings'][number]): Listing {
  return {
    listingId: row.id,
    releaseId: row.release.id,
    title: row.release.title,
    artist: row.release.artist ?? '',
    label: row.release.label ?? null,
    catno: row.release.catalog_number ?? null,
    format: row.release.format ?? null,
    year: row.release.year ?? null,
    condition: row.condition ?? null,
    sleeve: row.sleeve_condition ?? null,
    price: row.price?.value ?? null,
    currency: row.price?.currency ?? null,
    shipsFrom: row.ships_from ?? null,
    comments: row.comments ?? null,
    thumbUrl: row.release.thumbnail || null,
    postedAt: row.posted ?? null,
  }
}
