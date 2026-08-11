import { activeLanguage } from '~/composables/useMessages'

/**
 * The words for what you already own: the shelf, the map of your taste, the
 * wantlist and the shortlist.
 *
 * Its own file, both languages together — the reasons are in `settings.ts`.
 */

const en = {
  title: 'Collection',
  tabs: { label: 'Collection', shelf: 'Shelf', map: 'Map', wantlist: 'Wantlist' },

  loading: 'Loading …',

  shelf: {
    description: 'Your records, as a shelf.',
    empty: 'No records here yet. Fetch the collection in the settings.',
    noMatch: 'Nothing by that name on the shelf.',
    search: 'Artist, title or label',
    searchLabel: 'Search the shelf',
    sorting: 'Sorting',
    /*
     * The direction is on the label. "Year" here means oldest first, because a
     * shelf sorted by year is a timeline and timelines run forwards — the
     * opposite of a dig result, where a 2026 pressing is news. Both are right
     * and neither is guessable from the word alone.
     */
    sorts: {
      added: { label: 'Last added', about: 'Newest arrival first' },
      artist: { label: 'Artist', about: 'Alphabetical' },
      year: { label: 'Year ↑', about: 'Oldest first' },
      rating: { label: 'Rating ↓', about: 'Best first, unrated last' },
    },
    atDiscogs: (artist: string, title: string) => `${artist} — ${title}, view at Discogs`,
  },

  map: {
    description: 'What your collection gives away about your taste.',
    lead: (records: string) =>
      `${records} records. What can be read from that about your taste.`,
    noProfile: 'No profile yet — sync your collection first on the',
    startPage: 'start page',

    artists: 'Artists',
    labels: 'Labels',
    styles: 'Styles',
    genres: 'Genres',
    decades: 'Decades',
    noYears: 'No years recorded in the collection.',

    entries: (n: string) => `${n} entries`,
    artistsWhyLabel: 'What the number on the right means',
    labelsWhyLabel: 'How the lift is worked out',
    artistsWhy:
      'Discogs files everything under one name: albums, singles, remixes, contributions to compilations. The number is therefore not a collecting target but a statement of how likely a dig is to turn up something else of theirs.',
    labelsWhy:
      'It compares your share of a label with what would be expected if you picked at random from your labels. The comparison is against your own labels — what the rest of the world presses is not something this app can see.',
    needsHorizon:
      'Gaps and label lift need the horizon. Once it is built, this says how much you are still missing from which artist.',
    howMuchLeft: 'How much is still out there',
    yoursFrom: '· yours from',
    nothingByName: 'Nothing by that name on the list.',
  },

  wantlist: {
    description: 'What you are looking for — and how findable it is.',
    empty:
      'Your wantlist is empty — or not synced yet. It carries the two strongest signals there are.',
    lead: (total: string, withPressings: string) =>
      `${total} records wanted. For ${withPressings} of them the horizon knows every pressing — there a dig recognises a different edition than the one you entered, too.`,
    seenRecently: (n: string) => `${n} turned up at a dealer in the last thirty days.`,
    search: 'Artist or title',
    searchLabel: 'Search the wantlist',
    /*
     * The pressing count is what makes a wantlist entry actionable: one of 160
     * turns up far more often than the only pressing there is.
     */
    pressings: (n: string, one: boolean) => `${n} ${one ? 'pressing' : 'pressings'} known`,
    notExpanded: 'Pressings not unfolded yet',
    noMaster: 'No master at Discogs — only this exact pressing can be recognised',
  },

  saved: {
    description: 'The records you said yes to — even once the dig is long gone.',
    empty:
      'Nothing saved yet. The thumbs up in a dig puts a record here — and here it stays, even once the dig is long gone.',
    /** "at 1 shop" is arithmetic, not language. A number that reads aloud as a word is written as one. */
    lead: (records: number, shops: number) =>
      `${records === 1 ? 'One record' : `${records} records`} earmarked at ${shops === 1 ? 'one shop' : `${shops} shops`}.`,
    digsGo: 'Digs are cleared away after five — this stays.',
    markBought: (label: string) => `Mark ${label} as bought`,
    remove: (label: string) => `Take ${label} off the shortlist`,
  },

  /*
   * The shelf, the map and the wantlist — three screens, one vocabulary.
   * Enumerated by tests/unit/template-text.spec.ts rather than by reading:
   * a hand-written list of German words had already missed "von" three times.
   */
  shelfCount: (shown: string, of: string | null, records: string) =>
    of === null ? `${shown} ${records}` : `${shown} of ${of} ${records}`,
  records: 'records',
  noCover: 'no cover',
  showMore: (n: string) => `Show ${n} more`,
  howMuchLeft: 'How much is still out there',
  whichLabels: 'Which labels you actually collect',
  lastSeenAt: 'last seen at',
  onDay: (day: string) => `on ${day}`,
}

