/**
 * The single normalisation point for artist and label names
 * (docs/01-ARCHITEKTUR.md §8, step 1).
 *
 * It runs once per name at sync time, never per dig. That is the difference
 * between 40 ms and 40 ms times the number of digs ever run.
 *
 * Both sides of a match come out of the same Discogs database, so the strings
 * are canonical and a normalised exact match has very high precision — which
 * is why this stays deliberately conservative.
 */

/**
 * Letters that carry no combining mark and therefore survive NFD untouched.
 * Ø is an artist, ß shows up in German label names; without these the fold is
 * silently incomplete.
 */
const STANDALONE: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  þ: 'th',
  ħ: 'h',
  ı: 'i',
}

/** Leading articles, in the languages this collection actually contains. */
const LEADING_ARTICLE = /^(the|die|der|das|les|los|la|le)\s+/

export function norm(value: string | null | undefined): string {
  return (
    (value ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[øæœßđðłþħı]/g, (char) => STANDALONE[char] ?? char)
      .replace(LEADING_ARTICLE, '')
      // Parentheses survive on purpose: "nirvana (2)" is a DIFFERENT artist
      // from "nirvana", and folding them together would be a wrong match, not a
      // fuzzy one. & survives because "Simon & Garfunkel" is one name.
      .replace(/[^a-z0-9()& ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Names that are never an artist match, however well they compare. */
const NOT_AN_ARTIST = new Set([
  'various',
  'various artists',
  'v a',
  'unknown artist',
  'no artist',
])

export function isAnonymousArtist(normalised: string): boolean {
  return NOT_AN_ARTIST.has(normalised)
}

/**
 * Splits the several artists an inventory listing crams into one string.
 *
 * Only on "/", which is what Discogs uses to join credited artists. Not on
 * "&": "Simon & Garfunkel" is one act, and splitting it would invent two
 * artists that do not exist.
 */
export function splitArtists(raw: string): string[] {
  return raw
    .split('/')
    .map((part) => norm(part))
    .filter((part) => part.length > 0)
}

/**
 * Tokens for the containment stage of the cascade: an inventory listing gives
 * "Kraftwerk / Neu!" as one string, and the collection knows them separately.
 */
export function tokens(normalised: string): string[] {
  return normalised.split(' ').filter((token) => token.length > 1)
}
