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
    uk: 'From the UK',
    na: 'From North America',
    jp: 'From Japan',
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
    'On an iPhone this needs Sleeveside on the home screen. Share, then Add to Home Screen.',

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
    /* A count with its date and its n, and no adjective (#244, § 824 BGB). */
    stale: (percent: string, asOf: string, n: string) =>
      `${percent} % listed on Discogs more than five years ago (as of ${asOf}, n = ${n})`,
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
    tempo: (gone: number, of: number, from: string, days: number) =>
      `${gone} of the ${counted(of, 'find', 'finds')} from ${from} were gone ${counted(days, 'day', 'days')} later.`,
    newest: (when: string) => `newest arrival ${when}`,
    still: 'Nothing new since you last looked.',
    unwatched: 'Not watched, so we do not look.',
  },
  pick: 'Pick a shop on the left.',
  /** The way to the gift finder (#245), under the list. */
  giftEntry: 'Looking for a gift? Search a friend’s wantlist in these shops.',
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
  rowPostageUpTo: (n: number) => `, up to ${n} records`,
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
    uk: 'Aus Großbritannien',
    na: 'Aus Nordamerika',
    jp: 'Aus Japan',
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
    'Auf dem iPhone geht das nur mit Sleeveside auf dem Home-Bildschirm. Teilen, dann „Zum Home-Bildschirm".',

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
    stale: (percent, asOf, n) =>
      `${percent} % seit über fünf Jahren bei Discogs eingestellt (Stand ${asOf}, n = ${n})`,
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
    tempo: (gone, of, from, days) =>
      `${gone} von ${counted(of, 'Fund', 'Funden')} von ${from} waren ${counted(days, 'Tag', 'Tage')} später weg.`,
    newest: (when) => `zuletzt reingekommen ${when}`,
    still: 'Nichts Neues seit deinem letzten Blick.',
    unwatched: 'Nicht beobachtet, also schauen wir nicht nach.',
  },
  pick: 'Such dir links einen Laden aus.',
  giftEntry: 'Suchst du ein Geschenk? Durchsuch die Wantlist von jemandem in diesen Läden.',
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
  rowPostageUpTo: (n) => `, bis ${n} Platten`,
  hideShort: 'Weglegen',
  hiddenLine: (shop) => `${shop} weggelegt.`,
  undo: 'Rückgängig',
  prev: 'Voriger Laden',
  next: 'Nächster Laden',
}

/** French counts nought and one in the singular. */
const frCounted = (n: number, one: string, many: string) => `${n} ${n < 2 ? one : many}`

