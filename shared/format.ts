/**
 * Das Format-Vokabular, für beide Seiten dasselbe.
 *
 * This lived in `worker/match/` while only the matcher needed it. Then the
 * screens needed it too — a dig that lists "Freude Am Tanzen · FAT 016 · 2003"
 * and leaves out whether that is a 7", a 12" or a CD has omitted most of the
 * decision — and the choice was a second token table in `app/` or one table
 * both sides read. Two tables of the same vocabulary is how one of them grows
 * a sixth medium and the other does not.
 *
 * `shared/` is where main thread and worker meet, so it is here. Nothing in it
 * computes anything heavy: it splits a string somebody is about to read.
 *
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
  /**
   * Tonband, eigenständig neben der Kassette.
   *
   * Discogs writes "Reel-To-Reel" and it is a different thing from a cassette
   * — different machine, different money, different buyer. Folding it in with
   * `Cassette` would let somebody who filters for tapes get reels they cannot
   * play, and somebody who wants reels find them under a name that is not
   * theirs.
   */
  'Reel-to-Reel': medium(['reel-to-reel', 'reel to reel', 'r2r']),
  File: medium(['file', 'flac', 'mp3', 'wav', 'aiff']),
  DVD: medium(['dvd', 'blu-ray', 'bluray']),
}

/**
 * Die Medien, die diese App kennt — für Filter *und* Anzeige dieselbe Liste.
 *
 * The settings screen used to carry its own copy of these five names. Two
 * lists of the same thing is how one of them quietly grows a sixth entry and
 * the other does not.
 */
export const MEDIUMS = Object.keys(MEDIUM_TOKENS)

/**
 * Was für eine Veröffentlichung das ist — Album, EP, Single, Maxi.
 *
 * A separate question from the medium, and the one a collector asks second:
 * `7", Single` and `12", Maxi-Single` are both vinyl and are not remotely the
 * same purchase. Discogs writes it as a descriptor in the same comma-joined
 * string ("CD, Album, RE, RM"), which is why it needs its own token table
 * rather than a second reading of the medium one.
 *
 * Ordered: the first match wins, so the more specific names come first. A
 * "Maxi-Single" is also a "Single" by substring and must not be called one.
 */
const KIND_TOKENS: [string, RegExp][] = [
  ['Maxi', /\bmaxi(-|\s)?single\b|\bmaxi\b/i],
  ['Mini-Album', /\bmini(-|\s)?album\b/i],
  ['Kompilation', /\bcomp(ilation)?\b/i],
  ['Box', /\bbox(\s?set)?\b/i],
  ['EP', /\bep\b/i],
  ['Album', /\balbum\b/i],
  ['LP', /(?<![a-z])(?:\d+\s*[x×]\s*)?lp\b/i],
  ['Single', /\bsingle\b/i],
]

/** Which kind of release a format string names, or null when it names none. */
export function kindOf(format: string | null): string | null {
  if (!format) return null
  for (const [name, pattern] of KIND_TOKENS) {
    if (pattern.test(format)) return name
  }
  return null
}

/**
 * The size on the record, where there is one. `7"` and `12"` are the two facts
 * a vinyl buyer reads first and neither the medium nor the kind carries them.
 */
export function sizeOf(format: string | null): string | null {
  return format?.match(/(?<![\w])(\d{1,2})\s*"/)?.[0]?.replace(/\s+/g, '') ?? null
}

export interface FormatFacts {
  medium: string | null
  kind: string | null
  size: string | null
}

/**
 * Ein Formatstring, aufgeteilt in das, was jemand wissen will.
 *
 * `2xCD, Album, Mono, Dlx, RE, RM` is six facts of which two matter at a
 * glance. The rest — mono, deluxe, reissue, remastered — is in the pressing
 * profile where somebody who wants it goes looking.
 */
export function describeFormat(format: string | null): FormatFacts {
  return { medium: mediumOf(format), kind: kindOf(format), size: sizeOf(format) }
}

/**
 * Which medium a format string names, or null when it names none we know.
 *
 * Discogs writes the medium a dozen ways — "2xLP", '12"', "CD, Album", "Vinyl,
 * LP, Album, RE" — so this reads the same token table the filter does rather
 * than a second, quietly different one.
 */
export function mediumOf(format: string | null): string | null {
  if (!format) return null
  for (const [name, pattern] of Object.entries(MEDIUM_TOKENS)) {
    if (pattern.test(format)) return name
  }
  return null
}

/**
 * Whether two format strings name the same medium.
 *
 * Unknown on either side is false: "I cannot tell" must not become "these are
 * the same", or a record gets silently dropped from a signal on a guess.
 */
export function sameMedium(a: string | null, b: string | null): boolean {
  const left = mediumOf(a)
  return left !== null && left === mediumOf(b)
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
