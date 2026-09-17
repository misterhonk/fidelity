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
    /*
     * And for one that stays.
     *
     * A cover tile carries its title *underneath* the button, not inside it,
     * so without this a screen reader announces "button" and nothing else —
     * four of them in a row, indistinguishable. Found on 2026-08-13 by a test
     * that could not find the tiles either.
     */
    openRecord: (title: string) => `Open ${title}`,
    /*
     * The button carries only an arrow, so the name has to be spoken. "Button"
     * on its own tells nobody where it leads.
     */
    toTop: 'Back to the top',
    /*
     * Spoken, not drawn. The arrow beside an outward link is decoration; this
     * is the same fact for somebody who cannot see it.
     */
    opensAtDiscogs: '(opens at Discogs)',
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

  /**
   * Hearing a record (M31), on every screen that shows one.
   *
   * Two different things under one heading, and the copy has to keep them
   * apart: the clips are YouTube's, the search link is whichever service
   * somebody picked. Somebody who chose Deezer and taps a clip still hears
   * YouTube — so `source` says so rather than letting the picker imply
   * otherwise.
   */
  listen: {
    title: 'Hear it',
    search: (service: string) => `Find it on ${service}`,
    source: 'Playing from YouTube',
    /*
     * Split around the link for the same reason `signIn` is: a placeholder
     * inside an anchor is a placeholder that ends up outside one.
     */
    here: { lead: 'Play them here —', link: 'switch the preview on' },
    stop: 'Stop',
    /** Over the tracklist, where the clips hang once they are matched. */
    onIt: 'On the record',
    /** Beside a track that has one — a brand name, the same in every language. */
    via: 'YouTube',
    play: (track: string) => `Play ${track}`,
    /** What no track claimed: a live take, an album rip, a different pressing. */
    more: 'More recordings',
  },

  /**
   * The eight Discogs grades, in words somebody three weeks into collecting
   * can act on (M26.4, the beginner's hurdle).
   *
   * Not a translation of the abbreviation — an answer to the question behind
   * it: can I play this, and will it annoy me. Discogs' own definitions are
   * about the object; these are about the evening.
   */
  grades: {
    M: 'Sealed or never played.',
    NM: 'Looks new, barely played. No noise you would notice.',
    VGP: 'Light marks from use. Plays clean, maybe a tick between tracks.',
    VG: 'Visible marks. Surface noise you hear in quiet passages.',
    GP: 'Well played. Noise throughout, but it plays.',
    G: 'Heavily played. A copy to have, not to listen to.',
    F: 'Damaged. Plays through at best.',
    P: 'Broken or unplayable.',
  },

  /**
   * The request meter (M31.9).
   *
   * Never "X of Y left": Discogs' limit is a tempo — sixty a minute per
   * address — and nothing runs out. The words here talk about pace and about
   * who set the pace, and they say plainly that this is the app's own count.
   */
  limit: {
    title: 'Requests to Discogs',
    session: 'This session',
    purposes: {
      dig: 'Digs',
      horizon: 'Horizon',
      record: 'Records',
      watch: 'Watcher',
      sync: 'Collection',
      other: 'Other',
    },
    spoken: (n: number, ceiling: number) =>
      `${n} requests in the last minute, of ${ceiling} this device allows itself`,
    saved: (n: string, minutes: number) =>
      `The catalogue and the hub spared us ${n} lookups, about ${minutes === 1 ? 'a minute' : `${minutes} minutes`} of waiting.`,
    ceiling: (n: number) => `Discogs allows 60 a minute per address. We ask ${n}, on purpose.`,
    ours: 'We count what we asked for. Discogs’ own counter is not something a browser can read.',

    /*
     * The next rung, and only ever one line of it (M31.12).
     *
     * Worked out from what this device actually did, never from a schedule:
     * the horizon requests a catalogue would have taken over are the ones
     * already counted above it. No banner, no tile, nothing repeated.
     */
    noToken: 'Without a token: 25 a minute instead of 50. A dig takes twice as long.',
    tryCatalogue: (n: string) =>
      `A catalogue would have answered ${n} of these without asking Discogs.`,
    tryHub: (_n: string) =>
      'A hub shares these between your devices, and with whoever else uses it.',
    /** What things cost, behind a disclosure: figures, not a lecture. */
    costs: 'What takes how long',
    costRows: [
      ['A dig, 3.000 listings', '~ 130', '~ 2½ min'],
      ['A dig, 20.000 listings', '~ 300', '~ 6 min'],
      ['Your artists and labels, 30 of them', '~ 600', '~ 12 min'],
      ['Fetching a collection of 2.000', '~ 40', '~ 1 min'],
      ['The round, per watched shop', '~ 20', '~ 25 s'],
      ['Opening one record', '1', '1,2 s'],
    ] as [string, string, string][],
  },

  /** The notices that can appear on any screen. */
  notice: {
    offline: {
      title: 'No network.',
      body: 'Your shelf, the map and the last digs are still here. New digs, syncing and market prices need the network.',
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
        '. After that it opens without a browser bar and works in a basement with no signal.',
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
    scanRunning: (dealer: string) => ({
      title: `We are already digging through ${dealer}.`,
      action:
        'One dig at a time; Discogs allows us no more. It carries on in the background and this screen follows it. Start the next one when it is through.',
    }),
    hubHttpError: (status: number) => ({
      title: `The hub answered with HTTP ${status}.`,
      action: 'That is the hub talking, not Discogs. Its own log says more.',
    }),

    /*
     * The vault's own failures — no code from Discogs, so they get their own
     * words.
     *
     * Five of these read from here; thirteen more were German string literals
     * in `useVaultCloud.ts`, `useVaultFile.ts` and `vault-file.ts` until the
     * 2026-09-10. That is not a detail buried in a log: `explain()` has no code
     * to match, so it falls through to its last line and makes the message the
     * **title** — red, at the top, in an English interface.
     *
     * Where a sentence differs only in the provider's name, it is one sentence
     * with the name passed in. "Dropbox did not hand the vault over" and
     * "Google Drive did not hand the vault over" were two literals saying the
     * same thing in two places.
     */
    oauthMismatch: 'The provider’s answer does not belong to this request.',
    oauthNoToken: 'The provider sent no access key.',
    noFilePicker: 'This browser cannot pick a file.',
    noFileChosen: 'No file chosen yet.',
    fileUnreadable: 'The file holds no readable vault.',
    fileDenied: 'The browser did not allow access to the file.',
    notAVault: 'This file is not a Fidelity vault.',
    oauthRejected: (provider: string) => `${provider} rejected the code.`,
    notConnected: 'Not connected yet.',
    connectionExpired: 'The connection has expired. Connect again.',
    refreshFailed: 'The connection could not be renewed.',
    vaultNotGiven: (provider: string) => `${provider} did not hand the vault over.`,
    vaultNotTaken: (provider: string) => `${provider} did not accept the vault.`,
    vaultNotCreated: (provider: string) => `${provider} did not create the vault.`,
    providerUnexpected: (provider: string) => `${provider} is not answering as expected.`,
    noCloudTarget: 'No cloud target.',

    /**
     * What the worker throws, in words.
     *
     * Keyed by `WorkerError['code']` rather than reached through fourteen
     * branches in `explain()` — every one of these says the same *kind* of
     * thing ("this is what happened, here is what to do"), so a lookup is the
     * honest shape for it.
     *
     * Until 2026-09-11 the worker threw sentences instead. Ten were German,
     * inside an English interface, and `explain()` makes a message with no
     * code the **title** — red, at the top. They could not follow a language
     * switch either, because the packs hang off `activeLanguage()` in the main
     * thread and the worker knows nothing about language (CLAUDE.md).
     */
    failed: {
      'no-token': {
        title: 'No token entered.',
        action: 'Paste your personal access token from Discogs into the field.',
      },
      'not-signed-in': {
        title: 'Not signed in.',
        action: 'Enter your Discogs token in the settings. Everything here needs it.',
      },
      'no-listing': {
        title: 'No record given.',
        action: 'Paste a link to a record in a Discogs shop.',
      },
      'dig-gone': {
        title: 'That dig is no longer here.',
        action: 'We keep a dig for six hours, then its prices go. Dig the shop again.',
      },
      'dig-expired': {
        title: 'Those prices are more than six hours old.',
        action: 'We cannot show prices that old. A new dig takes a minute.',
      },
      'dig-running': {
        title: 'A dig is already running.',
        action: 'One at a time; Discogs allows us no more. Let it finish.',
      },
      'dig-not-running': {
        title: 'There is nothing here to continue.',
        action: 'This dig is not running. Start a new dig of the shop.',
      },
      'deep-scan-done': {
        title: 'A deep dig cannot be picked up again.',
        action: 'What it found is here. Picking it up again would count records twice.',
      },
      'no-anchor': {
        title: 'Nothing to compare against yet.',
        action: '"Only what is new" needs one full dig of this shop to start from.',
      },
      'match-gone': {
        title: 'That find is no longer here.',
        action: 'It went with its dig after six hours. Dig the shop again.',
      },
      'no-hub': {
        title: 'No hub entered.',
        action: 'A hub is optional. Enter one in the settings, or leave it and use the rest.',
      },
      'not-a-hub': {
        title: 'That is not a Fidelity hub.',
        action:
          'Something answered at that address, but not a hub. Check the address and port.',
      },
      'no-catalogue': {
        title: 'No catalogue entered.',
        action:
          'A catalogue is optional. Enter one in the settings, or leave it and use the rest.',
      },
      'not-a-catalogue': {
        title: 'That is not a Fidelity catalogue.',
        action:
          'Something answered at that address, but not a catalogue. Check the address and port.',
      },
      'not-a-backup': {
        title: 'That is not a Fidelity backup.',
        action:
          'A backup is the file “Export everything” writes here: fidelity-backup-<date>.json.',
      },
      'backup-too-new': {
        title: 'This backup is from a newer Fidelity.',
        action:
          'Update the app first. An older one would read it wrong rather than not at all.',
      },
      'token-other-account': {
        title: 'This token belongs to another Discogs account.',
        action:
          'What is on this device belongs to the signed-in account. To switch accounts, sign out first, which deletes the database, and sign in with the new token.',
      },
      'vault-too-new': {
        title: 'This backup is from a newer Fidelity.',
        action:
          'Update the app first. An older one would read it wrong rather than not at all.',
      },
      'vault-unusable': {
        title: 'This backup target cannot be used.',
        action: 'Check the target in the settings.',
      },
      'passphrase-short': {
        title: 'The passphrase is too short.',
        action:
          'Eight characters at least. It is the only thing standing between the backup and whoever finds it.',
      },
      'asset-missing': {
        title: 'Part of the app did not load.',
        action: 'Reload the page. If it keeps happening, the deployment is incomplete.',
      },
    },

    tokenRevoked: {
      title: 'Discogs no longer accepts the token.',
      action:
        'It was probably withdrawn at Discogs. Make a new one in the developer settings and enter it under Settings → Account → Renew the token. Your data here stays where it is.',
    },
    tokenUnknown: {
      title: 'Discogs does not know this token.',
      action:
        'Usually something slipped while copying, a space or a missing character at the end. Fetch it again from the developer settings and paste all of it.',
    },
    rateLimited: {
      title: 'Discogs asked us to slow down.',
      action: 'Everything so far is saved. Give it a minute or two, then dig on.',
    },
    offline: {
      title: 'We cannot reach Discogs.',
      action:
        'Your shelf, the map and the last digs are still here. New digs need the network.',
    },
    storageFull: {
      title: 'No room left on this device.',
      action:
        'The browser will not give us more space. Old digs go after six hours anyway; "Delete everything" on the start page clears the rest.',
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

    /*
     * What is running, named.
     *
     * The keeper has always worked on opening, on returning to the tab and
     * every twenty minutes — and said not a word about it. Anyone not reading
     * the source could only conclude that nothing was happening.
     */
    updating: 'Your data is being updated',
    job: {
      outbox: 'sending your changes',
      library: 'collection and wantlist',
      watch: 'the shops you watch',
      horizon: 'your artists and labels',
    },

    whyLabel: 'What refreshes by itself?',
    why: 'Your collection, your wantlist, the shops you watch and your artists and labels: when the app opens, when you come back to the tab, and every twenty minutes. Usually that is a single lookup, because we only ask Discogs what has changed. Two things stay out on purpose. A dig is two to four minutes and a hundred lookups or more, so you start it, never a clock. And your orders we cannot fetch at all; Discogs only lists what you sold, so a purchase is read from its order number.',
  },

  /** What changed in the version you are running. */
  news: {
    title: 'What is new',
    /** The call-out a release may add — the one line that asks something of the reader (M24). */
    whatToDo: 'What to do:',
    /* The line on the start page after the release has changed. */
    updatedTo: (version: string) => `Updated to ${version}`,
    whatChanged: 'What changed?',
    dismiss: 'Not now',
    inVersion: (version: string) => `In version ${version}`,
    none: 'Nothing written down for this version.',
    /*
     * The notes are in German up to and including 0.26.0, because they come
     * from this project's commits. English from the next release onwards —
     * they are user-visible text now and therefore fall under ADR-010. This
     * note stands for as long as German entries are still being shown.
     */
    german: 'Notes up to 0.26.0 are in German; they come from this project’s own commits.',
    full: 'Every version, on GitHub',
    fullHref: 'https://github.com/misterhonk/fidelity/blob/main/CHANGELOG.md',
  },

  /** The one form that is on the welcome screen and in the settings. */
  token: {
    title: 'Enter a token',
    lead: 'We talk to Discogs directly, with no server in between. For that we need a personal token, which you make yourself.',
    sampleTitle: 'What comes out of it',
    sampleNote:
      'Examples. A score and a sentence saying why, for every record in a shop. Once your collection is in, those are your artists and your labels.',
    step1: 'open',
    step2: 'Click "Generate token"',
    step3: 'Paste the token here',
    field: 'Personal access token',
    readsOnly: 'We only read.',
    readsOnlyRest:
      'Your collection, your wantlist and what the shops have, nothing more. We change nothing about your Discogs account, buy nothing and write nothing back. Buying happens at Discogs, by you.',
    staysHere:
      'The token stays on this device and goes to nobody, not to us either. There is no server that could receive it.',
    checking: 'Checking …',
    signIn: 'Sign in',

    /*
     * Renewing, on the account screen. Same field, same rules, one
     * difference that has to be said: nothing on this device is touched.
     * Until 2026-09-12 a withdrawn token meant signing out — and signing out
     * deletes the database.
     */
    renewTitle: 'Renew the token',
    renewLead:
      'If Discogs stopped accepting the token, enter a new one here. Everything on this device stays; only the key changes.',
    renew: 'Renew',
    renewed: 'The token works. Nothing else has changed.',
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
    ARTIST_FOLLOWED: 'On your radar',
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
    description: 'Fidelity, the person behind the counter for your Discogs digging.',
    counts: {
      collection: 'Collection',
      wantlist: 'Wantlist',
      marked: 'Saved',
      dealers: 'Shops',
      basket: 'In the basket',
    },
    lastFound: 'Found last time',
    interrupted: (scanned: string, total: string) =>
      `This dig stopped at ${scanned} of ${total}.`,
    carryOn: 'Carry on there',
    pricesGone:
      'These prices are more than six hours old, so we took them down. The finds and their reasons stay.',
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
      body: 'Without it we do not know what you like. A few seconds per thousand records, and then it is on this device.',
    },
    horizon: {
      cta: 'Look up your artists',
      title: 'Then: look up your artists and labels',
      body: (minutes: number) =>
        `Once, about ${counted(minutes, 'minute', 'minutes')}. After that every dig also recognises producers, catalogue runs and other pressings of your records.`,
    },
    dig: {
      cta: 'Start a dig',
      title: 'Now: dig through the first shop',
      body: 'Take one you buy from anyway. Two to four minutes for twenty thousand records, and at the end you get a list with a sentence per find.',
    },
  },

  /** ⌘K. */
  palette: {
    placeholder: 'Artist, shop, dig …',
    nothing: 'Nothing found. Digs and shops turn up here as soon as there are some.',
    goTo: 'Go to',
    dealers: 'Shops',
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
    why: "The shop's total, not how many records are new. Somebody who sells five and lists five has moved by zero. A dig says what of it is for you.",
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
  /** What a screen reader says for one cell of the run — the number, then its state. */
  catalogRunEntry: {
    this: (number: string) => `${number}, this record`,
    owned: (number: string) => `${number}, on your shelf`,
    missing: (number: string) => `${number}, missing`,
  },

  credits: {
    title: 'Who worked on this',
    look: 'Have a look',
    about:
      "Discogs' greatest unused treasure: who produced, mixed or mastered. We already know it, so the answer comes at once.",
    hereOnly: (here: string) => `${here} here that you have none of yet.`,
    youHave: (owned: string, here: string) => `You have ${owned}. This shop has ${here} more.`,
    records: (n: number) => counted(n, 'record', 'records'),
  },

  /** The in-store screen: one hand on a record, no signal. */
  inStore: {
    title: 'In the shop',
    description: 'Your finds for a hand in the racks. Offline, big targets.',
    back: 'Back',
    offline: 'offline, all of it from the device',
    /* A dig that was cut short is not a result. Standing in a shop is the worst
     * place to be told three records are all there is, when the scan behind
     * that number stopped halfway. */
    interrupted: (scanned: string, total: string) =>
      `This dig stopped at ${scanned} of ${total}, so what is here is not all of it.`,
    noDig:
      'No dig yet, so the list of finds stays empty. You can still search your collection and your wantlist, signal or not.',
    expired:
      'More than six hours old, so prices and conditions are gone. The finds and their reasons stay.',
    search: 'Artist or title',
    searchLabel: 'Search the collection, the wantlist and the finds',
    /*
     * The barcode scan (M13).
     *
     * `scanPressings` is the sentence that matters: a barcode names a release,
     * not a pressing — measured 2026-09-11, eight releases across five
     * countries for one. Anyone not reading that takes the first row for *the*
     * record.
     */
    scan: 'Read a barcode',
    scanning: 'Looking it up …',
    scanStop: 'Stop',
    scanDenied: 'The camera stayed shut. Typing works too.',
    scanNotHere:
      'This browser cannot read a barcode; Safari has no reader of its own. Type the digits instead, it finds the same thing.',
    scanOwned: (copies: string) => `You have it, ${copies} in the collection.`,
    scanWanted: 'Not in the collection. It is on your wantlist.',
    /* The album through its master (M20 #3): another pressing than the one in your hand. */
    scanOwnedAlbum: (copies: string) =>
      `You have this album, ${copies} in the collection, in another pressing.`,
    scanWantedAlbum:
      'Not in the collection. Another pressing of this album is on your wantlist.',
    scanNew: 'Not in your collection and not on your wantlist.',
    scanPressings: (n: string) =>
      `${n} pressings share this barcode. A barcode names a release, not a pressing.`,
    scanNothing: 'Discogs knows no record with this barcode.',
    identify: 'Look it up',
    identifyLabel: 'Barcode or run-out number',
    /* Both in one field: somebody holding a record does not want to decide
     * first which kind of number they are about to type. */
    identifyPlaceholder: 'Barcode, or what is etched in the run-out',
    /*
     * Which pressing this is (M19 #7). The candidates are the pressings that
     * share the code; picking the one in your hand reads it against the
     * album's whole family — two requests, for one record.
     */
    pressing: {
      pick: 'Which one are you holding? Pick it and it is read against every pressing of the album.',
      check: 'Which pressing is this?',
      reading: 'Reading the pressing …',
      noAnswer: 'Discogs did not answer, so this pressing stays unread. The list stands.',
      onlyItself: 'Discogs knows no other pressing of this, so nothing to compare it with.',
      among: (total: string, year: number) =>
        `One of ${total} pressings, and among the first: the album is from ${year}.`,
      later: (total: string, year: number) =>
        `One of ${total} pressings. The first are from ${year}:`,
      firstOnes: 'The first pressings',
      you: 'yours',
      onDiscogs: 'On Discogs',
    },
    finds: (n: number) => `${n} ${n === 1 ? 'find' : 'finds'}`,
    wrong: 'Wrong pick',
    notInLibrary: 'Not in your collection and not on your wantlist',
    norLastDig: ', and the last dig does not know it either',
    nothingByName: 'Nothing by that name.',
    pressings: (n: number) => `${n} pressings`,
    /*
     * Standing in a shop, holding a sleeve, the only question is which of the
     * two it is. Was a German ternary in the markup until 2026-08-13, which
     * the English build read out word for word.
     */
    youWant: 'On your wantlist',
    youOwn: 'Already yours',
    /*
     * A record fair (M19 #4): the shops scanned in the last day, one list per
     * stand or all of them at once. Every basket stays its own parcel — that
     * was true before and is what makes "all at once" safe.
     */
    stands: {
      all: (n: number) => `All ${n} stands`,
      chip: (name: string, finds: string) => `${name} · ${finds}`,
      line: (stands: number, finds: string) => `${stands} stands · ${finds}`,
      lead: 'The shops you dug in the last day. One list per stand, or all of them at once. Every basket stays its own parcel.',
      interrupted: (dealer: string, scanned: string, total: string) =>
        `${dealer}: stopped at ${scanned} of ${total}, so what is here from that stand is not all of it.`,
    },
  },

  /** Where the shop list comes from. */
  discovery: {
    search: 'Find shops at Discogs',
    searching: 'Looking …',
    about:
      'In your orders, where Discogs only shows us the selling side: shops that bought from you, not shops you bought at. If you allow it in the settings, in your Discogs friends list as well, and that is the half that finds anything for most people. One lookup per source, then one per candidate, to see who sells at all.',
    added: (n: number) => (n === 1 ? 'One shop added.' : `${n} shops added.`),
    take: (n: string) => `Take ${n} over`,
    listings: (n: string) => `${n} listings`,
    alreadyThere: 'already there',
    /* Per suggestion. A shop hidden here has no row yet and gets one, so the
     * next run knows to leave it out. */
    hide: 'Never suggest',
    hideWhy: 'Never suggest this shop again',
    /*
     * About the search, not about the screen.
     *
     * It read as a verdict on the whole list — reported with a screenshot in
     * which it stood directly above a shop that was there.
     */
    nothing: 'The search found no new shops.',
    whereLabel: 'Where it looks',
    friendsSummary: 'Also read my Discogs friends list?',
    /*
     * Named for what they are, not for the endpoint they came from.
     *
     * "Friends" on Discogs is a list of people, and most of them sell
     * nothing — the import keeps only the ones with records for sale, so
     * calling them shops would be a promise the list does not make.
     */
    sources: {
      order: 'From your orders (the selling side)',
      friend: 'Friends who sell records',
    },
    sourceAbout: {
      order: 'From your Discogs orders.',
      friend: 'From your friends list, kept only where somebody actually has records for sale.',
    },
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
    lead: 'Pick a record. We show you what fits it in the same shop. No sign-in.',
    listing: 'A record from a Discogs shop',
    look: 'Have a look',
    orOne: 'Or one of these:',
    moment: 'One moment …',
    fetching: 'Fetching the record …',
    reading: (page: number, pages: number) => `Reading the stock, page ${page} of ${pages}`,
    comparing: 'Comparing …',
    progress: 'Progress',
    fitsAt: (dealer: string) => `At ${dealer} this fits`,
    score: (score: number) => `Barry score ${score} out of 100`,
    nothing:
      'Nothing in this slice fitted. That happens: one record alone is a thin clue, and only part of the shop was read. With your collection it looks different.',
    /* What the demonstration cannot do, and why. Without this sentence Fidelity
     * looks thinner than it is. */
    coverage: (scanned: string, total: string) =>
      `We read ${scanned} of ${total} records, with one record as the clue. A dig reads the whole shop and knows your collection.`,
    shopLogo: (dealer: string) => `${dealer}, shop sign`,
    takesAMinute: 'Takes about a minute.',
  },

  nav: {
    label: 'Main sections',
    start: { label: 'Start', hint: "What's new, what's waiting" },
    dig: { label: 'Dig', hint: 'Dig through a shop' },
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
    compared: 'Compared',
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
