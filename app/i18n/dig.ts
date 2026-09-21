import { activeLanguage } from '~/composables/useMessages'
import { counted, plural } from '~/utils/plural'

/**
 * The dig, in the voice of the person behind the counter (docs/20).
 *
 * This is the screen where we go through a shop's crates for you. So the
 * words say what we are doing and what we found, in the shop's words: dig,
 * find, record, shelf. "Scan" was the code's word and is gone from the
 * sentences; "listings" stays only where it is a number.
 */
const en = {
  title: 'Dig',
  lead: "Pick a shop. We go through the racks and pull what's for you.",
  again: (shop: string) => `Dig ${shop} again`,
  /** Names the row of plates under the head (M33 #3) for a screen reader. */
  actions: 'What you can do here',
  description:
    'We go through a Discogs shop and hand you the records that fit, with a reason for each.',
  dealer: 'Shop name or link',
  dealerPlaceholder: 'juno_records, or the address of the shop page',
  check: 'Check',
  yourShops: 'Your shops',
  another: 'Another shop, or an earlier dig',
  perThousand: (rate: string) => `${rate} finds per thousand records`,
  offline:
    "You're offline, so no new dig right now. The last one is below, and it is complete.",
  resume: 'Carry on with the dig',
  interrupted: (dealer: string, scanned: string, total: string) =>
    `A dig at ${dealer} stopped at ${scanned} of ${total}.`,
  throttled: (seconds: number) =>
    `Discogs asked us for a pause. We carry on in about ${seconds} s, right where we stopped. Nothing is lost.`,
  slowLane: (howMany: number) =>
    `Only ${howMany} requests went out in the last minute instead of about fifty. Browsers slow down a tab in the background. Keep this one in front and the dig runs at full speed.`,
  scanning: (dealer: string) => `Digging through ${dealer}`,
  matchCount: (n: string) => `${n} finds`,
  allFindsHeading: 'All finds',
  listings: (n: string) => `has ${n} listings`,
  truncated: (reachable: string, percent: number) =>
    `An ordinary dig reaches ${reachable} of them at most, ${percent} % of the shop.`,
  takesAbout: (minutes: number) =>
    `Takes about ${counted(minutes, 'minute', 'minutes')} with this tab in front. Browsers slow the clock of one in the background.`,
  incremental: {
    short: 'only what was new',
    unmoved: (howMany: string) =>
      `Still ${howMany} for sale, the same number as at your last dig. Something may have arrived anyway: a shop that sold one and listed one counts as unchanged here.`,
    known: (minutes: number) =>
      `You know this shop already. We can fetch only what has arrived since last time, usually one or two lookups instead of ${counted(minutes, 'minute', 'minutes')}.`,
    fetch: 'Fetch only what is new',
  },
  start: 'Start the dig',
  startAgain: 'Go through all of it again',
  deep: {
    about: (minutes: number) =>
      `A deep dig walks the same shop in thirteen orderings: date, price, audio sample, title, artist, label, catalogue number, each both ways. Every one shows different records in its first 10,000. Takes up to ${minutes} minutes, and stops as soon as an ordering turns up nothing new.`,
    start: 'Start a deep dig',
  },
  enriching: (done: string, total: string, requests: string) =>
    `Looking up styles and market prices, ${done} of ${total} (${requests} lookups)`,
  horizonLearned: (albums: number) =>
    `We now know ${counted(albums, 'album', 'albums')} more of your artists in all their pressings`,
  horizonCounts: 'The next dig counts that in.',
  earlierDigs: 'Earlier digs',
  /** The history as the shops' story (M36). */
  visits: {
    title: 'Your visits',
    full: (when: string, finds: number) =>
      `full dig ${when}, ${counted(finds, 'find', 'finds')}`,
    since: (checks: number, newFinds: number, quiet: number) =>
      [
        checks > 0 ? `${checks}× checked since, ${newFinds} new` : null,
        quiet > 0 ? `${quiet}× nothing new` : null,
      ]
        .filter(Boolean)
        .join(', '),
    onlyChecked: (checks: number, newFinds: number) =>
      checks > 0 ? `only checked, ${checks}×, ${newFinds} new` : 'nothing kept yet',
    run: (kind: 'full' | 'deep' | 'new', finds: number, listings: number) =>
      kind === 'new'
        ? `checked, ${counted(finds, 'find', 'finds')} among ${listings} new`
        : `${kind === 'deep' ? 'deep dig' : 'full dig'}, ${counted(finds, 'find', 'finds')}`,
    gone: (gone: number, of: number) => `${gone} of ${of} gone since`,
    quiet: (n: number) => (n === 1 ? 'checked, nothing new' : `${n}× checked, nothing new`),
    open: 'open',
    current: 'open',
    sinceThis: (newFinds: number, gone: number | null) =>
      gone === null
        ? `Since this dig: ${counted(newFinds, 'new find', 'new finds')}.`
        : `Since this dig: ${newFinds} new, ${gone} of these gone.`,
    latest: 'The shop today',
  },
  /** Two full visits side by side (M36.5). */
  compare: {
    summary: (since: string, fresh: number, gone: number | null, kept: number) =>
      `Since the visit of ${since}: ${fresh} new, ${gone === null ? 'gone unknown' : `${gone} gone`}, ${kept} still there`,
    heading: (part: 'fresh' | 'gone' | 'kept', n: number) =>
      `${part === 'fresh' ? 'New' : part === 'gone' ? 'Gone' : 'Still there'} · ${n}`,
    goneUnknown: 'This dig did not see the whole shop, so it cannot say what left.',
    none: 'Nothing here.',
    more: (n: number) => `and ${n} more`,
  },
  hits: (n: number, dealer: string) => `${counted(n, 'find', 'finds')} at ${dealer}`,
  newListings: (n: string, one: boolean) =>
    `${n} ${one ? 'new record' : 'new records'} since you last looked`,
  scanned: (done: string, total: string, percent: number) =>
    `${done} of ${total} dug (${percent} %)`,
  folded: (n: number) => `${n} further ${plural(n, 'copy', 'copies')} folded in`,
  basis: (records: string, expanded: number, entities: number) =>
    `Matched against ${records} records of your artists and labels, from ${expanded} of ${entities} we know.`,
  basisMore: 'Build the rest',
  lane: 'We are still learning your artists and labels. There is one line to Discogs and we serve it in order, so a dig started now begins once that is through.',
  laneWatch: 'Watch it',
  expired:
    'This dig is more than six hours old, so prices and conditions are gone. The finds and their reasons stay.',
  refreshPrices: 'Refresh the prices',
  share: 'Share this list',
  sharedTitle: 'A list of finds',
  sharedFrom: (dealer: string) => `Finds at ${dealer}`,
  sharedScope: (shown: string, total: string, coverage: string) =>
    shown === total
      ? `All ${total} of them. We read ${coverage} % of the shop.`
      : `The best ${shown} of ${total}. We read ${coverage} % of the shop.`,
  sharedGone: 'This link has expired. Prices from a shop only live six hours.',
  sharedBadLink: 'Something is missing from this link, most likely the part after the #.',
  sharedNoHub:
    'No hub answers at this address. The link only works where the list was shared from.',
  sharedWhatIsThis: 'What is Fidelity?',
  sharedPitch:
    'We go through a record shop with your collection in mind and say, for every find, why it fits you.',
  stack: {
    title: 'One at a time',
    lead: 'Your finds, one record per screen. Swipe on.',
    empty: 'No fresh finds yet. A dig fills this screen.',
    toDig: 'Start a dig',
    through: 'That was all of them. Nothing left waiting.',
    position: (at: string, of: string, dealer: string) => `${at} of ${of} at ${dealer}`,
    shop: (dealer: string, waiting: number) =>
      waiting > 0 ? `${dealer}, ${waiting} still waiting` : `${dealer}, all seen`,
    like: 'Interesting',
    hear: 'Listen',
    hearStop: 'Stop',
    /* Said as soon as it plays, not as a warning beforehand. */
    hearVia: 'Playing from YouTube. Google sees this device while it does.',
    basket: 'Basket',
    share: 'Share',
    next: 'Next',
    back: 'Back',
  },
  shareBusy: 'Sealing …',
  shareNeedsHub: 'Sharing needs a hub. You set one up in the settings.',
  shareReady: (matches: number, total: number) =>
    matches < total
      ? `Link ready, with the top ${matches} of ${total} finds.`
      : `Link ready, with all ${matches} finds.`,
  shareCopy: 'Copy link',
  shareCopied: 'Copied.',
  shareGone: (when: string) => `Works until ${when}, then it is gone.`,
  shareTells:
    'Whoever opens it sees why each record fits you, and so, a little, what you collect.',
  refreshAbout: (minutes: number) =>
    `${counted(minutes, 'minute', 'minutes')}. Finds nothing new, only what this dig already found, again.`,
  refreshed: (n: string) => `${n} up to date again`,
  refreshedSold: (n: string) => `${n} sold in the meantime`,
  refreshedGone: (n: string) => `${n} no longer findable`,
  /**
   * Said after the six-hour sentence since M33 #3, so it starts with a
   * subject rather than a bare figure: the cost line used to sit under its own
   * button inside a box, where "17 lookups" needed no verb.
   */
  refreshCost: (lookups: number, minutes: number) =>
    `Refreshing costs ${counted(lookups, 'lookup', 'lookups')}, about ${counted(minutes, 'minute', 'minutes')}. It finds nothing new, only what this dig already found, again.`,
  checked: (done: string, total: string) => `${done} of ${total} checked`,
  alreadySold: (n: string) => `${n} already sold`,
  empty: {
    wholeShop: 'Read the whole shop',
    watchIt: 'Put it on the round',
    'incremental-empty': (dealer: string) =>
      `${dealer} has put nothing new up since you last looked. The rest of the stock was already here.`,
    incremental:
      'Nothing for you among the new arrivals. What was there before, we did not look at again.',
    full: 'Nothing here for you at this shop. That is a result, not a fault.',
    noHorizon:
      'We checked every record here and none fit. But we have not looked up your artists and labels yet, so there was almost nothing to check against. Until we have, we only recognise the exact pressings you already own: no other pressing, no same artist, no same label.',
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
    sortedAsc: (label: string) => `${label}, ascending`,
    sortedDesc: (label: string) => `${label}, descending`,
    /**
     * What the score does when it runs out (M33 #2), shown on the tab only
     * while the score is the ordering in force — the other keys have no
     * second half worth the width.
     */
    thenPrice: 'then price',
    columns: 'Columns, tap one to sort by it',
    density: 'Density',
    comfortable: 'Detailed',
    crate: 'Crate',
    compact: 'Compact',
    sorts: {
      score: {
        label: 'Score',
        about: 'Best find first, and the cheaper one where two finds score the same',
      },
      price: { label: 'Price', about: 'Cheapest first' },
      landed: {
        label: 'With postage',
        about: 'Cheapest first, counting the postage this record would add at this shop',
      },
      year: { label: 'Year', about: 'Newest first' },
      artist: { label: 'Artist', about: 'Alphabetical' },
    },
    nothingMatches: 'Nothing matches this selection.',
    upTo: 'Up to',
    upToLabel: 'At most this much, postage included',
    noPostage:
      'We do not know the postage for this shop yet, so nothing here counts it. Put a record in the basket and you can enter the table there.',
  },
  landed: {
    with: (amount: string) => `${amount} with postage`,
    why: (postage: string, items: number, source: string) =>
      `The price plus what this record adds in postage at this shop: ${postage} as record ${items} in the parcel${source ? `, ${source}` : ''}.`,
    sources: {
      user: 'table entered by you',
      bundled: 'from a shared table',
      parsed: 'our guess from the shop’s text',
      discogs: 'named by Discogs',
      order: 'what your last order here paid',
    },
  },
  match: {
    /** A later full dig no longer saw this listing (M36). */
    gone: 'gone',
    fewPressings: (n: number) =>
      n === 1 ? 'The only pressing of this album.' : `Only ${n} pressings of this album exist.`,
    band: {
      S: 'Side One, Track One',
      A: 'Top Five',
      B: 'Solid',
      C: 'Footnote',
    },
    score: (score: number) => `Barry Score ${score} out of 100`,
    scoreBand: (score: number, band: string) => `Barry Score ${score} out of 100, ${band}`,
    scoreWhat: 'How the score works',
    scoreHow:
      'The score counts the reasons a record is here. The strongest counts in full, every further one at 30 %. That is why 100 is almost never reached; a perfect wantlist hit on its own makes 87. From 85 it is Side One Track One, from 70 Top Five, from 50 Solid, below that a footnote.',
    verdicts: { interesting: 'Save', bought: 'Mark bought', meh: 'So-so', wrong: 'Wrong pick' },
    verdictsDone: { interesting: 'Saved', bought: 'Bought', meh: 'So-so', wrong: 'Wrong pick' },
    feedback: 'How was this find?',
    open: (record: string) => `Open ${record}`,
    allFinds: 'All finds',
    inBasket: 'Add to basket',
    outOfBasket: 'Take out of the basket',
    basketAdd: 'To basket',
    basketIn: 'In basket',
    inRunOut: 'in the run-out',
  },
  sheet: {
    offer: { price: 'Price', landed: 'With postage', media: 'Record', sleeve: 'Sleeve' },
    loading: 'Loading …',
    previous: 'The find before this one',
    next: 'The next find',
    askAgain: 'Ask this shop again',
    asking: 'Asking …',
    againSaid: {
      refreshed: 'Just asked. The price and the condition are what the shop says right now.',
      sold: 'Sold. It was here and it is not any more.',
      gone: 'The offer is gone from Discogs entirely.',
    },
    goneTitle: 'Gone',
    gone: 'This find is no longer here. A newer dig has taken its place.',
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
    ownedYear: (year: string) => `(yours from ${year})`,
    ownedYears: (from: string, to: string) => `(yours from ${from} to ${to})`,
    connections: 'Links to your collection',
    atDiscogs: 'View at Discogs',
    want: 'Add to your Discogs wantlist',
    wantShort: 'Want it',
    wanted: 'On your wantlist',
  },
}

