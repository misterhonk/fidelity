/**
 * English — the base language.
 *
 * This file is the source of truth in two senses. It is what somebody sees who
 * has expressed no preference, and its shape is the contract every other
 * language has to satisfy: `de.ts` is typed as `Messages`, so a forgotten key
 * or a translated function with the wrong arity is a build error rather than a
 * blank spot somebody finds in production.
 *
 * **Why an object and not `t('some.key')`.** Both cost about the same to write.
 * Only one of them can be checked. With plain properties the compiler knows
 * `m.nav.basket` exists, autocomplete offers it, and a rename that misses a
 * template fails `pnpm typecheck` instead of rendering the key. And anything
 * that takes a number or a name is simply a function — which makes plurals and
 * interpolation ordinary TypeScript instead of a little template language with
 * its own escaping rules.
 *
 * **Keep the copy here, not in the components.** A sentence that lives in a
 * template is a sentence no translator can find.
 *
 * Rules for writing the English, in order of how often they are broken:
 *
 * 1. Say what somebody gets, not what they do not get. "Covers and shipping
 *    tiers, shared between your devices" — never "does not sync your token".
 * 2. No developer words. Not "entity", not "request", not "IndexedDB". Costs
 *    are minutes, sizes are megabytes, and nothing is a "cache".
 * 3. This is a record shop, not a dashboard. "Dig", "shelf", "in the racks" —
 *    the words the hobby already uses.
 */

import { counted } from '~/utils/plural'

