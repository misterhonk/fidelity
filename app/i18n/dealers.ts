import { activeLanguage } from '~/composables/useMessages'

/**
 * The words for the shops: which ones you have walked, how well each one fits,
 * and where the list of them comes from.
 *
 * Its own file, both languages together — the reasons are in `settings.ts`.
 */

const en = {
  title: 'Shops',
  description: 'What a shop actually stocks — and how well they fit you.',
  lead: 'What a shop actually stocks — and how well it fits you.',

  none: 'No shop scanned yet. This fills up with the first dig.',
  scanned: 'Scanned shops',

  /*
   * A hit rate on its own is a number without a denominator. The comparison is
   * always against your *other* shops — what the market as a whole asks is not
   * something this app can see, so it does not claim to.
   */
  rateAlone: (rate: string) =>
    `${rate} finds per thousand listings. Once you have scanned a second shop, this says how that compares.`,
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

  /*
   * How honestly this shop grades — from your own purchases (M14).
   *
   * Two shapes on purpose. Below five judged records there is no percentage:
   * two out of two is 100 % and reads like a verdict on a shop you know
   * nothing about. The bare count says the same thing without the claim.
   */
  grading: {
    rate: (percent: string, judged: string) =>
      `${percent} of ${judged} records you bought here arrived as described or better.`,
    tooFew: (judged: string, one: boolean) =>
      `${judged} ${one ? 'record' : 'records'} judged so far — too few for a figure.`,
    worse: (n: string, one: boolean) => `${n} ${one ? 'was' : 'were'} worse than described.`,
    whyLabel: 'Why is this not on Discogs?',
    why: 'Discogs feedback rates the transaction, not whether the grading was right — and a negative rating for overgrading is removed when the seller objects. This figure is yours alone: it counts the records you marked as arrived, and it never leaves this device.',
  },

  watching: 'Being watched',
  watch: 'Watch this shop',
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
  priceHigh: 'at the top end of your shops',
  priceLow: 'at the bottom end of your shops',
  priceMiddle: 'in the middle of your shops',
  priceWhyLabel: 'What it is compared against',
  priceWhy:
    'Only against your own shops. What the market as a whole asks is not something this app can see, so it does not claim it either.',

  labelsInStock: 'Labels in stock',
  noLabels: 'No label information in the stock.',
  decades: 'Decades',
  noYears: 'No years recorded in the stock.',
  stock: {
    /*
     * The bar says "13"; the button has to say what a click does — otherwise a
     * screen reader reads "button, Kompakt" twenty times over.
     */
    show: (name: string, n: number) => `Show the ${n} records on ${name}`,
    close: 'Close',
    counted: (shown: string, total: string) => `${shown} of ${total}`,
    more: (n: string) => `Show ${n} more`,
    loading: 'Fetching …',
    /*
     * The difference between "he does not have it" and "we do not know right
     * now". Marketplace data lives six hours; after that these rows are
     * deleted, not stale — and an empty list would be a false statement.
     */
    needsDig:
      'The stock list is marketplace data and only lives for six hours. Scan this shop again to see what is on the shelves.',
  },
  nothingYet: 'Nothing here yet.',
}

const de: typeof en = {
  title: 'Läden',
  description: 'Was ein Laden eigentlich führt – und wie gut er zu dir passt.',
  lead: 'Was ein Laden eigentlich führt – und wie gut er zu dir passt.',

  none: 'Noch keinen Laden gescannt. Das hier füllt sich mit dem ersten Dig.',
  scanned: 'Gescannte Läden',

  rateAlone: (rate) =>
    `${rate} Treffer je tausend Listings. Sobald du einen zweiten Laden gescannt hast, steht hier, wie sich das vergleicht.`,
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

  grading: {
    rate: (percent, judged) =>
      `${percent} von ${judged} hier gekauften Platten kamen wie beschrieben oder besser an.`,
    tooFew: (judged, one) =>
      `Bisher ${judged} ${one ? 'Platte' : 'Platten'} beurteilt – zu wenige für eine Zahl.`,
    worse: (n, one) => `${n} ${one ? 'war' : 'waren'} schlechter als beschrieben.`,
    whyLabel: 'Warum steht das nicht bei Discogs?',
    why: 'Das Discogs-Feedback bewertet den Ablauf, nicht die Richtigkeit der Note – und eine negative Bewertung wegen Übergrading wird auf Beschwerde des Verkäufers entfernt. Diese Zahl gehört dir allein: sie zählt die Platten, die du als angekommen eingetragen hast, und sie verlässt dieses Gerät nicht.',
  },

  watching: 'Wird beobachtet',
  watch: 'Laden merken',
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
  priceHigh: 'am oberen Ende deiner Läden',
  priceLow: 'am unteren Ende deiner Läden',
  priceMiddle: 'im Mittelfeld deiner Läden',
  priceWhyLabel: 'Womit verglichen wird',
  priceWhy:
    'Nur gegen deine eigenen Läden. Was der Markt insgesamt aufruft, kann diese App nicht sehen, und sie behauptet es deshalb auch nicht.',

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
