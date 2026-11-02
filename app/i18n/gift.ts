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
  checking: (read: string, total: string) =>
    `Checking their collection for the finds: ${read} of ${total}.`,
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
  checking: (read: string, total: string) =>
    `Schaue, ob die Funde schon in der Sammlung stehen: ${read} von ${total}.`,
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

const fr: typeof en = {
  title: 'Un cadeau pour quelqu’un',
  lead: 'Ce que quelqu’un désire, dans les boutiques que tu as fouillées, dans ton budget.',
  who: 'Son nom Discogs ou le lien de son profil',
  budget: 'Au plus par disque',
  find: 'Chercher',
  forgotten: 'La liste d’envies est lue maintenant et oubliée quand tu quittes la page.',
  badName: 'Ce n’est ni un nom Discogs ni un lien de profil.',
  looking: 'On demande la liste d’envies à Discogs…',
  reading: (read: string, total: string) =>
    `Lecture de la liste d’envies : ${read} sur ${total}.`,
  checking: (read: string, total: string) =>
    `On regarde si les trouvailles sont déjà dans la collection : ${read} sur ${total}.`,
  closed: 'La liste d’envies est privée, ou ce nom n’existe pas.',
  found: (ideas: number, wanted: string) =>
    `${ideas} des ${wanted} envies ${ideas < 2 ? 'est' : 'sont'} dans tes boutiques, dans le budget.`,
  none: 'Aucune des envies n’est dans le budget dans une boutique des six dernières heures.',
  owned: (n: number) => `Déjà dans la collection, donc laissées de côté : ${n}.`,
  collectionClosed: 'La collection est privée. Certaines y sont peut-être déjà.',
  overBudget: (n: number) => `${n} autres, seulement au-dessus du budget.`,
  open: 's’ouvre sur Discogs',
  expires: (at: string) => `Prix de la fouille, valables jusqu’à ${at}.`,
}

export const packs = { en, de, fr }

export function useGiftMessages() {
  return computed(() => packs[activeLanguage()])
}
