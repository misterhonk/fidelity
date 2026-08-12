import { z } from 'zod'

import { setMeta } from '~~/db/meta'
import type { CollectionValue } from '#shared/types'
import type { DiscogsClient } from '../discogs/client'

/**
 * What the shelf is worth, as far as Discogs is concerned.
 *
 * One request, and only ever on the back of a sync that was going to run
 * anyway — a number that changes with the market is not worth a request every
 * time somebody opens a screen.
 *
 * The three values arrive as formatted strings ("€668.62"), currency and all,
 * and are kept exactly as they came. Parsing them into numbers would mean
 * guessing at a locale and then formatting them back, twice as much work for
 * a result that can only be worse.
 */

const valueSchema = z.object({
  minimum: z.string(),
  median: z.string(),
  maximum: z.string(),
})

export async function refreshCollectionValue(
  client: DiscogsClient,
  username: string,
  now: number,
): Promise<CollectionValue | null> {
  try {
    const answer = await client.get(
      `/users/${encodeURIComponent(username)}/collection/value`,
      valueSchema,
    )
    const value: CollectionValue = { ...answer, fetchedAt: now }
    await setMeta('collectionValue', value)
    return value
  } catch {
    // A missing estimate is not worth an error anywhere. The screen simply
    // leaves the line out, which is also what it does before the first sync.
    return null
  }
}
