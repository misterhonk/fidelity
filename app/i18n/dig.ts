import { activeLanguage } from '~/composables/useMessages'
import { counted, plural } from '~/utils/plural'

/**
 * The words for digging: the shop form, the scan, the list of finds and the
 * filters over it.
 *
 * Its own file for the reason in `settings.ts` — the first paint has a budget
 * and none of this is on the start screen. Both languages together, for the
 * reason written there too.
 */

const en = {
  title: 'Dig',
  lead: 'One shop, one dig — what it has, and what of it is for you.',
  again: (shop: string) => `Dig ${shop} again`,
  description: 'Scan a Discogs shop and get a scored list of finds.',

  dealer: 'Shop — name or link',
  dealerPlaceholder: 'juno_records — or the address of the shop page',
  check: 'Check',
  yourShops: 'Your shops',
  /** The head of the screen, once a result stands under it. */
  another: 'Another shop, or an earlier dig',
  /** The unit behind the number on a shop chip. */
  perThousand: (rate: string) => `${rate} finds per thousand listings`,
  offline:
    'No network — a new dig is not possible right now. The last one is below and is complete.',

  resume: 'Carry on with the dig',
  interrupted: (dealer: string, scanned: string, total: string) =>
    `A dig at ${dealer} was interrupted — ${scanned} of ${total} were through.`,
  /** Above the bar: which shop. A page opened mid-scan shows the same line. */
  /** Discogs has throttled us and the client is waiting it out (M32.5). */
  throttled: (seconds: number) =>
    `Discogs has asked for a pause — carrying on in about ${seconds} s. Nothing is lost; the scan picks up where it stopped.`,
  /** Measured, not assumed: what actually went out in the last minute (M32.7). */
  slowLane: (howMany: number) =>
    `Only ${howMany} requests went out in the last minute instead of about fifty. That is what a browser does to a tab in the background — keep this one in front and the dig runs at full speed.`,
  scanning: (dealer: string) => `Scanning ${dealer}`,
  matchCount: (n: string) => `${n} finds`,
  allFindsHeading: 'All finds',
  listings: (n: string) => `has ${n} listings`,
  truncated: (reachable: string, percent: number) =>
    `An ordinary dig reaches at most ${reachable} of them — that is ${percent} %.`,
  takesAbout: (minutes: number) =>
    `Takes about ${counted(minutes, 'minute', 'minutes')} — with this tab in front, because a browser slows the clock of one in the background.`,

  incremental: {
    /*
     * The short label for the chip row of earlier digs.
     *
     * Until 2026-09-11 three runs of the same shop looked identical there —
     * name and match count, nothing else. An "only what is new" run says
     * something completely different about a zero than a full one does, and
     * without this word the difference is invisible.
     */
    short: 'only what was new',
    /** The dig nobody has to run: the count has not moved (M32.4). */
    unmoved: (howMany: string) =>
      `Still ${howMany} for sale — the same number as at your last dig. Nothing may have arrived; a shop that sold one and listed one counts as unchanged here.`,
    known: (minutes: number) =>
      `You know this shop already. Fidelity can fetch only the listings that have arrived since last time — usually one or two lookups instead of ${counted(minutes, 'minute', 'minutes')}.`,
    fetch: 'Fetch only what is new',
  },
  start: 'Start the dig',
  startAgain: 'Go through all of it again',

  deep: {
    about: (minutes: number) =>
      `A deep scan walks the same shop in thirteen orderings — date, price, audio sample, title, artist, label, catalogue number, each in both directions. Every one shows different records in its first 10,000. Takes up to ${minutes} minutes — it stops as soon as an ordering turns up nothing new.`,
    start: 'Start a deep scan',
  },

  enriching: (done: string, total: string, requests: string) =>
    `Styles and market prices are being looked up — ${done} of ${total} (${requests} lookups)`,

  horizonLearned: (albums: number) =>
    `The horizon now knows ${counted(albums, 'album', 'albums')} more in all their pressings`,
  horizonCounts: 'The next dig counts that in.',

  earlierDigs: 'Earlier digs',
  hits: (n: number, dealer: string) => `${counted(n, 'find', 'finds')} at ${dealer}`,
  newListings: (n: string, one: boolean) =>
    `${n} ${one ? 'new listing' : 'new listings'} since your last visit`,
  scanned: (done: string, total: string, percent: number) =>
    `${done} of ${total} scanned (${percent} %)`,
  folded: (n: number) => `${n} further ${plural(n, 'copy', 'copies')} folded in`,

  /*
   * The basis, under every result.
   *
   * Reported on 2026-09-13 after a first dig came back empty: "now I do not
   * know whether my horizon was used or not." Nothing said. A nought and a
   * list of twenty are equally unreadable without it.
   */
  basis: (records: string, expanded: number, entities: number) =>
    `Matched against your horizon: ${records} records, from ${expanded} of ${entities} artists and labels.`,
  basisMore: 'Build the rest',

  /*
   * One lane to Discogs, first come first served (rule 3).
   *
   * "Now, after 10 minutes, the app starts scanning my first shop. A bit
   * illogical." The order was right; nothing on the screen said what was in
   * front of it.
   *
   * Only the deliberate build says so. The daily refresh and the pass after a
   * dig are twenty lookups apiece — half a minute, and a box about half a
   * minute is more apparatus than event.
   */
  lane: 'The horizon is being built. There is one line to Discogs and it is served in order, so a dig started now begins once the build is through.',
  laneWatch: 'Watch it',

  expired:
    'Older than six hours — prices and conditions may no longer be shown. The finds and their reasons stay.',
  refreshPrices: 'Refresh the prices',
  /*
   * Passing a find list on.
   *
   * The link carries the key in the `#` fragment, which no browser sends to a
   * server — so the text says "only whoever has the link" and not "private",
   * which would be a promise nobody can keep.
   */
  share: 'Share this list',
  /*
   * The screen for somebody who does not have this app.
   *
   * So every sentence explains itself and assumes nothing — not even the word
   * "dig", which is being read here for the first and possibly only time.
   */
  sharedTitle: 'A list of finds',
  sharedFrom: (dealer: string) => `Finds at ${dealer}`,
  sharedScope: (shown: string, total: string, coverage: string) =>
    shown === total
      ? `All ${total} of them — ${coverage} % of the shop was read.`
      : `The best ${shown} of ${total} — ${coverage} % of the shop was read.`,
  sharedGone: 'This link has expired. Prices from a shop may only be shown for six hours.',
  sharedBadLink: 'Something is missing from this link — most likely the part after the #.',
  sharedNoHub:
    'No hub answers at this address. The link only works where the list was shared from.',
  sharedWhatIsThis: 'What is Fidelity?',
  sharedPitch:
    'Fidelity reads a record shop against your own collection and says, for every find, why it fits.',

  /*
   * The stack (M15) — the same finds, one after another.
   *
   * `position` says where you are instead of feigning endlessness: a shop runs
   * out eventually, and then the screen says so.
   */
  stack: {
    title: 'One at a time',
    lead: 'Your finds, one record per screen. Swipe on.',
    empty: 'No fresh finds yet. A dig fills this screen.',
    toDig: 'Start a dig',
    through: 'That was all of them. Nothing left waiting.',
    position: (at: string, of: string, dealer: string) => `${at} of ${of} at ${dealer}`,
    shop: (dealer: string, waiting: number) =>
      waiting > 0 ? `${dealer} — ${waiting} still waiting` : `${dealer} — all seen`,
    like: 'Interesting',
    hear: 'Listen',
    hearStop: 'Stop',
    /* Said as soon as it runs — not beforehand as a warning and not at all.
     * Anyone turning the sound on should know who they are meeting. */
    hearVia: 'Played from YouTube — Google sees this device while it does.',
    basket: 'Basket',
    share: 'Share',
    next: 'Next',
    back: 'Back',
  },

  shareBusy: 'Sealing …',
  shareNeedsHub: 'Sharing needs a hub — one is set up in the settings.',
  shareReady: (matches: number, total: number) =>
    matches < total
      ? `Link ready — the top ${matches} of ${total} finds.`
      : `Link ready — all ${matches} finds.`,
  shareCopy: 'Copy link',
  shareCopied: 'Copied.',
  shareGone: (when: string) => `Works until ${when}, then it is gone.`,
  /* Said because nobody would otherwise guess it: the reason sentences give
   * something away about your collection. That is the point and still a
   * disclosure. */
  shareTells:
    'Whoever opens it sees why each record fitted — and so, a little, what you collect.',

  refreshAbout: (minutes: number) =>
    `${counted(minutes, 'minute', 'minutes')}. Finds nothing new — only what this dig already found, again.`,
  refreshed: (n: string) => `${n} up to date again`,
  refreshedSold: (n: string) => `${n} sold in the meantime`,
  refreshedGone: (n: string) => `${n} no longer findable`,
  refreshCost: (lookups: number, minutes: number) =>
    `${counted(lookups, 'lookup', 'lookups')}, so about ${counted(minutes, 'minute', 'minutes')}. Finds nothing new — only what this dig already found, again.`,
  checked: (done: string, total: string) => `${done} of ${total} checked`,
  alreadySold: (n: string) => `${n} already sold`,

  /**
   * Nothing found means three things, depending on what was looked at.
   *
   * A full dig that found nothing has read the whole shop and may say so about
   * the shop. An incremental one read what arrived since the last visit —
   * saying "nothing here for you" about 35,900 records because none of the four
   * new ones fit is a claim it never checked.
   */
  empty: {
    /* What is left to do when a dig found nothing (M31.6). */
    wholeShop: 'Read the whole shop',
    watchIt: 'Put it on the round',
    'incremental-empty': (dealer: string) =>
      `${dealer} has put nothing new up since your last visit. The rest of the stock was already here.`,
    incremental:
      'There was nothing for you among the new arrivals. What was there before, this dig did not look at again.',
    full: 'Nothing here for you at this shop. That is a result, not a fault.',
    /*
     * The sentence above is an acquittal, and without a horizon it cannot be
     * sustained.
     *
     * The engine then knows only the exact release ids of your own records —
     * no other pressing, no same artist, no same label. On 2026-08-13 it stood
     * there after 2,863 records had been looked through, while the horizon
     * consisted of a single entry, and sent the search in the wrong direction
     * for hours.
     */
    noHorizon:
      'Every listing here was checked and none matched — but the horizon has not been built yet, so there was almost nothing to match against. Until it exists, Fidelity only recognises the exact pressings you already own: no other pressing, no same artist, no same label.',
    buildIt: 'Build it now',
  },

  topFive: 'Top Five',
  sideOne: 'Side One, Track One:',

  filters: {
    search: 'Filter the finds',
    searchPlaceholder: 'Artist, title, label, catalogue number …',
    clear: 'Reset the filters',
    sorting: 'Sorting',
    shown: (shown: string, total: string | null) =>
      total === null ? `${shown} finds` : `${shown} of ${total} finds`,
    sortBy: 'Sort',
    /** Spoken on the key in force, because the arrow beside it is decoration. */
    sortedAsc: (label: string) => `${label}, ascending`,
    sortedDesc: (label: string) => `${label}, descending`,
    /** The head of the compact table: its own name, so it is not a second "Sort". */
    columns: 'Columns — tap one to sort by it',
    density: 'Density',
    comfortable: 'Detailed',
    /** The sleeves, two across on a phone — the crate you flip through. */
    crate: 'Crate',
    compact: 'Compact',
    /*
     * The direction is on the label.
     *
     * "Year" here means newest first — a shop's stock, where a 2026 pressing is
     * news. "Year" in the shelf means oldest first, because a shelf sorted by
     * year is a timeline and timelines run forwards. Both are right and neither
     * is guessable from the word alone, so both say which way they run.
     */
    sorts: {
      score: { label: 'Score', about: 'Best find first' },
      price: { label: 'Price', about: 'Cheapest first' },
      landed: {
        label: 'With postage',
        about: 'Cheapest first, counting the postage this record would add at this shop',
      },
      year: { label: 'Year', about: 'Newest first' },
      artist: { label: 'Artist', about: 'Alphabetical' },
    },
    nothingMatches: 'Nothing matches this selection.',
    /* A ceiling that counts postage. In the shop's currency, because nothing
     * here converts one — the basket says why. */
    upTo: 'Up to',
    upToLabel: 'At most this much, postage included',
    noPostage:
      'Postage for this shop is not known, so nothing here counts it. The table can be entered in the basket once a record is in it.',
  },

  /**
   * What a record costs once it is in the parcel (`shared/shipping.ts`).
   *
   * The number is the price plus the postage this record *adds* — the whole
   * first tier for the first record, often nothing for the third. The sentence
   * behind it says which record in the parcel it would be and where the table
   * came from, because "€2.10" on its own is a number nobody can check.
   */
  landed: {
    with: (amount: string) => `${amount} with postage`,
    why: (postage: string, items: number, source: string) =>
      `Price plus the postage this record adds at this shop: ${postage} as record ${items} in the parcel${source ? ` — ${source}` : ''}.`,
    sources: {
      user: 'table entered by you',
      bundled: 'from a shared table',
      parsed: 'estimated from the shop’s text',
      discogs: 'named by Discogs',
    },
  },

  /**
   * What a match says out loud.
   *
   * Almost none of this is visible: it is the accessible names on the score
   * badge, the feedback buttons and the list itself. Which is exactly why it
   * was still in German after the whole interface had been translated — a
   * screen reader was the only thing reading it, and nothing that reads a
   * screen reader was in the test suite. `tests/e2e/populated.spec.ts` is.
   *
   * In the dig pack rather than the shell, because a match card only ever
   * appears on a screen that has already loaded this chunk, and the first
   * paint has 2 kB of headroom, not 20.
   */
  match: {
    /* Rare per the catalogue (M20 #6): a hint under the sentence, never in the score. */
    fewPressings: (n: number) =>
      n === 1 ? 'The only pressing of this album.' : `Only ${n} pressings of this album exist.`,
    /*
     * The bands are named, not numbered, and two of the four names are
     * quotations — a record shop's own vocabulary for how much it matters, as
     * a nod to the novel this app is named after. They stay English in both
     * packs on purpose: "Side One, Track One" translated is just a sentence
     * about a groove. The lower two were never quotations, so they translate.
     */
    band: {
      S: 'Side One, Track One',
      A: 'Top Five',
      B: 'Solid',
      C: 'Footnote',
    },
    score: (score: number) => `Barry Score ${score} out of 100`,
    scoreBand: (score: number, band: string) => `Barry Score ${score} out of 100 – ${band}`,
    /* The name behind the question mark — spoken, and shown on hover. */
    scoreWhat: 'How the score works',
    scoreHow:
      'The score counts the reasons a record is here: the strongest counts in full, every further one at 30 %. That is why 100 is almost never reached — a perfect wantlist hit on its own makes 87. From 85 it is Side One Track One, from 70 Top Five, from 50 Solid, below that a footnote.',
    /*
     * Two actions, not ratings — and until today they stood in German in
     * `app/composables/useFeedback.ts`. Neither of today's guards looks there:
     * one checks attributes in templates, the other text nodes. A string
     * defined in a .ts file and then bound falls through both.
     */
    verdicts: { interesting: 'Save', bought: 'Mark bought', meh: 'So-so', wrong: 'Wrong pick' },
    /*
     * What the same button says once it is set.
     *
     * A toggle wearing one word never tells you which way it is thrown, and
     * the icon does not either. "Save" is the action, "Saved" is the state.
     */
    verdictsDone: { interesting: 'Saved', bought: 'Bought', meh: 'So-so', wrong: 'Wrong pick' },
    feedback: 'How was this find?',
    open: (record: string) => `Open ${record}`,
    allFinds: 'All finds',
    inBasket: 'Add to basket',
    outOfBasket: 'Take out of the basket',
    /*
     * The card's button is narrow and shows a state, not an errand: "In
     * basket" with `aria-pressed` says where the record is, which is what
     * somebody scanning a list of forty wants to know. The long pair above is
     * for the in-store screen, where the targets are thumb-sized and the label
     * is the instruction.
     */
    basketAdd: 'To basket',
    basketIn: 'In basket',
    inRunOut: 'in the run-out',
  },

  /**
   * The record's own page — the sheet that opens from a find.
   *
   * The richest screen in the app and the last one still in German after the
   * interface was translated, because nothing rendered it: it needs a match, a
   * dig and a click, and no test had ever had all three. Found on 2026-08-11
   * by looking at a screenshot of a seeded browser.
   */
  sheet: {
    offer: { price: 'Price', landed: 'With postage', media: 'Record', sleeve: 'Sleeve' },
    loading: 'Loading …',
    /** Walking the list from inside the sheet (M31.13). Arrow keys do it too. */
    previous: 'The find before this one',
    next: 'The next find',
    /** Asking about this one offer again, from where it is being read (M31.18). */
    askAgain: 'Ask this shop again',
    asking: 'Asking …',
    againSaid: {
      refreshed:
        'Asked again just now — the price and the condition are this shop’s current ones.',
      sold: 'Sold. It was here and it is not any more.',
      gone: 'The offer is gone from Discogs entirely.',
    },
    /*
     * A find whose dig is gone. Five are kept, so a newer dig eventually drops
     * an older one and the record behind a tile goes with it — which used to
     * render as an empty sheet under a loading title, the one state a reader
     * takes for a broken app.
     */
    /* Named for what it opens: a search at that service, not the record. */
    goneTitle: 'Gone',
    gone: 'This find is no longer here — a newer dig has taken its place.',
    goneAction: 'Dig the shop again',
    market: 'On the market',
    forSale: (copies: string, one: boolean) =>
      `${copies} ${one ? 'copy' : 'copies'} for sale worldwide`,
    lowest: 'lowest',
    signals: 'Signals',
    pressing: 'Pressing',
    plant: 'pressed at',
    discography: 'Discography',
    owned: (owned: string, total: string) => `${owned} of ${total}`,
    /* "(yours from 2004 to 2004)" is a sentence nobody would write.
     * One year is one year. */
    ownedYear: (year: string) => `(yours from ${year})`,
    ownedYears: (from: string, to: string) => `(yours from ${from} to ${to})`,
    connections: 'Links to your collection',
    atDiscogs: 'View at Discogs',
    want: 'Add to your Discogs wantlist',
    /* Short, because the sheet's foot is one row (M31.11). The full
       sentence is what a screen reader and a pointer get. */
    wantShort: 'Want it',
    wanted: 'On your wantlist',
  },
}

