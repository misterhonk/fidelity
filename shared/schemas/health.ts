import { z } from 'zod'

export const healthCheckSchema = z.object({
  ok: z.boolean(),
  /** Round-trip time in milliseconds, or null when the check never completed. */
  latencyMs: z.number().int().nonnegative().nullable(),
  detail: z.string().optional(),
})

/**
 * Shape of `GET /api/health`.
 *
 * M0 can only speak for the database. pg-boss, the last successful dig and the
 * remaining Discogs rate-limit budget join `checks` in M1/M2 — stubbing them
 * now would make a red system look green (docs/07-DEV-PIPELINE.md §8).
 */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  checkedAt: z.iso.datetime(),
  checks: z.object({
    database: healthCheckSchema,
  }),
})

export type HealthCheck = z.infer<typeof healthCheckSchema>
export type HealthResponse = z.infer<typeof healthResponseSchema>
