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
  description: 'One parcel, and as many records in it as make it worth the postage.',
  /*
   * What this screen is *for*, in one sentence.
   *
   * It used to open with what Discogs does not do — "Discogs shows the
   * combined postage only in its own cart" — which is a fact about somebody
   * else's website and no reason to be here. The reason is the hunt: you found
   * one record at a shop, and everything else that shop has now travels in the
   * same parcel for the same postage.
   */
  lead: 'One’s in. Anything else you find at that shop rides along for the same postage.',

  tabs: { label: 'Buying', basket: 'Basket', saved: 'Saved' },

  empty: 'Nothing in the basket yet. Put a find in from a dig, and we start counting.',
  emptyAction: 'Start a dig',
  shops: (shops: string, records: string) =>
    `${shops} shops · ${records} records. Every shop is its own parcel with its own postage.`,
  clearAll: 'Empty all of them',

  paste: {
    title: 'From the Discogs cart',
    about:
      /* What to do, not what Discogs will not do. */
      'Paste links to records here. Each one lands in the basket of the shop selling it, postage counted in.',
    label: 'Links to records',
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
    parsed: 'estimated from the shop text',
    /* Discogs' own figure for this one record, to your address (M34.2). */
    discogs: 'named by Discogs for this record',
  } satisfies Record<ShippingTier['source'], string>,
  /*
   * Beside a table for two or more: the one figure that is not a guess. It
   * is the floor the table has to agree with, said once, with the seller's
   * own currency first because that is the exact one.
   */
  namedForOne: (original: string, converted: string | null) =>
    `Discogs names ${original}${converted ? ` (${converted})` : ''} for one record.`,
  noShipping: 'Discogs says this shop does not ship to your address.',

  subtotalExpired:
    'At least one price is more than six hours old. A sum with a hole in it would be smaller than the truth, so dig the shop again.',
  missingToMinimum: (missing: string, minimum: string) =>
    `${missing} more and you reach the shop's minimum of ${minimum}. Under that, it will not ship.`,

  /** The sentence the whole feature exists for (docs/00 §7). */
  advice: (add: number, now: string, then: string) =>
    `${counted(add, 'record', 'records')} more and the postage drops from ${now} to ${then} each.`,

  parsedFrom: 'Our guess from the shop’s own text',
  parsedSection: (section: string) => `(section "${section}")`,
  parsedMatched: (matched: string) => `recognised: ${matched}`,
  parsedWrong: 'If that looks wrong, enter the tiers yourself.',

  unknownLabel: 'We could not read the postage. What would we have understood?',
  unknownAbout:
    'The shop’s text has no table we can read with confidence. These are the shapes we understand. If something like this is on the shop page, entering it here helps:',

  /*
   * A shop that bills by grams (2026-09-13).
   *
   * Reported from a real shop: "1 bis 1999 Gramm: 14,00 €". There is no honest
   * way to turn that into a table per record — an LP with its sleeve and a
   * mailer is somewhere between 250 and 500 grams — so the shape is named
   * instead of refused in silence, and the shop's own words go next to the
   * form. Reading four lines and typing three numbers is two minutes; going to
   * Discogs to find the dialog first is what made it feel like more.
   */
  weightLabel: 'This shop charges by weight',
  weightAbout:
    'Its table is in grams, and a record has no fixed weight. One LP with sleeve and mailer is anywhere between 250 and 500 grams, so any conversion would be a guess you would plan a purchase around. Its own words are below: read off what one, two and three records cost you and enter that.',
  noteLabel: 'What the shop says about postage',

  /*
   * The same basket, at the other shops (M29).
   *
   * "Five records at one shop for €100 — could another have the same five for
   * €80?" Every sentence here names its denominator: there is no documented
   * way to ask Discogs who else sells a release, so this compares the shops
   * *you* know, and an empty answer means nothing about the market.
   */
  compare: {
    start: 'Cheaper at another shop?',
    busy: 'Comparing your shops …',
    scope: (shops: number) =>
      shops === 0
        ? 'Dig a shop, and its prices join this comparison for six hours.'
        : `Compared with ${shops === 1 ? 'your one freshly dug shop' : `your ${shops} freshly dug shops`}.`,
    covered: (has: number, of: number) => `has ${has} of your ${of}`,
    saves: (amount: string) => `${amount} less`,
    costs: (amount: string) => `${amount} more`,
    /** The second parcel, which is the whole point of the partial case. */
    rest: (items: number, shop: string, amount: string) =>
      `${items === 1 ? 'The other one stays' : `The other ${items} stay`} at ${shop}: ${amount} with its own postage.`,
    better: (n: number) => `${n} in better condition`,
    worse: (n: number) => `${n} in worse condition`,
    noPostage: 'Enter this shop’s postage tiers, and you get its total too.',
    nothing: 'Nothing from this basket at your other shops. Dig one more, and look again.',
    tryThese: 'Worth a dig: these stock the same labels',
  },

  editTiers: 'Change the tiers',
  enterTiers: 'Enter the postage tiers',
  tiersTitle: 'Postage tiers',
  tiersAbout: 'It is on the shop page at Discogs. Enter it once, and it stays.',
  tiersFrom: 'from how many records',
  addTier: 'Add a step',

  curve: 'Postage per record',

  budget: {
    title: 'What would fit a budget?',
    label: 'Budget',
    including: (currency: string) => `${currency} including postage`,
    compute: 'Work out a suggestion',
    tooSmall: 'Not enough for this shop. The postage alone eats the budget.',
    result: (records: number, goods: string, shipping: string, total: string) =>
      `${counted(records, 'record', 'records')} · ${goods} plus ${shipping} postage = ${total}`,
    belowMinimum: (minimum: string) =>
      `That stays under the shop's minimum of ${minimum}, so it will not ship. More budget, or another shop.`,
    caveat:
      'A suggestion, not a proof. We fill greedily and then swap, we do not optimise exactly. The basket stays as it is; this changes nothing.',
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
      'You have not dug this shop yet. A dig tells you what else here fits you, and what of it rides along for the same postage.',
    expired: (when: string) =>
      `The last dig was ${when}. Prices older than six hours are gone, so right now we do not know what is here.`,
    nothing: (when: string) => `At the dig ${when} there was nothing else here that fits you.`,
    digAgain: 'Dig it again',
    digNow: (dealer: string) => `Dig ${dealer}`,
    closers: (n: number) =>
      `${n} of them ${plural(n, 'lifts', 'lift')} the basket over the minimum order on its own.`,
    noClosers: 'None of them clears the minimum alone. Two together do.',
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

  /*
   * Written after `tests/e2e/populated.spec.ts` rendered a basket with two
   * lines in it for the first time and found all of this still in German. It
   * only ever appears once something is in the basket, which is why an
   * interface-wide translation walked straight past it.
   */
  stillThere: 'Still there?',
  clearThis: 'Empty this basket',

  /*
   * The hand-over (M20 #9). The cart itself cannot be filled from here —
   * no endpoint, and the website's form is off limits — so this is the way
   * there made short: one link at a time, the next one moving up, and a
   * memory of which are done that survives a closed tab.
   */
  handOver: 'Put these in at Discogs',
  handOverLead:
    'Discogs lets us open one record at a time: each link opens the page with the "Add to Cart" button, and the next one moves up here. Worth a "Still there?" first if the basket is a day old.',
  /** Given formatted numbers, as every count on a screen is. */
  handOverProgress: (done: string, total: string) => `${done} of ${total} at Discogs`,
  handOverNext: (record: string) => `Open next at Discogs: ${record}`,
  handOverDone: (records: number) =>
    `All ${counted(records, 'record is', 'records are')} over there. The cart at Discogs has them now.`,
  toCart: 'To the cart at Discogs',
  handOverReset: 'Start the hand-over again',
  atDiscogs: 'at Discogs',
  tiersTo: 'to how many records',
  tiersOpen: 'open',
  tiersPrice: 'Price',
  allStillThere: (records: number) =>
    `All still there: ${counted(records, 'record', 'records')}, prices fresh again.`,
  someSold: (sold: string) => `${sold} sold in the meantime. The rest is fresh again.`,
  noDealer: 'No shop',
  forget: (record: string) => `Take ${record} off the saved list`,
  /** For a line whose record has no title left — see worker/basket. */
  unknownRecord: 'Unknown record',

  /*
   * The saved list — the tab beside the basket.
   *
   * Every one of these was still German after the interface was translated,
   * and `tests/unit/template-text.spec.ts` is what finally enumerated them:
   * eleven strings on one screen, none of which any test had ever rendered.
   */
  saved: {
    title: 'Saved',
    stillThere: 'Still there?',
    fetching: 'Fetching …',
    toBasket: 'To basket',
    workOutPostage: 'Work out the postage',
    release: (id: number) => `Release ${id}`,
    gone: 'gone',
    bought: 'bought',
    markBought: (record: string) => `Mark ${record} as bought`,
    forget: 'forget',
    boughtTitle: 'Bought',

    /*
     * How it arrived (M14).
     *
     * Deliberately worded against what the shop promised, without ever naming
     * it: the promised grade is Discogs content and is not stored anywhere
     * (worker/grading.ts). "As described" carries the comparison on its own.
     */
    arrival: {
      ask: 'How did it arrive?',
      asDescribed: 'As described',
      better: 'Better',
      worse: 'Worse',
      askFor: (record: string) => `How did ${record} arrive?`,
      said: {
        'as-described': 'arrived as described',
        better: 'arrived better than described',
        worse: 'arrived worse than described',
      },
      undo: 'change',
      nudge: 'Did it arrive?',
      more: (n: string) => `${n} more waiting`,
      why: 'Stays on this device. The rating at Discogs says whether the parcel came quickly, not whether the grading was right. This is your own record of that, and the honesty figure on a shop is built from it.',
      whyLabel: 'Where does this go?',
    },
    /*
     * Reading an order (M14).
     *
     * The number has to be typed in, and the text says why — otherwise it
     * reads like a convenience somebody forgot to build.
     */
    order: {
      title: 'Bought a few at once?',
      label: 'Discogs order number',
      hint: 'For example 259022-32308',
      submit: 'Read the order',
      reading: 'Reading …',
      badShape: 'That is not an order number. It looks like 259022-32308.',
      done: (records: number, dealer: string) =>
        `${counted(records, 'record', 'records')} from ${dealer} ${records === 1 ? 'is' : 'are'} now on the list.`,
      doneNoDealer: (records: number) =>
        `${counted(records, 'record', 'records')} ${records === 1 ? 'is' : 'are'} now on the list.`,
      already: (n: number) => `${n} of them you had already saved.`,
      nothing: 'That order has no records in it.',
      whyLabel: 'Where do I find it?',
      why: 'On discogs.com under Marketplace → Purchases, in the first column. You have to type it because Discogs only hands out an order when you name it. The list of what you bought is not something we can fetch, only what you sold. One lookup, and nothing but the records, the shop and the date is kept: not the price, and not the condition you were promised.',
    },
  },
}

