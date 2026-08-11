import type { PressingProfile, PressingStamp, PressingWarning } from '#shared/types'

/**
 * Pressing advice (docs/06 M7).
 *
 * The question a collector actually asks holding a record: is this the
 * original, and if not, does the price know that. Discogs has the answer and
 * almost no tool reads it — the runout groove, transcribed by whoever catalogued
 * the release, sits in `identifiers` and says who cut the lacquer.
 *
 * Costs nothing. The top-fifty pass already fetches `/releases/{id}` for S7,
 * S10 and S11; these fields come back in the same response (docs/02).
 *
 * Everything here is pure, and everything it claims is traceable to a field:
 * "Reissue" is not inferred, it is *stated* in `formats[].descriptions`. Where
 * something really is inferred — a year gap, a country — the profile says so
 * and the interface words it as a suspicion.
 */

/**
 * Mastering engineers and plants whose marks are worth recognising.
 *
 * docs/06 M7 names RVG, Porky, RL and Pecko. The rest were read off real
 * runouts while verifying the field (docs/02): Sterling and Masterdisk turn up
 * constantly, and the Plastylite "ear" is the single most quoted mark in jazz
 * collecting.
 *
 * The patterns are deliberately tight. A runout is a hand-transcribed field
 * full of noise, and a loose pattern turning "STERLING" out of "MASTERING"
 * would put a stamp on records that never had one.
 */
const STAMPS: { key: PressingStamp['key']; label: string; note: string; pattern: RegExp }[] = [
  {
    key: 'RVG',
    label: 'RVG',
    note: 'Rudy Van Gelder hat die Lackfolie geschnitten.',
    pattern: /(?:^|[^A-Z])RVG(?:[^A-Z]|$)/,
  },
  {
    key: 'PLASTYLITE',
    label: 'Plastylite-Ohr',
    note: 'Gepresst bei Plastylite – bei Blue Note das Merkmal der Erstpressung.',
    pattern: /\[ear\]|\bPlastylite\b/i,
  },
  {
    key: 'STERLING',
    label: 'Sterling',
    note: 'Geschnitten bei Sterling Sound.',
    pattern: /\bSTERLING\b/i,
  },
  {
    key: 'MASTERDISK',
    label: 'Masterdisk',
    note: 'Geschnitten bei Masterdisk.',
    pattern: /\bMASTERDISK\b/i,
  },
  {
    key: 'RL',
    label: 'RL',
    note: 'Robert Ludwig hat geschnitten – oft die lautere, gesuchtere Pressung.',
    // Initials, so the boundaries matter more than anywhere else here.
    pattern: /(?:^|[^A-Z])RL(?:[^A-Z]|$)/,
  },
  {
    key: 'PORKY',
    label: 'Porky / Pecko',
    note: 'George Peckham hat geschnitten.',
    pattern: /\bPORKY\b|\bPECKO\b|A PORKY PRIME CUT/i,
  },
  {
    key: 'KENDUN',
    label: 'Kendun',
    note: 'Geschnitten bei Kendun Recorders.',
    pattern: /\bKENDUN\b/i,
  },
]

/** Words Discogs itself uses for "not the first pressing". */
const REISSUE_WORDS = /^(reissue|repress|remastered|reproduction)$/i

/** …and for "not a normal commercial copy", which changes what a price means. */
const SPECIAL_WORDS = /^(promo|test pressing|white label|unofficial release|bootleg)$/i

export interface ReleaseFacts {
  country?: string
  year?: number
  released?: string
  formats?: { name?: string; text?: string; descriptions?: string[] }[]
  identifiers?: { type: string; value: string; description?: string }[]
}

/**
 * Reads a release payload into a pressing profile.
 *
 * `masterYear` is the album's own first year, from the horizon. It is what
 * turns "pressed 2015" into "a 2015 pressing of a 1959 album" — without it a
 * year is just a year.
 */
