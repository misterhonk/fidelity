import { activeLanguage } from '~/composables/useMessages'
import { countryName } from '~/utils/countries'

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
    noNewArtists: 'No artist new to the shelf. Every addition was somebody you already had.',
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
      'From your artists and labels as we know them, plus the producers and engineers off your favourite records, held against what arrived this year. Somebody we do not count as one of your artists yet is not in the list, however often they appear.',
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
    /** Six across or eight (M26.2): the sleeve size, or the crate. */
    density: { label: 'How many across', roomy: 'Larger', compact: 'More' },
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
      year: { label: 'Year', about: 'Oldest first, tap again to turn it around' },
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
      /** Walking the shelf from inside the sheet — the same arrows a find has. */
      previous: 'The record before this one',
      next: 'The next record',
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
        queued: 'Saved here. It goes to Discogs as soon as it can.',
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
      `Discogs' middle estimate, between ${low} and ${high}, as of ${when}`,
    description: 'What your collection gives away about your taste.',
    /** Different releases — the shelf counts copies, and two copies of one record are one taste. */
    lead: (releases: string) =>
      `${releases} different records. Here is what they say about your taste.`,
    noProfile: 'No profile yet. Sync your collection first on the',
    startPage: 'start page',

    /*
     * The line through the estimates (M19 #3). Labelled for what it is: the
     * number Discogs shows, kept day by day on this device — not an appraisal,
     * and not ours.
     */
    history: {
      title: 'Over time',
      about:
        'Discogs’ middle estimate, noted once a day on this device, with the lowest and highest around it. It moves with the market and with your shelf, and nobody else sees it.',
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
    /** The catalogue's side of the map (M21.6). */
    compared: (build: string) =>
      `The × behind a bar is your share of it divided by the share it has in all of Discogs, as of the catalogue of ${build}. Two and up is collected on purpose.`,

    entries: (n: string) => `${n} entries`,
    artistsWhyLabel: 'What the number on the right means',
    labelsWhyLabel: 'How the lift is worked out',
    artistsWhy:
      'Discogs files everything under one name: albums, singles, remixes, tracks on compilations. So the number is not a target to collect towards. It says how likely a dig is to turn up something else of theirs.',
    labelsWhy:
      'We compare your share of a label with what you would get picking at random from your labels. Only against your own labels; what the rest of the world presses, we do not know.',
    needsHorizon:
      'For gaps and label lift we need to know your artists and labels first. Two minutes in the settings.',
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
    noteShort: 'Note',
    noteLabel: (artist: string, title: string) => `Your note on ${artist} — ${title}`,
    drop: (artist: string, title: string) => `Take ${artist} — ${title} off the wantlist`,
    description: 'What you are looking for, and how findable it is.',
    empty:
      'Your wantlist is empty, or not synced yet. It is the strongest hint we have about what to look for.',
    emptyAction: 'Sync it now',
    lead: (total: string, withPressings: string) =>
      `${total} ${total === '1' ? 'record' : 'records'} wanted, ${withPressings} of them with every pressing known to us.`,
    /* Before the horizon is built (M28 #5): what it does for them, and the way there. */
    leadNoHorizon: (total: string) =>
      `${total} ${total === '1' ? 'record' : 'records'} wanted. We do not know their other pressings yet. For that,`,
    buildHorizon: 'look up your artists',
    buildHorizonTail: 'in the settings, two minutes, once.',
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
    /** The sheet a wanted record opens in (M31.21). */
    sheet: {
      since: (when: string) => `On the wantlist since ${when}`,
      lastSeen: (dealer: string, when: string) => `Last offered by ${dealer}, ${when}`,
    },
    priority: {
      label: 'How much you want it',
      set: (stars: number) => (stars === 1 ? 'Want it 1 star' : `Want it ${stars} stars`),
      most: 'wanted most',
      sortLabel: 'Order',
      waiting: 'Longest wanted',
      want: 'Wanted most',
    },
    notExpanded: 'Pressings not unfolded yet',
    noMaster: 'No master at Discogs, so we only recognise this exact pressing',
    /*
     * Taking several off at once (M27).
     *
     * The wantlist is the list that goes stale fastest — you buy a record and
     * it is still there — and until now the way off it was one sheet per
     * record. Same control as the shelf's, same words, because it is the same
     * gesture; what differs is the one action, and here there is only one that
     * makes sense on an armful.
     */
    select: {
      start: 'Select',
      done: 'Done',
      all: 'All',
      /** Given a formatted number. */
      count: (n: string) => `${n} selected`,
      pick: (artist: string, title: string) => `Select ${artist} — ${title}`,
      /*
       * A folded row is an album, so ticking it ticks its pressings — and the
       * button counts wants rather than sleeves, or it would promise to remove
       * nine and remove fourteen (the lesson of M28 #4).
       */
      drop: (n: string) => `Take ${n} off the wantlist`,
      dropped: (n: string) => `${n} off the wantlist`,
      undo: 'Undo',
      /*
       * Said only when it is true. A removal still waiting in the outbox is
       * undone by dropping the job, and then Discogs never heard about it —
       * claiming a re-request there would be inventing a request.
       */
      backAtDiscogs: (n: string) => `${n} asked for again at Discogs`,
    },
    /* One row per album (M28 #2): wants are per pressing at Discogs, the sleeve is per album. */
    inPressings: (n: string) => `wanted in ${n} pressings`,
    showPressings: 'Show them',
    hidePressings: 'Fold',

    /*
     * Your wants across the shops you scanned (M19 #9). Labelled as the
     * subset it is: the wish is "across all of Discogs", and only Discogs
     * can grant that one. What this adds is the postage.
     */
    plan: {
      title: 'At the shops you dug',
      subset:
        'Only the shops you dug in the last six hours, not all of Discogs; nobody outside Discogs can search it by record. What we add is the postage.',
      none: 'None of your wants at a shop you dug in the last six hours.',
      /* Before the first dig (M20 #4): what would fill this, and the way there. */
      empty:
        'No shop dug in the last six hours. Dig one, and we say which of your wants it has and what the parcel would cost.',
      emptyAction: 'Start a dig',
      lead: (available: string, wanted: string) =>
        `${available} of your ${wanted} wants are at these shops.`,
      best: (shops: string, goods: string, postage: string, total: string) =>
        `Cheapest: ${shops}, ${goods} for the records plus ${postage} postage, ${total} in all.`,
      naive: (shops: string, postage: string, more: string) =>
        `Each where it is cheapest would be ${shops} and ${postage} postage, ${more} more.`,
      sameAsNaive: 'That is also where each of them is cheapest.',
      shopLine: (records: string, goods: string, postage: string) =>
        `${records} · ${goods} + ${postage} postage`,
      otherPressing: 'other pressing',
      belowMinimum: (min: string) =>
        `Under this shop's minimum of ${min}. The checkout refuses it as it stands.`,
      unknownPostage: (shops: string) => `Left out, postage unknown: ${shops}.`,
      onlyThere: (n: string) => `${n} of the wants are only there.`,
      otherCurrencies: (n: string) => `${n} in another currency left out; we do not convert.`,
      expires: (at: string) => `Prices as dug, good until ${at}.`,
      open: 'Open at Discogs',
      /* "Only from Germany / the EU" (M20 #2): a view in the address, not a rule. */
      origin: {
        label: 'Ships from',
        any: 'Anywhere',
        home: (country: string) => `From ${country}`,
        eu: 'From the EU',
        /* The continent, which is a different question from the customs union. */
        europe: 'From Europe',
        leftOut: (shops: string) =>
          `${shops} elsewhere, or with no origin on record, left out.`,
      },
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
    empty: 'No places yet. A room, a shelf, a box in the cellar. Start with one.',
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
    /*
     * The boundary set by hand (M27.6).
     *
     * A rule orders the records and divides them; this takes over the
     * dividing for one compartment and leaves the ordering alone. Said by
     * pointing at a record, because the sort key is an implementation and
     * "which record should be last in here" is the actual question.
     */
    end: {
      label: 'The end of this compartment',
      /* Two plates that must not read as versions of each other next to the action. */
      by: 'by hand',
      byRule: 'by count',
      after: (what: string) => `Ends after ${what}`,
      set: 'Set the end',
      move: 'Move the end',
      pick: 'Tap the record that should be the last one here',
      pickOne: (artist: string, title: string) =>
        `End the compartment after ${artist} — ${title}`,
      stop: 'Never mind',
      release: 'Let it go',
      /* The one thing a pin cannot win, said rather than swallowed. */
      overflow: (n: string) =>
        `${n} past that end are in here too. There is no compartment after this one to hand them to.`,
      /* Before the rule changes: a key in one rule's language means nothing in another's. */
      lostOnRuleChange: 'Changing this also lets go of every end set by hand.',
    },
    staysHere:
      'Where a record stands is something about your flat, not about Discogs. It is kept on this device and sent nowhere.',
    /* On the copy, not on the release: two pressings sit in two places. */
    where: 'Where it is',
    nowhere: 'No place yet',
    /* The wall (M27.1): furniture with compartments, read from the front. */
    counts: (placed: string, unplaced: string) => `${placed} placed · ${unplaced} not yet`,
    inRoom: (n: string) => `${n} here, in no compartment`,
    cubeLabel: (label: string, n: string) => `${label}, ${n} records`,
    /* The same cube, where its end was set by hand — the dotted underline, spoken. */
    cubeLabelPinned: (label: string, n: string, ends: string) =>
      `${label}, ${n} records, ${ends}`,
    of: (n: string, capacity: string) => `${n} / ${capacity}`,
    chooseUnit: 'What is it?',
    presets: {
      'kallax-2x2': 'Kallax 2×2',
      'kallax-4x2': 'Kallax 4×2',
      'kallax-4x4': 'Kallax 4×4',
      'kallax-5x5': 'Kallax 5×5',
      billy: 'Billy',
      'usm-haller': 'USM Haller',
      tylko: 'Tylko',
      stocubo: 'stocubo',
      crate: 'Crate',
      'hhv-box': 'HHV record box',
      'box-7': '7" box',
      pile: 'Pile',
      custom: 'Custom grid',
    },
    /* The look (M27.1b): what the walls are made of, how thick, which colour. */
    finish: 'Finish',
    materials: {
      white: 'White',
      black: 'Black',
      birch: 'Birch',
      oak: 'Oak',
      walnut: 'Walnut',
      steel: 'Steel',
      cardboard: 'Cardboard',
    },
    thickness: { label: 'Wall', thin: 'Thin', medium: 'Medium', thick: 'Thick' },
    colour: 'Colour',
    noColour: 'None',
    colourOf: (hex: string) => `Colour ${hex}`,
    /* Filling a compartment from the wall (M27.1c). */
    fill: 'Fill',
    fillSearch: 'Artist, title or label',
    unplacedOnly: 'Not placed yet',
    everything: 'Everything',
    nothingToSort: 'Everything has a place.',
    noneFound: 'Nothing by that name.',
    putHere: (n: string, label: string) => `Put ${n} in ${label}`,
    selected: (n: string) => `${n} selected`,
    more: 'More',
    pick: (artist: string, title: string) => `Select ${artist} — ${title}`,
    /* The rule (M27.2): what the compartments are sorted by. It proposes, never moves. */
    order: 'Order',
    rules: {
      artist: 'By artist',
      label: 'By label',
      year: 'By year',
      added: 'By arrival',
      manual: 'By hand',
    },
    sortIn: 'Sort in',
    /* How "sort in" deals (M28 #3). */
    dealing: { label: 'How to deal', even: 'Evenly', front: 'From the front' },
    /** Given formatted numbers. */
    planLine: (moves: string, pile: string) => `${moves} would move · ${pile} from the pile`,
    nothingMoves: 'Nothing would move.',
    apply: 'Apply',
    suggested: (label: string, divider: string, rule: string) =>
      `By the rule: ${label}${divider ? ` · ${divider}` : ''}${rule ? `, ${rule}` : ''}`,
    putThere: 'Put it there',
    /* Re-sorting (M27.3): select, then move or take out, with a way back. */
    select: 'Select',
    done: 'Done',
    all: 'All',
    moveSelected: (n: string) => `Move ${n} to …`,
    takeOut: (n: string) => `Take ${n} out`,
    moved: (n: string, label: string) => `${n} moved to ${label}`,
    takenOut: (n: string) => `${n} taken out`,
    undo: 'Undo',
    whereTo: 'Where to',
    /* From the shelf (M27.5): ticked records into a compartment. */
    putSelected: (n: string) => `Put ${n} in …`,
    putInto: (n: string, label: string) => `${n} now in ${label}`,
    keys: 'M moves everything in the compartment · a letter jumps to its divider',
    /* Drag (M27.4): what the ghost says, and the line a drop leaves. */
    dragRecords: (n: string) => `${n}, drop on a compartment`,
    dragAll: (label: string) => `Everything in ${label}`,
    dragUnit: (name: string) => `${name}, drop on a room`,
    unitMoved: (name: string, room: string) => `${name} now stands in ${room}`,
    unitMovedOut: (name: string) => `${name} stands without a room`,
    perCompartment: (n: string) => `${n} each`,
    byHand: 'in order by hand',
    columnsByRows: 'columns × rows',
    columns: 'Columns',
    rows: 'Rows',
    unitName: 'Name of the furniture',
    unitPlaceholder: 'Kallax left, crate by the door …',
    addUnit: 'Add furniture',
    addUnitTop: 'Furniture without a room',
    noRoom: 'Without a room',
    cancel: 'Cancel',
    rename: 'Rename',
    renameCube: 'Name this compartment',
    dissolveUnitWhat:
      'The furniture and its compartments go. The records move to the room, or have no place.',
    open: 'Open',
    close: 'Close',
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
      `${records} ${records === 1 ? 'record' : 'records'}, one lookup each, about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
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
      `has gone from ${from} to ${to}, ${percent} % more.`,
    fell: (to: string) => `is down to ${to}, below your limit.`,
    appeared: (copies: string) => `is on offer again, ${copies} of them.`,
    /* "Sold" is not claimed: an offer can also have been withdrawn, and the
     * API does not say which of the two. */
    fewer: (from: string, to: string) => `is down from ${from} copies on offer to ${to}.`,
    /* The more precise case, and the only one where a shop appears here: a
     * dig on this device saw exactly this offer. Still not "sold" — withdrawn
     * looks the same from outside. */
    gone: (dealer: string, from: string, to: string) =>
      `is down from ${from} copies on offer to ${to}. The one at ${dealer} is gone.`,
    dropShort: 'Stop',
    drop: (label: string) => `Stop watching ${label}`,
    watch: 'Keep an eye on it',
    watchingOn: 'Watching',
    /* The limit visible rather than silent: a watcher that stops accepting
     * records without a word is worse than one that says no. */
    full: 'A hundred is the limit. One lookup each, and that is two minutes per look.',
    noShops:
      'No shop is named here: Discogs has no way to tell us who is selling a given record. You get the price, not the address. The one exception is a copy one of your own digs walked past. That one has an address, and we name it.',
  },

  saved: {
    description: 'The records you said yes to, even once the dig is long gone.',
    empty:
      'Nothing saved yet. A thumbs up in a dig puts a record here, and here it stays, even once the dig is long gone.',
    emptyAction: 'Start a dig',
    /** "at 1 shop" is arithmetic, not language. A number that reads aloud as a word is written as one. */
    lead: (records: number, shops: number) =>
      `${records === 1 ? 'One record' : `${records} records`} earmarked at ${shops === 1 ? 'one shop' : `${shops} shops`}.`,
    digsGo: 'We clear digs away after five. This stays.',
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
    noNewArtists: 'Kein Künstler neu im Regal. Jeder Zugang war jemand, den du schon hattest.',
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
      'Aus deinen Künstlern und Labels, wie wir sie kennen, plus den Produzenten und Engineers von deinen Lieblingsplatten, gehalten gegen das, was in dem Jahr dazukam. Wen wir noch nicht als deinen Künstler kennen, der steht nicht in der Liste, so oft er auch vorkommt.',
    runs: (n) => `${n} ${n === 1 ? 'Dig' : 'Digs'}`,
    shops: (n) => `${n} ${n === 1 ? 'Laden' : 'Läden'}`,
    finds: (n) => `${n} ${n === 1 ? 'Fund' : 'Funde'}`,
    records: (n) => `${n} ${n === 1 ? 'Platte' : 'Platten'}`,
    artistCount: (n) => `${n} ${n === 1 ? 'Künstler' : 'Künstler'}`,
  },

  loading: 'Wird geladen …',

  shelf: {
    description: 'Deine Platten, als Regal.',
    empty: 'Noch keine Platten hier. Sammlung in den Einstellungen holen.',
    emptyAction: 'Sammlung holen',
    noMatch: 'Nichts mit diesem Namen im Regal.',
    density: { label: 'Wie viele nebeneinander', roomy: 'Größer', compact: 'Mehr' },
    search: 'Künstler, Titel oder Label',
    searchLabel: 'Regal durchsuchen',
    sorting: 'Sortierung',
    sorts: {
      added: { label: 'Zuletzt dazu', about: 'Neuester Zugang zuerst' },
      artist: { label: 'Künstler', about: 'Alphabetisch' },
      year: { label: 'Jahr', about: 'Älteste zuerst, nochmal antippen dreht um' },
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
      previous: 'Die Platte davor',
      next: 'Die nächste Platte',
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
      everyone: 'Alle anderen',
      communityRating: (average, votes) => `${average} von 5, aus ${votes}`,
      forSale: 'Im Angebot',
      cheapest: (price, sellers) => `${price}, günstigstes von ${sellers}`,
      whatIsItWorth: 'Was ist sie wert?',
      aboutIt: 'Über diese Veröffentlichung',
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
        queued: 'Hier gespeichert. Geht an Discogs, sobald es geht.',
        failed: 'Nicht gespeichert. Es hat sich nichts geändert.',
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
      `Schätzung von Discogs, Mitte zwischen ${low} und ${high}, Stand ${when}`,
    description: 'Was deine Sammlung über deinen Geschmack verrät.',
    lead: (releases) =>
      `${releases} verschiedene Platten. Das sagen sie über deinen Geschmack.`,
    noProfile: 'Noch kein Profil. Hol zuerst deine Sammlung auf der',
    startPage: 'Startseite',

    history: {
      title: 'Im Verlauf',
      about:
        'Die mittlere Schätzung von Discogs, einmal am Tag auf diesem Gerät notiert, mit der niedrigsten und der höchsten drumherum. Sie bewegt sich mit dem Markt und mit deinem Regal, und niemand sonst sieht sie.',
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
    compared: (build) =>
      `Das × hinter einem Balken ist dein Anteil daran geteilt durch den Anteil in ganz Discogs, Stand des Katalogs vom ${build}. Ab zwei ist es Absicht.`,

    entries: (n) => `${n} Einträgen`,
    artistsWhyLabel: 'Was die Zahl rechts bedeutet',
    labelsWhyLabel: 'Wie der Lift gerechnet wird',
    artistsWhy:
      'Discogs führt unter einem Namen alles: Alben, Singles, Remixe, Stücke auf Samplern. Die Zahl ist also kein Sammelziel. Sie sagt, wie wahrscheinlich ein Dig noch etwas von ihnen ausgräbt.',
    labelsWhy:
      'Wir vergleichen deinen Anteil an einem Label mit dem, was du bei zufälliger Auswahl aus deinen Labels hättest. Nur mit deinen eigenen Labels; was der Rest der Welt presst, wissen wir nicht.',
    needsHorizon:
      'Für Lücken und Label-Lift müssen wir erst deine Künstler und Labels kennen. Zwei Minuten in den Einstellungen.',
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
    noteShort: 'Notiz',
    noteLabel: (artist, title) => `Deine Notiz zu ${artist} – ${title}`,
    drop: (artist, title) => `${artist} – ${title} von der Wantlist nehmen`,
    description: 'Was du suchst, und wie gut es zu finden ist.',
    empty:
      'Deine Wantlist ist leer, oder noch nicht geholt. Sie ist der stärkste Hinweis, den wir haben, wonach wir suchen sollen.',
    emptyAction: 'Jetzt holen',
    lead: (total, withPressings) =>
      `${total} ${total === '1' ? 'Platte' : 'Platten'} gesucht, bei ${withPressings} kennen wir alle Pressungen.`,
    leadNoHorizon: (total) =>
      `${total} ${total === '1' ? 'Platte' : 'Platten'} gesucht. Ihre anderen Pressungen kennen wir noch nicht. Dafür musst du einmal`,
    buildHorizon: 'deine Künstler nachschlagen',
    buildHorizonTail: 'in den Einstellungen. Zwei Minuten.',
    seenRecently: (n) => `${n} sind in den letzten dreißig Tagen bei einem Laden aufgetaucht.`,
    search: 'Künstler oder Titel',
    searchLabel: 'Wantlist durchsuchen',
    pressings: (n, one) => `${n} ${one ? 'Pressung' : 'Pressungen'} bekannt`,
    sheet: {
      since: (when) => `Auf der Wantlist seit ${when}`,
      lastSeen: (dealer, when) => `Zuletzt angeboten bei ${dealer}, ${when}`,
    },
    priority: {
      label: 'Wie sehr du sie willst',
      set: (stars) => (stars === 1 ? '1 Stern vergeben' : `${stars} Sterne vergeben`),
      most: 'ganz oben',
      sortLabel: 'Reihenfolge',
      waiting: 'Am längsten gesucht',
      want: 'Am meisten gewollt',
    },
    notExpanded: 'Pressungen noch nicht ausgeklappt',
    noMaster: 'Kein Master bei Discogs, wir erkennen also nur genau diese Pressung',
    select: {
      start: 'Auswählen',
      done: 'Fertig',
      all: 'Alle',
      count: (n) => `${n} ausgewählt`,
      pick: (artist, title) => `${artist} – ${title} auswählen`,
      drop: (n) => `${n} von der Wantlist nehmen`,
      dropped: (n) => `${n} von der Wantlist genommen`,
      undo: 'Rückgängig',
      backAtDiscogs: (n) => `${n} bei Discogs neu angefragt`,
    },
    inPressings: (n) => `in ${n} Pressungen gesucht`,
    showPressings: 'Anzeigen',
    hidePressings: 'Einklappen',

    plan: {
      title: 'Bei den Läden, die du gegraben hast',
      subset:
        'Nur die Läden, die du in den letzten sechs Stunden gegraben hast, nicht ganz Discogs; das kann außerhalb von Discogs niemand nach Platte durchsuchen. Was wir dazutun, ist das Porto.',
      none: 'Keine deiner gesuchten Platten bei einem Laden aus den letzten sechs Stunden.',
      empty:
        'Kein Laden in den letzten sechs Stunden gegraben. Grab einen, und wir sagen dir, welche deiner gesuchten Platten er hat und was das Paket kosten würde.',
      emptyAction: 'Dig starten',
      lead: (available, wanted) =>
        `${available} deiner ${wanted} gesuchten Platten sind bei diesen Läden.`,
      best: (shops, goods, postage, total) =>
        `Am günstigsten: ${shops}, ${goods} für die Platten plus ${postage} Porto, ${total} zusammen.`,
      naive: (shops, postage, more) =>
        `Jede dort, wo sie am billigsten ist, wären ${shops} und ${postage} Porto, ${more} mehr.`,
      sameAsNaive: 'Dort ist auch jede einzelne am billigsten.',
      shopLine: (records, goods, postage) => `${records} · ${goods} + ${postage} Porto`,
      otherPressing: 'andere Pressung',
      belowMinimum: (min) =>
        `Unter dem Mindestbestellwert des Ladens von ${min}. So nimmt die Kasse es nicht an.`,
      unknownPostage: (shops) => `Nicht dabei, Porto unbekannt: ${shops}.`,
      onlyThere: (n) => `${n} der gesuchten Platten gibt es nur dort.`,
      otherCurrencies: (n) =>
        `${n} in einer anderen Währung weggelassen; wir rechnen nicht um.`,
      expires: (at) => `Preise wie gegraben, gültig bis ${at}.`,
      open: 'Bei Discogs öffnen',
      origin: {
        label: 'Versand aus',
        any: 'Überall',
        home: (country) => `Aus ${countryName(country)}`,
        eu: 'Aus der EU',
        europe: 'Aus Europa',
        leftOut: (shops) => `${shops} anderswo oder ohne Herkunft weggelassen.`,
      },
      shops: (n) => `${n} ${n === 1 ? 'Laden' : 'Läden'}`,
      records: (n) => `${n} ${n === 1 ? 'Platte' : 'Platten'}`,
      offers: (n) => `${n} ${n === 1 ? 'Angebot' : 'Angebote'}`,
    },
  },

  places: {
    title: 'Wo sie stehen',
    lead: 'Eine Sammlung liegt nicht in einer Liste. Sie liegt in einer Wohnung.',
    empty: 'Noch keine Orte. Ein Raum, ein Regal, eine Kiste im Keller. Fang mit einem an.',
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
    end: {
      label: 'Das Ende dieses Fachs',
      by: 'von Hand',
      byRule: 'nach Anzahl',
      after: (what) => `Endet nach ${what}`,
      set: 'Ende setzen',
      move: 'Ende verschieben',
      pick: 'Tippe die Platte an, die hier die letzte sein soll',
      pickOne: (artist, title) => `Fach nach ${artist} – ${title} enden lassen`,
      stop: 'Doch nicht',
      release: 'Wieder freigeben',
      overflow: (n) =>
        `${n} hinter diesem Ende liegen auch hier. Es gibt kein Fach danach, an das sie gehen könnten.`,
      lostOnRuleChange: 'Damit lässt du auch alle von Hand gesetzten Enden los.',
    },
    staysHere:
      'Wo eine Platte steht, sagt etwas über deine Wohnung, nicht über Discogs. Es bleibt auf diesem Gerät, wir schicken es nirgendwohin.',
    where: 'Wo sie steht',
    nowhere: 'Noch kein Platz',
    counts: (placed, unplaced) => `${placed} einsortiert · ${unplaced} noch nicht`,
    inRoom: (n) => `${n} hier, in keinem Fach`,
    cubeLabel: (label, n) => `${label}, ${n} Platten`,
    cubeLabelPinned: (label, n, ends) => `${label}, ${n} Platten, ${ends}`,
    of: (n, capacity) => `${n} / ${capacity}`,
    chooseUnit: 'Was ist es?',
    presets: {
      'kallax-2x2': 'Kallax 2×2',
      'kallax-4x2': 'Kallax 4×2',
      'kallax-4x4': 'Kallax 4×4',
      'kallax-5x5': 'Kallax 5×5',
      billy: 'Billy',
      'usm-haller': 'USM Haller',
      tylko: 'Tylko',
      stocubo: 'stocubo',
      crate: 'Kiste',
      'hhv-box': 'HHV Record Box',
      'box-7': '7"-Box',
      pile: 'Stapel',
      custom: 'Eigenes Raster',
    },
    finish: 'Oberfläche',
    materials: {
      white: 'Weiß',
      black: 'Schwarz',
      birch: 'Birke',
      oak: 'Eiche',
      walnut: 'Nussbaum',
      steel: 'Stahl',
      cardboard: 'Karton',
    },
    thickness: { label: 'Wand', thin: 'Dünn', medium: 'Mittel', thick: 'Dick' },
    colour: 'Farbe',
    noColour: 'Keine',
    colourOf: (hex) => `Farbe ${hex}`,
    fill: 'Befüllen',
    fillSearch: 'Künstler, Titel oder Label',
    unplacedOnly: 'Noch nicht einsortiert',
    everything: 'Alle',
    nothingToSort: 'Alles hat einen Platz.',
    noneFound: 'Nichts mit diesem Namen.',
    putHere: (n, label) => `${n} nach ${label}`,
    selected: (n) => `${n} ausgewählt`,
    more: 'Mehr',
    pick: (artist, title) => `${artist} – ${title} auswählen`,
    order: 'Ordnung',
    rules: {
      artist: 'Nach Künstler',
      label: 'Nach Label',
      year: 'Nach Jahr',
      added: 'Nach Ankunft',
      manual: 'Von Hand',
    },
    sortIn: 'Einsortieren',
    dealing: { label: 'Verteilung', even: 'Gleichmäßig', front: 'Von vorne' },
    planLine: (moves, pile) => `${moves} würden wandern · ${pile} vom Stapel`,
    nothingMoves: 'Nichts würde wandern.',
    apply: 'Anwenden',
    suggested: (label, divider, rule) =>
      `Nach der Regel: ${label}${divider ? ` · ${divider}` : ''}${rule ? `, ${rule}` : ''}`,
    putThere: 'Dorthin',
    select: 'Auswählen',
    done: 'Fertig',
    all: 'Alle',
    moveSelected: (n) => `${n} verschieben nach …`,
    takeOut: (n) => `${n} herausnehmen`,
    moved: (n, label) => `${n} nach ${label} verschoben`,
    takenOut: (n) => `${n} herausgenommen`,
    undo: 'Rückgängig',
    whereTo: 'Wohin',
    putSelected: (n) => `${n} einräumen nach …`,
    putInto: (n, label) => `${n} jetzt in ${label}`,
    keys: 'M verschiebt alles im Fach · ein Buchstabe springt zu seinem Trenner',
    dragRecords: (n) => `${n}, auf ein Fach ziehen`,
    dragAll: (label) => `Alles aus ${label}`,
    dragUnit: (name) => `${name}, auf einen Raum ziehen`,
    unitMoved: (name, room) => `${name} steht jetzt in ${room}`,
    unitMovedOut: (name) => `${name} steht ohne Raum`,
    perCompartment: (n) => `je ${n}`,
    byHand: 'Reihenfolge von Hand',
    columnsByRows: 'Spalten × Reihen',
    columns: 'Spalten',
    rows: 'Reihen',
    unitName: 'Name des Möbels',
    unitPlaceholder: 'Kallax links, Kiste an der Tür …',
    addUnit: 'Möbel anlegen',
    addUnitTop: 'Möbel ohne Raum',
    noRoom: 'Ohne Raum',
    cancel: 'Abbrechen',
    rename: 'Umbenennen',
    renameCube: 'Dieses Fach benennen',
    dissolveUnitWhat:
      'Das Möbel und seine Fächer verschwinden. Die Platten wandern in den Raum, oder haben keinen Platz.',
    open: 'Öffnen',
    close: 'Schließen',
  },

  watched: {
    title: 'Im Blick',
    lead: 'Eine Handvoll Platten, und was der Markt mit ihnen macht.',
    empty: 'Noch nichts im Blick. Leg eine Platte aus dem Regal oder der Wantlist hierher.',
    toShelf: 'Zum Regal',
    check: 'Jetzt nachsehen',
    checking: 'Schauen nach …',
    cost: (records, minutes) =>
      `${records} ${records === 1 ? 'Platte' : 'Platten'}, je eine Abfrage, etwa ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}.`,
    nothingNew: 'Nichts hat sich bewegt.',
    notYet: 'noch nicht nachgesehen',
    noneForSale: 'niemand bietet sie an',
    noPrice: 'Preis unklar',
    fromShelf: 'deine',
    fromWantlist: 'gesucht',
    span: (from, to, when) => `${from} → ${to} seit ${when}`,
    rose: (from, to, percent) => `ist von ${from} auf ${to} gestiegen, ${percent} % mehr.`,
    fell: (to) => `liegt jetzt bei ${to}, unter deiner Grenze.`,
    appeared: (copies) => `wird wieder angeboten, ${copies} Stück.`,
    fewer: (from, to) => `wird statt ${from} nur noch ${to} mal angeboten.`,
    gone: (dealer, from, to) =>
      `wird statt ${from} nur noch ${to} mal angeboten. Die bei ${dealer} ist weg.`,
    dropShort: 'Stopp',
    drop: (label) => `${label} nicht mehr beobachten`,
    watch: 'Im Blick behalten',
    watchingOn: 'Im Blick',
    full: 'Hundert ist die Grenze. Je eine Abfrage, das sind zwei Minuten pro Durchgang.',
    noShops:
      'Hier steht kein Laden: Discogs sagt uns nicht, wer eine bestimmte Platte anbietet. Du bekommst den Preis, nicht die Adresse. Die eine Ausnahme ist ein Exemplar, an dem einer deiner Digs vorbeigekommen ist. Das hat eine Adresse, und die steht dann da.',
  },

  saved: {
    description: 'Die Platten, zu denen du ja gesagt hast, auch wenn der Dig längst weg ist.',
    empty:
      'Noch nichts gemerkt. Ein Daumen hoch im Dig legt eine Platte hier ab, und hier bleibt sie, auch wenn der Dig längst weg ist.',
    emptyAction: 'Einen Dig starten',
    lead: (records, shops) =>
      `${records === 1 ? 'Eine Platte' : `${records} Platten`} vorgemerkt bei ${shops === 1 ? 'einem Laden' : `${shops} Läden`}.`,
    digsGo: 'Digs räumen wir nach fünf weg. Das hier bleibt.',
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
