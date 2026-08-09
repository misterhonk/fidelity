import { customType, pgSchema } from 'drizzle-orm/pg-core'

/**
 * `app` holds everything we produce ourselves plus the mirrors of live Discogs
 * data. Anything derived from the marketplace carries an `expires_at` and falls
 * under the six-hour rule (docs/03-DATENMODELL.md).
 *
 * `catalog` (CC0 dumps, permanent, read-only) arrives with M5 and is
 * deliberately not modelled yet.
 */
export const appSchema = pgSchema('app')

/**
 * Drizzle 0.45 has no native `bytea`. OAuth tokens live here, encrypted at rest
 * via pgcrypto — never logged, never sent to the client.
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

export const digStatus = appSchema.enum('dig_status', [
  'queued',
  'scanning',
  'matching',
  'done',
  'failed',
  'cancelled',
])

export type DigStatus = (typeof digStatus.enumValues)[number]
