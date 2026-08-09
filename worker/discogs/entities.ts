import { z } from 'zod'

import { paginationSchema } from './schemas'

/**
 * The three expansion endpoints.
 *
 * Only the fields the horizon packs are described. Discogs sends a great deal
 * more per row — pinning what we ignore would turn their next additive change
 * into our outage.
 */

/**
 * GET /artists/{id}/releases
 *
 * Mixes `type: "master"` and `type: "release"`, and carries the `role` field
 * that makes the credit graph reachable for eleven requests instead of a
 * 10.4 GB dump: Main, Producer, Remix, Engineer and the rest.
 */
export const artistReleasesSchema = z.object({
  pagination: paginationSchema,
  releases: z.array(
    z.object({
      id: z.number().int(),
      type: z.string().optional(),
      /** Master rows carry the id of their main pressing. */
      main_release: z.number().int().optional(),
      role: z.string().optional(),
      year: z.number().int().optional(),
      title: z.string().optional(),
    }),
  ),
})

/** GET /labels/{id}/releases */
export const labelReleasesSchema = z.object({
  pagination: paginationSchema,
  releases: z.array(
    z.object({
      id: z.number().int(),
      catno: z.string().optional(),
      year: z.number().int().optional(),
      title: z.string().optional(),
    }),
  ),
})

/** GET /masters/{id}/versions — every pressing of one album. */
export const masterVersionsSchema = z.object({
  pagination: paginationSchema,
  versions: z.array(
    z.object({
      id: z.number().int(),
      released: z.string().optional(),
      catno: z.string().optional(),
      country: z.string().optional(),
    }),
  ),
})

export type ArtistReleasesPage = z.infer<typeof artistReleasesSchema>
export type LabelReleasesPage = z.infer<typeof labelReleasesSchema>
export type MasterVersionsPage = z.infer<typeof masterVersionsSchema>