const de: typeof en = {
  title: 'Graben',
  lead: 'Ein Laden, ein Dig – was er hat und was davon zu dir passt.',
  again: (shop) => `${shop} nochmal graben`,
  description: 'Einen Discogs-Laden scannen und eine bewertete Fundliste bekommen.',

  dealer: 'Laden – Name oder Link',
  dealerPlaceholder: 'juno_records – oder die Adresse der Ladenseite',
  check: 'Prüfen',
  yourShops: 'Deine Läden',
  another: 'Ein anderer Laden, oder ein früherer Dig',
  perThousand: (rate) => `${rate} Treffer je tausend Listings`,
  offline:
    'Kein Netz – ein neuer Dig geht gerade nicht. Der letzte steht unten und ist vollständig.',

  resume: 'Dig fortsetzen',
  interrupted: (dealer: string, scanned: string, total: string) =>
    `Ein Dig bei ${dealer} wurde unterbrochen – ${scanned} von ${total} waren durch.`,
  throttled: (seconds) =>
    `Discogs bittet um eine Pause – weiter in etwa ${seconds} s. Es geht nichts verloren, der Scan macht dort weiter, wo er stehen geblieben ist.`,
  slowLane: (howMany) =>
    `In der letzten Minute gingen nur ${howMany} Anfragen raus statt rund fünfzig. Genau das macht ein Browser mit einem Tab im Hintergrund – lass diesen hier vorne, dann läuft der Dig in voller Geschwindigkeit.`,
  scanning: (dealer: string) => `Scanne ${dealer}`,
  matchCount: (n: string) => `${n} Treffer`,
  allFindsHeading: 'Alle Treffer',
  listings: (n) => `hat ${n} Listings`,
  truncated: (reachable, percent) =>
    `Ein normaler Dig kommt an höchstens ${reachable} davon heran – das sind ${percent} %.`,
  takesAbout: (minutes) =>
    `Dauert etwa ${counted(minutes, 'Minute', 'Minuten')} – mit diesem Tab im Vordergrund, denn im Hintergrund bremst der Browser die Uhr.`,

  incremental: {
    short: 'nur das Neue',
    unmoved: (howMany) =>
      `Weiterhin ${howMany} im Angebot – dieselbe Zahl wie bei deinem letzten Dig. Neu dazugekommen sein muss trotzdem nichts: ein Laden, der eine verkauft und eine eingestellt hat, zählt hier als unverändert.`,
    known: (minutes) =>
      `Diesen Laden kennst du schon. Fidelity kann nur die Angebote holen, die seit dem letzten Mal dazugekommen sind — meist ein bis zwei Abfragen statt ${counted(minutes, 'Minute', 'Minuten')}.`,
    fetch: 'Nur das Neue holen',
  },
  start: 'Dig starten',
  startAgain: 'Alles noch einmal durchgehen',

  deep: {
    about: (minutes) =>
      `Ein Tiefenscan geht denselben Laden in dreizehn Sortierungen durch – Datum, Preis, Hörprobe, Titel, Künstler, Label, Katalognummer, jeweils in beide Richtungen. Jede zeigt andere Platten in ihren ersten 10.000. Dauert bis zu ${minutes} Minuten – er hört auf, sobald eine Sortierung nichts Neues mehr bringt.`,
    start: 'Tiefenscan starten',
  },

  enriching: (done, total, requests) =>
    `Stile und Marktpreise werden nachgeschlagen – ${done} von ${total} (${requests} Abfragen)`,

  horizonLearned: (albums) =>
    `Der Horizont kennt jetzt ${counted(albums, 'Album', 'Alben')} mehr in allen Pressungen`,
  horizonCounts: 'Beim nächsten Dig zählt das mit.',

  earlierDigs: 'Frühere Digs',
  hits: (n, dealer) => `${counted(n, 'Treffer', 'Treffer')} bei ${dealer}`,
  newListings: (n, one) =>
    `${n} ${one ? 'neues Listing' : 'neue Listings'} seit dem letzten Besuch`,
  scanned: (done, total, percent) => `${done} von ${total} gescannt (${percent} %)`,
  folded: (n) => `${n} weitere ${plural(n, 'Exemplar', 'Exemplare')} zusammengefasst`,

  basis: (records, expanded, entities) =>
    `Geprüft gegen deinen Horizont: ${records} Platten, aus ${expanded} von ${entities} Künstlern und Labels.`,
  basisMore: 'Rest bauen',

  lane: 'Der Horizont wird gerade gebaut. Es gibt nur eine Leitung zu Discogs, und sie wird der Reihe nach bedient – ein Dig, den du jetzt startest, beginnt, sobald der Bau durch ist.',
  laneWatch: 'Zusehen',

  expired:
    'Älter als sechs Stunden – Preise und Zustände dürfen nicht mehr angezeigt werden. Die Treffer und ihre Begründungen bleiben.',
  refreshPrices: 'Preise auffrischen',
  share: 'Diese Liste teilen',
  sharedTitle: 'Eine Fundliste',
  sharedFrom: (dealer) => `Fundstücke bei ${dealer}`,
  sharedScope: (shown, total, coverage) =>
    shown === total
      ? `Alle ${total} davon – ${coverage} % des Ladens wurden gelesen.`
      : `Die besten ${shown} von ${total} – ${coverage} % des Ladens wurden gelesen.`,
  sharedGone:
    'Dieser Link ist abgelaufen. Preise aus einem Laden dürfen nur sechs Stunden lang gezeigt werden.',
  sharedBadLink: 'An diesem Link fehlt etwas – vermutlich der Teil hinter dem #.',
  sharedNoHub:
    'Unter dieser Adresse antwortet kein Hub. Der Link funktioniert nur dort, wo die Liste geteilt wurde.',
  sharedWhatIsThis: 'Was ist Fidelity?',
  sharedPitch:
    'Fidelity liest einen Plattenladen gegen deine eigene Sammlung und sagt zu jedem Fund, warum er passt.',

  stack: {
    title: 'Eine nach der anderen',
    lead: 'Deine Funde, eine Platte pro Bildschirm. Weiterwischen.',
    empty: 'Noch keine frischen Funde. Ein Dig füllt diesen Bildschirm.',
    toDig: 'Dig starten',
    through: 'Das waren alle. Es wartet nichts mehr.',
    position: (at, of, dealer) => `${at} von ${of} bei ${dealer}`,
    shop: (dealer, waiting) =>
      waiting > 0 ? `${dealer} — ${waiting} warten noch` : `${dealer} — alle gesehen`,
    like: 'Interessant',
    hear: 'Anhören',
    hearStop: 'Stopp',
    hearVia: 'Kommt von YouTube – Google sieht dieses Gerät, solange es läuft.',
    basket: 'Korb',
    share: 'Teilen',
    next: 'Weiter',
    back: 'Zurück',
  },

  shareBusy: 'Wird versiegelt …',
  shareNeedsHub: 'Teilen braucht einen Hub — einer wird in den Einstellungen eingetragen.',
  shareReady: (matches, total) =>
    matches < total
      ? `Link steht — die besten ${matches} von ${total} Treffern.`
      : `Link steht — alle ${matches} Treffer.`,
  shareCopy: 'Link kopieren',
  shareCopied: 'Kopiert.',
  shareGone: (when) => `Gilt bis ${when}, danach ist er weg.`,
  shareTells:
    'Wer ihn öffnet, sieht zu jeder Platte, warum sie passt – und damit ein wenig, was du sammelst.',

  refreshAbout: (minutes) =>
    `${counted(minutes, 'Minute', 'Minuten')}. Findet nichts Neues – nur das wieder, was dieser Dig schon gefunden hat.`,
  refreshed: (n) => `${n} wieder aktuell`,
  refreshedSold: (n) => `${n} inzwischen verkauft`,
  refreshedGone: (n) => `${n} nicht mehr auffindbar`,
  refreshCost: (lookups, minutes) =>
    `${counted(lookups, 'Abfrage', 'Abfragen')}, also rund ${counted(minutes, 'Minute', 'Minuten')}. Findet nichts Neues – nur das wieder, was dieser Dig schon gefunden hat.`,
  checked: (done, total) => `${done} von ${total} nachgesehen`,
  alreadySold: (n) => `${n} schon verkauft`,

  empty: {
    wholeShop: 'Den ganzen Laden lesen',
    watchIt: 'In den Rundgang nehmen',
    'incremental-empty': (dealer) =>
      `Seit deinem letzten Besuch hat ${dealer} nichts Neues eingestellt. Der Rest des Sortiments stand hier schon.`,
    incremental:
      'Unter dem Neuen war nichts für dich. Was vorher da war, hat dieser Dig nicht noch einmal angesehen.',
    full: 'Bei diesem Laden nichts für dich. Das ist ein Ergebnis, kein Fehler.',
    noHorizon:
      'Jede Platte hier wurde geprüft und keine passte — aber der Horizont ist noch nicht gebaut, es gab also fast nichts, wogegen zu prüfen war. Solange er fehlt, erkennt Fidelity nur die Pressungen, die du schon hast: kein anderes Pressing, kein selber Künstler, kein selbes Label.',
    buildIt: 'Jetzt bauen',
  },

  topFive: 'Top Five',
  sideOne: 'Side One, Track One:',

  filters: {
    search: 'Fundliste filtern',
    searchPlaceholder: 'Künstler, Titel, Label, Katalognummer …',
    clear: 'Filter zurücksetzen',
    sorting: 'Sortierung',
    shown: (shown, total) =>
      total === null ? `${shown} Treffer` : `${shown} von ${total} Treffern`,
    sortBy: 'Sortieren',
    sortedAsc: (label) => `${label}, aufsteigend`,
    sortedDesc: (label) => `${label}, absteigend`,
    columns: 'Spalten – zum Sortieren antippen',
    density: 'Dichte',
    comfortable: 'Ausführlich',
    crate: 'Kiste',
    compact: 'Kompakt',
    sorts: {
      score: { label: 'Score', about: 'Bester Treffer zuerst' },
      price: { label: 'Preis', about: 'Günstigste zuerst' },
      landed: {
        label: 'Mit Porto',
        about:
          'Günstigste zuerst, mit dem Porto, das diese Platte bei diesem Laden dazukommen lässt',
      },
      year: { label: 'Jahr', about: 'Neueste zuerst' },
      artist: { label: 'Künstler', about: 'Alphabetisch' },
    },
    nothingMatches: 'Nichts passt zu dieser Auswahl.',
    upTo: 'Bis',
    upToLabel: 'Höchstens so viel, Porto eingerechnet',
    noPostage:
      'Das Porto dieses Ladens ist nicht bekannt, deshalb rechnet hier nichts damit. Die Staffel lässt sich im Korb eintragen, sobald eine Platte drin liegt.',
  },

  landed: {
    with: (amount) => `${amount} mit Porto`,
    why: (postage, items, source) =>
      `Preis plus das Porto, das diese Platte bei diesem Laden dazukommen lässt: ${postage} als ${items}. Platte im Paket${source ? ` – ${source}` : ''}.`,
    sources: {
      user: 'Staffel von dir eingetragen',
      bundled: 'aus einer geteilten Staffel',
      parsed: 'aus dem Text des Ladens geschätzt',
      discogs: 'von Discogs genannt',
    },
  },

  match: {
    fewPressings: (n) =>
      n === 1
        ? 'Die einzige Pressung dieses Albums.'
        : `Von diesem Album gibt es nur ${n} Pressungen.`,
    band: {
      S: 'Side One, Track One',
      A: 'Top Five',
      B: 'Solide',
      C: 'Randnotiz',
    },
    score: (score: number) => `Barry Score ${score} von 100`,
    scoreBand: (score: number, band: string) => `Barry Score ${score} von 100 – ${band}`,
    scoreWhat: 'Wie der Score entsteht',
    scoreHow:
      'Der Score zählt die Gründe, aus denen eine Platte hier steht: der stärkste zählt voll, jeder weitere zu 30 %. Darum wird die 100 fast nie erreicht – ein perfekter Wantlist-Treffer allein ergibt 87. Ab 85 ist es Side One, Track One, ab 70 Top Five, ab 50 Solide, darunter eine Randnotiz.',
    verdicts: {
      interesting: 'Merken',
      bought: 'Als gekauft',
      meh: 'Naja',
      wrong: 'Danebengegriffen',
    },
    verdictsDone: {
      interesting: 'Gemerkt',
      bought: 'Gekauft',
      meh: 'Naja',
      wrong: 'Danebengegriffen',
    },
    feedback: 'Wie war der Treffer?',
    open: (record) => `${record} öffnen`,
    allFinds: 'Alle Treffer',
    inBasket: 'In den Korb',
    outOfBasket: 'Aus dem Korb nehmen',
    basketAdd: 'In den Korb',
    basketIn: 'Im Korb',
    inRunOut: 'im Auslauf',
  },

  sheet: {
    offer: { price: 'Preis', landed: 'Mit Porto', media: 'Platte', sleeve: 'Hülle' },
    previous: 'Der Fund davor',
    next: 'Der nächste Fund',
    askAgain: 'Beim Laden nachfragen',
    asking: 'Wird gefragt …',
    againSaid: {
      refreshed: 'Gerade nachgefragt – Preis und Zustand sind die aktuellen dieses Ladens.',
      sold: 'Verkauft. Sie war hier und ist es nicht mehr.',
      gone: 'Das Angebot ist bei Discogs ganz verschwunden.',
    },
    loading: 'Wird geladen …',
    goneTitle: 'Nicht mehr da',
    gone: 'Diesen Fund gibt es hier nicht mehr – ein neuerer Dig ist an seine Stelle getreten.',
    goneAction: 'Laden nochmal graben',
    market: 'Marktlage',
    forSale: (copies, one) => `${copies} ${one ? 'Exemplar' : 'Exemplare'} weltweit im Angebot`,
    lowest: 'Tiefstpreis',
    signals: 'Signale',
    pressing: 'Pressung',
    plant: 'Presswerk',
    discography: 'Diskografie',
    owned: (owned, total) => `${owned} von ${total}`,
    ownedYear: (year) => `(deine von ${year})`,
    ownedYears: (from, to) => `(deine von ${from} bis ${to})`,
    connections: 'Verbindungen zu deiner Sammlung',
    atDiscogs: 'Bei Discogs ansehen',
    want: 'Auf die Wantlist',
    wantShort: 'Wantlist',
    wanted: 'Auf deiner Wantlist',
  },
}

export const packs = { en, de }

export function useDigMessages() {
  return computed(() => packs[activeLanguage()])
}
