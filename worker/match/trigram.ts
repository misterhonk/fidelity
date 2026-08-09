/**
 * Trigram similarity — stage three of the fuzzy cascade, and the only
 * expensive one. It runs for the few hundred listings that the map lookup and
 * token containment did not catch, never for all 20.000.
 *
 * Modelled on pg_trgm, which the server design used to lean on: each word is
 * padded with two leading spaces and one trailing space before it is cut into
 * three-character grams, and similarity is the Jaccard index over the sets.
 * Keeping the same definition means the thresholds from docs/04 still mean
 * what they meant.
 */

export function trigrams(value: string): Set<string> {
  const grams = new Set<string>()

  for (const word of value.split(' ')) {
    if (word.length === 0) continue
    const padded = `  ${word} `
    for (let i = 0; i + 3 <= padded.length; i++) {
      grams.add(padded.slice(i, i + 3))
    }
  }

  return grams
}

/** Jaccard index of the two trigram sets, 0–1. */
export function similarity(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1

  const left = trigrams(a)
  const right = trigrams(b)
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  // Walk the smaller set — the intersection is the same either way.
  const [small, large] = left.size <= right.size ? [left, right] : [right, left]
  for (const gram of small) {
    if (large.has(gram)) shared += 1
  }

  return shared / (left.size + right.size - shared)
}

/**
 * Precomputes the trigram sets of a candidate list once, so a scan compares
 * against them without rebuilding them per listing.
 */
export class TrigramIndex<T> {
  readonly #entries: { value: T; key: string; grams: Set<string> }[]

  constructor(entries: Iterable<{ value: T; key: string }>) {
    this.#entries = [...entries].map(({ value, key }) => ({
      value,
      key,
      grams: trigrams(key),
    }))
  }

  /** Best match at or above the threshold, or null. */
  best(candidate: string, threshold: number): { value: T; similarity: number } | null {
    const grams = trigrams(candidate)
    if (grams.size === 0) return null

    let bestValue: T | null = null
    let bestScore = threshold

    for (const entry of this.#entries) {
      // Jaccard can never exceed the size ratio, so entries of a very
      // different length are skipped before their grams are touched.
      const ceiling =
        Math.min(grams.size, entry.grams.size) / Math.max(grams.size, entry.grams.size)
      if (ceiling < bestScore) continue

      let shared = 0
      for (const gram of grams) {
        if (entry.grams.has(gram)) shared += 1
      }
      const score = shared / (grams.size + entry.grams.size - shared)

      if (score >= bestScore) {
        bestScore = score
        bestValue = entry.value
      }
    }

    return bestValue === null ? null : { value: bestValue, similarity: bestScore }
  }
}
