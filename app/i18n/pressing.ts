import type { PressingWarning, PressingWarningKind } from '#shared/types'

import { activeLanguage } from '~/composables/useMessages'

/**
 * What a pressing warning says.
 *
 * The facts come from `worker/match/pressing.ts`, which knows what the record
 * is; the sentence is written here, which knows what language it is read in.
 * Same split as the Barry sentence, and for the same reason.
 *
 * It never says a reissue is bad — plenty of people want the 180 g remaster.
 * It says what the record *is*, so the price can be judged against the right
 * thing.
 */

type Facts = PressingWarning['facts']
type Phrase = (facts: Facts) => string

const en: Record<PressingWarningKind, Phrase> = {
  reissue: ({ country, year, masterYear }) => {
    const where = country ? `${country} ` : ''
    const when = year ? ` from ${year}` : ''
    const original = masterYear ? `, not the ${masterYear} original` : ''
    return `${where}reissue${when}${original}.`
  },
  'late-pressing': ({ year, masterYear }) =>
    `Pressed ${year}, the album is from ${masterYear} — probably not a first pressing.`,
  special: ({ special }) => `Filed as "${special}" — that is not an ordinary retail pressing.`,
  'claims-original-but-reissue': () =>
    'The dealer writes "original"; Discogs lists this pressing as a reissue.',
  'claims-original-but-late': ({ year, masterYear }) =>
    `The dealer writes "original", but it was pressed ${year} — the album is from ${masterYear}.`,
}

const de: Record<PressingWarningKind, Phrase> = {
  reissue: ({ country, year, masterYear }) => {
    const where = country ? `${country}-` : ''
    const when = year ? ` von ${year}` : ''
    const original = masterYear ? `, nicht das Original von ${masterYear}` : ''
    return `${where}Neuauflage${when}${original}.`
  },
  'late-pressing': ({ year, masterYear }) =>
    `Gepresst ${year}, das Album ist von ${masterYear} – vermutlich keine Erstpressung.`,
  special: ({ special }) =>
    `Als „${special}" eingetragen – das ist keine normale Handelspressung.`,
  'claims-original-but-reissue': () =>
    'Der Händler schreibt „Original", Discogs führt diese Pressung als Neuauflage.',
  'claims-original-but-late': ({ year, masterYear }) =>
    `Der Händler schreibt „Original", gepresst wurde ${year} – das Album ist von ${masterYear}.`,
}

export const packs = { en, de }

/** Read per call, so a sheet already open follows a language switch. */
export function pressingText(warning: PressingWarning): string {
  return packs[activeLanguage()][warning.kind](warning.facts)
}
