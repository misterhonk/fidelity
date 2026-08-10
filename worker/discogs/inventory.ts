import { z } from 'zod'

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
   * Das Ladenschild.
   *
   * Free — this endpoint is fetched anyway, once per dig, to find out how big
   * the shop is. Most sellers have set one; the ones who have not get Discogs'
   * grey default, which is why the screens fall back to initials rather than
   * drawing somebody else's placeholder.
   */
  avatar_url: z.string().optional(),
})

/**
 * Only the fields a match needs. The seller object is repeated in full inside
 * every listing — 100 copies of the same ~800-byte blob per page — and is
 * dropped here rather than carried around (docs/02 §3).
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
