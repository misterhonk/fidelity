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

import { COUNTRY_CODES } from '#shared/countries'

import { activeLocale } from '~/composables/useMessages'

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

export const COUNTRIES: Country[] = COUNTRY_CODES.split(' ')
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

/** English name → code, for the way back: Discogs hands over the name, not the code. */
const codeByName = new Map(
  COUNTRIES.map((country) => [country.name.toLowerCase(), country.code]),
)

/**
 * A country as Discogs writes it, in the language of the app.
 *
 * `ships_from` is an English name, and the app showed it as such in German
 * too — "aus Germany" on a shop, "Aus Germany" on the chip (seen 2026-09-12).
 * Same `Intl.DisplayNames` as the picker, so no second list; a name the table
 * does not know — "Europe", "Worldwide" — stays as written, which is still
 * right, only English.
 */
export function countryName(english: string | null | undefined): string {
  const name = (english ?? '').trim()
  if (!name) return ''
  const code = codeByName.get(name.toLowerCase())
  return code ? localName(code, activeLocale()) : name
}
