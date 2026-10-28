/**
 * How much of `needle` appears in `haystack`, 0–1.
 *
 * Jaccard is the wrong measure when one string is the other plus decoration.
 * A marketplace title is the album title with things bolted on — "Dummy
 * (Reissue)", "Dummy - 180g Vinyl, Gatefold" — and Jaccard reads those as
 * barely related (0,43) because it divides by the union, which the decoration
 * inflated. Containment divides by the needle alone, so extra words cost
 * nothing and a missing word still costs everything.
 *
 * Deliberately not a replacement for `similarity`: containment says nothing
 * about the other direction, which is exactly what the artist cascade needs
 * it to say.
 */
export function containment(needle: string, haystack: string): number {
  const small = trigrams(needle)
  const large = trigrams(haystack)
  if (small.size === 0 || large.size === 0) return 0

  let shared = 0
  for (const gram of small) {
    if (large.has(gram)) shared += 1
  }
  return shared / small.size
}

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
  // Gram → entries holding it, so a listing is only compared with names it shares a gram with.
  readonly #postings = new Map<string, number[]>()
  readonly #shared: Uint16Array

  constructor(entries: Iterable<{ value: T; key: string }>) {
    this.#entries = [...entries].map(({ value, key }) => ({
      value,
      key,
      grams: trigrams(key),
    }))
    this.#entries.forEach((entry, at) => {
      for (const gram of entry.grams) {
        const list = this.#postings.get(gram)
        if (list) list.push(at)
        else this.#postings.set(gram, [at])
      }
    })
    this.#shared = new Uint16Array(this.#entries.length)
  }

  /** Best match at or above the threshold, or null. */
  best(candidate: string, threshold: number): { value: T; similarity: number } | null {
    const grams = trigrams(candidate)
    if (grams.size === 0) return null

    // Count shared grams per entry; an entry sharing none scores 0 and is never touched.
    const shared = this.#shared
    const touched: number[] = []
    for (const gram of grams) {
      for (const at of this.#postings.get(gram) ?? []) {
        if (shared[at] === 0) touched.push(at)
        shared[at]! += 1
      }
    }

    let bestAt = -1
    let bestScore = threshold

    for (const at of touched) {
      const common = shared[at]!
      shared[at] = 0
      const size = this.#entries[at]!.grams.size
      const score = common / (grams.size + size - common)
      // Ties go to the later entry, as the linear scan this replaced did.
      if (score > bestScore || (score === bestScore && at > bestAt)) {
        bestScore = score
        bestAt = at
      }
    }

    return bestAt === -1 ? null : { value: this.#entries[bestAt]!.value, similarity: bestScore }
  }
}
