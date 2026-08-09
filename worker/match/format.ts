/**
 * Format matching against the inventory's format string.
 *
 * The trap: the collection says `formats: ["Vinyl", "LP", "Album"]`, but an
 * inventory listing says `format: "12\", RE, RM"` or `"2xLP, Album"`. The word
 * "Vinyl" never appears there. A naive `format.includes('Vinyl')` therefore
 * discards essentially every record — and a dig that silently returns nothing
 * looks like a dealer with nothing for you rather than a broken filter.
 *
 * So the preference is treated as a medium, and each medium knows the tokens
 * Discogs actually writes, including the quantity prefix it puts on them
 * ("2xLP", "3x12\""). A medium is decided by what a listing *is*, not by what
 * it is not: a 2xLP sold with a bonus CD is still a record.
 */

/** "2x", "3 × " — Discogs writes the quantity in front of the medium. */
const COUNT = String.raw`(?:\d+\s*[x×]\s*)?`

function medium(words: string[], sizes: string[] = []): RegExp {
  const parts = [
    // Not preceded by a letter, so "2xLP" matches but "FLAC" does not hide an
    // "LP" inside another word.
    String.raw`(?<![a-z])${COUNT}(?:${words.join('|')})\b`,
    // The size markers end in a quote, which is not a word character — a
    // trailing \b there could never match.
    ...(sizes.length > 0 ? [String.raw`(?<![\w])${COUNT}(?:${sizes.join('|')})\s*"`] : []),
  ]
  return new RegExp(parts.join('|'), 'i')
}

const MEDIUM_TOKENS: Record<string, RegExp> = {
  Vinyl: medium(['vinyl', 'lp', 'shellac', 'acetate', 'flexi-disc'], ['7', '10', '12']),
  CD: medium(['cd', 'cdr', 'hdcd', 'sacd', 'vcd']),
  Cassette: medium(['cass', 'cassette', '8-track', 'dcc', 'minidisc']),
  File: medium(['file', 'flac', 'mp3', 'wav', 'aiff']),
  DVD: medium(['dvd', 'blu-ray', 'bluray']),
}

export function matchesFormat(format: string | null, allowed: string[]): boolean {
  // No preference means no filter.
  if (allowed.length === 0) return true
  // A listing without a format cannot be judged, and dropping it silently
  // would hide records for no reason.
  if (!format) return true

  return allowed.some((name) => {
    const pattern = MEDIUM_TOKENS[name]
    // An unknown medium falls back to a plain substring test, so a preference
    // we have not modelled still does something sensible.
    return pattern ? pattern.test(format) : format.toLowerCase().includes(name.toLowerCase())
  })
}
