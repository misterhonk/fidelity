import { ROLE_TABLE, type HorizonChunk, type HorizonKind } from '#shared/types'

/**
 * Packing an expanded entity into parallel TypedArrays.
 *
 * 200.000 release ids cost about 800 KB this way and roughly 9 MB as an object
 * list — on a device that also has to hold the collection, the wantlist and a
 * dig. Sorted, so a binary search is possible and so it compresses well.
 */

export interface Edge {
  releaseId: number
  /** Index into ROLE_TABLE; 0 is 'main'. */
  role: number
  year: number
  /** Numeric part of a catalogue number, for CATALOG_RUN. Labels only. */
  catnoNum?: number
  catnoPrefix?: string
}

export function roleIndex(role: string | undefined): number {
  if (!role) return 0
  const found = ROLE_TABLE.indexOf(role as (typeof ROLE_TABLE)[number])
  // An unknown role counts as a main credit rather than being dropped: the
  // edge is still true, only its label is unfamiliar.
  return found >= 0 ? found : 0
}

/**
 * "BLP 4058" → { prefix: "BLP", num: 4058 }.
 *
 * Catalogue numbers are the messiest field Discogs has. Anything that does not
 * split cleanly into letters and digits is left out rather than guessed at —
 * a wrong series is worse than no series.
 */
export function parseCatno(catno: string | undefined): { prefix: string; num: number } | null {
  if (!catno) return null
  // Prefix, then the number, then an optional format suffix like "lp" or "cd".
  const match = /^([A-Za-z][A-Za-z\s.-]{0,9}?)\s*[-\s]?\s*(\d{1,6})\s*[A-Za-z]{0,4}$/.exec(
    catno.trim(),
  )
  if (!match) return null

  const prefix = match[1]!.replace(/[\s.-]+$/, '').toUpperCase()
  const num = Number(match[2])
  return prefix.length > 0 && Number.isFinite(num) ? { prefix, num } : null
}

export function packChunk(
  kind: HorizonKind,
  entityId: number,
  name: string,
  edges: Edge[],
  meta: { fetchedAt: number; complete: boolean; requests: number },
): HorizonChunk {
  // Deduplicated and sorted: an artist can appear on the same release twice
  // with different roles, and the strongest role wins.
  const byRelease = new Map<number, Edge>()
  for (const edge of edges) {
    const existing = byRelease.get(edge.releaseId)
    if (!existing || edge.role < existing.role) byRelease.set(edge.releaseId, edge)
  }

  const sorted = [...byRelease.values()].sort((a, b) => a.releaseId - b.releaseId)

  const chunk: HorizonChunk = {
    key: `${kind}:${entityId}`,
    kind,
    entityId,
    name,
    fetchedAt: meta.fetchedAt,
    complete: meta.complete,
    requests: meta.requests,
    releaseIds: Int32Array.from(sorted, (edge) => edge.releaseId),
    roles: Uint8Array.from(sorted, (edge) => edge.role),
    years: Int16Array.from(sorted, (edge) => clampYear(edge.year)),
  }

  // Catalogue numbers only where a series can exist, and only when one prefix
  // actually dominates — docs/03 stores a single prefix per chunk.
  const prefixes = sorted.map((edge) => edge.catnoPrefix).filter(Boolean) as string[]
  if (prefixes.length > 0) {
    const dominant = mostCommon(prefixes)
    chunk.catnoPrefix = dominant
    chunk.catnoNums = Int32Array.from(sorted, (edge) =>
      edge.catnoPrefix === dominant && edge.catnoNum !== undefined ? edge.catnoNum : 0,
    )
  }

  return chunk
}

/** Int16 tops out at 32.767; a year outside the plausible range is "unknown". */
function clampYear(year: number): number {
  return year >= 1880 && year <= 2100 ? year : 0
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0]
}

/** Binary search over the sorted ids — the lookup a dig does per listing. */
export function indexOfRelease(chunk: HorizonChunk, releaseId: number): number {
  let low = 0
  let high = chunk.releaseIds.length - 1

  while (low <= high) {
    const mid = (low + high) >> 1
    const value = chunk.releaseIds[mid]!
    if (value === releaseId) return mid
    if (value < releaseId) low = mid + 1
    else high = mid - 1
  }

  return -1
}
