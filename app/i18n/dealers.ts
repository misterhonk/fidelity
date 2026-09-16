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
  /*
   * One shop, one number, and no promise about the next one.
   *
   * This was the loudest line on the screen and half of it was about a
   * comparison that does not exist yet: "once you have scanned a second shop,
   * this says how that compares". The other three say the comparison when
   * there is one, which is when it is worth reading.
   */
  rateAlone: (rate: string) => `${rate} finds per thousand listings.`,
  rateAbove: (rate: string, factor: string) =>
    `${rate} finds per thousand — ${factor} times your other shops.`,
  rateSame: (rate: string) =>
    `${rate} finds per thousand — about the same as your other shops.`,
  rateBelow: (rate: string, factor: string) =>
    `${rate} finds per thousand — only ${factor} times your other shops.`,

  /*
   * A shop that has never been dug, and what can be done with it anyway.
   *
   * It used to say only what was missing — "I only know this shop by name" —
   * which reads as a dead end beside a "Watch this shop" button nobody could
   * be sure worked. It does: the watch asks `num_for_sale` off the profile,
   * one lookup, and needs no dig at all (`worker/watch/check.ts`). What it
   * cannot do until the shop has been dug once is say *what* moved.
   */
  neverScanned: 'Known by name so far. Watching works already — a dig fills in the rest.',
  /** The same fact in three words, for a row in the list. */
  notDug: 'not dug yet',
  /* On the row itself: short, because it repeats down the list. */
  digShort: 'Dig',
  /* Four orderings, one row above the list (M31.10). */
  sort: {
    label: 'Order',
    rate: 'Hit rate',
    recent: 'Last dug',
    size: 'Size',
    name: 'Name',
  },
  /* The mental model, not a filter: yours, and the rest. */
  groups: { mine: 'Your shops', rest: 'The rest' },
  digAt: (shop: string) => `Dig ${shop} now`,
  /** What the number beside a shop counts. Spoken, not drawn. */
  perThousand: (rate: string) => `${rate} finds per thousand`,
  /** Above the list, once there are enough shops to be a wall. */
  find: 'Find a shop',
  noMatch: 'No shop of yours goes by that name.',
  more: (n: string) => `Show ${n} more`,
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
  watchCostLabel: 'What watching costs',
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
    /* The one line above the list: how many, how long. */
    line: (shops: string, minutes: number) =>
      `${shops} watched · about ${minutes === 1 ? 'a minute' : `${minutes} minutes`}`,
    about: (shops: number, minutes: number) =>
      `Visits your ${shops === 1 ? 'one watched shop' : `${shops} watched shops`} one after another and fetches only what each has put up since your last visit — about ${minutes === 1 ? 'a minute' : `${minutes} minutes`}. No style or price lookups: those are a hundred more per shop, and a find is one tap from them.`,
    /* Short, because the round already names each skipped shop in its result. */
    neverDug: (n: number) =>
      n === 1
        ? 'One watched shop has never been dug — the round skips it until it has.'
        : `${n} watched shops have never been dug — the round skips them until they have.`,
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
    /*
     * The last round as one line (M34.4). Ten stops used to be ten lines
     * across the top of the screen, eight of them saying "nothing". The finds
     * are listed; the quiet stops are a count and a fold.
     */
    quiet: (n: number) => (n === 1 ? '1 with nothing new' : `${n} with nothing new`),
    skipped: (n: number) => (n === 1 ? '1 never dug, skipped' : `${n} never dug, skipped`),
    others: (n: number) => (n === 1 ? 'The other one' : `The other ${n}`),
  },

  /*
   * "Never show this one again." Gone from every list, unwatched — and one
   * sentence on what brings it back, because a switch with no visible way
   * back is a trap, not a setting.
   */
  hide: 'Hide this shop',
  /** The seller's own page — postage in prose, holidays, returns (M32.3). */
  atDiscogs: 'The shop at Discogs',
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

  /** Four records of your own on the labels this shop carries (M31.4). */
  shelfSample: 'From your shelf it stocks',
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

  /*
   * The masthead and the plates (M34.1).
   *
   * A shop's profile used to be one paragraph of numbers and a row of
   * buttons of the same weight. Now it opens the way a buyer asks: who is
   * this — does it fit me — what will postage cost — what do they charge —
   * what of mine do they carry — what has moved — what did I buy here. Each
   * answer under a plate word, and the count before the percentage: "59,539
   * ratings · 99.9 %" says more than "99.9 %" alone, because a hundred per
   * cent of three is not a record.
   */
  trust: {
    ratings: (n: string, percent: string) => `${n} ratings · ${percent} %`,
    noRatings: 'no ratings yet',
    since: (year: string) => `since ${year}`,
    dug: (when: string) => `dug ${when}`,
    /* The one line that makes every other number moot. */
    suspended: 'Suspended from selling at Discogs.',
  },
  plates: {
    fit: 'Fit',
    postage: 'Postage',
    price: 'Price range',
    shelf: 'From your shelf',
    range: 'Range',
    movement: 'Movement',
    purchases: 'Your purchases',
  },
  rateWhyLabel: 'What the number counts',
  rateWhy:
    'Finds per thousand listings on the last dig, set against the median of your other shops. What the market as a whole would find is not something this app can see.',
  postage: {
    /* Discogs' own figure for one record to your address, off a basket line (M34.2). */
    named: (original: string, converted: string | null) =>
      `${original}${converted ? ` (${converted})` : ''} for one record, named by Discogs`,
    from: (amount: string) => `from ${amount} for one record`,
    unknown: 'Not on record yet.',
    enter: 'Enter it in the basket',
    text: 'What the shop writes',
  },
  movement: {
    newest: (when: string) => `newest listing ${when}`,
    still: 'Nothing new since the last check.',
    unwatched: 'Not watched — nothing is checked.',
  },
  /** The right-hand column on a desk before any shop is open. */
  pick: 'Pick a shop on the left.',
  /*
   * The verdict pair on a row (M34.4): the profile's two sentences as two
   * plate words, against your other shops.
   */
  verdict: {
    fit: { above: 'more finds', same: 'as many finds', below: 'fewer finds' },
    price: { high: 'pricier', middle: 'mid-priced', low: 'cheaper' },
  },
  /** Five shops for a device with none (M34.4) — large, well rated, verified 2026-09-16. */
  starters: {
    title: 'Five shops to start with',
    about: 'Big, well rated, and they ship across Europe. Adding one costs one lookup.',
    add: 'Add',
    adding: 'Adding …',
  },
  /** The plate word; the full sentence is its spoken name. */
  hideShort: 'Hide',
  hiddenLine: (shop: string) => `${shop} hidden.`,
  undo: 'Undo',
  prev: 'Previous shop',
  next: 'Next shop',
}