const fr: typeof en = {
  title: 'Boutiques',
  description: 'Quelles boutiques sont ton truc, et ce qu’il y a dans leurs bacs.',
  lead: 'Quelles boutiques sont ton truc, et ce qu’il y a dans leurs bacs.',

  none: 'Pas encore de boutiques. Fouilles-en une, et elle apparaîtra ici.',
  scanned: 'Tes boutiques',
  origin: {
    label: 'Expédié depuis',
    any: 'Partout',
    home: (country) => `Depuis : ${countryName(country)}`,
    eu: 'Depuis l’UE',
    europe: 'Depuis l’Europe',
    uk: 'Depuis le Royaume-Uni',
    na: 'Depuis l’Amérique du Nord',
    jp: 'Depuis le Japon',
    none: 'Aucune de tes boutiques n’expédie de là.',
  },

  rateAlone: (rate) => `${rate} trouvailles pour mille disques.`,
  rateAbove: (rate, factor) =>
    `${rate} trouvailles pour mille disques, ${factor} fois tes autres boutiques.`,
  rateSame: (rate) =>
    `${rate} trouvailles pour mille disques, à peu près comme tes autres boutiques.`,
  rateBelow: (rate, factor) =>
    `${rate} trouvailles pour mille disques, seulement ${factor} fois tes autres boutiques.`,

  neverScanned:
    'Pour l’instant, on ne connaît que le nom. Tu peux quand même la suivre, une fouille remplira le reste.',
  notDug: 'pas encore fouillée',
  digShort: 'Fouiller',
  sort: {
    label: 'Trier',
    rate: 'Taux de trouvailles',
    recent: 'Dernière fouille',
    size: 'Taille',
    name: 'Nom',
  },
  groups: { mine: 'Tes boutiques', rest: 'Autres' },
  digAt: (shop) => `Fouiller chez ${shop} maintenant`,
  perThousand: (rate) => `${rate} trouvailles pour mille`,
  find: 'Trouver une boutique',
  noMatch: 'Aucune de tes boutiques ne s’appelle comme ça.',
  more: (n) => `Afficher ${n} de plus`,
  listings: (n) => `${n} annonces`,
  shipsFrom: (country) => `depuis : ${countryName(country)}`,
  rating: (percent, count) => `${percent} sur ${count} évaluations`,
  lastScanned: (when) => `dernière fouille le ${when}`,

  grading: {
    rate: (percent, judged) =>
      `${percent} des ${judged} disques que tu as achetés ici sont arrivés comme décrits, ou mieux.`,
    tooFew: (judged, one) =>
      `Seulement ${judged} ${one ? 'disque évalué' : 'disques évalués'}, trop peu pour un chiffre.`,
    worse: (n, one) => `${n} ${one ? 'était moins bon' : 'étaient moins bons'} que décrit.`,
    whyLabel: 'Pourquoi ce n’est pas sur Discogs ?',
    why: 'L’évaluation sur Discogs dit si le colis est arrivé vite. Si le disque était aussi bon que décrit, elle ne le dit pas. Ce chiffre vient de toi : tu as évalué les disques au déballage. Il reste sur ton appareil.',
  },

  watching: 'Suivie',
  watch: 'Suivre la boutique',
  watchCostLabel: 'Ce que coûte le suivi',
  watchCost:
    'Chaque fois que tu ouvres l’appli, on regarde vite si la boutique a du nouveau. Un coup d’œil, pas une nouvelle fouille.',
  digNow: 'Fouiller maintenant',
  digAgain: 'Refouiller',

  add: {
    label: 'Ajouter une boutique',
    placeholder: 'juno_records, ou l’adresse de la page de la boutique',
    submit: 'Ajouter',
    busy: 'On regarde …',
  },

  reasons: {
    dug: 'fouillée',
    basket: 'au panier',
    watched: 'suivie',
    order: 'achats ici',
    friend: 'ami Discogs',
    manual: 'ajoutée à la main',
  },

  suggested: {
    title: 'Des boutiques où d’autres ont trouvé leur bonheur',
    busy: 'On demande à ton hub …',
    about: 'Le chiffre dit quelle part de la boutique est sur des labels que tu collectionnes.',
    fit: (percent) => `${percent} % pour toi`,
    sample:
      'Fouilles-en une, et elle apparaîtra avec ses propres chiffres parmi tes boutiques.',
  },

  round: {
    title: 'La tournée',
    line: (shops, minutes) =>
      `${shops} suivies · environ ${minutes === 1 ? 'une minute' : `${minutes} minutes`}`,
    about: (shops, minutes) =>
      `On passe ${shops === 1 ? 'ta boutique suivie' : `tes ${shops} boutiques suivies`} l’une après l’autre et on ne récupère que ce qui est nouveau depuis ton dernier coup d’œil. Environ ${minutes === 1 ? 'une minute' : `${minutes} minutes`}. On laisse de côté styles et prix, ce serait cent requêtes de plus par boutique, et une trouvaille est à un toucher de là.`,
    neverDug: (n) =>
      n === 1
        ? 'Tu n’as jamais fouillé une de tes boutiques. On la laisse de côté pendant la tournée.'
        : `Tu n’as jamais fouillé ${n} de tes boutiques. On les laisse de côté pendant la tournée.`,
    start: 'Lancer la tournée',
    found: (n) => (n < 2 ? `${n} trouvaille` : `${n} trouvailles`),
    keepsRunning: 'Continue même si tu quittes l’écran.',
    lastAt: (when) => `Dernière tournée ${when}`,
    stopNothing: (listings) => `rien pour toi parmi ${listings} nouvelles`,
    stopFound: (matches, listings) =>
      `${matches < 2 ? `${matches} trouvaille` : `${matches} trouvailles`} parmi ${listings} nouvelles`,
    stopNeverDug: 'jamais fouillée, laissée de côté',
    stopFailed: 'n’a pas répondu cette fois',
    quiet: (n) => (n < 2 ? `${n} sans nouveauté` : `${n} sans nouveauté`),
    skipped: (n) =>
      n < 2
        ? `${n} jamais fouillée, laissée de côté`
        : `${n} jamais fouillées, laissées de côté`,
    others: (n) => (n === 1 ? 'L’autre' : `Les ${n} autres`),
  },

  hide: 'Mettre cette boutique de côté',
  atDiscogs: 'La boutique sur Discogs',
  hideWhy:
    'On retire la boutique de toutes les listes et on ne la surveille plus. Fouille-la par son nom, et elle revient.',
  hidden: {
    title: (n) => (n === 1 ? 'Une boutique mise de côté' : `${n} boutiques mises de côté`),
    restore: 'La ressortir',
  },

  pushOffer: 'Prévenir aussi quand l’appli est fermée',
  pushOn: 'On te prévient, même quand l’appli est fermée.',
  pushStop: 'Ne plus prévenir',
  pushWhy: 'Le hub passe une fois par heure voir chaque boutique suivie, une fois pour tous.',
  pushInstall:
    'Sur iPhone, ça ne marche qu’avec Sleeveside sur l’écran d’accueil. Partager, puis « Sur l’écran d’accueil ».',

  coverage: (sampled, total, percent) =>
    `On a vu ${sampled} disques sur ${total}, ${percent} % de la boutique.`,

  priceTitle: 'Niveau de prix',
  median: (amount) => `Médiane ${amount}`,
  mixedCurrencies: '(la boutique affiche ses prix en plusieurs devises)',
  priceHigh: 'plutôt chère parmi tes boutiques',
  priceLow: 'plutôt bon marché parmi tes boutiques',
  priceMiddle: 'dans la moyenne de tes boutiques',
  priceWhyLabel: 'Avec quoi on compare',
  priceWhy:
    'Seulement avec tes propres boutiques. Ce que pratique tout le marché, on ne le sait pas.',

  shelfSample: 'De ton étagère, elle a',
  labelsInStock: 'Labels dans les bacs',
  noLabels: 'La boutique n’indique pas de labels.',
  decades: 'Décennies',
  noYears: 'La boutique n’indique pas d’années.',
  stock: {
    show: (name: string, n: number) => `Montrer les ${n} disques sur ${name}`,
    close: 'Fermer',
    counted: (shown: string, total: string) => `${shown} sur ${total}`,
    more: (n: string) => `Afficher ${n} de plus`,
    loading: 'On récupère …',
    needsDig:
      'Ce qu’il y a dans les bacs, ce sont des données du marché, valables six heures. Refouille la boutique, et on te montre les rayons.',
  },
  nothingYet: 'Rien pour l’instant.',

  trust: {
    ratings: (n, percent) => `${n} évaluations · ${percent} %`,
    noRatings: 'pas encore d’évaluations',
    since: (year) => `depuis ${year}`,
    dug: (when) => `fouillée ${when}`,
    stale: (percent, asOf, n) =>
      `${percent} % en vente sur Discogs depuis plus de cinq ans (état au ${asOf}, n = ${n})`,
    suspended: 'Discogs a exclu cette boutique de la vente.',
  },
  plates: {
    fit: 'Accord',
    postage: 'Port',
    price: 'Niveau de prix',
    shelf: 'De ton étagère',
    range: 'Dans les bacs',
    movement: 'Nouveautés',
    purchases: 'Tes achats',
  },
  rateWhyLabel: 'Comment on calcule',
  rateWhy:
    'Autant de trouvailles pour mille disques lors de la dernière fouille ici. Pour comparer, on prend la médiane de tes autres boutiques. Ce que donne tout le marché, on ne le sait pas.',
  postage: {
    named: (original, converted) =>
      `${original}${converted ? ` (${converted})` : ''} pour un disque, selon Discogs`,
    from: (amount) => `à partir de ${amount} pour un disque`,
    unknown: 'On ne connaît pas encore le port.',
    enter: 'Le saisir dans le panier',
    text: 'Ce que la boutique en dit',
  },
  movement: {
    tempo: (gone, of, from, days) =>
      `${gone} sur ${frCounted(of, 'trouvaille', 'trouvailles')} du ${from} étaient parties ${frCounted(days, 'jour', 'jours')} plus tard.`,
    newest: (when) => `dernière arrivée ${when}`,
    still: 'Rien de neuf depuis ton dernier coup d’œil.',
    unwatched: 'Pas suivie, donc on ne regarde pas.',
  },
  pick: 'Choisis une boutique à gauche.',
  giftEntry:
    'Tu cherches un cadeau ? Parcours la liste d’envies de quelqu’un dans ces boutiques.',
  verdict: {
    fit: {
      above: 'plus de trouvailles',
      same: 'autant de trouvailles',
      below: 'moins de trouvailles',
    },
    price: { high: 'plus chère', middle: 'dans la moyenne', low: 'moins chère' },
  },
  starters: {
    title: 'Cinq boutiques pour commencer',
    about:
      'Grandes, bien notées, et elles expédient dans toute l’Europe. Une coûte une requête.',
    add: 'Ajouter',
    adding: 'Ça arrive …',
  },
  rowPostage: (amount) => `Port à partir de ${amount}`,
  rowPostageUpTo: (n) => `, jusqu’à ${n} disques`,
  hideShort: 'Mettre de côté',
  hiddenLine: (shop) => `${shop} mise de côté.`,
  undo: 'Annuler',
  prev: 'Boutique précédente',
  next: 'Boutique suivante',
}

export const packs = { en, de, fr }

export function useDealerMessages() {
  return computed(() => packs[activeLanguage()])
}
