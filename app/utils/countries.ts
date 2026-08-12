/**
 * The countries a record can be shipped from.
 *
 * Two-letter codes and nothing else — the names come from `Intl.DisplayNames`,
 * which every target browser has and which speaks the reader's language for
 * free. A hand-written list of 250 names in two languages would be 8 KB of
 * translation nobody asked for and a source of typos in both.
 *
 * **Stored and compared in English**, because that is what Discogs sends:
 * `ships_from` is `"Germany"`, `"United Kingdom"` — an English name, never a
 * code (measured 2026-08-12, docs/02). The codes are the picker's own keys and
 * never leave it; what lands in the preference is the English name, which is
 * also what the matching engine already compares against. No migration, and
 * nothing downstream has to learn a new vocabulary.
 */

/** ISO 3166-1 alpha-2, minus the ones nobody sells records from. */
const CODES =
  'AD AE AF AG AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ ' +
  'CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM ' +
  'FO FR GA GB GD GE GH GI GL GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT ' +
  'JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG ' +
  'MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL ' +
  'PR PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG ' +
  'TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW'

/**
 * The English name, which is the one that has to match Discogs.
 *
 * Built once: `Intl.DisplayNames` is not free to construct, and this runs for
 * every keystroke in the search field.
 */
const english = new Intl.DisplayNames(['en'], { type: 'region' })

export interface Country {
  code: string
  /** What Discogs calls it, and what is stored. */
  name: string
}

export const COUNTRIES: Country[] = CODES.split(' ')
  .map((code) => ({ code, name: english.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

/** The reader's own word for it, for the label beside the checkbox. */
export function localName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
