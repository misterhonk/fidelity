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
const basicInformationSchema = z.object({
  id: z.number().int(),
  /** 0 or null both mean "no master". */
  master_id: z.number().int().nullable().optional(),
  title: z.string(),
  year: z.number().int().optional(),
  artists: z.array(z.object({ id: z.number().int(), name: z.string() })).optional(),
  labels: z
    .array(z.object({ id: z.number().int(), name: z.string(), catno: z.string().optional() }))
    .optional(),
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  formats: z
    .array(z.object({ name: z.string(), descriptions: z.array(z.string()).optional() }))
    .optional(),
})

export const collectionPageSchema = z.object({
  pagination: paginationSchema,
  releases: z.array(
    z.object({
      id: z.number().int(),
      instance_id: z.number().int().optional(),
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
      basic_information: basicInformationSchema,
    }),
  ),
})

export type BasicInformation = z.infer<typeof basicInformationSchema>
export type CollectionPage = z.infer<typeof collectionPageSchema>
export type WantlistPage = z.infer<typeof wantlistPageSchema>
export type DiscogsIdentity = z.infer<typeof identitySchema>
export type DiscogsUserProfile = z.infer<typeof userProfileSchema>
