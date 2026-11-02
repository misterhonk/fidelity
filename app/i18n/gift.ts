import { activeLanguage } from '~/composables/useMessages'

/**
 * The gift finder (#245), in its own chunk: one screen, reached from the
 * shops page, and loaded only by somebody who opens it.
 */

const en = {
  title: 'A gift for a friend',
  lead: 'What a friend wants, in the shops you scanned, within your budget.',
  who: 'Their Discogs name or profile link',
  budget: 'Most per record',
  find: 'Find',
  forgotten: 'Their wantlist is read now and forgotten when you leave this page.',
  badName: 'That is not a Discogs name or profile link.',
  looking: 'Asking Discogs for their wantlist…',
  reading: (read: string, total: string) => `Reading their wantlist: ${read} of ${total}.`,
  closed: 'Their wantlist is private, or there is no such name.',
  found: (ideas: number, wanted: string) =>
    `${ideas} of their ${wanted} wants ${ideas === 1 ? 'is' : 'are'} in your shops within the budget.`,
  none: 'None of their wants is in a shop you scanned in the last six hours within the budget.',
  owned: (n: number) => `${n} they already own ${n === 1 ? 'was' : 'were'} left out.`,
  collectionClosed: 'Their collection is private, so they may own some of these.',
  overBudget: (n: number) => `${n} more only above the budget.`,
  open: 'opens on Discogs',
  expires: (at: string) => `Prices as dug, good until ${at}.`,
}

const de: typeof en = {
  title: 'Ein Geschenk für jemanden',
  lead: 'Was sich jemand wünscht, in deinen gescannten Läden, in deinem Budget.',
  who: 'Discogs-Name oder Profil-Link',
  budget: 'Höchstens pro Platte',
  find: 'Suchen',
  forgotten: 'Die Wantlist wird jetzt gelesen und vergessen, wenn du die Seite verlässt.',
  badName: 'Das ist kein Discogs-Name und kein Profil-Link.',
  looking: 'Frage Discogs nach der Wantlist…',
  reading: (read: string, total: string) => `Lese die Wantlist: ${read} von ${total}.`,
  closed: 'Die Wantlist ist privat, oder den Namen gibt es nicht.',
  found: (ideas: number, wanted: string) =>
    `${ideas} von ${wanted} Wünschen ${ideas === 1 ? 'liegt' : 'liegen'} in deinen Läden im Budget.`,
  none: 'Keiner der Wünsche liegt im Budget in einem Laden aus den letzten sechs Stunden.',
  owned: (n: number) => `Schon in der Sammlung, darum weggelassen: ${n}.`,
  collectionClosed: 'Die Sammlung ist privat. Ein paar davon könnten schon dort stehen.',
  overBudget: (n: number) => `${n} weitere nur über dem Budget.`,
  open: 'öffnet bei Discogs',
  expires: (at: string) => `Preise vom Scan, gültig bis ${at}.`,
}

export const packs = { en, de }

export function useGiftMessages() {
  return computed(() => packs[activeLanguage()])
}
