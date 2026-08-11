import type { ShippingTier } from '#shared/types'

import { activeLanguage } from '~/composables/useMessages'
import { counted, plural } from '~/utils/plural'

/**
 * The words for buying: the basket per shop, the postage arithmetic, the
 * budget suggestion and the shortlist beside it.
 *
 * Its own file, both languages together — the reasons are in `settings.ts`.
 */

const en = {
  title: 'Basket',
  description: 'What the postage costs — before Discogs tells you.',
  lead: 'Discogs shows the combined postage only in its own cart. Here it is beforehand.',

  tabs: { label: 'Buying', basket: 'Basket', saved: 'Saved' },

  empty: 'Nothing here yet. Putting something in from a dig works too — the basket counts it.',
  shops: (shops: string, records: string) =>
    `${shops} shops · ${records} records. Every shop is its own parcel with its own postage.`,
  clearAll: 'Empty all of them',

  paste: {
    title: 'From the Discogs cart',
    about:
      'Discogs does not hand its cart out through the interface. Paste the listing links in here — Fidelity fetches them and puts each into the basket of the shop selling it. After that the postage counts along.',
    label: 'Listing links',
    fetching: 'Fetching …',
    take: 'Take them over',
    took: (n: number) => `${n} taken over`,
    sold: (n: number) => `${n} already sold`,
    unknown: (n: number) => `${n} not found`,
    acrossShops: (n: number) => `${counted(n, 'shop', 'shops')}`,
  },

  line: {
    sold: 'sold',
    priceExpired: 'price expired',
    remove: (title: string) => `Remove ${title}`,
    removeShort: 'out',
  },

  records: 'Records',
  subtotal: 'Subtotal',
  shipping: 'Shipping',
  shippingUnknown: 'unknown',
  total: 'Total',
  perRecord: 'per record',

  /** Where the postage table came from — said out loud, never implied. */
  source: {
    user: 'entered by you',
    bundled: 'from the bundled profiles',
    parsed: 'estimated from the dealer text',
  } satisfies Record<ShippingTier['source'], string>,

  subtotalExpired:
    'At least one price is older than six hours. A partial sum would be a smaller number than the truth — scan the dealer again.',
  missingToMinimum: (missing: string, minimum: string) =>
    `${missing} more to reach the minimum order of ${minimum}, otherwise the dealer will not ship.`,

  /** The sentence the whole feature exists for (docs/00 §7). */
  advice: (add: number, now: string, then: string) =>
    `${counted(add, 'record', 'records')} more and the postage drops from ${now} to ${then} each.`,

  parsedFrom: 'Guessed from the dealer’s free text',
  parsedSection: (section: string) => `(section "${section}")`,
  parsedMatched: (matched: string) => `— recognised: ${matched}`,
  parsedWrong: 'If that is wrong, enter the tiers.',

  unknownLabel: 'Postage unknown — what could I have read?',
  unknownAbout:
    'The dealer text gives no tier I can read with confidence. These are the shapes I recognise — if something like this is on the dealer page, entering it here helps:',

  editTiers: 'Change the tiers',
  enterTiers: 'Enter the postage tiers',
  tiersTitle: 'Postage tiers',
  tiersAbout: 'It is on the dealer page at Discogs. Entered once, it stays.',
  tiersFrom: 'from how many records',
  addTier: 'Add a step',

  curve: 'Postage per record',

  budget: {
    title: 'What would fit a budget?',
    label: 'Budget',
    including: (currency: string) => `${currency} including postage`,
    compute: 'Work out a suggestion',
    tooSmall: 'Not enough for this shop — the postage alone eats the budget.',
    result: (records: number, goods: string, shipping: string, total: string) =>
      `${counted(records, 'record', 'records')} · ${goods} plus ${shipping} postage = ${total}`,
    belowMinimum: (minimum: string) =>
      `That stays under the minimum order of ${minimum} — the dealer will not ship it that way. More budget, or another shop.`,
    caveat:
      'A suggestion, not a proof: filled greedily and then swapped, not optimised exactly. The basket stays as it is — this changes nothing.',
  },

  /**
   * Having nothing to suggest is not one state, it is three.
   *
   * A shop nobody has walked, a dig whose prices have aged past the six-hour
   * rule, and a shop that genuinely has nothing else. They look identical as an
   * empty list, and only the last one is an answer.
   */
  candidates: {
    title: 'Would also be worth it',
    neverDug:
      'You have not searched this shop yet. A dig tells you what else here fits you — and what of it the postage carries along anyway.',
    expired: (when: string) =>
      `The last dig was ${when}. Market prices older than six hours I do not show — right now I do not know what is here.`,
    nothing: (when: string) => `At the dig ${when} there was nothing else here that fits you.`,
    digAgain: 'Search it again',
    digNow: (dealer: string) => `Search ${dealer}`,
    closers: (n: number) =>
      `${n} of them ${plural(n, 'lifts', 'lift')} the basket over the minimum order on its own.`,
    noClosers: 'None of them clears the minimum order alone — two together do.',
    closesGap: 'closes the gap',
  },

  /**
   * What this button really does.
   *
   * It said "Carry on at fatplastics", which promises a continuation of a
   * purchase — and there is none: the link goes to the seller's Discogs
   * storefront, it does not carry this basket and there is no checkout at the
   * other end. Discogs has no cart in its API and refuses to be embedded, so
   * the last step is a tap per record, and saying so beats waiting for a button
   * that cannot exist.
   */
  toBuy: (records: number) =>
    `To buy: every line above leads to its listing at Discogs, where the "Add to Cart" button is. ${counted(records, 'record is', 'records are')} ready.`,
  viewAtDiscogs: (dealer: string) => `View ${dealer} at Discogs`,
}

