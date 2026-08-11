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
  description: 'Scan a Discogs dealer and get a scored list of finds.',

  dealer: 'Dealer — name or link',
  dealerPlaceholder: 'juno_records — or the address of the dealer page',
  check: 'Check',
  yourShops: 'Your shops',
  offline:
    'No network — a new dig is not possible right now. The last one is below and is complete.',

  resume: 'Carry on with the dig',
  listings: (n: string) => `has ${n} listings`,
  truncated: (reachable: string, percent: number) =>
    `An ordinary dig reaches at most ${reachable} of them — that is ${percent} %.`,
  takesAbout: (minutes: number) => `Takes about ${counted(minutes, 'minute', 'minutes')}.`,

  incremental: {
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

  expired:
    'Older than six hours — prices and conditions may no longer be shown. The finds and their reasons stay.',
  refreshPrices: 'Refresh the prices',
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
    'incremental-empty': (dealer: string) =>
      `${dealer} has put nothing new up since your last visit. The rest of the stock was already here.`,
    incremental:
      'There was nothing for you among the new arrivals. What was there before, this dig did not look at again.',
    full: 'Nothing here for you at this dealer. That is a result, not a fault.',
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
    density: 'Density',
    comfortable: 'Detailed',
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
      price: { label: 'Price ↑', about: 'Cheapest first' },
      year: { label: 'Year ↓', about: 'Newest first' },
      artist: { label: 'Artist', about: 'Alphabetical' },
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
    loading: 'Loading …',
    market: 'On the market',
    forSale: (copies: string, one: boolean) =>
      `${copies} ${one ? 'copy' : 'copies'} for sale worldwide`,
    lowest: 'lowest',
    signals: 'Signals',
    pressing: 'Pressing',
    plant: 'pressed at',
    discography: 'Discography',
    owned: (owned: string, total: string) => `${owned} of ${total}`,
    connections: 'Links to your collection',
    atDiscogs: 'View at Discogs',
  },
}

const de: typeof en = {
  title: 'Graben',
  description: 'Einen Discogs-Händler scannen und eine bewertete Fundliste bekommen.',

  dealer: 'Händler – Name oder Link',
  dealerPlaceholder: 'juno_records – oder die Adresse der Händlerseite',
  check: 'Prüfen',
  yourShops: 'Deine Läden',
  offline:
    'Kein Netz – ein neuer Dig geht gerade nicht. Der letzte steht unten und ist vollständig.',

  resume: 'Dig fortsetzen',
  listings: (n) => `hat ${n} Listings`,
  truncated: (reachable, percent) =>
    `Ein normaler Dig kommt an höchstens ${reachable} davon heran – das sind ${percent} %.`,
  takesAbout: (minutes) => `Dauert etwa ${counted(minutes, 'Minute', 'Minuten')}.`,

  incremental: {
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

  expired:
    'Älter als sechs Stunden – Preise und Zustände dürfen nicht mehr angezeigt werden. Die Treffer und ihre Begründungen bleiben.',
  refreshPrices: 'Preise auffrischen',
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
    'incremental-empty': (dealer) =>
      `Seit deinem letzten Besuch hat ${dealer} nichts Neues eingestellt. Der Rest des Sortiments stand hier schon.`,
    incremental:
      'Unter dem Neuen war nichts für dich. Was vorher da war, hat dieser Dig nicht noch einmal angesehen.',
    full: 'Bei diesem Händler nichts für dich. Das ist ein Ergebnis, kein Fehler.',
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
    density: 'Dichte',
    comfortable: 'Ausführlich',
    compact: 'Kompakt',
    sorts: {
      score: { label: 'Score', about: 'Bester Treffer zuerst' },
      price: { label: 'Preis ↑', about: 'Günstigste zuerst' },
      year: { label: 'Jahr ↓', about: 'Neueste zuerst' },
      artist: { label: 'Künstler', about: 'Alphabetisch' },
    },
  },

  match: {
    band: {
      S: 'Side One, Track One',
      A: 'Top Five',
      B: 'Solide',
      C: 'Randnotiz',
    },
    score: (score: number) => `Barry Score ${score} von 100`,
    scoreBand: (score: number, band: string) => `Barry Score ${score} von 100 – ${band}`,
    feedback: 'Wie war der Treffer?',
    open: (record) => `${record} öffnen`,
    allFinds: 'Alle Treffer',
    inBasket: 'In den Korb',
    outOfBasket: 'Aus dem Korb nehmen',
    basketAdd: 'In den Korb',
    basketIn: 'Im Korb',
  },

  sheet: {
    loading: 'Wird geladen …',
    market: 'Marktlage',
    forSale: (copies, one) => `${copies} ${one ? 'Exemplar' : 'Exemplare'} weltweit im Angebot`,
    lowest: 'Tiefstpreis',
    signals: 'Signale',
    pressing: 'Pressung',
    plant: 'Presswerk',
    discography: 'Diskografie',
    owned: (owned, total) => `${owned} von ${total}`,
    connections: 'Verbindungen zu deiner Sammlung',
    atDiscogs: 'Bei Discogs ansehen',
  },
}

export const packs = { en, de }

export function useDigMessages() {
  return computed(() => packs[activeLanguage()])
}
