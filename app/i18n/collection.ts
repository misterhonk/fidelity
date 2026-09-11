import { activeLanguage } from '~/composables/useMessages'

/**
 * The words for what you already own: the shelf, the map of your taste, the
 * wantlist and the shortlist.
 *
 * Its own file, both languages together — the reasons are in `settings.ts`.
 */

const en = {
  title: 'Collection',
  tabs: {
    label: 'Collection',
    shelf: 'Shelf',
    map: 'Map',
    wantlist: 'Wantlist',
    watched: 'On watch',
    places: 'Places',
    review: 'Year',
  },

  loading: 'Loading …',

  /*
   * A year on the shelf (M19 #8): what arrived, where it came from, who
   * shaped it, and what Fidelity had to do with it. Read off the device, no
   * request, nothing from the marketplace.
   */
  review: {
    title: 'A year on the shelf',
    description: 'What arrived on the shelf in a year, and what it says.',
    yearLabel: 'Which year',
    empty:
      'Nothing on the shelf yet, so no year to look back on. Fetch the collection first in the',
    settings: 'settings',
    lead: (records: string, year: number) => `${records} arrived in ${year}.`,
    more: (n: string, before: number) => `${n} more than in ${before}.`,
    fewer: (n: string, before: number) => `${n} fewer than in ${before}.`,
    same: (before: number) => `The same as in ${before}.`,
    firstYear: 'The first year on the shelf.',
    months: 'By month',
    monthsSummary: (peak: string, month: string) => `Most in ${month}: ${peak}.`,
    newArtists: (n: string) => `${n} new to the shelf:`,
    noNewArtists: 'No artist new to the shelf — every addition was somebody you already had.',
    andMore: (n: string) => `and ${n} more`,
    artists: 'Artists',
    labels: 'Labels',
    styles: 'Styles',
    decades: 'Where they come from',
    noYears: 'No pressing years on this year’s additions.',
    media: 'On what',
    oldest: (record: string, year: number) =>
      `The oldest pressing to arrive: ${record}, ${year}.`,
    newest: (record: string, year: number) => `The newest: ${record}, ${year}.`,
    loved: (loved: string, rated: string) =>
      `${loved} of them got four or five stars, ${rated} a rating at all.`,
    unrated: 'None of them has a rating yet.',
    digs: 'With Fidelity',
    digsLine: (runs: string, shops: string, finds: string) =>
      `${runs} across ${shops}, ${finds} altogether.`,
    bought: (n: string) => `${n} marked as bought.`,
    noDigs: 'No dig that year.',
    people: 'Who shaped them',
    peopleWhyLabel: 'Where the names come from',
    peopleWhy:
      'From the horizon: the people it has expanded — artists you collect, and the producers and engineers read off your favourites — matched against the records that arrived this year. Somebody the horizon has not met yet is not in the list, however often they appear.',
    runs: (n: number) => `${n} ${n === 1 ? 'dig' : 'digs'}`,
    shops: (n: number) => `${n} ${n === 1 ? 'shop' : 'shops'}`,
    finds: (n: number) => `${n} ${n === 1 ? 'find' : 'finds'}`,
    records: (n: number) => `${n} ${n === 1 ? 'record' : 'records'}`,
    artistCount: (n: number) => `${n} ${n === 1 ? 'artist' : 'artists'}`,
  },

  shelf: {
    description: 'Your records, as a shelf.',
    empty: 'No records here yet. Fetch the collection in the settings.',
    emptyAction: 'Fetch the collection',
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
    /*
     * No arrow in the name.
     *
     * Two of these labels carried one — "Year ↑", "Rating ↓" — because each
     * key had exactly one direction and it had to be said. Since every sort
     * can be turned round, the interface draws the arrow itself, and the baked
     * one stood beside it: two arrows after one word, one of them lying.
     *
     * `about` still describes the *default* — the state before the first
     * click, and the answer to "what happens if I choose this".
     */
    sorts: {
      added: { label: 'Last added', about: 'Newest arrival first' },
      artist: { label: 'Artist', about: 'Alphabetical' },
      year: { label: 'Year', about: 'Oldest first — click again to turn it around' },
      rating: { label: 'Rating', about: 'Best first, unrated last' },
    },
    atDiscogs: (artist: string, title: string) => `${artist} — ${title}, view at Discogs`,
    readFully: (when: string) => `Last full sync ${when}`,
    /*
     * Named, not numbered. "3 of 34" already stands above it; what this line
     * adds is *which* question the shelf is currently answering, in the words
     * somebody clicked to ask it.
     */
    onlyFrom: (name: string) => `Only ${name}`,
    showAll: 'Show everything again',
    reread: 'Sync now',
    rereading: 'Syncing…',
    sheet: {
      loading: 'Opening the record…',
      facts: {
        rating: 'Rating',
        artist: 'Artist',
        label: 'Label',
        catno: 'Cat. no.',
        format: 'Format',
        year: 'Year',
        added: 'Added',
        folder: 'Folder',
        country: 'Pressed in',
      },
      /*
       * The blocks that cost the one lookup.
       *
       * Named for what somebody wants from them rather than for the field they
       * came out of: "Pressing" is the question "is this the one I think it
       * is", and the run-out number is how that gets answered in a shop.
       */
      tracklist: 'On the record',
      credits: 'Who made it',
      pressing: 'This pressing',
      listen: 'Hear it',
      everyone: 'Everyone else',
      communityRating: (average: string, votes: string) => `${average} of 5, from ${votes}`,
      forSale: 'For sale',
      /*
       * Named as a range, not as a value. "Worth" is what an insurer says; the
       * lowest asking price is what somebody actually wants for one right now,
       * and the count is what turns that number into a market.
       */
      cheapest: (price: string, sellers: string) => `${price}, cheapest of ${sellers}`,
      whatIsItWorth: 'What does it go for?',
      aboutIt: 'About this release',
      someOf: (total: string) => `6 of ${total}`,
      looking: 'Fetching the tracklist …',
      /*
       * A name that is also a question: what else of theirs is here?
       * Shown as a tooltip rather than in the row, because the row is a fact
       * sheet and every extra word in it is one more thing to read past.
       */
      ownedBy: (name: string) => `What you own by ${name}`,
      rated: (stars: number) => `Rated ${stars} of 5`,
      rate: (stars: number) => (stars === 1 ? 'Rate 1 star' : `Rate ${stars} stars`),
      sounds: 'Sounds like',
      condition: 'Your copy',
      unset: 'Not said',
      write: {
        idle: '',
        sending: 'Sending to Discogs…',
        sent: 'Saved at Discogs',
        queued: 'Saved here — going to Discogs as soon as it can',
        failed: 'Not saved. Nothing was changed.',
      },
      remove: 'Take off the shelf',
      removeSure:
        'This deletes the record from your Discogs collection. It cannot be undone from here.',
      removeYes: 'Remove',
      atDiscogs: 'View at Discogs',
    },
  },

  map: {
    worth: (low: string, high: string, when: string) =>
      `— Discogs' middle estimate, between ${low} and ${high}, as of ${when}`,
    description: 'What your collection gives away about your taste.',
    /** Different releases — the shelf counts copies, and two copies of one record are one taste. */
    lead: (releases: string) =>
      `${releases} different releases. What can be read from that about your taste.`,
    noProfile: 'No profile yet — sync your collection first on the',
    startPage: 'start page',

    /*
     * The line through the estimates (M19 #3). Labelled for what it is: the
     * number Discogs shows, kept day by day on this device — not an appraisal,
     * and not ours.
     */
    history: {
      title: 'Over time',
      about:
        'Discogs’ middle estimate, kept once a day on this device, with the lowest and highest around it. It moves with the market and with the shelf, and nobody else sees it.',
      onePoint: 'One day so far. The line starts with the next.',
      summary: (from: string, first: string, to: string, last: string) =>
        `Middle estimate from ${from} on ${first} to ${to} on ${last}.`,
      now: (median: string) => `${median} today`,
    },

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
    /*
     * How long a record has been waited for.
     *
     * German for six weeks, on the one screen no test ever rendered with data
     * in it — which is how a whole paragraph of it survived the sweep that
     * translated everything else.
     */
    waiting: {
      today: 'noted today',
      yesterday: 'since yesterday',
      days: (days: string) => `waiting ${days} days`,
      months: (months: string) => `waiting ${months} months`,
      years: (years: string) => `waiting ${years} years`,
    },
    dropShort: 'Not any more',
    notePlaceholder: 'Which pressing will do?',
    noteLabel: (artist: string, title: string) => `Your note on ${artist} — ${title}`,
    drop: (artist: string, title: string) => `Take ${artist} — ${title} off the wantlist`,
    description: 'What you are looking for — and how findable it is.',
    empty:
      'Your wantlist is empty — or not synced yet. It carries the two strongest signals there are.',
    emptyAction: 'Sync it now',
    lead: (total: string, withPressings: string) =>
      `${total} records wanted. For ${withPressings} of them the horizon knows every pressing — there a dig recognises a different edition than the one you entered, too.`,
    seenRecently: (n: string) => `${n} turned up at a shop in the last thirty days.`,
    search: 'Artist or title',
    searchLabel: 'Search the wantlist',
    /*
     * The pressing count is what makes a wantlist entry actionable: one of 160
     * turns up far more often than the only pressing there is.
     */
    pressings: (n: string, one: boolean) => `${n} ${one ? 'pressing' : 'pressings'} known`,
    /*
     * How much you want it (M20 #1). Discogs' 0–5 per want, synced all along
     * and shown nowhere until now. Zero means "never said", not "not much" —
     * so five hollow stars are an invitation, never a verdict.
     */
    priority: {
      label: 'How much you want it',
      set: (stars: number) => (stars === 1 ? 'Want it 1 star' : `Want it ${stars} stars`),
      most: 'wanted most',
      sortLabel: 'Order',
      waiting: 'Longest wanted',
      want: 'Wanted most',
    },
    notExpanded: 'Pressings not unfolded yet',
    noMaster: 'No master at Discogs — only this exact pressing can be recognised',

    /*
     * Your wants across the shops you scanned (M19 #9). Labelled as the
     * subset it is: the wish is "across all of Discogs", and only Discogs
     * can grant that one. What this adds is the postage.
     */
    plan: {
      title: 'At the shops you scanned',
      subset:
        'Only the shops scanned in the last six hours — not all of Discogs, which nobody outside Discogs can search by record. What this adds is the postage.',
      none: 'None of your wants at a shop scanned in the last six hours.',
      lead: (available: string, wanted: string) =>
        `${available} of your ${wanted} wants are at these shops.`,
      best: (shops: string, goods: string, postage: string, total: string) =>
        `Cheapest: ${shops}, ${goods} for the records plus ${postage} postage — ${total}.`,
      naive: (shops: string, postage: string, more: string) =>
        `Each where it is cheapest would be ${shops} and ${postage} postage — ${more} more.`,
      sameAsNaive: 'That is also where each of them is cheapest.',
      shopLine: (records: string, goods: string, postage: string) =>
        `${records} · ${goods} + ${postage} postage`,
      otherPressing: 'other pressing',
      belowMinimum: (min: string) =>
        `Under this shop's minimum of ${min} — the checkout refuses it as it stands.`,
      unknownPostage: (shops: string) => `Left out, postage unknown: ${shops}.`,
      onlyThere: (n: string) => `${n} of the wants are only there.`,
      otherCurrencies: (n: string) =>
        `${n} in another currency left out — nothing here converts.`,
      expires: (at: string) => `Prices as scanned, good until ${at}.`,
      open: 'Open at Discogs',
      shops: (n: number) => `${n} ${n === 1 ? 'shop' : 'shops'}`,
      records: (n: number) => `${n} ${n === 1 ? 'record' : 'records'}`,
      offers: (n: number) => `${n} ${n === 1 ? 'offer' : 'offers'}`,
    },
  },

  /*
   * Watched records (M11).
   *
   * The sentence that matters most here is in `noShops`: "who is selling
   * release X?" cannot be answered through the API (`docs/02`). Anyone not
   * knowing that takes the missing shop for a gap in the app.
   *
   * Since `gone` the sentence has an exception, and it is now stated: a dig on
   * this device has seen offers with their listing id, and those can be
   * fetched individually. That is not a way round the missing listing — they
   * are only the ones you have already walked past yourself.
   */
  /*
   * Where the records stand (M12).
   *
   * `staysHere` is the sentence that sets this screen apart from every other:
   * something is created here that does not exist at Discogs and goes nowhere.
   * Measured 2026-09-11 — Discogs returns exactly three collection fields
   * (Media, Sleeve, Notes), and a location fits in none of them.
   */
  places: {
    title: 'Where they are',
    lead: 'A collection does not live in a list. It lives in a flat.',
    empty: 'No places yet. A room, a shelf, a box in the cellar — start with one.',
    placed: (records: string) => `${records} records have a place.`,
    withBelow: (here: string, below: string) => `${here} here · ${below} in all`,
    namePlaceholder: 'Cellar, shelf, box 3 …',
    add: 'Add',
    addTop: 'Add a place',
    addInside: 'Inside',
    moveAll: 'Move all',
    moveTo: 'Everything goes to',
    dissolve: 'Dissolve',
    /* What does **not** happen in the process. Without this sentence nobody
     * dares press the button — for a note that can be rewritten at any time. */
    dissolveWhat:
      'The place goes, the records stay. They simply have no place afterwards, and anything inside moves up one level.',
    dissolveConfirm: 'Dissolve it',
    renameLabel: (name: string) => `Rename ${name}`,
    nothingHere: 'Nothing here yet.',
    staysHere:
      'Where a record stands is something about your flat, not about Discogs. It is kept on this device and sent nowhere.',
    /* On the copy, not on the release: two pressings sit in two places. */
    where: 'Where it is',
    nowhere: 'No place yet',
  },

  watched: {
    title: 'On watch',
    lead: 'A handful of records, and what the market does with them.',
    empty: 'Nothing on watch yet. Put a record here from your shelf or your wantlist.',
    toShelf: 'To the shelf',
    check: 'Look now',
    checking: 'Looking …',
    /* Both inflected, not only the minutes: "1 records" stood on screen for a
     * quarter of an hour on 2026-09-11, because only half the numbers had been
     * looked at. */
    cost: (records: number, minutes: number) =>
      `${records} ${records === 1 ? 'record' : 'records'}, one request each — about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    nothingNew: 'Nothing has moved.',
    notYet: 'not looked yet',
    noneForSale: 'none for sale',
    /* A number without a currency is not a price. Discogs sends both
     * together; this is the branch that should not occur and still has to say
     * something true. */
    noPrice: 'price unclear',
    fromShelf: 'yours',
    fromWantlist: 'wanted',
    span: (from: string, to: string, when: string) => `${from} → ${to} since ${when}`,
    rose: (from: string, to: string, percent: string) =>
      `has gone from ${from} to ${to} — ${percent} % more.`,
    fell: (to: string) => `is down to ${to}, below your limit.`,
    appeared: (copies: string) => `is on offer again — ${copies} of them.`,
    /* "Sold" is not claimed: an offer can also have been withdrawn, and the
     * API does not say which of the two. */
    fewer: (from: string, to: string) => `is down from ${from} copies on offer to ${to}.`,
    /* The more precise case, and the only one where a shop appears here: a
     * dig on this device saw exactly this offer. Still not "sold" — withdrawn
     * looks the same from outside. */
    gone: (dealer: string, from: string, to: string) =>
      `is down from ${from} copies on offer to ${to} — the one at ${dealer} is no longer listed.`,
    dropShort: 'Stop',
    drop: (label: string) => `Stop watching ${label}`,
    watch: 'Keep an eye on it',
    watchingOn: 'Watching',
    /* The limit visible rather than silent: a watcher that stops accepting
     * records without a word is worse than one that says no. */
    full: 'A hundred is the limit — one request each, and that is two minutes per look.',
    noShops:
      'No shop is named here: Discogs has no way to list who is selling a given record. What you get is the price, not the address. The one exception is a copy one of your own digs walked past — that one has an address, and it is named.',
  },

  saved: {
    description: 'The records you said yes to — even once the dig is long gone.',
    empty:
      'Nothing saved yet. The thumbs up in a dig puts a record here — and here it stays, even once the dig is long gone.',
    emptyAction: 'Start a dig',
    /** "at 1 shop" is arithmetic, not language. A number that reads aloud as a word is written as one. */
    lead: (records: number, shops: number) =>
      `${records === 1 ? 'One record' : `${records} records`} earmarked at ${shops === 1 ? 'one shop' : `${shops} shops`}.`,
    digsGo: 'Digs are cleared away after five — this stays.',
    markBought: (label: string) => `Mark ${label} as bought`,
    remove: (label: string) => `Take ${label} off the shortlist`,
    /*
     * What came of "all into the basket", and what of the checking.
     *
     * Both sentences stood in German in the source of `saved.vue` until
     * 2026-09-10, inside an English interface — `template-text.spec.ts` only
     * looks between the tags, and these came from the script.
     *
     * The count arrives twice: once as a number so it can be inflected, once
     * as a finished string because the thousands separators are set at the
     * caller. The German "war schon weg" used to stand there for two sold
     * records as well.
     */
    moved: (added: string, sold: number, soldText: string) =>
      sold === 0
        ? `${added} in the basket.`
        : `${added} in the basket, ${soldText} ${sold === 1 ? 'was' : 'were'} already gone.`,
    checked: (sold: number, soldText: string, left: string) =>
      sold === 0
        ? `All ${left} still to be had.`
        : `${soldText} gone since, ${left} still there.`,
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
  open: (artist: string, title: string) => `Open ${artist} — ${title}`,
  showMore: (n: string) => `Show ${n} more`,
  howMuchLeft: 'How much is still out there',
  whichLabels: 'Which labels you actually collect',
  /*
   * The direction belongs in the button's spoken name.
   *
   * `aria-sort` would be the obvious attribute and is wrong here: it applies
   * to table columns, not to buttons. axe reported it immediately — in this
   * morning's test, the one that checks the screens *with data*.
   */
  sortedAsc: (label: string) => `${label}, ascending`,
  sortedDesc: (label: string) => `${label}, descending`,
  lastSeenAt: 'last seen at',
  onDay: (day: string) => `on ${day}`,
}

const de: typeof en = {
  title: 'Sammlung',
  tabs: {
    label: 'Sammlung',
    shelf: 'Regal',
    map: 'Landkarte',
    wantlist: 'Wantlist',
    watched: 'Im Blick',
    places: 'Orte',
    review: 'Jahr',
  },

  review: {
    title: 'Ein Jahr im Regal',
    description: 'Was in einem Jahr ins Regal kam, und was es sagt.',
    yearLabel: 'Welches Jahr',
    empty:
      'Noch nichts im Regal, also kein Jahr zum Zurückschauen. Hol zuerst die Sammlung in den',
    settings: 'Einstellungen',
    lead: (records, year) => `${records} kamen ${year} dazu.`,
    more: (n, before) => `${n} mehr als ${before}.`,
    fewer: (n, before) => `${n} weniger als ${before}.`,
    same: (before) => `Genauso viele wie ${before}.`,
    firstYear: 'Das erste Jahr im Regal.',
    months: 'Nach Monat',
    monthsSummary: (peak, month) => `Die meisten im ${month}: ${peak}.`,
    newArtists: (n) => `${n} neu im Regal:`,
    noNewArtists: 'Kein Künstler neu im Regal – jeder Zugang war jemand, den du schon hattest.',
    andMore: (n) => `und ${n} weitere`,
    artists: 'Künstler',
    labels: 'Labels',
    styles: 'Stile',
    decades: 'Woher sie kommen',
    noYears: 'Keine Pressjahre an den Zugängen dieses Jahres.',
    media: 'Worauf',
    oldest: (record, year) => `Die älteste Pressung, die dazukam: ${record}, ${year}.`,
    newest: (record, year) => `Die neueste: ${record}, ${year}.`,
    loved: (loved, rated) =>
      `${loved} davon haben vier oder fünf Sterne bekommen, ${rated} überhaupt eine Bewertung.`,
    unrated: 'Noch keine davon hat eine Bewertung.',
    digs: 'Mit Fidelity',
    digsLine: (runs, shops, finds) => `${runs} in ${shops}, zusammen ${finds}.`,
    bought: (n) => `${n} als gekauft markiert.`,
    noDigs: 'Kein Dig in dem Jahr.',
    people: 'Wer sie gemacht hat',
    peopleWhyLabel: 'Woher die Namen kommen',
    peopleWhy:
      'Aus dem Horizont: die Leute, die er ausgeklappt hat – Künstler, die du sammelst, und die Produzenten und Engineers aus deinen Lieblingsplatten – gegen die Platten gehalten, die in dem Jahr dazukamen. Wen der Horizont noch nicht kennt, der steht nicht in der Liste, so oft er auch vorkommt.',
    runs: (n) => `${n} ${n === 1 ? 'Dig' : 'Digs'}`,
    shops: (n) => `${n} ${n === 1 ? 'Laden' : 'Läden'}`,
    finds: (n) => `${n} ${n === 1 ? 'Treffer' : 'Treffer'}`,
    records: (n) => `${n} ${n === 1 ? 'Platte' : 'Platten'}`,
    artistCount: (n) => `${n} ${n === 1 ? 'Künstler' : 'Künstler'}`,
  },

  loading: 'Wird geladen …',

  shelf: {
    description: 'Deine Platten, als Regal.',
    empty: 'Noch keine Platten hier. Sammlung in den Einstellungen holen.',
    emptyAction: 'Sammlung holen',
    noMatch: 'Nichts mit diesem Namen im Regal.',
    search: 'Künstler, Titel oder Label',
    searchLabel: 'Regal durchsuchen',
    sorting: 'Sortierung',
    sorts: {
      added: { label: 'Zuletzt dazu', about: 'Neuester Zugang zuerst' },
      artist: { label: 'Künstler', about: 'Alphabetisch' },
      year: { label: 'Jahr', about: 'Älteste zuerst — nochmal klicken dreht um' },
      rating: { label: 'Bewertung', about: 'Beste zuerst, unbewertete zuletzt' },
    },
    atDiscogs: (artist, title) => `${artist} – ${title}, bei Discogs ansehen`,
    readFully: (when) => `Ganz abgeglichen ${when}`,
    onlyFrom: (name) => `Nur ${name}`,
    showAll: 'Wieder alles zeigen',
    reread: 'Jetzt abgleichen',
    rereading: 'Gleicht ab …',
    sheet: {
      loading: 'Platte wird geöffnet…',
      facts: {
        rating: 'Bewertung',
        artist: 'Künstler',
        label: 'Label',
        catno: 'Katalognr.',
        format: 'Format',
        year: 'Jahr',
        added: 'Zugegangen',
        folder: 'Ordner',
        country: 'Gepresst in',
      },
      tracklist: 'Auf der Platte',
      credits: 'Wer sie gemacht hat',
      pressing: 'Diese Pressung',
      listen: 'Reinhören',
      everyone: 'Alle anderen',
      communityRating: (average, votes) => `${average} von 5, aus ${votes}`,
      forSale: 'Im Angebot',
      cheapest: (price, sellers) => `${price}, günstigstes von ${sellers}`,
      whatIsItWorth: 'Was ist sie wert?',
      aboutIt: 'Über diese Veröffentlichung',
      someOf: (total) => `6 von ${total}`,
      looking: 'Hole die Titelliste …',
      ownedBy: (name) => `Was du von ${name} hast`,
      rated: (stars) => `Mit ${stars} von 5 bewertet`,
      rate: (stars) => (stars === 1 ? 'Mit 1 Stern bewerten' : `Mit ${stars} Sternen bewerten`),
      sounds: 'Klingt nach',
      condition: 'Dein Exemplar',
      unset: 'Keine Angabe',
      write: {
        idle: '',
        sending: 'Geht an Discogs …',
        sent: 'Bei Discogs gespeichert',
        queued: 'Hier gespeichert — geht an Discogs, sobald es geht',
        failed: 'Nicht gespeichert. Es wurde nichts geändert.',
      },
      remove: 'Aus dem Regal nehmen',
      removeSure:
        'Das löscht die Platte aus deiner Discogs-Sammlung. Von hier aus nicht rückgängig zu machen.',
      removeYes: 'Entfernen',
      atDiscogs: 'Bei Discogs ansehen',
    },
  },

  map: {
    worth: (low, high, when) =>
      `— Schätzung von Discogs, Mitte zwischen ${low} und ${high}, Stand ${when}`,
    description: 'Was deine Sammlung über deinen Geschmack verrät.',
    lead: (releases) =>
      `${releases} verschiedene Releases. Was daraus über deinen Geschmack ablesbar ist.`,
    noProfile: 'Noch kein Profil – synchronisiere zuerst deine Sammlung auf der',
    startPage: 'Startseite',

    history: {
      title: 'Im Verlauf',
      about:
        'Die mittlere Schätzung von Discogs, einmal am Tag auf diesem Gerät festgehalten, mit der niedrigsten und der höchsten drumherum. Sie bewegt sich mit dem Markt und mit dem Regal, und niemand sonst sieht sie.',
      onePoint: 'Bisher ein Tag. Die Linie beginnt mit dem nächsten.',
      summary: (from, first, to, last) =>
        `Mittlere Schätzung von ${from} am ${first} bis ${to} am ${last}.`,
      now: (median) => `${median} heute`,
    },

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
    waiting: {
      today: 'heute notiert',
      yesterday: 'seit gestern',
      days: (days) => `seit ${days} Tagen`,
      months: (months) => `seit ${months} Monaten`,
      years: (years) => `seit ${years} Jahren`,
    },
    dropShort: 'Doch nicht',
    notePlaceholder: 'Welche Pressung darf es sein?',
    noteLabel: (artist, title) => `Deine Notiz zu ${artist} – ${title}`,
    drop: (artist, title) => `${artist} – ${title} von der Wantlist nehmen`,
    description: 'Was du suchst – und wie auffindbar es ist.',
    empty:
      'Deine Wantlist ist leer – oder noch nicht synchronisiert. Sie trägt die zwei stärksten Signale überhaupt.',
    emptyAction: 'Jetzt synchronisieren',
    lead: (total, withPressings) =>
      `${total} Platten gesucht. Von ${withPressings} kennt der Horizont alle Pressungen – bei denen erkennt ein Dig auch eine andere Ausgabe als die eingetragene.`,
    seenRecently: (n) => `${n} sind in den letzten dreißig Tagen bei einem Laden aufgetaucht.`,
    search: 'Künstler oder Titel',
    searchLabel: 'Wantlist durchsuchen',
    pressings: (n, one) => `${n} ${one ? 'Pressung' : 'Pressungen'} bekannt`,
    priority: {
      label: 'Wie sehr du sie willst',
      set: (stars) => (stars === 1 ? '1 Stern vergeben' : `${stars} Sterne vergeben`),
      most: 'ganz oben',
      sortLabel: 'Reihenfolge',
      waiting: 'Am längsten gesucht',
      want: 'Am meisten gewollt',
    },
    notExpanded: 'Pressungen noch nicht ausgeklappt',
    noMaster: 'Kein Master bei Discogs – nur genau diese Pressung ist erkennbar',

    plan: {
      title: 'Bei den Läden, die du gescannt hast',
      subset:
        'Nur die Läden aus den letzten sechs Stunden – nicht ganz Discogs, das kann außerhalb von Discogs niemand nach Platte durchsuchen. Was hier dazukommt, ist der Versand.',
      none: 'Keine deiner gesuchten Platten bei einem Laden aus den letzten sechs Stunden.',
      lead: (available, wanted) =>
        `${available} deiner ${wanted} gesuchten Platten sind bei diesen Läden.`,
      best: (shops, goods, postage, total) =>
        `Am günstigsten: ${shops}, ${goods} für die Platten plus ${postage} Versand – ${total}.`,
      naive: (shops, postage, more) =>
        `Jede dort, wo sie am billigsten ist, wären ${shops} und ${postage} Versand – ${more} mehr.`,
      sameAsNaive: 'Dort ist auch jede einzelne am billigsten.',
      shopLine: (records, goods, postage) => `${records} · ${goods} + ${postage} Versand`,
      otherPressing: 'andere Pressung',
      belowMinimum: (min) =>
        `Unter dem Mindestbestellwert des Ladens von ${min} – so nimmt die Kasse es nicht an.`,
      unknownPostage: (shops) => `Nicht dabei, Versand unbekannt: ${shops}.`,
      onlyThere: (n) => `${n} der gesuchten Platten gibt es nur dort.`,
      otherCurrencies: (n) =>
        `${n} in einer anderen Währung weggelassen – hier rechnet nichts um.`,
      expires: (at) => `Preise wie gescannt, gültig bis ${at}.`,
      open: 'Bei Discogs öffnen',
      shops: (n) => `${n} ${n === 1 ? 'Laden' : 'Läden'}`,
      records: (n) => `${n} ${n === 1 ? 'Platte' : 'Platten'}`,
      offers: (n) => `${n} ${n === 1 ? 'Angebot' : 'Angebote'}`,
    },
  },

  places: {
    title: 'Wo sie stehen',
    lead: 'Eine Sammlung liegt nicht in einer Liste. Sie liegt in einer Wohnung.',
    empty: 'Noch keine Orte. Ein Raum, ein Regal, eine Kiste im Keller – fang mit einem an.',
    placed: (records) => `${records} Platten haben einen Platz.`,
    withBelow: (here, below) => `${here} hier · ${below} insgesamt`,
    namePlaceholder: 'Keller, Regal, Kiste 3 …',
    add: 'Anlegen',
    addTop: 'Ort anlegen',
    addInside: 'Darin',
    moveAll: 'Alles umziehen',
    moveTo: 'Alles kommt nach',
    dissolve: 'Auflösen',
    dissolveWhat:
      'Der Ort verschwindet, die Platten bleiben. Sie haben danach nur keinen Platz mehr, und was darin lag, rückt eine Ebene nach oben.',
    dissolveConfirm: 'Auflösen',
    renameLabel: (name) => `${name} umbenennen`,
    nothingHere: 'Hier liegt noch nichts.',
    staysHere:
      'Wo eine Platte steht, ist eine Aussage über deine Wohnung, nicht über Discogs. Es bleibt auf diesem Gerät und wird nirgendwohin geschickt.',
    where: 'Wo sie steht',
    nowhere: 'Noch kein Platz',
  },

  watched: {
    title: 'Im Blick',
    lead: 'Eine Handvoll Platten – und was der Markt mit ihnen macht.',
    empty: 'Noch nichts im Blick. Leg eine Platte aus dem Regal oder der Wantlist hierher.',
    toShelf: 'Zum Regal',
    check: 'Jetzt nachsehen',
    checking: 'Sehe nach …',
    cost: (records, minutes) =>
      `${records} ${records === 1 ? 'Platte' : 'Platten'}, je eine Anfrage – etwa ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}.`,
    nothingNew: 'Nichts hat sich bewegt.',
    notYet: 'noch nicht nachgesehen',
    noneForSale: 'niemand bietet sie an',
    noPrice: 'Preis unklar',
    fromShelf: 'deine',
    fromWantlist: 'gesucht',
    span: (from, to, when) => `${from} → ${to} seit ${when}`,
    rose: (from, to, percent) => `ist von ${from} auf ${to} gestiegen – ${percent} % mehr.`,
    fell: (to) => `liegt jetzt bei ${to}, unter deiner Grenze.`,
    appeared: (copies) => `wird wieder angeboten – ${copies} Stück.`,
    fewer: (from, to) => `wird statt ${from} nur noch ${to} mal angeboten.`,
    gone: (dealer, from, to) =>
      `wird statt ${from} nur noch ${to} mal angeboten – die bei ${dealer} steht nicht mehr drin.`,
    dropShort: 'Stopp',
    drop: (label) => `${label} nicht mehr beobachten`,
    watch: 'Im Blick behalten',
    watchingOn: 'Im Blick',
    full: 'Hundert ist die Grenze – je eine Anfrage, das sind zwei Minuten pro Durchgang.',
    noShops:
      'Hier steht kein Laden: Discogs bietet keinen Weg, die Angebote zu einer Platte aufzulisten. Man bekommt den Preis, nicht die Adresse. Die eine Ausnahme ist ein Exemplar, an dem ein eigener Dig vorbeigekommen ist – das hat eine Adresse, und die steht dann da.',
  },

  saved: {
    description: 'Die Platten, zu denen du ja gesagt hast – auch wenn der Dig längst weg ist.',
    empty:
      'Noch nichts gemerkt. Der Daumen nach oben im Dig legt eine Platte hier ab – und hier bleibt sie, auch wenn der Dig längst weg ist.',
    emptyAction: 'Einen Dig starten',
    lead: (records, shops) =>
      `${records === 1 ? 'Eine Platte' : `${records} Platten`} vorgemerkt bei ${shops === 1 ? 'einem Laden' : `${shops} Läden`}.`,
    digsGo: 'Digs werden nach fünf weggeräumt – das hier bleibt.',
    markBought: (label) => `${label} als gekauft eintragen`,
    remove: (label) => `${label} von der Merkliste nehmen`,
    moved: (added, sold, soldText) =>
      sold === 0
        ? `${added} im Korb.`
        : `${added} im Korb, ${soldText} ${sold === 1 ? 'war' : 'waren'} schon weg.`,
    checked: (sold, soldText, left) =>
      sold === 0
        ? `Alle ${left} noch zu haben.`
        : `${soldText} inzwischen weg, ${left} noch da.`,
  },

  shelfCount: (shown: string, of: string | null, records: string) =>
    of === null ? `${shown} ${records}` : `${shown} von ${of} ${records}`,
  records: 'Platten',
  noCover: 'kein Cover',
  open: (artist, title) => `${artist} – ${title} öffnen`,
  showMore: (n: string) => `Weitere ${n} zeigen`,
  howMuchLeft: 'Wie viel es noch gibt',
  whichLabels: 'Welche Labels du wirklich sammelst',
  sortedAsc: (label: string) => `${label}, aufsteigend`,
  sortedDesc: (label: string) => `${label}, absteigend`,
  lastSeenAt: 'zuletzt bei',
  onDay: (day: string) => `am ${day}`,
}

export const packs = { en, de }

export function useCollectionMessages() {
  return computed(() => packs[activeLanguage()])
}
