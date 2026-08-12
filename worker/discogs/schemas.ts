import { z } from 'zod'

/**
 * Zod at the boundary and nowhere else. These describe only the fields we
 * actually read — Discogs sends a great deal more, and pinning fields we
 * ignore would turn their next additive change into our outage.
 */

/** GET /oauth/identity — the cheapest way to prove a token works. */
export const identitySchema = z.object({
  id: z.number().int(),
  username: z.string().min(1),
})

/** GET /users/{username} */
export const userProfileSchema = z.object({
  id: z.number().int(),
  username: z.string().min(1),
  avatar_url: z.string().optional(),
  num_collection: z.number().int().optional(),
  num_wantlist: z.number().int().optional(),
})

/**
 * `pagination.pages` is honest for collection and wantlist. It lies for
 * inventories (docs/02 §3) — that is a problem for M2, not here.
 */
export const paginationSchema = z.object({
  page: z.number().int(),
  pages: z.number().int(),
  items: z.number().int(),
})

/**
 * Identical in the collection and the wantlist, so one parser covers both.
 * Richer than the inventory equivalent, and crucially it carries IDs.
 */
export const basicInformationSchema = z.object({
  id: z.number().int(),
  /** 0 or null both mean "no master". */
  master_id: z.number().int().nullable().optional(),
  title: z.string(),
  /**
   * The 150px cover, already in this response — we were throwing it away.
   *
   * Worth roughly 90 bytes a record and no request at all, which is what makes
   * a shelf of covers possible without breaking the image rate limit: the
   * browser fetches them lazily as they scroll into view, and the service
   * worker keeps them (docs/02, i.discogs.com has its own ~30–40/min budget).
   */
  thumb: z.string().optional(),
  /** The 600px version, for a grid on a screen with room. Same response. */
  cover_image: z.string().optional(),
  year: z.number().int().optional(),
  artists: z.array(z.object({ id: z.number().int(), name: z.string() })).optional(),
  labels: z
    .array(z.object({ id: z.number().int(), name: z.string(), catno: z.string().optional() }))
    .optional(),
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  /*
   * More than the word "Vinyl", and all of it already paid for.
   *
   * `qty` is how many discs — a string, because Discogs sends "2" and not 2 —
   * and `text` is the free line the submitter typed: "Blue Translucent",
   * "Etched", "Numbered". Both ride along in `basic_information` (measured
   * against the live API 2026-08-12, and docs/02 §Sammlung) and were being
   * parsed away, which is why a double LP looked exactly like a single.
   */
  formats: z
    .array(
      z.object({
        name: z.string(),
        qty: z.string().optional(),
        text: z.string().optional(),
        descriptions: z.array(z.string()).optional(),
      }),
    )
    .optional(),
})

/**
 * GET /releases/{id} — everything the collection sync does not carry.
 *
 * Only the fields actually shown, per the rule at the top of this file: what
 * is pinned here becomes an outage the day Discogs adds a sibling key.
 * `duration` is very often an empty string and `position` can be anything from
 * "A1" to "" on a CD, so neither is trusted to be useful, only to be a string.
 */
export const releaseDetailSchema = z.object({
  id: z.number().int(),
  country: z.string().optional(),
  released: z.string().optional(),
  notes: z.string().optional(),
  tracklist: z
    .array(
      z.object({
        position: z.string().optional(),
        title: z.string().optional(),
        duration: z.string().optional(),
        /** "track", "heading", "index" — a heading is a section, not a song. */
        type_: z.string().optional(),
      }),
    )
    .optional(),
  extraartists: z.array(z.object({ name: z.string(), role: z.string().optional() })).optional(),
  identifiers: z
    .array(
      z.object({
        type: z.string().optional(),
        value: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  community: z
    .object({
      rating: z.object({ average: z.number().optional(), count: z.number().optional() }),
    })
    .optional(),
  videos: z.array(z.object({ title: z.string().optional(), uri: z.string() })).optional(),
  /*
   * The only two marketplace numbers in this response, and the reason the
   * request carries `curr_abbr`: Discogs prices in the caller's currency and
   * names it nowhere in the body. A number without a currency is not a price.
   */
  lowest_price: z.number().nullable().optional(),
  num_for_sale: z.number().int().optional(),
})

export const collectionPageSchema = z.object({
  pagination: paginationSchema,
  releases: z.array(
    z.object({
      id: z.number().int(),
      // Beide zusammen adressieren einen Sammlungseintrag beim Schreiben:
      // ein Release kann mehrfach im Regal stehen, eine Instanz nur einmal.
      instance_id: z.number().int().optional(),
      folder_id: z.number().int().optional(),
      date_added: z.string(),
      rating: z.number().optional(),
      basic_information: basicInformationSchema,
    }),
  ),
})

export const wantlistPageSchema = z.object({
  pagination: paginationSchema,
  wants: z.array(
    z.object({
      id: z.number().int(),
      date_added: z.string(),
      rating: z.number().optional(),
      // What you wrote down about why you want it — "only the German press",
      // "not the 2016 repress". Verified present on every row, 2026-08-12.
      notes: z.string().optional(),
      basic_information: basicInformationSchema,
    }),
  ),
})

export type BasicInformation = z.infer<typeof basicInformationSchema>
export type CollectionPage = z.infer<typeof collectionPageSchema>
export type WantlistPage = z.infer<typeof wantlistPageSchema>
export type DiscogsIdentity = z.infer<typeof identitySchema>
export type DiscogsUserProfile = z.infer<typeof userProfileSchema>
