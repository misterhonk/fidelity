import { z } from 'zod'

import { getPreferences, setMeta } from '~~/db/meta'
import { openFidelityDb } from '~~/db/open'
import type { CollectionValue, ValuePoint } from '#shared/types'
import type { DiscogsClient } from '../discogs/client'

/**
 * What the shelf is worth, as far as Discogs is concerned.
 *
 * One request, on the back of a sync that was going to run anyway — a number
 * that changes with the market is not worth a request every time somebody
 * opens a screen. Once a day at most, even when the shelf did not change
 * (`worker/sync/library.ts`), because since M19 #3 the number is also kept:
 * one row per day, and a line through them on the map.
 *
 * The three values arrive as formatted strings ("€668.62"), currency and all,
 * and are kept exactly as they came for the screen. For the line they are
 * also read as cents — see `parseMoney` for what that reading dares and what
 * it refuses.
 */

const valueSchema = z.object({
  minimum: z.string(),
  median: z.string(),
  maximum: z.string(),
})

/**
 * A formatted amount, read as cents — or null.
 *
 * Discogs formats the estimate in the account's currency, with that currency's
 * symbol and separators: "€668.62", "$1,234.56", "£12.00", "¥1,234". The
 * currency is not read from the string at all — the preferences know it — and
 * the number is read by one rule: the last separator is the decimal mark if
 * one or two digits follow it, otherwise it is a thousands separator. That
 * covers "1,941.57", "1.941,57" and "¥1,234" alike, and returns null for
 * anything that leaves no digits, rather than a number nobody typed.
 */
export function parseMoney(text: string): number | null {
  const digits = text.replace(/[^0-9.,]/g, '')
  if (!/\d/.test(digits)) return null

  const last = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','))
  const after = last >= 0 ? digits.slice(last + 1) : ''
  const decimal = last >= 0 && after.length >= 1 && after.length <= 2 && /^\d+$/.test(after)

  const whole = (decimal ? digits.slice(0, last) : digits).replace(/[.,]/g, '')
  if (!/^\d+$/.test(whole)) return null

  const cents = Number(whole) * 100 + (decimal ? Number(after.padEnd(2, '0')) : 0)
  return Number.isFinite(cents) ? cents : null
}

/** The ISO day in local time — the row's key. */
export function dayOf(at: number): string {
  const date = new Date(at)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

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
    await recordValue(value)
    return value
  } catch {
    // A missing estimate is not worth an error anywhere. The screen simply
    // leaves the line out, which is also what it does before the first sync.
    return null
  }
}

/**
 * One row for the day; a second fetch the same day replaces the first.
 *
 * The currency comes from the preferences rather than from the string, which
 * is the one place the app knows it — and it travels with the row, so a line
 * drawn next year still knows what it was drawn in.
 */
export async function recordValue(value: CollectionValue): Promise<ValuePoint> {
  const { currency } = await getPreferences()
  const point: ValuePoint = {
    day: dayOf(value.fetchedAt),
    minimum: value.minimum,
    median: value.median,
    maximum: value.maximum,
    minimumCents: parseMoney(value.minimum),
    medianCents: parseMoney(value.median),
    maximumCents: parseMoney(value.maximum),
    currency,
    fetchedAt: value.fetchedAt,
  }
  const db = await openFidelityDb()
  await db.put('valueHistory', point)
  return point
}

/** Every day kept, oldest first — the key sorts that way on its own. */
export async function valueHistory(): Promise<ValuePoint[]> {
  const db = await openFidelityDb()
  return db.getAll('valueHistory')
}
