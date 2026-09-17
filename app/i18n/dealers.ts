import { activeLanguage } from '~/composables/useMessages'
import { countryName } from '~/utils/countries'

/**
 * The words for the shops, in the voice of the person behind the counter
 * (docs/20): which ones you have dug, how well each one is your kind of
 * shop, and where the list of them comes from.
 *
 * Its own file, both languages together, both written rather than one
 * translated from the other. Buttons say what happens; the folds explain
 * like a friend would; where we do not know something, we say so in three
 * words. "Hide" is "put away" here, because that is what you do with a
 * record you are not taking: it is still in the shop.
 */

const en = {
  title: 'Shops',
  description: 'Which shops are your kind of shop, and what they have in the racks.',
  lead: 'Which shops are your kind of shop, and what they have in the racks.',

  none: 'No shops yet. Dig through one, and it shows up here.',
  /** The list's name for a screen reader. */
  scanned: 'Your shops',
  origin: {
    label: 'Ships from',
    any: 'Anywhere',
    home: (country: string) => `From ${country}`,
    eu: 'From the EU',
    europe: 'From Europe',
    none: 'None of your shops ships from there.',
  },

  /* One shop, one number. The comparison is with your other shops, once there are any. */
  rateAlone: (rate: string) => `${rate} finds per thousand records.`,
  rateAbove: (rate: string, factor: string) =>
    `${rate} finds per thousand records, ${factor} times your other shops.`,
  rateSame: (rate: string) =>
    `${rate} finds per thousand records, about the same as your other shops.`,
  rateBelow: (rate: string, factor: string) =>
    `${rate} finds per thousand records, only ${factor} times your other shops.`,

  neverScanned: 'We only know the name so far. Watch it anyway; a dig fills in the rest.',
  notDug: 'not dug yet',
  digShort: 'Dig',
  sort: {
    label: 'Order',
    rate: 'Hit rate',
    recent: 'Last dug',
    size: 'Size',
    name: 'Name',
  },
  groups: { mine: 'Your shops', rest: 'The rest' },
  digAt: (shop: string) => `Dig ${shop} now`,
  perThousand: (rate: string) => `${rate} finds per thousand`,
  find: 'Find a shop',
  noMatch: 'None of your shops goes by that name.',
  more: (n: string) => `Show ${n} more`,
  listings: (n: string) => `${n} listings`,
  shipsFrom: (country: string) => `from ${country}`,
  rating: (percent: string, count: string) => `${percent} on ${count} ratings`,
  lastScanned: (when: string) => `last dug on ${when}`,

  grading: {
    rate: (percent: string, judged: string) =>
      `${percent} of ${judged} records you bought here arrived as described or better.`,
    tooFew: (judged: string, one: boolean) =>
      `${judged} ${one ? 'record' : 'records'} judged so far, too few for a figure.`,
    worse: (n: string, one: boolean) => `${n} ${one ? 'was' : 'were'} worse than described.`,
    whyLabel: 'Why is this not on Discogs?',
    why: 'The rating at Discogs says whether the parcel came quickly. Whether the record was as good as described, it does not say. This figure comes from you: you judged the records as you unpacked them. It stays on your device.',
  },

  watching: 'Being watched',
  watch: 'Watch this shop',
  watchCostLabel: 'What watching costs',
  watchCost:
    'Every time you open the app, we glance at the shop for new arrivals. One look, not a new dig.',
  digNow: 'Dig now',
  digAgain: 'Dig again',

  add: {
    label: 'Add a shop',
    placeholder: 'juno_records, or the address of the shop page',
    submit: 'Add',
    busy: 'Looking …',
  },

  reasons: {
    dug: 'dug',
    basket: 'in the basket',
    watched: 'watched',
    order: 'bought from',
    friend: 'Discogs friend',
    manual: 'entered by hand',
  },

  suggested: {
    title: 'Shops others struck gold in',
    busy: 'Asking your hub …',
    about: 'The number says how much of the shop is on labels you collect.',
    fit: (percent: number) => `${percent} % yours`,
    sample: 'Dig one, and it joins your shops with numbers of its own.',
  },

  round: {
    title: 'The round',
    line: (shops: string, minutes: number) =>
      `${shops} watched · about ${minutes === 1 ? 'a minute' : `${minutes} minutes`}`,
    about: (shops: number, minutes: number) =>
      `We go to ${shops === 1 ? 'your one watched shop' : `your ${shops} watched shops`} one after another and fetch only what is new since your last look. About ${minutes === 1 ? 'a minute' : `${minutes} minutes`}. We skip styles and prices on the way, that would be a hundred more requests per shop, and a find is one tap from them.`,
    neverDug: (n: number) =>
      n === 1
        ? 'One of your shops you have never dug through. We skip it on the round.'
        : `${n} of your shops you have never dug through. We skip them on the round.`,
    start: 'Walk the round',
    found: (n: number) => (n === 1 ? '1 find' : `${n} finds`),
    keepsRunning: 'Keeps going if you leave this screen.',
    lastAt: (when: string) => `Last round ${when}`,
    stopNothing: (listings: string) => `nothing for you among ${listings} new`,
    stopFound: (matches: number, listings: string) =>
      `${matches === 1 ? '1 find' : `${matches} finds`} among ${listings} new`,
    stopNeverDug: 'never dug, skipped',
    stopFailed: 'did not answer this time',
    quiet: (n: number) => (n === 1 ? '1 with nothing new' : `${n} with nothing new`),
    skipped: (n: number) => (n === 1 ? '1 never dug, skipped' : `${n} never dug, skipped`),
    others: (n: number) => (n === 1 ? 'The other one' : `The other ${n}`),
  },

  /* "Put away", not "hide": the record is still in the shop, you are just not taking it. */
  hide: 'Put this shop away',
  atDiscogs: 'The shop at Discogs',
  hideWhy:
    'We take the shop off every list and stop looking at it. Dig it by name, and it is back.',
  hidden: {
    title: (n: number) => (n === 1 ? 'One shop put away' : `${n} shops put away`),
    restore: 'Bring it back',
  },

  pushOffer: 'Tell me while the app is closed',
  pushOn: 'We will tell you, even with the app closed.',
  pushStop: 'Stop telling me',
  pushWhy: 'The hub looks at each watched shop once an hour, once for everybody.',
  pushInstall:
    'On an iPhone this needs Fidelity on the home screen. Share, then Add to Home Screen.',

  coverage: (sampled: string, total: string, percent: number) =>
    `We saw ${sampled} of ${total} records, ${percent} % of the shop.`,

  priceTitle: 'Price range',
  median: (amount: string) => `Median ${amount}`,
  mixedCurrencies: '(the shop prices in several currencies)',
  priceHigh: 'on the dear side of your shops',
  priceLow: 'on the cheap side of your shops',
  priceMiddle: 'in the middle of your shops',
  priceWhyLabel: 'What we compare with',
  priceWhy: 'Only with your own shops. What the market at large charges, we do not know.',

  shelfSample: 'From your shelf it stocks',
  labelsInStock: 'Labels in the racks',
  noLabels: 'The shop names no labels.',
  decades: 'Decades',
  noYears: 'The shop names no years.',
  stock: {
    show: (name: string, n: number) => `Show the ${n} records on ${name}`,
    close: 'Close',
    counted: (shown: string, total: string) => `${shown} of ${total}`,
    more: (n: string) => `Show ${n} more`,
    loading: 'Fetching …',
    needsDig:
      'What is in the racks is marketplace data and lives six hours. Dig the shop again, and we show you the shelves.',
  },
  nothingYet: 'Nothing here yet.',

  trust: {
    ratings: (n: string, percent: string) => `${n} ratings · ${percent} %`,
    noRatings: 'no ratings yet',
    since: (year: string) => `since ${year}`,
    dug: (when: string) => `dug ${when}`,
    suspended: 'Discogs has stopped this shop from selling.',
  },
  plates: {
    fit: 'Fit',
    postage: 'Postage',
    price: 'Price range',
    shelf: 'From your shelf',
    range: 'In the racks',
    movement: 'New arrivals',
    purchases: 'Your purchases',
  },
  rateWhyLabel: 'How we count',
  rateWhy:
    'Finds per thousand records on the last dig here, against the median of your other shops. What the whole market would turn up, we do not know.',
  postage: {
    named: (original: string, converted: string | null) =>
      `${original}${converted ? ` (${converted})` : ''} for one record, says Discogs`,
    from: (amount: string) => `from ${amount} for one record`,
    unknown: 'We do not know the postage yet.',
    enter: 'Enter it in the basket',
    text: 'What the shop writes',
  },
  movement: {
    newest: (when: string) => `newest arrival ${when}`,
    still: 'Nothing new since you last looked.',
    unwatched: 'Not watched, so we do not look.',
  },
  pick: 'Pick a shop on the left.',
  verdict: {
    fit: { above: 'more finds', same: 'as many finds', below: 'fewer finds' },
    price: { high: 'dearer', middle: 'mid-priced', low: 'cheaper' },
  },
  starters: {
    title: 'Five shops to start with',
    about: 'Big, well rated, and they ship across Europe. Adding one costs one lookup.',
    add: 'Add',
    adding: 'Adding …',
  },
  /** On the row: what one record costs to post from here (M34.3). */
  rowPostage: (amount: string) => `from ${amount} postage`,
  hideShort: 'Put away',
  hiddenLine: (shop: string) => `${shop} put away.`,
  undo: 'Undo',
  prev: 'Previous shop',
  next: 'Next shop',
}