const en = {
  /** What the language calls itself, and the tag `Intl` formats dates with. */
  meta: {
    name: 'English',
    /**
     * `en-GB`, not `en-US`.
     *
     * Fidelity prices in euro and its shops are mostly European. `en-US` would
     * print 8/11/2026 for a date every one of those shops writes the other way
     * round, and a misread date on a shipping estimate is worse than a slightly
     * foreign-looking one.
     */
    locale: 'en-GB',
  },

  /**
   * The two places where the idiomatic form beats the counted one. Everything
   * else about elapsed time comes from `Intl.RelativeTimeFormat` — see
   * `app/utils/when.ts` for why only these two are here.
   */
  when: {
    justNow: 'just now',
    yesterday: 'yesterday',
  },

  common: {
    /**
     * Split around the link rather than written as one string with a
     * placeholder: a link is markup, and a translator who has to place `%s`
     * inside an anchor will sooner or later place it outside one.
     */
    signIn: { lead: 'Sign in first —', link: 'go to the start page' },
    /** Read out for a cover that leads away from the app. */
    atDiscogs: (title: string) => `${title}, view at Discogs`,
    nothingYet: 'Nothing fetched yet',
    off: 'Off',
    never: 'never',
    /*
     * The shapes that turned up in eight different templates, each written out
     * by hand and each still in German after the interface was translated.
     * A phrase used on eight screens belongs in one place — that is the whole
     * argument for a pack, and it had been made eight times over.
     */
    ofTotal: (done: string | number, total: string | number) => `${done} of ${total}`,
    loading: 'Loading …',
    asking: 'Asking …',
    searching: 'Searching …',
    save: 'Save',
    to: 'to',
    etaLeft: (clock: string) => `· about ${clock} left`,
  },

  /** The notices that can appear on any screen. */
  notice: {
    offline: {
      title: 'No network.',
      body: 'Your collection, the map and the last digs are on this device and keep working. What does not: new digs, syncing, market prices.',
    },
    install: {
      title: 'Put it on your phone',
      got_it: 'Got it',
      // Safari has no `beforeinstallprompt` and never will, so this is not a
      // prompt but a description of where the button is.
      body_before: 'In Safari, tap',
      share: 'Share',
      body_middle: 'at the bottom, then',
      addToHome: 'Add to Home Screen',
      body_after:
        '. After that Fidelity starts without a browser bar and works in a basement with no signal.',
    },
    update: {
      title: 'A new version is ready.',
      later: 'Later',
      reload: 'Reload',
    },
  },

  /**
   * What went wrong, and what to do about it.
   *
   * There are exactly four ways this app fails in practice and every one of
   * them has an answer somebody can act on. Anything else keeps its own words:
   * a friendly wrapper around an unknown failure hides the only clue there is.
   */
  error: {
    detail: 'What Discogs actually said',
    unknown: 'Something went wrong.',

    /**
     * The three ways the hub probe fails.
     *
     * Here rather than beside the hub settings, because this is where every
     * failure gets its words — and the mixed-content one is not a fault in the
     * hub at all: an https page may not call an unencrypted localhost, which
     * every iPhone hits (measured 2026-08-10).
     */
    hubUnreachable: {
      title: 'Nothing answers at this address.',
      action: 'Is the hub running, and are the address and port right?',
    },
    hubMixedContent: {
      title: 'Not reachable from here.',
      action:
        'This page runs over HTTPS, so it may not call an unencrypted address. It works in Chrome; the lasting fix is to make the hub itself reachable over HTTPS.',
    },
    hubHttpError: (status: number) => ({
      title: `The hub answered with HTTP ${status}.`,
      action: 'That is the hub talking, not Discogs — its own log will say more.',
    }),

    /** Four failures with no code from Discogs — they get their own words. */
    oauthMismatch: 'The provider’s answer does not belong to this request.',
    oauthNoToken: 'The provider sent no access key.',
    noFilePicker: 'This browser cannot pick a file.',
    noFileChosen: 'No file chosen yet.',
    fileUnreadable: 'The file holds no readable vault.',

    tokenRevoked: {
      title: 'Discogs no longer accepts the token.',
      action:
        'It was probably withdrawn at Discogs. A new one from the developer settings is enough — your data here stays where it is.',
    },
    tokenUnknown: {
      title: 'Discogs does not know this token.',
      action:
        'Usually something slipped while copying — a space, a missing character at the end. Fetch it again from the developer settings and paste all of it.',
    },
    rateLimited: {
      title: 'Discogs is throttling.',
      action:
        'Sixty lookups a minute, and you share them with nobody — one or two minutes of waiting is enough. Whatever was scanned is saved.',
    },
    offline: {
      title: 'Discogs cannot be reached.',
      action:
        'Collection, map and the last digs are on this device and keep working. New digs need a network.',
    },
    storageFull: {
      title: 'No room left on this device.',
      action:
        'The browser will not give Fidelity more space. Old digs expire after six hours anyway; "Delete everything" on the start page clears the rest.',
    },
  },

  /** The label on a disclosure that holds the reasoning. */
  why: 'Why?',

  /** How current everything is, and the one button that refreshes it. */
  freshness: {
    looking: 'Looking …',
    nothingNew: 'Nothing new.',
    added: (records: number) => `${counted(records, 'record', 'records')} added`,
    alerts: (shops: number) => `${counted(shops, 'shop has', 'shops have')} something new`,
    asOf: (when: string) => `As of ${when}`,
    refreshAll: 'Refresh everything',
  },

  /** The one form that is on the welcome screen and in the settings. */
  token: {
    title: 'Enter a token',
    lead: 'Fidelity talks to Discogs directly — with no server in between. For that it needs a personal token, which you make yourself.',
    sampleTitle: 'What comes out of it',
    sampleNote:
      "Examples. A score and a sentence saying why — for every record in a dealer's stock. With your collection in place, those are your artists and your labels.",
    step1: 'open',
    step2: 'Click "Generate token"',
    step3: 'Paste the token here',
    field: 'Personal access token',
    readsOnly: 'Fidelity only reads.',
    readsOnlyRest:
      'Collection, wantlist and dealer stock — nothing more. It changes nothing about your Discogs account, buys nothing and writes nothing back. Buying happens at Discogs, by you.',
    staysHere:
      'The token stays stored on this device and is passed to nobody — not to us either. There is no server that could receive it.',
    checking: 'Checking …',
    signIn: 'Sign in',
  },

  /**
   * How the eleven signals are named.
   *
   * One table, because the card, the filter bar and the detail sheet have to
   * agree: a chip that says "Label" in one place and "Label affinity" in
   * another reads as two different things.
   */
  signals: {
    WANTLIST_EXACT: 'Wantlist',
    WANTLIST_PRESSING: 'Other pressing',
    ARTIST_KNOWN: 'Artist',
    ARTIST_GAP: 'Gap',
    LABEL_AFFINITY: 'Label',
    CATALOG_RUN: 'Catalogue run',
    STYLE_ADJACENT: 'Style',
    CREDIT_GRAPH: 'Credits',
    FORMAT_UPGRADE: 'Upgrade',
    PRICE_SIGNAL: 'Price',
    SCARCITY: 'Scarcity',
  },

  /** The start screen: what is new, and what is waiting. */
  home: {
    title: 'Start',
    description: 'Fidelity — the clerk behind the counter for your Discogs digging.',
    counts: {
      collection: 'Collection',
      wantlist: 'Wantlist',
      marked: 'Saved',
      dealers: 'Shops',
      basket: 'In the basket',
    },
    lastFound: 'Found last time',
    interrupted: (scanned: string, total: string) =>
      `This dig was interrupted — ${scanned} of ${total} were through.`,
    carryOn: 'Carry on there',
    pricesGone:
      'Prices older than six hours may no longer be shown. The finds and their reasons stay.',
    whyThese: 'Why these?',
    newOnShelf: 'New on the shelf',
    lastNoted: 'Noted last',
    /*
     * Beside `wanted`, and that is the point of it being here.
     *
     * This one was written into the page as `${n} Platten` — German, on the
     * English screen, right next to a line that came from the pack properly.
     * The two rails sit side by side, which is exactly how it was eventually
     * noticed, and exactly why neither belongs in the template.
     */
    owned: (n: string) => `${n} records`,
    wanted: (n: string) => `${n} wanted`,
    yourShops: 'Your shops',
    forSale: (n: string) => `${n} for sale`,
    whatIsHere: 'What is here',
  },

  /** The one next thing, on the start screen. */
  nextStep: {
    library: {
      cta: 'Fetch the collection',
      title: 'First: fetch your collection',
      body: 'Without it Fidelity does not know what you like. A few seconds per thousand records, and afterwards it is on this device.',
    },
    horizon: {
      cta: 'Build the horizon',
      title: 'Then: build the horizon',
      body: (minutes: number) =>
        `Once, about ${counted(minutes, 'minute', 'minutes')}. After that every dig also recognises producers, catalogue runs and other pressings of your records.`,
    },
    dig: {
      cta: 'Start a dig',
      title: 'Now: scan the first dealer',
      body: 'Take one you buy from anyway. Two to four minutes for twenty thousand listings, and at the end there is a list with a sentence per find.',
    },
  },

  /** ⌘K. */
  palette: {
    placeholder: 'Artist, dealer, dig …',
    nothing: 'Nothing found. Digs and dealers turn up here as soon as there are some.',
    goTo: 'Go to',
    dealers: 'Dealers',
    digs: 'Digs',
    lastDig: 'In the last dig',
    inStore: 'In the shop',
    affinity: (rate: string) => `${rate} finds per thousand`,
    digHint: (matches: number, when: string) => `${matches} finds · ${when}`,
    label: 'Commands and search',
    search: 'Search',
  },

  watch: {
    whyLabel: 'How it is counted',
    why: "The shop's total, not how many records are new — somebody who sells five and lists five has moved by zero. A dig says what of it is for you.",
    sinceLastVisit: 'Since your last visit',
    moreListings: (n: number, one: boolean) =>
      `${one ? 'listing' : 'listings'} more on offer than last time.`,
    read: 'Read',
    /*
     * Written to follow the shop's name, because the name is a link and a
     * link is markup: a translator handed `%s` to put inside an anchor will
     * sooner or later put it outside one. Both languages happen to allow the
     * name first, which is what makes the split clean rather than a compromise.
     */
    moved: (n: string, one: boolean) =>
      `has ${n} ${one ? 'listing' : 'listings'} more on offer than last time.`,
  },

  catalogRun: 'Filled = on your shelf. Outlined = this record.',

  credits: {
    title: 'Who worked on this',
    look: 'Have a look',
    about:
      "Discogs' greatest unused treasure: who produced, mixed or mastered. It is already in the horizon — the answer comes at once.",
    hereOnly: (here: string) => `${here} here that you have none of yet.`,
    youHave: (owned: string, here: string) =>
      `You have ${owned} — this dealer has ${here} more.`,
    records: (n: number) => counted(n, 'record', 'records'),
  },

  /** The in-store screen: one hand on a record, no signal. */
  inStore: {
    title: 'In the shop',
    description: 'The list of finds for a hand in the racks — offline, big targets.',
    back: 'Back',
    offline: 'offline, all of it from the device',
    /* A dig that was cut short is not a result. Standing in a shop is the worst
     * place to be told three records are all there is, when the scan behind
     * that number stopped halfway. */
    interrupted: (scanned: string, total: string) =>
      `This dig was interrupted — ${scanned} of ${total} were through. So what is here is not all of it.`,
    noDig:
      'No dig yet, so the list of finds stays empty. You can still search your collection and your wantlist, signal or not.',
    expired:
      'Older than six hours — prices and conditions may no longer be shown. The finds and their reasons stay.',
    search: 'Artist or title',
    searchLabel: 'Search the collection, the wantlist and the finds',
    finds: (n: number) => `${n} ${n === 1 ? 'find' : 'finds'}`,
    wrong: 'Wrong pick',
    notInLibrary: 'Not in your collection and not on your wantlist',
    norLastDig: '— and the last dig does not know it either',
    nothingByName: 'Nothing by that name.',
    pressings: (n: number) => `${n} pressings`,
  },

  /** Where the shop list comes from. */
  discovery: {
    search: 'Find shops at Discogs',
    searching: 'Looking …',
    about:
      'In your orders — those are the shops you have actually bought from. If you allow it in the settings, in your Discogs friends list as well. One lookup per source, then one per candidate, to see who sells at all.',
    added: (n: number) => (n === 1 ? 'One shop added.' : `${n} shops added.`),
    take: (n: string) => `Take ${n} over`,
    listings: (n: string) => `${n} listings`,
    alreadyThere: 'already there',
  },

  /**
   * Every evidence key the engine emits, and what it is called.
   *
   * The list is the allowlist: anything not in here is an internal handle
   * (releaseId, role) and stays out of the sheet.
   */
  evidence: {
    artist: 'Artist',
    album: 'Album',
    label: 'Label',
    person: 'Person',
    owned: 'on the shelf',
    total: 'discography',
    ownedAs: 'you have',
    styles: 'Styles',
    similarity: 'Closeness',
    lift: 'Lift',
    share: 'Share',
    prefix: 'Series',
    number: 'Number',
    inRun: 'in the series',
    wantedYear: 'wanted',
    pressingYear: 'this pressing',
    price: 'Price',
    marketLowest: 'market low',
    ratio: 'Ratio',
    numForSale: 'for sale',
  },
  close: 'Close',
  cancel: 'Cancel',
  mainReleases: (n: string) => `${n} main releases`,

  /** The demonstration, before anybody hands over a key. */
  demo: {
    title: 'Have a look first',
    lead: 'Pick a record — Fidelity shows what fits it in the same shop. No sign-in.',
    listing: 'A listing from Discogs',
    look: 'Have a look',
    orOne: 'Or one of these:',
    moment: 'One moment …',
    fetching: 'Fetching the record …',
    comparing: 'Comparing …',
    progress: 'Progress',
    fitsAt: (dealer: string) => `At ${dealer} this fits`,
    score: (score: number) => `Barry score ${score} out of 100`,
    nothing:
      'Nothing in this slice fitted. That happens: one record alone is a thin clue, and only part of the shop was read. With your collection it looks different.',
    /* What the demonstration cannot do, and why. Without this sentence Fidelity
     * looks thinner than it is. */
    coverage: (scanned: string, total: string) =>
      `${scanned} of ${total} listings were read, with one record as the clue. A dig reads the whole shop and knows your collection.`,
    shopLogo: (dealer: string) => `${dealer}, shop sign`,
    takesAMinute: 'Takes about a minute.',
  },

  nav: {
    label: 'Main sections',
    start: { label: 'Start', hint: "What's new, what's waiting" },
    dig: { label: 'Dig', hint: 'Scan a shop' },
    basket: { label: 'Basket', hint: 'What you mean to buy' },
    shelf: { label: 'Collection', hint: 'What you own and what you are after' },
    dealers: { label: 'Shops', hint: 'Who you buy from' },
    settings: { label: 'Settings', hint: 'Token, sync, appearance' },
    inBasket: (count: number) => `${count} in the basket`,
    attribution: 'Data provided by Discogs',
    disclaimer:
      'This application uses Discogs\' API but is not affiliated with, sponsored or endorsed by Discogs. "Discogs" is a trademark of Zink Media, LLC.',
    privacy: 'Privacy',
    legal: 'Imprint',
  },
}

export default en

/**
 * The shape every language has to fill.
 *
 * Deliberately total, not `Partial`: two languages maintained by the same
 * person are better served by a compiler that refuses a half-finished
 * translation than by a fallback that quietly shows English inside a German
 * sentence. If community translations ever arrive this loosens to a partial
 * pack with a deep merge onto English — and that is the moment to change it,
 * not before.
 */
export type Messages = typeof en