const de: typeof en = {
  title: 'Sammlung',
  tabs: { label: 'Sammlung', shelf: 'Regal', map: 'Landkarte', wantlist: 'Wantlist' },

  loading: 'Wird geladen …',

  shelf: {
    description: 'Deine Platten, als Regal.',
    empty: 'Noch keine Platten hier. Sammlung in den Einstellungen holen.',
    noMatch: 'Nichts mit diesem Namen im Regal.',
    search: 'Künstler, Titel oder Label',
    searchLabel: 'Regal durchsuchen',
    sorting: 'Sortierung',
    sorts: {
      added: { label: 'Zuletzt dazu', about: 'Neuester Zugang zuerst' },
      artist: { label: 'Künstler', about: 'Alphabetisch' },
      year: { label: 'Jahr ↑', about: 'Älteste zuerst' },
      rating: { label: 'Bewertung ↓', about: 'Beste zuerst, unbewertete zuletzt' },
    },
    atDiscogs: (artist, title) => `${artist} – ${title}, bei Discogs ansehen`,
  },

  map: {
    description: 'Was deine Sammlung über deinen Geschmack verrät.',
    lead: (records) => `${records} Platten. Was daraus über deinen Geschmack ablesbar ist.`,
    noProfile: 'Noch kein Profil – synchronisiere zuerst deine Sammlung auf der',
    startPage: 'Startseite',

    artists: 'Künstler',
    labels: 'Labels',
    styles: 'Stile',
    genres: 'Genres',
    decades: 'Dekaden',
    noYears: 'Keine Jahresangaben in der Sammlung.',

    entries: (n) => `${n} Einträgen`,
    artistsWhyLabel: 'Was die Zahl rechts bedeutet',
    labelsWhyLabel: 'Wie der Lift gerechnet wird',
    artistsWhy:
      'Discogs führt unter einem Namen alles: Alben, Singles, Remixe, Beiträge zu Samplern. Die Zahl ist deshalb kein Sammelziel, sondern eine Auskunft darüber, wie wahrscheinlich ein Dig noch etwas von ihnen zutage fördert.',
    labelsWhy:
      'Er vergleicht deinen Anteil an einem Label mit dem, was bei zufälliger Auswahl aus deinen Labels zu erwarten wäre. Verglichen wird gegen deine eigenen Labels – was der Rest der Welt presst, sieht diese App nicht.',
    needsHorizon:
      'Lücken und Label-Lift brauchen den Horizont. Sobald der gebaut ist, steht hier, wie viel dir bei welchem Künstler noch fehlt.',
    howMuchLeft: 'Wie viel es noch gibt',
    yoursFrom: '· deine von',
    nothingByName: 'Nichts mit diesem Namen auf der Liste.',
  },

  wantlist: {
    description: 'Was du suchst – und wie auffindbar es ist.',
    empty:
      'Deine Wantlist ist leer – oder noch nicht synchronisiert. Sie trägt die zwei stärksten Signale überhaupt.',
    lead: (total, withPressings) =>
      `${total} Platten gesucht. Von ${withPressings} kennt der Horizont alle Pressungen – bei denen erkennt ein Dig auch eine andere Ausgabe als die eingetragene.`,
    seenRecently: (n) =>
      `${n} sind in den letzten dreißig Tagen bei einem Händler aufgetaucht.`,
    search: 'Künstler oder Titel',
    searchLabel: 'Wantlist durchsuchen',
    pressings: (n, one) => `${n} ${one ? 'Pressung' : 'Pressungen'} bekannt`,
    notExpanded: 'Pressungen noch nicht ausgeklappt',
    noMaster: 'Kein Master bei Discogs – nur genau diese Pressung ist erkennbar',
  },

  saved: {
    description: 'Die Platten, zu denen du ja gesagt hast – auch wenn der Dig längst weg ist.',
    empty:
      'Noch nichts gemerkt. Der Daumen nach oben im Dig legt eine Platte hier ab – und hier bleibt sie, auch wenn der Dig längst weg ist.',
    lead: (records, shops) =>
      `${records === 1 ? 'Eine Platte' : `${records} Platten`} vorgemerkt bei ${shops === 1 ? 'einem Laden' : `${shops} Läden`}.`,
    digsGo: 'Digs werden nach fünf weggeräumt – das hier bleibt.',
    markBought: (label) => `${label} als gekauft eintragen`,
    remove: (label) => `${label} von der Merkliste nehmen`,
  },

  shelfCount: (shown: string, of: string | null, records: string) =>
    of === null ? `${shown} ${records}` : `${shown} von ${of} ${records}`,
  records: 'Platten',
  noCover: 'kein Cover',
  showMore: (n: string) => `Weitere ${n} zeigen`,
  howMuchLeft: 'Wie viel es noch gibt',
  whichLabels: 'Welche Labels du wirklich sammelst',
  lastSeenAt: 'zuletzt bei',
  onDay: (day: string) => `am ${day}`,
}

export const packs = { en, de }

export function useCollectionMessages() {
  return computed(() => packs[activeLanguage()])
}