const de: typeof en = {
  title: 'Läden',
  description: 'Welche Läden dein Ding sind, und was bei ihnen in den Kisten liegt.',
  lead: 'Welche Läden dein Ding sind, und was bei ihnen in den Kisten liegt.',

  none: 'Noch keine Läden. Grab einen durch, dann steht er hier.',
  scanned: 'Deine Läden',
  origin: {
    label: 'Versand aus',
    any: 'Überall',
    home: (country) => `Aus ${countryName(country)}`,
    eu: 'Aus der EU',
    europe: 'Aus Europa',
    none: 'Von dort verschickt keiner deiner Läden.',
  },

  rateAlone: (rate) => `${rate} Funde auf tausend Platten.`,
  rateAbove: (rate, factor) =>
    `${rate} Funde auf tausend Platten, das ${factor}-Fache deiner anderen Läden.`,
  rateSame: (rate) => `${rate} Funde auf tausend Platten, ungefähr wie deine anderen Läden.`,
  rateBelow: (rate, factor) =>
    `${rate} Funde auf tausend Platten, nur das ${factor}-Fache deiner anderen Läden.`,

  neverScanned:
    'Bis jetzt kennen wir nur den Namen. Beobachten geht trotzdem, ein Dig füllt den Rest.',
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
  perThousand: (rate) => `${rate} Funde auf tausend`,
  find: 'Laden finden',
  noMatch: 'So heißt keiner deiner Läden.',
  more: (n) => `${n} weitere zeigen`,
  listings: (n) => `${n} Angebote`,
  shipsFrom: (country) => `aus ${countryName(country)}`,
  rating: (percent, count) => `${percent} bei ${count} Bewertungen`,
  lastScanned: (when) => `zuletzt gegraben am ${when}`,

  grading: {
    rate: (percent, judged) =>
      `${percent} von ${judged} Platten, die du hier gekauft hast, kamen wie beschrieben oder besser an.`,
    tooFew: (judged, one) =>
      `Erst ${judged} ${one ? 'Platte' : 'Platten'} bewertet, zu wenig für eine Zahl.`,
    worse: (n, one) => `${n} ${one ? 'war' : 'waren'} schlechter als beschrieben.`,
    whyLabel: 'Warum steht das nicht bei Discogs?',
    why: 'Die Bewertung bei Discogs sagt, ob das Paket schnell kam. Ob die Platte so gut war wie beschrieben, sagt sie nicht. Diese Zahl kommt von dir: Du hast die Platten beim Auspacken bewertet. Sie bleibt auf deinem Gerät.',
  },

  watching: 'Wird beobachtet',
  watch: 'Laden beobachten',
  watchCostLabel: 'Was Beobachten kostet',
  watchCost:
    'Jedes Mal, wenn du die App öffnest, schauen wir kurz, ob der Laden was Neues hat. Ein Blick, kein neuer Dig.',
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
    title: 'Läden, in denen andere fündig wurden',
    busy: 'Fragen deinen Hub …',
    about: 'Die Zahl sagt, wie viel vom Laden auf Labels liegt, die du sammelst.',
    fit: (percent) => `${percent} % deins`,
    sample: 'Grab einen durch, dann steht er mit eigenen Zahlen bei deinen Läden.',
  },

  round: {
    title: 'Die Runde',
    line: (shops, minutes) =>
      `${shops} beobachtet · rund ${minutes === 1 ? 'eine Minute' : `${minutes} Minuten`}`,
    about: (shops, minutes) =>
      `Wir gehen ${shops === 1 ? 'deinen einen beobachteten Laden' : `deine ${shops} beobachteten Läden`} nacheinander ab und holen nur, was seit deinem letzten Blick neu ist. Rund ${minutes === 1 ? 'eine Minute' : `${minutes} Minuten`}. Stile und Preise lassen wir dabei aus, das wären hundert Anfragen mehr pro Laden, und ein Fund ist einen Tipp davon entfernt.`,
    neverDug: (n) =>
      n === 1
        ? 'Einen Laden hast du noch nie durchgegraben. Den lassen wir bei der Runde aus.'
        : `${n} Läden hast du noch nie durchgegraben. Die lassen wir bei der Runde aus.`,
    start: 'Runde starten',
    found: (n) => (n === 1 ? '1 Fund' : `${n} Funde`),
    keepsRunning: 'Läuft weiter, auch wenn du den Bildschirm verlässt.',
    lastAt: (when) => `Letzte Runde ${when}`,
    stopNothing: (listings) => `nichts für dich unter ${listings} neuen`,
    stopFound: (matches, listings) =>
      `${matches === 1 ? '1 Fund' : `${matches} Funde`} unter ${listings} neuen`,
    stopNeverDug: 'nie gegraben, ausgelassen',
    stopFailed: 'hat diesmal nicht geantwortet',
    quiet: (n) => (n === 1 ? '1 ohne Neues' : `${n} ohne Neues`),
    skipped: (n) =>
      n === 1 ? '1 nie gegraben, ausgelassen' : `${n} nie gegraben, ausgelassen`,
    others: (n) => (n === 1 ? 'Der andere' : `Die anderen ${n}`),
  },

  hide: 'Diesen Laden weglegen',
  atDiscogs: 'Der Laden bei Discogs',
  hideWhy:
    'Wir nehmen den Laden aus allen Listen und schauen nicht mehr nach ihm. Grab ihn mit Namen, dann ist er wieder da.',
  hidden: {
    title: (n) => (n === 1 ? 'Ein Laden weggelegt' : `${n} Läden weggelegt`),
    restore: 'Wieder hervorholen',
  },

  pushOffer: 'Auch Bescheid sagen, wenn die App zu ist',
  pushOn: 'Wir sagen dir Bescheid, auch wenn die App zu ist.',
  pushStop: 'Nicht mehr Bescheid sagen',
  pushWhy:
    'Der Hub schaut einmal die Stunde bei jedem beobachteten Laden vorbei, einmal für alle.',
  pushInstall:
    'Auf dem iPhone geht das nur mit Fidelity auf dem Home-Bildschirm. Teilen, dann „Zum Home-Bildschirm".',

  coverage: (sampled, total, percent) =>
    `Wir haben ${sampled} von ${total} Platten gesehen, ${percent} % des Ladens.`,

  priceTitle: 'Preislage',
  median: (amount) => `Median ${amount}`,
  mixedCurrencies: '(der Laden preist in mehreren Währungen aus)',
  priceHigh: 'eher teuer unter deinen Läden',
  priceLow: 'eher günstig unter deinen Läden',
  priceMiddle: 'im Mittelfeld deiner Läden',
  priceWhyLabel: 'Womit wir vergleichen',
  priceWhy: 'Nur mit deinen eigenen Läden. Was der ganze Markt nimmt, wissen wir nicht.',

  shelfSample: 'Aus deinem Regal führt er',
  labelsInStock: 'Labels in den Kisten',
  noLabels: 'Der Laden nennt keine Labels.',
  decades: 'Jahrzehnte',
  noYears: 'Der Laden nennt keine Jahre.',
  stock: {
    show: (name: string, n: number) => `Die ${n} Platten auf ${name} zeigen`,
    close: 'Schließen',
    counted: (shown: string, total: string) => `${shown} von ${total}`,
    more: (n: string) => `${n} weitere zeigen`,
    loading: 'Holen gerade …',
    needsDig:
      'Was in den Kisten liegt, ist Marktplatzdatum und hält sechs Stunden. Grab den Laden nochmal, dann zeigen wir dir die Regale.',
  },
  nothingYet: 'Noch nichts da.',

  trust: {
    ratings: (n, percent) => `${n} Bewertungen · ${percent} %`,
    noRatings: 'noch keine Bewertungen',
    since: (year) => `seit ${year}`,
    dug: (when) => `gegraben ${when}`,
    suspended: 'Discogs hat diesen Laden vom Verkauf ausgeschlossen.',
  },
  plates: {
    fit: 'Passung',
    postage: 'Porto',
    price: 'Preislage',
    shelf: 'Aus deinem Regal',
    range: 'In den Kisten',
    movement: 'Neu reingekommen',
    purchases: 'Deine Käufe',
  },
  rateWhyLabel: 'Wie wir rechnen',
  rateWhy:
    'So viele Funde auf tausend Platten hatte der letzte Dig hier. Zum Vergleich nehmen wir den Median deiner anderen Läden. Was der ganze Markt hergibt, wissen wir nicht.',
  postage: {
    named: (original, converted) =>
      `${original}${converted ? ` (${converted})` : ''} für eine Platte, sagt Discogs`,
    from: (amount) => `ab ${amount} für eine Platte`,
    unknown: 'Das Porto kennen wir noch nicht.',
    enter: 'Im Korb eintragen',
    text: 'Was der Laden dazu schreibt',
  },
  movement: {
    newest: (when) => `zuletzt reingekommen ${when}`,
    still: 'Nichts Neues seit deinem letzten Blick.',
    unwatched: 'Nicht beobachtet, also schauen wir nicht nach.',
  },
  pick: 'Such dir links einen Laden aus.',
  verdict: {
    fit: { above: 'mehr Funde', same: 'gleich viele Funde', below: 'weniger Funde' },
    price: { high: 'teurer', middle: 'Mittelfeld', low: 'günstiger' },
  },
  starters: {
    title: 'Fünf Läden für den Anfang',
    about: 'Groß, gut bewertet, und sie verschicken in ganz Europa. Einer kostet eine Abfrage.',
    add: 'Hinzufügen',
    adding: 'Kommt …',
  },
  rowPostage: (amount) => `Porto ab ${amount}`,
  hideShort: 'Weglegen',
  hiddenLine: (shop) => `${shop} weggelegt.`,
  undo: 'Rückgängig',
  prev: 'Voriger Laden',
  next: 'Nächster Laden',
}

export const packs = { en, de }

export function useDealerMessages() {
  return computed(() => packs[activeLanguage()])
}
