import { activeLanguage } from '~/composables/useMessages'

/**
 * The words for the shops: which ones you have walked, how well each one fits,
 * and where the list of them comes from.
 *
 * Its own file, both languages together — the reasons are in `settings.ts`.
 */

const en = {
  title: 'Shops',
  description: 'What a dealer actually stocks — and how well they fit you.',
  lead: 'What a shop actually stocks — and how well it fits you.',

  none: 'No dealer scanned yet. This fills up with the first dig.',
  scanned: 'Scanned dealers',

  /*
   * A hit rate on its own is a number without a denominator. The comparison is
   * always against your *other* shops — what the market as a whole asks is not
   * something this app can see, so it does not claim to.
   */
  rateAlone: (rate: string) =>
    `${rate} finds per thousand listings. Once you have scanned a second dealer, this says how that compares.`,
  rateAbove: (rate: string, factor: string) =>
    `${rate} finds per thousand — ${factor} times your other shops.`,
  rateSame: (rate: string) =>
    `${rate} finds per thousand — about the same as your other shops.`,
  rateBelow: (rate: string, factor: string) =>
    `${rate} finds per thousand — only ${factor} times your other shops.`,

  neverScanned: 'I only know this shop by name — it has not been scanned yet.',
  listings: (n: string) => `${n} listings`,
  shipsFrom: (country: string) => `from ${country}`,
  rating: (percent: string, count: string) => `${percent} on ${count} ratings`,
  lastScanned: (when: string) => `last scanned on ${when}`,

  watching: 'Being watched',
  watch: 'Watch this dealer',
  /* Watching costs one request per app start, not a rescan. Worth saying,
   * because "watch" usually means somebody is polling. */
  watchCost:
    'When the app opens, it checks whether the stock has moved — a single lookup, not a new scan.',
  digNow: 'Dig now',
  digAgain: 'Dig again',

  /*
   * Push, worded as what it is: the app is closed, and somebody else is
   * looking. It says "the shops you watch" because the permission is one per
   * device — switching it on here covers all of them, and a line that implied
   * otherwise would be a small lie discovered later.
   */
  pushOffer: 'Tell me while the app is closed',
  pushOn: 'You will be told, even with the app closed.',
  pushStop: 'Stop telling me',
  pushWhy:
    'The hub asks each watched shop once an hour — one lookup for everybody, not one each.',
  pushInstall:
    'On an iPhone this needs Fidelity on the home screen. Share → Add to Home Screen.',

  coverage: (sampled: string, total: string, percent: number) =>
    `From ${sampled} of ${total} listings — ${percent} % of the shop.`,

  priceTitle: 'Price range',
  median: (amount: string) => `Median ${amount}`,
  mixedCurrencies: '(the shop prices in several currencies)',
  priceHigh: 'at the top end of your dealers',
  priceLow: 'at the bottom end of your dealers',
  priceMiddle: 'in the middle of your dealers',
  priceWhyLabel: 'What it is compared against',
  priceWhy:
    'Only against your own dealers. What the market as a whole asks is not something this app can see, so it does not claim it either.',

  labelsInStock: 'Labels in stock',
  noLabels: 'No label information in the stock.',
  decades: 'Decades',
  noYears: 'No years recorded in the stock.',
  stock: {
    /*
     * Der Balken sagt „13", der Knopf muss sagen, was ein Klick tut — sonst
     * liest ein Bildschirmleser zwanzig Mal „Schaltfläche, Kompakt".
     */
    show: (name: string, n: number) => `Show the ${n} records on ${name}`,
    close: 'Close',
    counted: (shown: string, total: string) => `${shown} of ${total}`,
    more: (n: string) => `Show ${n} more`,
    loading: 'Fetching …',
    /*
     * Der Unterschied zwischen „hat er nicht" und „wissen wir gerade nicht".
     * Marktplatzdaten leben sechs Stunden; danach sind diese Zeilen gelöscht,
     * nicht veraltet — und eine leere Liste wäre eine Falschaussage.
     */
    needsDig:
      'The stock list is marketplace data and only lives for six hours. Scan this shop again to see what is on the shelves.',
  },
  nothingYet: 'Nothing here yet.',
}