const de: typeof en = {
  title: 'Läden',
  description: 'Welche Läden zu dir passen, und was bei ihnen im Regal steht.',
  lead: 'Welche Läden zu dir passen, und was bei ihnen im Regal steht.',

  none: 'Noch kein Laden da. Mit dem ersten Dig füllt sich das hier.',
  scanned: 'Gescannte Läden',
  origin: {
    label: 'Versand aus',
    any: 'Überall',
    home: (country) => `Aus ${countryName(country)}`,
    eu: 'Aus der EU',
    europe: 'Aus Europa',
    none: 'Von dort versendet keiner deiner Läden.',
  },

  rateAlone: (rate) => `${rate} Treffer auf tausend Listings.`,
  rateAbove: (rate, factor) =>
    `${rate} Treffer auf tausend, das ${factor}-Fache deiner anderen Läden.`,
  rateSame: (rate) => `${rate} Treffer auf tausend, ungefähr wie deine anderen Läden.`,
  rateBelow: (rate, factor) =>
    `${rate} Treffer auf tausend, nur das ${factor}-Fache deiner anderen Läden.`,

  neverScanned: 'Bisher nur der Name. Beobachten geht trotzdem schon, ein Dig füllt den Rest.',
  notDug: 'noch nicht gegraben',
  digShort: 'Graben',
  sort: {
    label: 'Sortieren',
    rate: 'Trefferquote',
    recent: 'Zuletzt gegraben',
    size: 'Größe',
    name: 'Name',
  },
  groups: { mine: 'Deine Läden', rest: 'Weitere' },
  digAt: (shop) => `Jetzt bei ${shop} graben`,
  perThousand: (rate) => `${rate} Treffer auf tausend`,
  find: 'Laden finden',
  noMatch: 'So heißt keiner deiner Läden.',
  more: (n) => `${n} weitere zeigen`,
  listings: (n) => `${n} Listings`,
  shipsFrom: (country) => `aus ${countryName(country)}`,
  rating: (percent, count) => `${percent} bei ${count} Bewertungen`,
  lastScanned: (when) => `zuletzt gescannt am ${when}`,

  grading: {
    rate: (percent, judged) =>
      `${percent} von ${judged} Platten, die du hier gekauft hast, kamen wie beschrieben oder besser an.`,
    tooFew: (judged, one) =>
      `Erst ${judged} ${one ? 'Platte' : 'Platten'} beurteilt, zu wenig für eine Zahl.`,
    worse: (n, one) => `${n} ${one ? 'war' : 'waren'} schlechter als beschrieben.`,
    whyLabel: 'Warum steht das nicht bei Discogs?',
    why: 'Discogs-Feedback bewertet den Ablauf, nicht ob die Note gestimmt hat. Und eine schlechte Bewertung wegen Übergrading fliegt raus, sobald der Verkäufer sich beschwert. Diese Zahl gehört dir: Sie zählt die Platten, die du als angekommen markiert hast, und bleibt auf diesem Gerät.',
  },

  watching: 'Wird beobachtet',
  watch: 'Laden beobachten',
  watchCostLabel: 'Was Beobachten kostet',
  watchCost:
    'Beim Öffnen der App schaut Fidelity kurz nach, ob sich im Sortiment was getan hat. Eine Abfrage, kein neuer Scan.',
  digNow: 'Jetzt graben',
  digAgain: 'Nochmal graben',

  add: {
    label: 'Laden hinzufügen',
    placeholder: 'juno_records, oder die Adresse der Ladenseite',
    submit: 'Hinzufügen',
    busy: 'Schaue nach …',
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
    about: 'Wie viel vom Sortiment auf Labels liegt, die du schon sammelst.',
    fit: (percent) => `${percent} % deins`,
    sample: 'Grab einen, dann steht er mit eigenen Zahlen bei deinen Läden.',
  },

  round: {
    title: 'Der Rundgang',
    line: (shops, minutes) =>
      `${shops} beobachtet · rund ${minutes === 1 ? 'eine Minute' : `${minutes} Minuten`}`,
    about: (shops, minutes) =>
      `Geht ${shops === 1 ? 'deinen einen beobachteten Laden' : `deine ${shops} beobachteten Läden`} nacheinander ab und holt nur, was seit deinem letzten Besuch neu ist. Dauert rund ${minutes === 1 ? 'eine Minute' : `${minutes} Minuten`}. Stil und Preise fragt er nicht ab, das wären hundert Anfragen mehr pro Laden, und ein Treffer ist einen Tipp davon entfernt.`,
    neverDug: (n) =>
      n === 1
        ? 'Einen beobachteten Laden hast du noch nie gegraben, den überspringt der Rundgang.'
        : `${n} beobachtete Läden hast du noch nie gegraben, die überspringt der Rundgang.`,
    start: 'Rundgang starten',
    found: (n) => (n === 1 ? '1 Treffer' : `${n} Treffer`),
    keepsRunning: 'Läuft im Hintergrund weiter, auch wenn du den Bildschirm verlässt.',
    lastAt: (when) => `Letzter Rundgang ${when}`,
    stopNothing: (listings) => `nichts für dich unter ${listings} neuen`,
    stopFound: (matches, listings) =>
      `${matches === 1 ? '1 Treffer' : `${matches} Treffer`} unter ${listings} neuen`,
    stopNeverDug: 'noch nie gegraben, übersprungen',
    stopFailed: 'hat diesmal nicht geantwortet',
    quiet: (n) => (n === 1 ? '1 ohne Neues' : `${n} ohne Neues`),
    skipped: (n) =>
      n === 1 ? '1 nie gegraben, übersprungen' : `${n} nie gegraben, übersprungen`,
    others: (n) => (n === 1 ? 'Der andere' : `Die anderen ${n}`),
  },

  hide: 'Diesen Laden ausblenden',
  atDiscogs: 'Der Laden bei Discogs',
  hideWhy:
    'Verschwindet aus den Listen, von der Startseite und aus den Vorschlägen, und wird nicht mehr beobachtet. Ein Dig mit seinem Namen holt ihn zurück.',
  hidden: {
    title: (n) => (n === 1 ? 'Ein Laden ausgeblendet' : `${n} Läden ausgeblendet`),
    restore: 'Wieder zeigen',
  },

  pushOffer: 'Auch Bescheid sagen, wenn die App zu ist',
  pushOn: 'Du bekommst Bescheid, auch wenn die App zu ist.',
  pushStop: 'Nicht mehr Bescheid sagen',
  pushWhy:
    'Der Hub fragt jeden beobachteten Laden einmal die Stunde. Eine Abfrage für alle, nicht eine pro Person.',
  pushInstall:
    'Auf dem iPhone geht das nur mit Fidelity auf dem Home-Bildschirm: Teilen, dann „Zum Home-Bildschirm".',

  coverage: (sampled, total, percent) =>
    `Aus ${sampled} von ${total} Listings, ${percent} % des Ladens.`,

  priceTitle: 'Preislage',
  median: (amount) => `Median ${amount}`,
  mixedCurrencies: '(der Laden preist in mehreren Währungen aus)',
  priceHigh: 'eher teuer unter deinen Läden',
  priceLow: 'eher günstig unter deinen Läden',
  priceMiddle: 'im Mittelfeld deiner Läden',
  priceWhyLabel: 'Womit das verglichen wird',
  priceWhy:
    'Nur mit deinen eigenen Läden. Was der Markt insgesamt verlangt, sieht diese App nicht, also behauptet sie es auch nicht.',

  shelfSample: 'Aus deinem Regal führt er',
  labelsInStock: 'Labels im Sortiment',
  noLabels: 'Keine Labelangaben im Sortiment.',
  decades: 'Jahrzehnte',
  noYears: 'Keine Jahresangaben im Sortiment.',
  stock: {
    show: (name: string, n: number) => `Die ${n} Platten auf ${name} zeigen`,
    close: 'Schließen',
    counted: (shown: string, total: string) => `${shown} von ${total}`,
    more: (n: string) => `${n} weitere zeigen`,
    loading: 'Wird geholt …',
    needsDig:
      'Das Sortiment ist Marktplatzdatum und hält nur sechs Stunden. Scann den Laden neu, dann siehst du wieder, was im Regal steht.',
  },
  nothingYet: 'Noch nichts da.',

  trust: {
    ratings: (n, percent) => `${n} Bewertungen · ${percent} %`,
    noRatings: 'noch keine Bewertungen',
    since: (year) => `seit ${year}`,
    dug: (when) => `gegraben ${when}`,
    suspended: 'Bei Discogs vom Verkauf gesperrt.',
  },
  plates: {
    fit: 'Passung',
    postage: 'Versand',
    price: 'Preislage',
    shelf: 'Aus deinem Regal',
    range: 'Sortiment',
    movement: 'Bewegung',
    purchases: 'Deine Käufe',
  },
  rateWhyLabel: 'Was die Zahl zählt',
  rateWhy:
    'Treffer auf tausend Listings beim letzten Dig, verglichen mit dem Median deiner anderen Läden. Was der Markt insgesamt hergäbe, sieht diese App nicht.',
  postage: {
    named: (original, converted) =>
      `${original}${converted ? ` (${converted})` : ''} für eine Platte, sagt Discogs`,
    from: (amount) => `ab ${amount} für eine Platte`,
    unknown: 'Noch nicht erfasst.',
    enter: 'Im Warenkorb eintragen',
    text: 'Was der Laden dazu schreibt',
  },
  movement: {
    newest: (when) => `neuestes Angebot ${when}`,
    still: 'Nichts Neues seit dem letzten Blick.',
    unwatched: 'Nicht beobachtet, es wird also nichts nachgesehen.',
  },
  pick: 'Wähl links einen Laden aus.',
  verdict: {
    fit: { above: 'mehr Treffer', same: 'gleich viele Treffer', below: 'weniger Treffer' },
    price: { high: 'teurer', middle: 'Mittelfeld', low: 'günstiger' },
  },
  starters: {
    title: 'Fünf Läden für den Anfang',
    about: 'Groß, gut bewertet, und sie versenden in ganz Europa. Einer kostet eine Abfrage.',
    add: 'Hinzufügen',
    adding: 'Kommt …',
  },
  hideShort: 'Ausblenden',
  hiddenLine: (shop) => `${shop} ausgeblendet.`,
  undo: 'Rückgängig',
  prev: 'Voriger Laden',
  next: 'Nächster Laden',
}

export const packs = { en, de }

export function useDealerMessages() {
  return computed(() => packs[activeLanguage()])
}
