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

export type DiscogsIdentity = z.infer<typeof identitySchema>
export type DiscogsUserProfile = z.infer<typeof userProfileSchema>