const de: typeof en = {
  title: 'Graben',
  lead: 'Such dir einen Laden aus. Wir gehen die Kisten durch und holen raus, was zu dir passt.',
  again: (shop) => `${shop} nochmal graben`,
  actions: 'Was du hier machen kannst',
  description:
    'Wir gehen einen Discogs-Laden durch und legen dir die Platten hin, die passen, mit einem Grund zu jeder.',
  dealer: 'Laden, Name oder Link',
  dealerPlaceholder: 'juno_records, oder die Adresse der Ladenseite',
  check: 'Prüfen',
  yourShops: 'Deine Läden',
  another: 'Ein anderer Laden, oder ein früherer Dig',
  perThousand: (rate) => `${rate} Funde auf tausend Platten`,
  offline:
    'Du bist offline, ein neuer Dig geht gerade nicht. Der letzte steht unten und ist vollständig.',
  resume: 'Dig weitermachen',
  interrupted: (dealer: string, scanned: string, total: string) =>
    `Ein Dig bei ${dealer} ist bei ${scanned} von ${total} stehen geblieben.`,
  throttled: (seconds) =>
    `Discogs bittet um eine Pause. In etwa ${seconds} s machen wir weiter, genau da, wo wir waren. Es geht nichts verloren.`,
  slowLane: (howMany) =>
    `In der letzten Minute gingen nur ${howMany} Anfragen raus statt rund fünfzig. Browser bremsen einen Tab im Hintergrund. Lass diesen hier vorne, dann läuft der Dig in voller Geschwindigkeit.`,
  scanning: (dealer: string) => `Graben bei ${dealer}`,
  matchCount: (n: string) => `${n} Funde`,
  allFindsHeading: 'Alle Funde',
  listings: (n) => `hat ${n} Angebote`,
  truncated: (reachable, percent) =>
    `Ein normaler Dig kommt an höchstens ${reachable} davon heran, ${percent} % des Ladens.`,
  takesAbout: (minutes) =>
    `Dauert etwa ${counted(minutes, 'Minute', 'Minuten')}, mit diesem Tab vorne. Im Hintergrund bremst der Browser die Uhr.`,
  incremental: {
    short: 'nur das Neue',
    unmoved: (howMany) =>
      `Weiterhin ${howMany} im Angebot, dieselbe Zahl wie bei deinem letzten Dig. Neu kann trotzdem was sein: Ein Laden, der eine verkauft und eine eingestellt hat, zählt hier als unverändert.`,
    known: (minutes) =>
      `Diesen Laden kennst du schon. Wir können nur holen, was seit dem letzten Mal dazugekommen ist, meist ein bis zwei Abfragen statt ${counted(minutes, 'Minute', 'Minuten')}.`,
    fetch: 'Nur das Neue holen',
  },
  start: 'Dig starten',
  startAgain: 'Alles noch einmal durchgehen',
  deep: {
    about: (minutes) =>
      `Ein tiefer Dig geht denselben Laden in dreizehn Sortierungen durch: Datum, Preis, Hörprobe, Titel, Künstler, Label, Katalognummer, jeweils in beide Richtungen. Jede zeigt andere Platten in ihren ersten 10.000. Dauert bis zu ${minutes} Minuten und hört auf, sobald eine Sortierung nichts Neues mehr bringt.`,
    start: 'Tiefen Dig starten',
  },
  enriching: (done, total, requests) =>
    `Wir schlagen Stile und Marktpreise nach, ${done} von ${total} (${requests} Abfragen)`,
  horizonLearned: (albums) =>
    `Wir kennen jetzt ${counted(albums, 'Album', 'Alben')} mehr von deinen Künstlern, in allen Pressungen`,
  horizonCounts: 'Beim nächsten Dig zählt das mit.',
  earlierDigs: 'Frühere Digs',
  visits: {
    title: 'Deine Besuche',
    full: (when, finds) => `voll am ${when}, ${counted(finds, 'Fund', 'Funde')}`,
    since: (checks, newFinds, quiet) =>
      [
        checks > 0 ? `seitdem ${checks}× nachgeschaut, ${newFinds} neu` : null,
        quiet > 0 ? `${quiet}× nichts Neues` : null,
      ]
        .filter(Boolean)
        .join(', '),
    onlyChecked: (checks, newFinds) =>
      checks > 0 ? `nur nachgeschaut, ${checks}×, ${newFinds} neu` : 'noch nichts da',
    run: (kind, finds, listings) =>
      kind === 'new'
        ? `nachgeschaut, ${counted(finds, 'Fund', 'Funde')} unter ${listings} neuen`
        : `${kind === 'deep' ? 'tiefer Dig' : 'voller Dig'}, ${counted(finds, 'Fund', 'Funde')}`,
    gone: (gone, of) => `${gone} von ${of} seitdem weg`,
    quiet: (n) => (n === 1 ? 'nachgeschaut, nichts Neues' : `${n}× nachgeschaut, nichts Neues`),
    open: 'öffnen',
    current: 'offen',
    sinceThis: (newFinds, gone) =>
      gone === null
        ? `Seit diesem Dig: ${counted(newFinds, 'neuer Fund', 'neue Funde')}.`
        : `Seit diesem Dig: ${newFinds} neu, ${gone} davon weg.`,
    latest: 'Der Laden heute',
  },
  compare: {
    summary: (since, fresh, gone, kept) =>
      `Seit dem Besuch vom ${since}: ${fresh} neu, ${gone === null ? 'weg unbekannt' : `${gone} weg`}, ${kept} noch da`,
    heading: (part, n) =>
      `${part === 'fresh' ? 'Neu' : part === 'gone' ? 'Weg' : 'Noch da'} · ${n}`,
    goneUnknown:
      'Dieser Dig hat nicht den ganzen Laden gesehen, deshalb kann er nicht sagen, was fehlt.',
    none: 'Hier nichts.',
    more: (n) => `und ${n} weitere`,
  },
  hits: (n, dealer) => `${counted(n, 'Fund', 'Funde')} bei ${dealer}`,
  newListings: (n, one) =>
    `${n} ${one ? 'neue Platte' : 'neue Platten'} seit deinem letzten Blick`,
  scanned: (done, total, percent) => `${done} von ${total} durch (${percent} %)`,
  folded: (n) => `${n} weitere ${plural(n, 'Exemplar', 'Exemplare')} zusammengefasst`,
  basis: (records, expanded, entities) =>
    `Verglichen mit ${records} Platten deiner Künstler und Labels, aus ${expanded} von ${entities}, die wir kennen.`,
  basisMore: 'Den Rest bauen',
  lane: 'Wir lernen gerade noch deine Künstler und Labels. Es gibt nur eine Leitung zu Discogs, und die bedienen wir der Reihe nach. Ein Dig, den du jetzt startest, beginnt, sobald das durch ist.',
  laneWatch: 'Zusehen',
  expired:
    'Dieser Dig ist älter als sechs Stunden, Preise und Zustände sind darum weg. Die Funde und ihre Begründungen bleiben.',
  refreshPrices: 'Preise auffrischen',
  share: 'Diese Liste teilen',
  sharedTitle: 'Eine Fundliste',
  sharedFrom: (dealer) => `Funde bei ${dealer}`,
  sharedScope: (shown, total, coverage) =>
    shown === total
      ? `Alle ${total}. Wir haben ${coverage} % des Ladens gelesen.`
      : `Die besten ${shown} von ${total}. Wir haben ${coverage} % des Ladens gelesen.`,
  sharedGone: 'Dieser Link ist abgelaufen. Preise aus einem Laden halten nur sechs Stunden.',
  sharedBadLink: 'An diesem Link fehlt etwas, vermutlich der Teil hinter dem #.',
  sharedNoHub:
    'Unter dieser Adresse antwortet kein Hub. Der Link funktioniert nur da, wo jemand die Liste geteilt hat.',
  sharedWhatIsThis: 'Was ist Fidelity?',
  sharedPitch:
    'Wir gehen einen Plattenladen mit deiner Sammlung im Kopf durch und sagen zu jedem Fund, warum er zu dir passt.',
  stack: {
    title: 'Eine nach der anderen',
    lead: 'Deine Funde, eine Platte pro Bildschirm. Wisch weiter.',
    empty: 'Noch keine frischen Funde. Ein Dig füllt diesen Bildschirm.',
    toDig: 'Dig starten',
    through: 'Das waren alle. Es wartet nichts mehr.',
    position: (at, of, dealer) => `${at} von ${of} bei ${dealer}`,
    shop: (dealer, waiting) =>
      waiting > 0 ? `${dealer}, ${waiting} warten noch` : `${dealer}, alle gesehen`,
    like: 'Interessant',
    hear: 'Anhören',
    hearStop: 'Stopp',
    hearVia: 'Kommt von YouTube. Google sieht dieses Gerät, solange es läuft.',
    basket: 'Korb',
    share: 'Teilen',
    next: 'Weiter',
    back: 'Zurück',
  },
  shareBusy: 'Wird versiegelt …',
  shareNeedsHub: 'Teilen braucht einen Hub. Den trägst du in den Einstellungen ein.',
  shareReady: (matches, total) =>
    matches < total
      ? `Link steht, mit den besten ${matches} von ${total} Funden.`
      : `Link steht, mit allen ${matches} Funden.`,
  shareCopy: 'Link kopieren',
  shareCopied: 'Kopiert.',
  shareGone: (when) => `Gilt bis ${when}, danach ist er weg.`,
  shareTells:
    'Wer ihn öffnet, sieht zu jeder Platte, warum sie zu dir passt, und damit ein bisschen, was du sammelst.',
  refreshAbout: (minutes) =>
    `${counted(minutes, 'Minute', 'Minuten')}. Findet nichts Neues, nur das nochmal, was dieser Dig schon gefunden hat.`,
  refreshed: (n) => `${n} wieder aktuell`,
  refreshedSold: (n) => `${n} inzwischen verkauft`,
  refreshedGone: (n) => `${n} nicht mehr auffindbar`,
  refreshCost: (lookups, minutes) =>
    `Auffrischen kostet ${counted(lookups, 'Abfrage', 'Abfragen')}, also rund ${counted(minutes, 'Minute', 'Minuten')}. Es findet nichts Neues, nur das nochmal, was dieser Dig schon gefunden hat.`,
  checked: (done, total) => `${done} von ${total} nachgesehen`,
  alreadySold: (n) => `${n} schon verkauft`,
  empty: {
    wholeShop: 'Den ganzen Laden lesen',
    watchIt: 'Mit in die Runde nehmen',
    'incremental-empty': (dealer) =>
      `Seit deinem letzten Blick hat ${dealer} nichts Neues eingestellt. Der Rest stand hier schon.`,
    incremental:
      'Unter dem Neuen war nichts für dich. Was vorher da war, haben wir nicht nochmal angesehen.',
    full: 'Bei diesem Laden ist nichts für dich dabei. Das ist ein Ergebnis, kein Fehler.',
    noHorizon:
      'Wir haben jede Platte hier geprüft, und keine passte. Aber wir haben deine Künstler und Labels noch nicht nachgeschlagen, es gab also fast nichts zum Vergleichen. Bis dahin erkennen wir nur die Pressungen, die du schon hast: keine andere Pressung, keinen gleichen Künstler, kein gleiches Label.',
    buildIt: 'Jetzt nachschlagen',
  },
  topFive: 'Top Five',
  sideOne: 'Side One, Track One:',
  filters: {
    search: 'Funde filtern',
    searchPlaceholder: 'Künstler, Titel, Label, Katalognummer …',
    clear: 'Filter zurücksetzen',
    sorting: 'Sortierung',
    shown: (shown, total) =>
      total === null ? `${shown} Funde` : `${shown} von ${total} Funden`,
    sortBy: 'Sortieren',
    sortedAsc: (label) => `${label}, aufsteigend`,
    sortedDesc: (label) => `${label}, absteigend`,
    thenPrice: 'dann Preis',
    columns: 'Spalten, zum Sortieren antippen',
    density: 'Dichte',
    comfortable: 'Ausführlich',
    crate: 'Kiste',
    compact: 'Kompakt',
    sorts: {
      score: {
        label: 'Score',
        about: 'Bester Fund zuerst, und bei gleichem Score der günstigere',
      },
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
      'Das Porto dieses Ladens kennen wir noch nicht, deshalb rechnet hier nichts damit. Leg eine Platte in den Korb, dann kannst du die Staffel dort eintragen.',
  },
  landed: {
    with: (amount) => `${amount} mit Porto`,
    why: (postage, items, source) =>
      `Der Preis plus das Porto, das diese Platte bei diesem Laden dazukommen lässt: ${postage} als ${items}. Platte im Paket${source ? `, ${source}` : ''}.`,
    sources: {
      user: 'Staffel von dir eingetragen',
      bundled: 'aus einer geteilten Staffel',
      parsed: 'unsere Schätzung aus dem Text des Ladens',
      discogs: 'von Discogs genannt',
      order: 'was deine letzte Bestellung hier gekostet hat',
    },
  },
  match: {
    gone: 'weg',
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
    scoreBand: (score: number, band: string) => `Barry Score ${score} von 100, ${band}`,
    scoreWhat: 'Wie der Score entsteht',
    scoreHow:
      'Der Score zählt die Gründe, aus denen eine Platte hier steht. Der stärkste zählt voll, jeder weitere zu 30 %. Darum kommt fast nie eine 100 raus; ein perfekter Wantlist-Fund allein macht 87. Ab 85 ist es Side One Track One, ab 70 Top Five, ab 50 solide, darunter eine Randnotiz.',
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
    feedback: 'Wie war der Fund?',
    open: (record) => `${record} öffnen`,
    allFinds: 'Alle Funde',
    inBasket: 'In den Korb',
    outOfBasket: 'Aus dem Korb nehmen',
    basketAdd: 'In den Korb',
    basketIn: 'Im Korb',
    inRunOut: 'im Auslauf',
  },
  sheet: {
    offer: { price: 'Preis', landed: 'Mit Porto', media: 'Platte', sleeve: 'Hülle' },
    loading: 'Wird geladen …',
    previous: 'Der Fund davor',
    next: 'Der nächste Fund',
    askAgain: 'Beim Laden nachfragen',
    asking: 'Fragen nach …',
    againSaid: {
      refreshed: 'Gerade nachgefragt. Preis und Zustand sind das, was der Laden jetzt sagt.',
      sold: 'Verkauft. Sie war hier und ist es nicht mehr.',
      gone: 'Das Angebot ist bei Discogs ganz verschwunden.',
    },
    goneTitle: 'Nicht mehr da',
    gone: 'Diesen Fund gibt es hier nicht mehr. Ein neuerer Dig hat seinen Platz eingenommen.',
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