const de: typeof en = {
  title: 'Läden',
  description: 'Was ein Händler eigentlich führt – und wie gut er zu dir passt.',
  lead: 'Was ein Laden eigentlich führt – und wie gut er zu dir passt.',

  none: 'Noch keinen Händler gescannt. Das hier füllt sich mit dem ersten Dig.',
  scanned: 'Gescannte Händler',

  rateAlone: (rate) =>
    `${rate} Treffer je tausend Listings. Sobald du einen zweiten Händler gescannt hast, steht hier, wie sich das vergleicht.`,
  rateAbove: (rate, factor) =>
    `${rate} Treffer je tausend – das ${factor}-Fache deiner übrigen Läden.`,
  rateSame: (rate) => `${rate} Treffer je tausend – etwa so viel wie deine übrigen Läden.`,
  rateBelow: (rate, factor) =>
    `${rate} Treffer je tausend – nur das ${factor}-Fache deiner übrigen Läden.`,

  neverScanned: 'Diesen Laden kenne ich nur vom Namen – gescannt wurde er noch nicht.',
  listings: (n) => `${n} Listings`,
  shipsFrom: (country) => `aus ${country}`,
  rating: (percent, count) => `${percent} bei ${count} Bewertungen`,
  lastScanned: (when) => `zuletzt gescannt am ${when}`,

  watching: 'Wird beobachtet',
  watch: 'Händler merken',
  watchCost:
    'Beim Öffnen der App wird nachgesehen, ob sich das Sortiment bewegt hat – eine einzige Abfrage, kein neuer Scan.',
  digNow: 'Jetzt graben',
  digAgain: 'Nochmal graben',

  pushOffer: 'Auch Bescheid geben, wenn die App zu ist',
  pushOn: 'Du bekommst Bescheid, auch bei geschlossener App.',
  pushStop: 'Nicht mehr Bescheid geben',
  pushWhy:
    'Der Hub fragt jeden beobachteten Laden einmal pro Stunde – eine Abfrage für alle, nicht eine pro Person.',
  pushInstall:
    'Auf dem iPhone braucht das Fidelity auf dem Home-Bildschirm. Teilen → Zum Home-Bildschirm.',

  coverage: (sampled, total, percent) =>
    `Aus ${sampled} von ${total} Listings – ${percent} % des Ladens.`,

  priceTitle: 'Preislage',
  median: (amount) => `Median ${amount}`,
  mixedCurrencies: '(der Laden preist in mehreren Währungen aus)',
  priceHigh: 'am oberen Ende deiner Händler',
  priceLow: 'am unteren Ende deiner Händler',
  priceMiddle: 'im Mittelfeld deiner Händler',
  priceWhyLabel: 'Womit verglichen wird',
  priceWhy:
    'Nur gegen deine eigenen Händler. Was der Markt insgesamt aufruft, kann diese App nicht sehen, und sie behauptet es deshalb auch nicht.',

  labelsInStock: 'Labels im Sortiment',
  noLabels: 'Keine Labelangaben im Sortiment.',
  decades: 'Dekaden',
  noYears: 'Keine Jahresangaben im Sortiment.',
  stock: {
    show: (name: string, n: number) => `Die ${n} Platten auf ${name} zeigen`,
    close: 'Schließen',
    counted: (shown: string, total: string) => `${shown} von ${total}`,
    more: (n: string) => `${n} weitere zeigen`,
    loading: 'Wird geholt …',
    needsDig:
      'Das Sortiment ist ein Marktplatzdatum und lebt nur sechs Stunden. Scanne den Laden neu, um zu sehen, was im Regal steht.',
  },
  nothingYet: 'Noch nichts da.',
}

export const packs = { en, de }

export function useDealerMessages() {
  return computed(() => packs[activeLanguage()])
}
