import { activeLanguage } from '~/composables/useMessages'
import { countryName } from '~/utils/countries'

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
  /* "Only from Germany / the EU" (M20 #2), on the shop chips. */
  origin: {
    label: 'Ships from',
    any: 'Anywhere',
    home: (country: string) => `From ${country}`,
    eu: 'From the EU',
    /*
     * Europe, which is a different question from the EU.
     *
     * "From the EU" is about a customs border, and for somebody in Zurich,
     * London or Oslo it runs the wrong way round. What they are asking is
     * "near me".
     */
    europe: 'From Europe',
    none: 'None of your shops ships from there.',
  },

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
   * The round (worker/dealers/round.ts).
   *
   * Asked for as a question: "so I can build a kind of favourite-shop list and
   * scan it weekly for new items?" Almost — the shops were remembered and
   * could be watched, but watching only says *that* something moved. This is
   * the walk that says what.
   *
   * "Weekly" is the one word not used. There is no server and a browser does
   * not run while it is closed (ADR-007); a button that runs when somebody is
   * there is the honest version of a schedule.
   */
  /*
   * Shops other people have dug (ADR-014).
   *
   * "How do we maximise the shops I already know?" — and Discogs offers
   * nothing: no "which shops sell this sort of record", no list of good
   * sellers, and the undocumented search is rule 5. What there is: other
   * devices and a hub that passes on what one of them learned.
   *
   * Every sentence here says what the number is and what it is a share of. A
   * fingerprint from a hundred rows of a forty-thousand-record shop describes
   * those hundred.
   */
  /*
   * A shop entered by hand, and why each one is on the list (M30).
   *
   * "I want to enter dealers myself" and "under Shops I want to see every
   * dealer I have bought from, have something in the basket from, or added by
   * hand". The screen was a log of what had been dug, and a row without a
   * reason is a row nobody trusts.
   */
  add: {
    label: 'Add a shop',
    placeholder: 'juno_records — or the address of the shop page',
    submit: 'Add',
    busy: 'Looking …',
  },

  /*
   * There is no "offers something from my wantlist" here, and it is not an
   * oversight: that needs a listings-by-release endpoint and Discogs has none
   * that may be used. Where a dig has found such a record the shop is on the
   * list as dug, and the find list names the record.
   */
  reasons: {
    dug: 'dug',
    basket: 'in the basket',
    watched: 'watched',
    order: 'bought from',
    friend: 'Discogs friend',
    manual: 'entered by hand',
  },

  suggested: {
    title: 'Shops other people have dug',
    busy: 'Asking your hub …',
    /* What the figure means, in one line. The workings are in ADR-014. */
    about: 'How much of each shop sits on labels you already collect.',
    fit: (percent: number) => `${percent} % yours`,
    sample: 'Dig one and it joins your shops with its own figures.',
  },

  round: {
    title: 'The round',
    about: (shops: number, minutes: number) =>
      `Visits your ${shops === 1 ? 'one watched shop' : `${shops} watched shops`} one after another and fetches only what each has put up since your last visit — about ${minutes === 1 ? 'a minute' : `${minutes} minutes`}. No style or price lookups: those are a hundred more per shop, and a find is one tap from them.`,
    neverDug: (n: number) =>
      n === 1
        ? 'One watched shop has never been dug, so there is no line for "what is new" to stop at. The round leaves it out — dig it once and it joins.'
        : `${n} watched shops have never been dug, so there is no line for "what is new" to stop at. The round leaves them out — dig each once and they join.`,
    start: 'Walk the round',
    found: (n: number) => (n === 1 ? '1 find' : `${n} finds`),
    keepsRunning:
      'Carries on if you leave this screen — the round runs in the background, not on this page.',
    lastAt: (when: string) => `Last round ${when}`,
    stopNothing: (listings: string) => `nothing for you among ${listings} new`,
    stopFound: (matches: number, listings: string) =>
      `${matches === 1 ? '1 find' : `${matches} finds`} among ${listings} new`,
    stopNeverDug: 'never dug — left out',
    stopFailed: 'did not answer this time',
  },

  /*
   * "Never show this one again." Gone from every list, unwatched — and one
   * sentence on what brings it back, because a switch with no visible way
   * back is a trap, not a setting.
   */
  hide: 'Hide this shop',
  hideWhy:
    'Gone from the lists, the start page and the suggestions, and no longer watched. A dig you start by name brings it back.',
  hidden: {
    title: (n: number) => (n === 1 ? 'One shop hidden' : `${n} shops hidden`),
    restore: 'Show again',
  },

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
  origin: {
    label: 'Versand aus',
    any: 'Überall',
    home: (country) => `Aus ${countryName(country)}`,
    eu: 'Aus der EU',
    europe: 'Aus Europa',
    none: 'Keiner deiner Läden versendet von dort.',
  },

  rateAlone: (rate) =>
    `${rate} Treffer je tausend Listings. Sobald du einen zweiten Laden gescannt hast, steht hier, wie sich das vergleicht.`,
  rateAbove: (rate, factor) =>
    `${rate} Treffer je tausend – das ${factor}-Fache deiner übrigen Läden.`,
  rateSame: (rate) => `${rate} Treffer je tausend – etwa so viel wie deine übrigen Läden.`,
  rateBelow: (rate, factor) =>
    `${rate} Treffer je tausend – nur das ${factor}-Fache deiner übrigen Läden.`,

  neverScanned: 'Diesen Laden kenne ich nur vom Namen – gescannt wurde er noch nicht.',
  listings: (n) => `${n} Listings`,
  shipsFrom: (country) => `aus ${countryName(country)}`,
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

  add: {
    label: 'Laden hinzufügen',
    placeholder: 'juno_records – oder die Adresse der Ladenseite',
    submit: 'Hinzufügen',
    busy: 'Sehe nach …',
  },

  reasons: {
    dug: 'gegraben',
    basket: 'im Korb',
    watched: 'beobachtet',
    order: 'hier gekauft',
    friend: 'Discogs-Freund',
    manual: 'von Hand eingetragen',
  },

  suggested: {
    title: 'Läden, die andere gegraben haben',
    busy: 'Frage deinen Hub …',
    about: 'Wie viel von jedem Laden auf Labels liegt, die du schon sammelst.',
    fit: (percent) => `${percent} % deins`,
    sample: 'Grab einen, dann steht er mit eigenen Zahlen bei deinen Läden.',
  },

  round: {
    title: 'Der Rundgang',
    about: (shops, minutes) =>
      `Geht ${shops === 1 ? 'deinen einen beobachteten Laden' : `deine ${shops} beobachteten Läden`} nacheinander ab und holt nur, was seit deinem letzten Besuch dazugekommen ist – rund ${minutes === 1 ? 'eine Minute' : `${minutes} Minuten`}. Ohne Stil- und Preisabfragen: die wären hundert weitere pro Laden, und ein Treffer ist einen Tipp davon entfernt.`,
    neverDug: (n) =>
      n === 1
        ? 'Ein beobachteter Laden wurde noch nie gegraben, es gibt also keine Linie, an der „was ist neu" halten könnte. Der Rundgang lässt ihn aus – einmal graben, dann ist er dabei.'
        : `${n} beobachtete Läden wurden noch nie gegraben, es gibt also keine Linie, an der „was ist neu" halten könnte. Der Rundgang lässt sie aus – einmal graben, dann sind sie dabei.`,
    start: 'Rundgang starten',
    found: (n) => (n === 1 ? '1 Treffer' : `${n} Treffer`),
    keepsRunning:
      'Läuft weiter, wenn du diesen Bildschirm verlässt – der Rundgang läuft im Hintergrund, nicht auf dieser Seite.',
    lastAt: (when) => `Letzter Rundgang ${when}`,
    stopNothing: (listings) => `nichts für dich unter ${listings} neuen`,
    stopFound: (matches, listings) =>
      `${matches === 1 ? '1 Treffer' : `${matches} Treffer`} unter ${listings} neuen`,
    stopNeverDug: 'noch nie gegraben – ausgelassen',
    stopFailed: 'hat diesmal nicht geantwortet',
  },

  hide: 'Diesen Laden ausblenden',
  hideWhy:
    'Weg aus den Listen, von der Startseite und aus den Vorschlägen, und nicht mehr beobachtet. Ein Dig, den du mit Namen startest, holt ihn zurück.',
  hidden: {
    title: (n) => (n === 1 ? 'Ein Laden ausgeblendet' : `${n} Läden ausgeblendet`),
    restore: 'Wieder zeigen',
  },

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