export function readPressing(facts: ReleaseFacts, masterYear: number | null): PressingProfile {
  const descriptions = (facts.formats ?? []).flatMap((format) => format.descriptions ?? [])
  const freeText = (facts.formats ?? [])
    .map((format) => format.text)
    .filter((text): text is string => Boolean(text))

  const runouts = (facts.identifiers ?? [])
    .filter((entry) => /matrix|runout/i.test(entry.type))
    .map((entry) => entry.value)

  const plant = (facts.identifiers ?? []).find((entry) => /pressing plant/i.test(entry.type))

  // Stamps are read from the runout *and* the free text: "Plastylite Pressing"
  // is usually typed into formats[].text rather than into the groove.
  const haystack = [...runouts, ...freeText].join(' ⏐ ')
  const stamps = STAMPS.filter((stamp) => stamp.pattern.test(haystack)).map((stamp) => ({
    key: stamp.key,
    label: stamp.label,
    note: stamp.note,
  }))

  const year = facts.year && facts.year > 1880 ? facts.year : null

  return {
    // Stated, not guessed. This is the field Discogs fills in itself.
    statedReissue: descriptions.some((entry) => REISSUE_WORDS.test(entry.trim())),
    special: descriptions.filter((entry) => SPECIAL_WORDS.test(entry.trim())),
    country: facts.country ?? null,
    year,
    masterYear,
    /** Positive when this pressing is younger than the album. */
    yearGap:
      year !== null && masterYear !== null && masterYear > 1880 ? year - masterYear : null,
    stamps,
    runouts,
    plant: plant?.value ?? null,
    freeText,
  }
}

/**
 * How many years younger a pressing has to be before it is worth a word.
 *
 * Three, because pressings genuinely run on for a year or two after release
 * and calling those reissues would be wrong. It is the same window docs/04
 * §S2 uses to be suspicious of a wantlist pressing, kept deliberately.
 */
export const REISSUE_YEAR_GAP = 3

/**
 * What is worth warning about — the trap from docs/06 M7.
 *
 * Only things a buyer could get wrong about *this* record. It never says a
 * reissue is bad: plenty of people want the 180 g remaster. It says what the
 * record is, so the price can be judged against the right thing.
 */
export function pressingWarnings(profile: PressingProfile): PressingWarning[] {
  const warnings: PressingWarning[] = []

  if (profile.statedReissue) {
    warnings.push({
      kind: 'reissue',
      severity: 'high',
      facts: {
        // "Worldwide" is not a country and reads as one in a sentence.
        country: profile.country && profile.country !== 'Worldwide' ? profile.country : null,
        year: profile.year,
        // Discogs uses years before 1880 as a placeholder; they are not a date.
        masterYear: profile.masterYear && profile.masterYear > 1880 ? profile.masterYear : null,
      },
    })
  } else if (profile.yearGap !== null && profile.yearGap >= REISSUE_YEAR_GAP) {
    // Not stated, so this is a suspicion, and the wording says so.
    warnings.push({
      kind: 'late-pressing',
      severity: 'medium',
      facts: { year: profile.year, masterYear: profile.masterYear },
    })
  }

  for (const special of profile.special) {
    warnings.push({ kind: 'special', severity: 'medium', facts: { special } })
  }

  return warnings
}

/**
 * Where the dealer's own words disagree with the release data.
 *
 * The check docs/06 M7 asks for, and the one place this file makes a claim
 * about somebody rather than about a record — so it only fires on a plain
 * contradiction, never on a hunch. "Original" written under a release Discogs
 * itself marks as a reissue is a plain contradiction.
 */
const ORIGINAL_CLAIM =
  /\b(original(?:e|s|es)?|first press(?:ing)?|erstpressung|1st press(?:ing)?|originalpressung)\b/i

const REISSUE_CLAIM = /\b(reissue|repress|neuauflage|nachpressung|remaster(?:ed|t)?)\b/i

export function pressingContradictions(
  comments: string | null,
  profile: PressingProfile,
): PressingWarning[] {
  if (!comments) return []

  const out: PressingWarning[] = []
  const claimsOriginal = ORIGINAL_CLAIM.test(comments) && !REISSUE_CLAIM.test(comments)

  if (claimsOriginal && profile.statedReissue) {
    out.push({ kind: 'claims-original-but-reissue', severity: 'high', facts: {} })
  } else if (
    claimsOriginal &&
    profile.yearGap !== null &&
    profile.yearGap >= REISSUE_YEAR_GAP
  ) {
    out.push({
      kind: 'claims-original-but-late',
      severity: 'medium',
      facts: { year: profile.year, masterYear: profile.masterYear },
    })
  }

  return out
}
