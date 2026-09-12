/**
 * The roles the engine knows, by index — `ROLE_TABLE` in `shared/types.ts`,
 * in the same order, because a chunk built here is read there by index.
 */
export const ROLE_TABLE = [
  'main',
  'Producer',
  'Engineer',
  'Mixed By',
  'Mastered By',
  'Remix',
  'Co-producer',
] as const

/**
 * A dump credit is "Producer, Mixed By [Additional]" — several roles in one
 * string, each with an optional qualifier in brackets. The API hands the app
 * one role per row; this hands over the strongest known one, and -1 when
 * none of them is in the table, so the row is still there for the person's
 * full credit list without pretending to be a signal.
 */
export function roleIndex(credit: string): number {
  let best = -1
  for (const part of credit.split(',')) {
    const role = part.replace(/\[.*?\]/g, '').trim()
    const index = ROLE_TABLE.indexOf(role as (typeof ROLE_TABLE)[number])
    if (index > 0 && (best === -1 || index < best)) best = index
  }
  return best
}