const de: typeof en = {
  title: 'Korb',
  description: 'Ein Paket, und so viele Platten drin, dass sich das Porto lohnt.',
  lead: 'Eine Platte ist drin. Was du sonst noch bei dem Laden findest, kommt fürs gleiche Porto mit.',

  tabs: { label: 'Kaufen', basket: 'Korb', saved: 'Gemerkt' },

  empty: 'Noch nichts drin. Leg aus einem Dig was rein, dann rechnen wir mit.',
  emptyAction: 'Einen Dig starten',
  shops: (shops, records) =>
    `${shops} Läden · ${records} Platten. Jeder Laden ist eine eigene Sendung mit eigenem Porto.`,
  clearAll: 'Alle leeren',

  paste: {
    title: 'Aus dem Discogs-Warenkorb',
    about:
      'Kopier Links zu Platten hier rein. Jede landet im Korb ihres Ladens, Porto eingerechnet.',
    label: 'Links zu Platten',
    fetching: 'Holen gerade …',
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
    parsed: 'geschätzt aus dem Freitext des Ladens',
    discogs: 'von Discogs für diese Platte genannt',
  },
  namedForOne: (original, converted) =>
    `Discogs nennt ${original}${converted ? ` (${converted})` : ''} für eine Platte.`,
  noShipping: 'Discogs sagt, dieser Laden versendet nicht an deine Adresse.',

  subtotalExpired:
    'Mindestens ein Preis ist älter als sechs Stunden. Eine Summe mit Loch wäre kleiner als die Wahrheit, also grab den Laden nochmal.',
  missingToMinimum: (missing, minimum) =>
    `Noch ${missing}, dann ist der Mindestbestellwert von ${minimum} erreicht. Darunter verschickt der Laden nicht.`,

  advice: (add, now, then) =>
    `Noch ${counted(add, 'Platte', 'Platten')}, und das Porto fällt von ${now} auf ${then} pro Stück.`,

  parsedFrom: 'Unsere Schätzung aus dem Text des Ladens',
  parsedSection: (section) => `(Abschnitt „${section}“)`,
  parsedMatched: (matched) => `erkannt: ${matched}`,
  parsedWrong: 'Sieht das falsch aus, trag die Staffel selbst ein.',

  unknownLabel: 'Wir konnten das Porto nicht lesen. Was hätten wir verstanden?',
  unknownAbout:
    'Im Text des Ladens steht keine Staffel, die wir sicher lesen können. Diese Formen verstehen wir. Steht so etwas auf der Ladenseite, hilft es, sie hier einzutragen:',

  weightLabel: 'Dieser Laden rechnet nach Gewicht',
  weightAbout:
    'Seine Staffel steht in Gramm, und eine Platte hat kein festes Gewicht. Eine LP mit Hülle und Versandtasche liegt zwischen 250 und 500 Gramm, jede Umrechnung wäre also geraten, und zwar bei einer Zahl, um die herum du einen Kauf planst. Seine eigenen Worte stehen unten: lies ab, was ein, zwei und drei Platten kosten, und trag das ein.',
  noteLabel: 'Was der Laden zum Versand sagt',

  compare: {
    start: 'Woanders billiger?',
    busy: 'Wir vergleichen deine Läden …',
    scope: (shops) =>
      shops === 0
        ? 'Grab einen Laden, dann sind seine Preise sechs Stunden lang im Vergleich dabei.'
        : `Verglichen mit ${shops === 1 ? 'deinem einen frisch gegrabenen Laden' : `deinen ${shops} frisch gegrabenen Läden`}.`,
    covered: (has, of) => `hat ${has} von deinen ${of}`,
    saves: (amount) => `${amount} weniger`,
    costs: (amount) => `${amount} mehr`,
    rest: (items, shop, amount) =>
      `${items === 1 ? 'Die andere bleibt' : `Die anderen ${items} bleiben`} bei ${shop}: ${amount} mit eigenem Porto.`,
    better: (n) => `${n} in besserem Zustand`,
    worse: (n) => `${n} in schlechterem Zustand`,
    noPostage: 'Trag die Versandstaffel dieses Ladens ein, dann steht hier auch seine Summe.',
    nothing:
      'Nichts aus diesem Korb bei deinen anderen Läden. Grab noch einen, und schau nochmal.',
    tryThese: 'Einen Dig wert: die führen dieselben Labels',
  },

  editTiers: 'Staffel ändern',
  enterTiers: 'Versandstaffel eintragen',
  tiersTitle: 'Versandstaffel',
  tiersAbout: 'Steht auf der Ladenseite bei Discogs. Einmal eingetragen, und sie bleibt.',
  tiersFrom: 'ab wie vielen Platten',
  addTier: 'Stufe hinzufügen',

  curve: 'Versand pro Platte',

  budget: {
    title: 'Was ginge für ein Budget?',
    label: 'Budget',
    including: (currency) => `${currency} inklusive Versand`,
    compute: 'Vorschlag rechnen',
    tooSmall: 'Dafür reicht es hier nicht. Das Porto allein frisst das Budget.',
    result: (records, goods, shipping, total) =>
      `${counted(records, 'Platte', 'Platten')} · ${goods} plus ${shipping} Versand = ${total}`,
    belowMinimum: (minimum) =>
      `Das bleibt unter dem Mindestbestellwert von ${minimum}, so verschickt der Laden nicht. Mehr Budget, oder ein anderer Laden.`,
    caveat:
      'Ein Vorschlag, kein Beweis. Wir füllen gierig auf und tauschen dann, exakt optimiert ist das nicht. Der Korb bleibt, wie er ist, das hier ändert nichts.',
  },

  candidates: {
    title: 'Käme auch noch infrage',
    neverDug:
      'Diesen Laden hast du noch nicht durchgegraben. Ein Dig sagt dir, was hier sonst noch zu dir passt, und was davon fürs gleiche Porto mitkommt.',
    expired: (when) =>
      `Der letzte Dig war ${when}. Preise, die älter als sechs Stunden sind, sind weg, also wissen wir gerade nicht, was hier liegt.`,
    nothing: (when) => `Beim Dig ${when} war hier sonst nichts dabei, das zu dir passt.`,
    digAgain: 'Nochmal graben',
    digNow: (dealer) => `${dealer} graben`,
    closers: (n) =>
      `${n} ${plural(n, 'davon hebt', 'davon heben')} den Korb allein über den Mindestbestellwert.`,
    noClosers: 'Keine davon reicht allein über den Mindestbestellwert. Zwei zusammen schon.',
    closesGap: 'schließt die Lücke',
  },

  toBuy: (records) =>
    `Zum Kaufen: jede Zeile oben führt zu ihrem Angebot bei Discogs, dort sitzt der „Add to Cart"-Knopf. ${counted(records, 'Platte liegt', 'Platten liegen')} bereit.`,
  viewAtDiscogs: (dealer) => `${dealer} bei Discogs ansehen`,

  stillThere: 'Noch da?',
  clearThis: 'Diesen Korb leeren',

  handOver: 'Bei Discogs einlegen',
  handOverLead:
    'Bei Discogs geht es Platte für Platte: Jeder Link öffnet die Seite mit dem „Add to Cart"-Knopf, und hier rückt die nächste nach. Ist der Korb einen Tag alt, lohnt vorher ein „Noch da?".',
  handOverProgress: (done, total) => `${done} von ${total} bei Discogs`,
  handOverNext: (record) => `Nächstes bei Discogs öffnen: ${record}`,
  handOverDone: (records) =>
    `${counted(records, 'Platte ist', 'Platten sind')} drüben. Der Warenkorb bei Discogs hat sie jetzt.`,
  toCart: 'Zum Warenkorb bei Discogs',
  handOverReset: 'Übergabe von vorn beginnen',
  atDiscogs: 'bei Discogs',
  tiersTo: 'bis wie vielen Platten',
  tiersOpen: 'offen',
  tiersPrice: 'Preis',
  allStillThere: (records) =>
    `Alles noch da: ${counted(records, 'Platte', 'Platten')}, Preise wieder frisch.`,
  someSold: (sold) => `${sold} inzwischen verkauft. Der Rest ist wieder frisch.`,
  noDealer: 'Ohne Laden',
  forget: (record) => `${record} von der Merkliste nehmen`,
  unknownRecord: 'Unbekannte Platte',

  saved: {
    title: 'Gemerkt',
    stillThere: 'Noch da?',
    fetching: 'Holen gerade …',
    toBasket: 'In den Korb',
    workOutPostage: 'Versand rechnen',
    release: (id: number) => `Release ${id}`,
    gone: 'weg',
    bought: 'gekauft',
    markBought: (record: string) => `${record} als gekauft eintragen`,
    forget: 'vergessen',
    boughtTitle: 'Gekauft',

    arrival: {
      ask: 'Wie kam sie an?',
      asDescribed: 'Wie beschrieben',
      better: 'Besser',
      worse: 'Schlechter',
      askFor: (record: string) => `Wie kam ${record} an?`,
      said: {
        'as-described': 'kam wie beschrieben',
        better: 'kam besser als beschrieben',
        worse: 'kam schlechter als beschrieben',
      },
      undo: 'ändern',
      nudge: 'Ist sie angekommen?',
      more: (n) => `${n} weitere offen`,
      why: 'Bleibt auf deinem Gerät. Die Bewertung bei Discogs sagt, ob das Paket schnell kam, nicht ob die Note gestimmt hat. Das hier ist deine eigene Aufzeichnung davon, und daraus entsteht die Ehrlichkeitszahl bei einem Laden.',
      whyLabel: 'Wo landet das?',
    },
    order: {
      title: 'Mehrere auf einmal gekauft?',
      label: 'Discogs-Bestellnummer',
      hint: 'Zum Beispiel 259022-32308',
      submit: 'Bestellung lesen',
      reading: 'Lese …',
      badShape: 'Das ist keine Bestellnummer. Sie sieht aus wie 259022-32308.',
      done: (records, dealer) =>
        `${counted(records, 'Platte', 'Platten')} von ${dealer} ${records === 1 ? 'steht' : 'stehen'} jetzt auf der Liste.`,
      doneNoDealer: (records) =>
        `${counted(records, 'Platte', 'Platten')} ${records === 1 ? 'steht' : 'stehen'} jetzt auf der Liste.`,
      already: (n) => `${n} davon hattest du schon gemerkt.`,
      nothing: 'In dieser Bestellung sind keine Platten.',
      whyLabel: 'Wo finde ich die?',
      why: 'Auf discogs.com unter Marktplatz → Einkäufe, in der ersten Spalte. Eintippen musst du sie, weil Discogs eine Bestellung nur rausgibt, wenn man sie beim Namen nennt. Die Liste deiner Einkäufe können wir nicht holen, nur die von dem, was du verkauft hast. Eine Abfrage, und behalten wird nichts außer den Platten, dem Laden und dem Datum: nicht der Preis, und nicht der versprochene Zustand.',
    },
  },
}

export const packs = { en, de }

export function useBasketMessages() {
  return computed(() => packs[activeLanguage()])
}
