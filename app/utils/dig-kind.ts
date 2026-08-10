import type { Dig } from '#shared/types'

/**
 * Worüber ein Dig überhaupt etwas sagen darf.
 *
 * A full dig read the shop, so it may speak about the shop: how much of it it
 * saw, and whether there was anything in it. A "nur das Neue" visit read what
 * arrived since the last time and knows nothing about the rest — its
 * denominator is what it found, and `coverage` is 1 by construction because it
 * stopped exactly where the known stock begins (worker/dig/scan.ts).
 *
 * Rendered with the same sentences, that came out as "0 von 0 gescannt
 * (100 %)" above "Bei diesem Händler nichts für dich" — a coverage claim and a
 * verdict about 35.900 records, from a visit that looked at none of them.
 *
 * Named here rather than left as two conditions in a template because it is
 * the same distinction in two places, and the failure was that only one of
 * them had it.
 */
export type DigKind =
  /** Read the whole shop, or as much of it as the pagination wall allows. */
  | 'full'
  /** Read what arrived since the last visit. Something had. */
  | 'incremental'
  /** Read what arrived since the last visit. Nothing had. */
  | 'incremental-empty'

export function digKind(dig: Pick<Dig, 'depth' | 'listingsTotal'>): DigKind {
  if (dig.depth !== 'neu') return 'full'
  return dig.listingsTotal === 0 ? 'incremental-empty' : 'incremental'
}