const de: typeof en = {
  title: 'Korb',
  description: 'Was der Versand kostet – bevor Discogs es dir sagt.',
  lead: 'Discogs zeigt den kombinierten Versand erst im eigenen Warenkorb. Hier steht er vorher.',

  tabs: { label: 'Kaufen', basket: 'Korb', saved: 'Gemerkt' },

  empty: 'Sonst noch leer. Im Dig etwas hineinlegen geht auch – der Korb rechnet dann mit.',
  shops: (shops, records) =>
    `${shops} Läden · ${records} Platten. Jeder Laden ist eine eigene Sendung mit eigenem Porto.`,
  clearAll: 'Alle leeren',

  paste: {
    title: 'Aus dem Discogs-Warenkorb',
    about:
      'Discogs gibt seinen Warenkorb nicht über die Schnittstelle heraus. Kopier die Links der Angebote hier herein – Fidelity holt sie und legt jedes in den Korb des Ladens, der es verkauft. Danach rechnet der Versand mit.',
    label: 'Angebotslinks',
    fetching: 'Hole …',
    take: 'Übernehmen',
    took: (n) => `${n} übernommen`,
    sold: (n) => `${n} schon verkauft`,
    unknown: (n) => `${n} nicht gefunden`,
    acrossShops: (n) => `${counted(n, 'Laden', 'Läden')}`,
  },

  line: {
    sold: 'verkauft',
    priceExpired: 'Preis abgelaufen',
    remove: (title) => `${title} entfernen`,
    removeShort: 'raus',
  },

  records: 'Platten',
  subtotal: 'Summe',
  shipping: 'Versand',
  shippingUnknown: 'unbekannt',
  total: 'Gesamt',
  perRecord: 'pro Platte',

  source: {
    user: 'von dir eingetragen',
    bundled: 'aus den mitgelieferten Profilen',
    parsed: 'geschätzt aus dem Händlertext',
  },

  subtotalExpired:
    'Mindestens ein Preis ist älter als sechs Stunden. Eine Teilsumme wäre eine kleinere Zahl als die Wahrheit – scanne den Händler neu.',
  missingToMinimum: (missing, minimum) =>
    `Noch ${missing} bis zum Mindestbestellwert von ${minimum}, sonst verschickt der Händler nicht.`,

  advice: (add, now, then) =>
    `Noch ${counted(add, 'Platte', 'Platten')} und der Versand fällt von ${now} auf ${then} pro Stück.`,

  parsedFrom: 'Aus dem Freitext des Händlers geraten',
  parsedSection: (section) => `(Abschnitt „${section}“)`,
  parsedMatched: (matched) => `– erkannt: ${matched}`,
  parsedWrong: 'Stimmt das nicht, trag die Staffel ein.',

  unknownLabel: 'Versand unbekannt – was hätte ich lesen können?',
  unknownAbout:
    'Der Händlertext gibt keine Staffel her, die ich sicher lesen kann. Diese Formen erkenne ich – steht so etwas auf der Händlerseite, hilft es, sie hier einzutragen:',

  editTiers: 'Staffel ändern',
  enterTiers: 'Versandstaffel eintragen',
  tiersTitle: 'Versandstaffel',
  tiersAbout: 'Steht auf der Händlerseite bei Discogs. Einmal eingetragen, bleibt sie.',
  tiersFrom: 'ab wie vielen Platten',
  addTier: 'Stufe hinzufügen',

  curve: 'Versand pro Platte',

  budget: {
    title: 'Was ginge für ein Budget?',
    label: 'Budget',
    including: (currency) => `${currency} inklusive Versand`,
    compute: 'Vorschlag rechnen',
    tooSmall: 'Dafür reicht es hier nicht – der Versand allein frisst das Budget.',
    result: (records, goods, shipping, total) =>
      `${counted(records, 'Platte', 'Platten')} · ${goods} plus ${shipping} Versand = ${total}`,
    belowMinimum: (minimum) =>
      `Das bleibt unter dem Mindestbestellwert von ${minimum} – der Händler verschickt es so nicht. Mehr Budget oder ein anderer Laden.`,
    caveat:
      'Ein Vorschlag, kein Beweis: gierig gefüllt und dann getauscht, nicht exakt optimiert. Der Korb bleibt, wie er ist – das hier ändert nichts.',
  },

  candidates: {
    title: 'Käme auch noch infrage',
    neverDug:
      'Diesen Laden hast du noch nicht durchsucht. Ein Dig sagt dir, was hier sonst noch zu dir passt – und was davon der Versand ohnehin mitnimmt.',
    expired: (when) =>
      `Der letzte Dig war ${when}. Marktpreise, die älter als sechs Stunden sind, zeige ich nicht – ich weiß gerade nicht, was hier liegt.`,
    nothing: (when) => `Beim Dig ${when} war hier sonst nichts dabei, das zu dir passt.`,
    digAgain: 'Neu durchsuchen',
    digNow: (dealer) => `${dealer} durchsuchen`,
    closers: (n) =>
      `${n} ${plural(n, 'davon hebt', 'davon heben')} den Korb allein über den Mindestbestellwert.`,
    noClosers: 'Keine davon reicht allein über den Mindestbestellwert – zwei zusammen schon.',
    closesGap: 'schließt die Lücke',
  },

  toBuy: (records) =>
    `Zum Kaufen: jede Zeile oben führt zu ihrem Angebot bei Discogs, dort sitzt der „Add to Cart"-Knopf. ${counted(records, 'Platte liegt', 'Platten liegen')} bereit.`,
  viewAtDiscogs: (dealer) => `${dealer} bei Discogs ansehen`,
}

export const packs = { en, de }

export function useBasketMessages() {
  return computed(() => packs[activeLanguage()])
}
