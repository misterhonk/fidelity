import type { PressingStamp, PressingWarning, PressingWarningKind } from '#shared/types'

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
    `Pressed ${year}, the album is from ${masterYear}. Probably not a first pressing.`,
  special: ({ special }) => `Filed as "${special}", so not an ordinary retail pressing.`,
  'claims-original-but-reissue': () =>
    'The shop writes "original"; Discogs lists this pressing as a reissue.',
  'claims-original-but-late': ({ year, masterYear }) =>
    `The shop writes "original", but it was pressed ${year}. The album is from ${masterYear}.`,
}

const de: Record<PressingWarningKind, Phrase> = {
  reissue: ({ country, year, masterYear }) => {
    const where = country ? `${country}-` : ''
    const when = year ? ` von ${year}` : ''
    const original = masterYear ? `, nicht das Original von ${masterYear}` : ''
    return `${where}Neuauflage${when}${original}.`
  },
  'late-pressing': ({ year, masterYear }) =>
    `Gepresst ${year}, das Album ist von ${masterYear}. Vermutlich keine Erstpressung.`,
  special: ({ special }) => `Als „${special}" eingetragen, also keine normale Handelspressung.`,
  'claims-original-but-reissue': () =>
    'Der Laden schreibt „Original", Discogs führt diese Pressung als Neuauflage.',
  'claims-original-but-late': ({ year, masterYear }) =>
    `Der Laden schreibt „Original", gepresst ist sie ${year}. Das Album ist von ${masterYear}.`,
}

export const packs = { en, de }

/**
 * The marks in a runout, named.
 *
 * `worker/match/pressing.ts` finds them and hands back the key; the label and
 * the sentence under it are written here, per language. The worker carries an
 * English copy of both as a fallback for a stored dig, and nothing reads it
 * while this pack is loaded.
 */
type StampText = { label: string; note: string }

const stampsEn: Record<PressingStamp['key'], StampText> = {
  RVG: { label: 'RVG', note: 'Rudy Van Gelder cut the lacquer.' },
  PLASTYLITE: {
    label: 'Plastylite ear',
    note: 'Pressed at Plastylite. On Blue Note, the mark of a first pressing.',
  },
  STERLING: { label: 'Sterling', note: 'Cut at Sterling Sound.' },
  MASTERDISK: { label: 'Masterdisk', note: 'Cut at Masterdisk.' },
  RL: {
    label: 'RL',
    note: 'Cut by Robert Ludwig, often the louder, more sought-after pressing.',
  },
  PORKY: { label: 'Porky / Pecko', note: 'Cut by George Peckham.' },
  KENDUN: { label: 'Kendun', note: 'Cut at Kendun Recorders.' },
}

const stampsDe: Record<PressingStamp['key'], StampText> = {
  RVG: { label: 'RVG', note: 'Rudy Van Gelder hat die Lackfolie geschnitten.' },
  PLASTYLITE: {
    label: 'Plastylite-Ohr',
    note: 'Gepresst bei Plastylite. Bei Blue Note das Merkmal der Erstpressung.',
  },
  STERLING: { label: 'Sterling', note: 'Geschnitten bei Sterling Sound.' },
  MASTERDISK: { label: 'Masterdisk', note: 'Geschnitten bei Masterdisk.' },
  RL: {
    label: 'RL',
    note: 'Robert Ludwig hat geschnitten, oft die lautere, gesuchtere Pressung.',
  },
  PORKY: { label: 'Porky / Pecko', note: 'George Peckham hat geschnitten.' },
  KENDUN: { label: 'Kendun', note: 'Geschnitten bei Kendun Recorders.' },
}

const stampPacks = { en: stampsEn, de: stampsDe }

/** Label and sentence for one mark, in the language on screen. */
export function stampText(stamp: PressingStamp): StampText {
  return stampPacks[activeLanguage()][stamp.key] ?? { label: stamp.label, note: stamp.note }
}

/** Read per call, so a sheet already open follows a language switch. */
export function pressingText(warning: PressingWarning): string {
  return packs[activeLanguage()][warning.kind](warning.facts)
}
