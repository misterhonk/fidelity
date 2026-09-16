import type { VaultBlocked, VaultTarget } from '#shared/types'

import { activeLanguage } from '~/composables/useMessages'
import { counted } from '~/utils/plural'

/**
 * The words for the settings, in every language, in the settings chunk.
 *
 * **Why this is not in `en.ts`.** That file is imported by the shell, so
 * everything in it lands in the first paint, which has a budget of its own. Nobody needs the wording of the vault
 * picker to see the start screen. Splitting by area puts each screen's words in
 * the chunk that screen already loads, which is where they were always going to
 * belong.
 *
 * **Why both languages live here together, unlike `en.ts` and `de.ts`.** For the
 * shell it is worth a separate chunk per language: it is on every screen, so
 * carrying the one nobody reads is pure waste on every visit. For an area it is
 * not. This file is fetched once, when somebody first opens the settings, and
 * doubling two kilobytes there is cheaper than the machinery a second dynamic
 * import per area would need — an await in every page, a second loading path,
 * and a flash to get wrong. The translation also reads better next to its
 * original.
 */

const en = {
  appearance: {
    title: 'Appearance',
    /*
     * The language is named first, and it is named at all, because the person
     * who commissioned the switch could not find it. The picker is the top
     * section of this page — but this line used to read "light or dark, and in
     * which type", which sounds like a complete list, so nobody looking for a
     * language had any reason to open it. A row that enumerates what is behind
     * it has to enumerate all of it.
     */
    hint: 'Language, light or dark, and in which type',

    theme: {
      title: 'Theme',
      system: { label: 'System', about: 'Follows the device, including the switch at dusk.' },
      light: { label: 'Light', about: 'For daylight, and for paper lists next to the screen.' },
      dark: { label: 'Dark', about: 'The default. Covers glow on a dark ground.' },
      /** Appended to the "System" description so the word says what it means today. */
      following: (resolved: 'light' | 'dark') =>
        `On this device that is ${resolved === 'dark' ? 'dark' : 'light'} right now.`,
    },

    language: {
      title: 'Language',
      about: 'Picked from your device the first time. Change it here and it stays changed.',
      /** The switch is a set of radios, so it needs a name for a screen reader. */
      legend: 'Interface language',
    },
  },

  title: 'Settings',
  lead: 'Everything you set up once and then leave alone.',
  /** The way back, on every subpage. */
  back: 'Settings',

  account: {
    lead: 'Only your token, on this device.',
    title: 'Account',
    hint: 'Your Discogs token, and what is kept on this device',
    discogsAccount: 'Discogs account',
    dataLives: 'Data lives',
    inThisBrowser: 'in this browser, on this device',
    used: 'Used',
    /* Chrome books every cached cover at ~7 MB; the data and the cache are told apart. */
    usedLine: (data: string, covers: string) => `${data} of data · ${covers} covers cached`,
    protected: 'protected from being cleared',
    signOut: 'Sign out',
    signOutWarning:
      'Signing out deletes the database with it — token, collection, horizon and digs. There is no copy anywhere else. Export first if you want to keep it.',
  },
  library: {
    lead: 'What Fidelity knows from Discogs. The ground everything else stands on.',
    title: 'Collection',
    hint: 'Collection, wantlist, horizon and credits',
    /**
     * Given already-formatted numbers, not raw ones.
     *
     * The packs deliberately do not reach for `count()`: `money.ts` reads the
     * active locale from the language module, so a pack that formatted its
     * own numbers would close a circle between the two. Formatting is the
     * caller's job; wording is this file's.
     */
    summary: (records: string, wants: string) => `${records} records · ${wants} wanted`,

    /** Collection and wantlist: the first thing that has to be there. */
    fetch: {
      title: 'Collection and wantlist',
      collection: 'Collection',
      wantlist: 'Wantlist',
      lastSynced: 'Last synced',
      fetching: 'Fetching …',
      progress: (what: string, stored: number, total: number) =>
        `${what}: ${stored} of ${total}`,
      start: 'Sync collection',
      again: 'Sync again',
    },

    horizon: {
      title: 'Horizon',
      about: 'Your collection, unfolded once. After that no dig costs any extra lookups.',
      /*
       * "Entities" and "release ids" are words from the inside. A collector
       * has artists and labels, and records. The numbers are the same
       * numbers; only the words changed.
       */
      entities: 'Artists and labels',
      ofTotal: (done: number, total: number) => `${done} of ${total}`,
      knownRecords: 'Records known',
      /*
       * Time, not requests. This said "another 240 requests, so about 5
       * minutes" — the number somebody plans around is the second one, and
       * the first is a unit from inside the machine.
       */
      remaining: (minutes: number) =>
        `About ${counted(minutes, 'minute', 'minutes')} to go. It runs in small bites and survives a reload — nothing already done is fetched twice.`,
      stale: (entries: number) =>
        `${counted(entries, 'entry is', 'entries are')} older than 30 days. Those get refreshed bit by bit, a small helping each day.`,
      records: 'records',
      eta: (clock: string) => `about ${clock} left`,
      build: 'Build the horizon',
      refresh: 'Refresh the horizon',
      /*
       * When it last went through to the end — asked for by name.
       *
       * A tester on 2026-09-13: "it would be good if it said *last successful
       * horizon build on … at …*". He was right, and for a sharper reason than
       * curiosity: the two numbers above say how much exists, and nothing said
       * whether a run had ever finished. A horizon at 312 of 690 looks the same
       * whether it stopped an hour ago or in July.
       */
      lastBuilt: (when: string) => `Last built through on ${when}`,
      neverBuilt:
        'Never built all the way through yet. What is here came from interrupted runs, from the daily refresh and from what digs turned up.',
      /*
       * Said while it runs, because the opposite was being read into it.
       *
       * Reported as "the build is aborted as soon as I leave the tab, and I
       * cannot see why". Nothing was aborted — the run lives in the worker and
       * the bar lived on the page, so leaving took the bar and left the run.
       */
      keepsRunning:
        'Carries on if you leave this screen — the build runs in the background, not on this page.',
    },

    /*
     * The radar (M29): bands you own nothing by.
     *
     * Asked for as "Exit North — I think they are great, have no record by
     * them, but I would like to be shown one if it turns up." The word
     * "follow" is avoided: it means a feed somewhere else. This is a list of
     * names the matcher is allowed to recognise.
     */
    radar: {
      title: 'On your radar',
      about: 'Bands you have nothing by — and would like to be shown.',
      lead: 'A dig matches against what is on your shelf. These are the names it should recognise anyway: nothing of theirs is here yet, and that is the point.',
      empty: 'Nobody on the radar yet. Search below and add one.',
      searchLabel: 'Find a band',
      searchPlaceholder: 'Exit North',
      search: 'Search',
      add: 'Put on the radar',
      onIt: 'On the radar',
      remove: 'Take off',
      noHits: 'Nobody of that name at Discogs.',
      /*
       * The list is a list of names until the horizon has expanded them.
       *
       * Without the expansion the engine knows only the exact spelling on a
       * listing — no other spelling, no alias, and no idea which records are
       * theirs. One or two lookups each, and the horizon card is the next one
       * up this page.
       */
      needsHorizon:
        'Each of these is one or two lookups the next time the horizon is built or refreshed — that is what turns a name into the records behind it.',
      toHorizon: 'To the horizon',
    },

    credits: {
      title: 'Credits',
      about: 'Who made your favourite records — producers, engineers, remixers.',
      lead: 'Who produced, mixed and mastered — read from your favourite records, the four- and five-star ones.',
      whyLabel: 'Why only the favourites',
      why: 'Credits only appear in the per-record lookup. Going through the whole collection would take hours — the rated ones are a fraction of that and say the most about you.',
      noFavourites:
        'No record rated four or five stars yet. Give some ratings on Discogs and I will know where to look.',
      read: (read: string, total: string) => `${read} of ${total} favourites read`,
      worthExpanding: (people: number) =>
        `${people === 1 ? 'person turns' : 'people turn'} up often enough to join the horizon`,
      remaining: (records: number, minutes: number) =>
        `${counted(records, 'record', 'records')} to go — about ${counted(minutes, 'minute', 'minutes')}. It runs in small bites and survives a reload.`,
      people: 'people',
      harvest: 'Read the credits',
      continue: 'Keep reading',
    },
  },
  search: {
    lead: 'Applies to every dig.',
    title: 'Search',
    hint: 'What is looked for, and where the shops come from',
    unrestricted: 'No restrictions',
    upTo: (price: string) => `up to ${price}`,
    originalsOnly: 'originals only',
    countriesBlocked: (blocked: number) =>
      blocked === 1 ? '1 country blocked' : `${blocked} countries blocked`,

    filter: {
      title: 'What is looked for',
      about: 'What never shows up at all, and what only lands further down.',

      /**
       * docs/04 §2 is emphatic that a criterion is either a filter or a
       * dampener, never both — otherwise the dampener is dead code. These two
       * legends are the interface saying which is which, because "is discarded"
       * and "counts for less" are very different promises and somebody setting
       * a maximum price deserves to know which one they just made.
       */
      hard: 'Hard — what never shows up at all',
      soft: 'Soft — what still shows up, but further down',

      formats: 'Formats',
      formatsHint:
        'Nothing selected means everything counts. Discogs writes vinyl as 12", 2xLP or 7" — all of those are read.',

      maxPrice: 'Maximum price',
      noLimit: 'no limit',
      maxPriceHint: 'Anything above is discarded.',

      minRating: 'Seller rating at least',
      minRatingHint: 'Below that, no dig starts.',

      shipsTo: 'Where it ships to',
      shipsToHint:
        'Decides the postage: shops write their prices by destination ("Germany:", "Europe:", "Non-Europe:"), and only the block that belongs to you is read. In English, the way Discogs writes it.',

      blocked: 'No shipping from these countries',
      blockedPlaceholder: 'Search for a country',
      blockedSearch: 'Search for a country to block',
      unblock: (country: string) => `Stop blocking ${country}`,
      blockedHint: 'Useful against customs and three weeks of waiting.',

      condition: 'Condition from',
      conditionHint: 'Anything worse counts for 40 %, but does not disappear.',
      /*
       * Where "listen" goes (M31). Named as a search, because that is what it
       * is: Fidelity cannot know Spotify's id for a record without asking
       * Spotify, and asking needs an account and a key.
       */
      listen: 'Listen at',
      listenNone: 'Nowhere',
      listenHint: 'A record then carries a link to that service’s search.',

      targetPrice: 'Comfortable price',
      targetPriceAny: 'no preference',
      targetPriceHint:
        'Above that a find counts for 55 % — and that is also the ceiling up to which the basket makes suggestions.',

      preferOriginals: 'Prefer original pressings',
      preferOriginalsHint: 'Reissues then count for less.',
      preferOriginalsWhyLabel: 'Dampened rather than discarded',
      preferOriginalsWhy:
        'Whether a record is a reissue is something Discogs only says in the per-record lookup — and that runs after the scan, over the best fifty. So discarding could not discard anything.',

      saved: 'Saved. Applies from the next dig.',
      countryPlaceholder: 'Germany',
    },

    dealers: {
      title: 'Where the shops come from',
      about: 'Which sources the import may read.',
      ordersAlways:
        'Orders are always read. Measured on 2026-09-11: that endpoint is the selling side, so for anybody who only buys it finds nothing — the friends list is the half that works.',
      friends: 'Read the Discogs friends list as well',
      friendsOff: 'Off until you switch it on.',
      /*
       * Said only while it is on, because the line above it describes the
       * default and kept saying "off until you switch it on" to somebody who
       * already had. Names the price of the exception every time it is read.
       */
      friendsOn: 'On. Friends with records for sale are searched too.',
      whyLabel: 'Why this one is an exception',
      why: 'Otherwise this app uses only officially documented Discogs interfaces.',
      whyAfter:
        'is not one — it works, but appears in no documentation and can disappear without notice. If it does, the import loses one source and nothing else. Hence: off until you agree.',
    },
  },
  sync: {
    lead: 'Encrypted, so where it is kept does not matter.',
    title: 'Sync devices',
    hint: 'An encrypted vault for phone and desktop',
    /**
     * `satisfies`, so a new vault target cannot be added without a name for
     * it. The settings index used to hold this table and a local
     * `Record<VaultTarget, string>` annotation; moving the words here would
     * otherwise have quietly dropped that check.
     */
    targets: {
      none: 'Off',
      hub: 'Your hub',
      file: 'A file in a sync folder',
      dropbox: 'Dropbox',
      drive: 'Google Drive',
    } satisfies Record<VaultTarget, string>,
  },

  /** Settings → Sync devices. */
  /*
   * The audio preview (ADR-012) — a named exception, so visible and
   * switchable.
   */
  audio: {
    label: 'Listen to a record',
    off: 'Off. Nothing is loaded from Google.',
    on: 'On. Records with clips carry a play button — and it only talks to Google once you tap it.',
    whyLabel: 'What happens then',
    why: 'Discogs has one source of sound: YouTube. So a preview means embedding Google. Your collection, wantlist and token stay on this device — what Google learns is this device’s address and which record is playing. Nothing is loaded until you tap Listen, not even with this switch on.',
  },

  vault: {
    targets: {
      none: { label: 'This device only', hint: 'Nothing leaves the browser.' },
      hub: { label: 'Your hub', hint: 'Encrypted, on your own server.' },
      file: { label: 'A file in a sync folder', hint: 'iCloud, Dropbox or Drive carry it.' },
      cloud: { hint: 'With your own app registration.' },
    },

    /** Why the chosen destination cannot be used right now. */
    blocked: {
      'no-hub': 'No hub set — the address lives in Settings under Hub.',
      'signed-out': 'Sign in first: the vault belongs to your Discogs account.',
      'not-built': 'This destination does not exist yet.',
      // `satisfies`, so a new reason cannot appear in the worker without a
      // sentence for it here.
    } satisfies Record<VaultBlocked, string>,

    clientId: (provider: string) => `Client ID from ${provider}`,
    redirect: (uri: string) => `As the redirect URL, enter ${uri}.`,
    /*
     * What the provider's registration form expects, so nobody has to guess.
     *
     * Stood in `CLOUD_PROVIDERS` (`app/utils/cloud-vault.ts`) until the
     * 2026-09-10, in German — and rendered directly beside `redirect()` above,
     * so one sentence was English and the half before it was not.
     */
    providerHint: {
      dropbox: 'Scoped access, App folder, then enter the app key.',
      drive: 'An OAuth client id of type “Web application”, with the Drive API enabled.',
    },
    /*
     * Said because it is the one rename somebody cannot fix from here: the
     * redirect URL lives in a registration at Dropbox or Google. The old one
     * still works — the app and the server both send it on, query and all —
     * so nobody has to touch a working setup.
     */
    redirectMoved:
      'Set this up before August 2026? The address then ended in /einstellungen/abgleich. It still works — nothing to change.',
    connect: (provider: string) => `Connect to ${provider}`,
    connected: 'Connected.',
    connectedTo: (provider: string) => `Connected to ${provider}.`,
    disconnect: 'Disconnect',

    pickFile: 'Choose a file',
    otherFile: 'A different file',

    passphrase: 'Passphrase',
    // The one thing nobody can recover for you, said before it matters rather
    // than after.
    passphraseHint: 'The same on every device. It is stored nowhere — forgotten means gone.',
    remember: 'Remember on this device',
    rememberHint: 'Then Fidelity syncs by itself when you open it.',
    rememberWhyLabel: 'Is that not the key next to the lock',
    rememberWhy:
      'No — the lock is on the copy far away. This database here is unencrypted and always was: collection, shortlist and the Discogs token are already in it. Putting the passphrase beside them gives nobody anything that holding the device does not already give. On a shared computer that is a different question — then leave the box unticked and type it each time.',

    syncing: 'Syncing …',
    syncNow: 'Sync now',
    setUp: 'Set up',
    merged: (entries: number) => `Merged: ${counted(entries, 'entry', 'entries')}.`,
    firstBackup: (entries: number) =>
      `Backed up for the first time: ${counted(entries, 'entry', 'entries')}.`,
    /*
     * The one case that looks like a first setup and is not.
     *
     * Since the slot is derived from the passphrase, a different word moves the
     * slot as well — and the honest reading of "nothing was there" is then
     * "you are looking somewhere else", not "you have never done this". Saying
     * "first backup" here would let two devices drift apart with nothing
     * anywhere looking broken.
     */
    emptySlot: (entries: number) =>
      `Nothing was there, though this device has synced before — so ${counted(entries, 'entry', 'entries')} went up as a fresh backup. If you changed your passphrase, the older one is still under the old word: enter it again and sync once to bring the two together.`,
    lastSynced: (when: string) => `Last synced on ${when}.`,

    /*
     * The file you carry yourself (M29).
     *
     * Reported as "why is there no iCloud option in Safari?" It was never
     * about iCloud: the automatic file destination keeps a handle from the
     * File System Access API, which is what lets the file be chosen once, and
     * WebKit has none of it. This is the same round with two taps instead of
     * none — and it works in every browser there is.
     */
    byHand: {
      title: 'Or by hand, as a file',
      about:
        'One round without choosing a destination: read the file the other device wrote, and save a fresh one. Useful for a single transfer, or for a device that is not set up.',
      aboutWebkit:
        'This browser has no way to write to a file on its own, which is why "file in a sync folder" is not offered above — Safari lacks the API it needs, and that is the whole reason there is no iCloud entry. By hand it works: save the file into iCloud Drive yourself, and pick it here on the other device.',
      file: 'The file from the other device',
      fileHint: 'Leave empty on the first device — there is nothing to read yet.',
      run: 'Merge and save a file',
      saved: 'The file has been saved — put it where the other device can reach it.',
    },

    scopeWhyLabel: 'What travels and what does not',
    scopeWhy:
      'With: horizon, shortlist, basket, shops with their postage tiers, settings. Not with: your Discogs token — one key on three devices is three times the surface, and each device signs itself in once. And no digs: prices are deleted after six hours anyway and have no business on a server.',
  },

  /** Settings → Hub. */
  hubPanel: {
    whyLabel: 'What a hub gives you',
    why: 'The horizon — everything Fidelity has worked out about your artists and labels — then does not have to be built again on every device. What is in it once is there immediately on the next device instead of after minutes. The same goes for postage per shop. And if friends use the same hub, you all work for each other.',
    optional: 'Everything works the same without a hub — it only takes waiting away.',

    url: 'Hub URL',
    door: 'Access key or shared secret',
    removeDoor: 'Remove',
    notYourToken:
      'Not your Discogs token — that never leaves this device. A key starts with “fk1.” and opens a hosted hub and catalogue; anything else is the secret of your own hub.',

    save: 'Save',
    test: 'Test the connection',
    discover: 'Look here',

    found: 'One is running on this machine — address filled in. Save it now.',
    /*
     * Two answers, because the two situations ask different things of the
     * reader. An open hub beside the app is finished business — saying it was
     * kept is the whole message. A secured one needs a word that cannot be
     * discovered, and the sentence has to say where that word comes from, or
     * somebody types their Discogs token into it.
     */
    /*
     * Without "here" or "on this page".
     *
     * The search reaches two quite different places — the same domain and this
     * machine — and a sentence naming one of them is simply wrong in the other
     * case. The address is a line further down in the field anyway, and says
     * it more precisely than a sentence could.
     */
    foundAndKept: 'Found one and kept it — nothing else to do.',
    foundSecured:
      'Found one, and it asks for a shared secret: the word whoever set the hub up chose for it. Enter it below, then save.',
    // Measured 2026-08-10: from an https page Chromium reaches http://localhost
    // and WebKit refuses outright. On an iPhone a hub that is running perfectly
    // well is simply unreachable this way, and "nothing found" would send
    // somebody debugging a service that has no fault.
    blockedByMixedContent:
      'Not reachable from here: this page runs over HTTPS, and Safari refuses any connection from there to an unencrypted localhost. It works in Chrome. The lasting fix is to make the hub itself reachable over HTTPS.',
    notFound:
      'None running on this machine. Enter the address by hand if it is somewhere else.',
    searchFailed: 'Cannot search.',

    reachable: 'Reachable',
    horizonEntries: (entries: number) =>
      `${counted(entries, 'entry', 'entries')} in the shared horizon`,
    shippingTiers: (tiers: number) => counted(tiers, 'postage tier', 'postage tiers'),
    secured: 'secured with a secret',
    open: 'open',
    showDoor: 'Show it',
    hideDoor: 'Hide it',
    secretOk: 'the secret opens it',
    secretWrong: 'the hub refuses this secret — nothing you contribute or fetch gets through',
    secretMissing: 'no secret entered — nothing you contribute or fetch gets through',
    /** The second door (docs/17 §3.2): a hub that takes access keys. */
    keyOk: 'your access key opens it',
    keyWrong: 'the hub refuses your access key — expired, revoked, or not for this hub',
    keyMissing: 'this hub takes access keys and none is entered',
  },

  /** Settings → Access (docs/17 §6.2). */
  /** What a key says, on the hub screen (M26.3: the key and the secret share one field). */
  accessPanel: {
    notAKey: 'That does not read as an access key.',
    /** Given the tier’s name and a formatted date. */
    reads: (tier: string, until: string) => `${tier} · valid until ${until}`,
    expired: 'expired — ask for a fresh one',
    saved: 'Saved. The hub and the catalogue get it with every request from now on.',
    removed: 'Removed. Your own hub works as before; a hosted one is closed to you now.',
  },

  /**
   * The tier as a name, for the access screen’s line.
   *
   * This was Settings › Support with the plans and tips of docs/17 §6.3 until
   * 2026-09-12. Taken out again on Martin’s call: a list of prices with no way
   * to pay is a promise the app cannot keep yet. It returns with the provider.
   */
  supportPanel: {
    tierName: (tier: string) =>
      ({
        beta: 'Beta key',
        seven: 'A 7"',
        lp: 'An LP',
        double: 'A double album',
        first: 'The first pressing',
        test: 'The test pressing',
      })[tier] ?? tier,
  },

  /**
   * Settings → Hub → Catalogue (ADR-013, docs/16).
   *
   * Public data with no door, so no secret and no "kept without asking" —
   * a found one is filled in and tested, and Save is one tap away.
   */
  cataloguePanel: {
    whyLabel: 'What a catalogue gives you',
    why: 'Discogs publishes its whole database once a month. A catalogue is that month, read once, answering what the API answers slowly or not at all: every pressing of an album at once, every record a producer touched, a barcode without a single request. Nothing of yours goes there — it only knows the records.',
    optional: 'Everything works the same without one — it only takes waiting away.',

    url: 'Catalogue URL',
    save: 'Save',
    test: 'Test the connection',
    discover: 'Look here',

    found: 'Found one — address filled in. Save it now.',
    notFound:
      'None running on this machine. Enter the address by hand if it is somewhere else.',
    searchFailed: 'Cannot search.',

    reachable: 'Reachable',
    build: (date: string) => `built ${date}`,
    /** Given an already-formatted number, as the note at `summary` says. */
    releases: (count: string) => `${count} releases`,
  },

  /** Settings → Your data. */
  dataPanel: {
    exportAll: 'Export everything',
    /*
     * The way back (M24). Rows merge into what is here; the digs stay out
     * because the file never had their prices; a file from before the row
     * shape settled brings the shops and ratings and asks for a sync.
     */
    importAll: 'Read a backup back in',
    importing: 'Reading …',
    importReport: (rows: string) => `Read: ${rows}.`,
    importNothing: 'Nothing in the file to read back.',
    importStore: {
      collection: 'collection',
      wantlist: 'wantlist',
      dealers: 'shops',
      feedback: 'ratings',
      basket: 'basket',
      places: 'places',
      placements: 'where records sit',
      valueHistory: 'the estimate over time',
    } as Record<string, string>,
    importSkippedPrices: (digs: string) =>
      `${digs} digs stayed out: a backup carries no prices, and a dig without them is a heading over nothing.`,
    importSkippedOld:
      'The shelf and the wantlist in this file are from before the row shape settled — sync again and they are back.',
    importMeta:
      'Settings and the taste profile came from the file, because this device had none.',
    exportDig: 'Last dig as a file',
    // Said before the file exists, not after. Somebody exporting a dig to send
    // to a friend needs to know what is in it *while deciding to send it*.
    contents:
      "Neither file holds your token, prices or conditions — marketplace data may not be passed on under Discogs' terms. What is in there: which records fit how well and why, with a link to each listing.",
    noDigYet: 'No dig yet that could be exported.',

    /*
     * CSV (M19 #5). Named for what the sheet gets that Discogs' own export
     * lacks — and for what it does not get, because "no prices" is the line
     * somebody expecting a valuation needs to read before opening the file.
     */
    exportCollectionCsv: 'Collection as CSV',
    exportWantlistCsv: 'Wantlist as CSV',
    csvContents:
      'For a spreadsheet. Every column Discogs’ own export leaves out — genres, styles, release and master ids — plus what is yours alone: rating, folder, the condition fields and the place a record sits in. No prices and no estimate: those are marketplace data and stay in the app.',

    deleteAll: 'Delete everything',
    deleteWarning:
      'Deletes the whole database on this device: token, collection, horizon, digs, basket and ratings. There is no copy anywhere else and no way back.',
    deleteConfirm: 'Yes, delete everything',
    cancel: 'Cancel',
  },
  /** The key's end on the index line, beside the hub's host (M26.3: one door). */
  access: {
    /** Given a formatted date. */
    until: (date: string) => `until ${date}`,
    expired: 'expired',
  },
  hub: {
    lead: 'A helper on your own network. It remembers what was already worked out.',
    title: 'Hub',
    hint: 'An optional helper on your own network',
    notSetUp: 'Not set up',
    catalogue: 'Catalogue',
    // A hub address that will not parse is worth showing as such rather than
    // hiding behind "not set up" — the setting is set, it is wrong.
    unreadable: 'Address unreadable',
  },
  data: {
    lead: 'Take it with you, or be rid of it.',
    title: 'Your data',
    hint: 'Export it, or delete all of it',
  },
  help: {
    lead: 'How Fidelity works, what the scores mean, and where your data lives.',
    title: 'Help',
    hint: 'How this works, and what the scores mean',
  },

  /**
   * The manual, in the app instead of on a website.
   *
   * Questions rather than headings, because that is the shape somebody arrives
   * in. Each answer is short enough to read standing up, and the ones that cost
   * lookups say so in minutes.
   */
  chapters: [
    {
      title: 'How do I start?',
      body: [
        'You need a personal access token from Discogs — you make one yourself under "Settings → Developers". After that Fidelity fetches your collection and your wantlist once. That is the ground everything stands on: without it the app does not know what you like.',
        'Then, under "Dig", you name a shop — their name, or simply the link to their Discogs page. Fidelity reads their stock and tells you what in it fits you.',
      ],
    },
    {
      title: 'What does the number next to a record mean?',
      body: [
        'It says how well that record fits your collection — from 0 to 100. Eleven different signals feed into it: an artist you collect, a wish on your wantlist, a label you follow, a gap in a catalogue run, somebody who appears in the small print of your favourite records.',
        'The strongest signal counts in full, the rest at 30 per cent each. So a record with one very good reason beats one with three weak ones — the way a person would do it too.',
        'Under each record is a sentence saying why. If the sentence does not convince you, the number is worth nothing either. Tap the record and you see every single signal with its evidence.',
      ],
    },
    {
      title: 'Why does a dig take so long?',
      body: [
        'Discogs allows only a limited number of lookups per minute, and Fidelity keeps to it — one request after another, with a gap. So a shop with three thousand records is a few minutes.',
        'You can walk away meanwhile. The progress is kept even if you close the tab: next time you open it, the app offers to carry on from there.',
        'For shops you have searched before there is "only what is new" — that reads only what has arrived since your last visit, and is usually done in seconds.',
      ],
    },
    {
      title: 'Why do the prices disappear after a few hours?',
      body: [
        'Because we are not allowed to keep them longer. Discogs permits its marketplace data to be used only for a short time, and Fidelity keeps to that without exception.',
        'The finds and the reasons stay — we worked those out ourselves. Only the prices and conditions go. In the basket, "Still there?" brings everything up to date.',
      ],
    },
    {
      title: 'Why one basket per shop?',
      body: [
        'Because postage is charged per parcel, not per record. Two records at two shops is postage twice; two records at one shop is often postage once.',
        "So every basket does its own arithmetic: subtotal, postage tier, and what each further record actually costs. Buying happens at Discogs — Fidelity puts nothing in anybody else's cart.",
      ],
    },
    {
      title: 'What is the horizon?',
      body: [
        'Everything Fidelity has worked out about your artists and labels — not only what is on your shelf. With it the app recognises other pressings of the same record, gaps in catalogue runs, and albums you do not know yet.',
        'It is built once and only kept up to date afterwards. Everything works without it, but the more interesting finds stay invisible.',
      ],
    },
    {
      title: 'And the credits?',
      body: [
        'From the records you rated four or five stars on Discogs, Fidelity reads out who made them: producers, remixers, studio people.',
        'When the same person turns up often, the app later finds records their name is not on the front of. That is the difference between "search by artist" and somebody who knows the shop.',
      ],
    },
    {
      title: 'Where is my data?',
      body: [
        "On this device, in your browser's storage. There is no server it could go to — Fidelity is nothing but files running in your browser.",
        'Your Discogs token stays here as well. It is never written into an address, never logged, and never passed to anybody.',
        'Fidelity only reads. It changes nothing about your Discogs account, buys nothing and writes nothing back.',
      ],
    },
    {
      title: 'How do I get all of it onto my phone?',
      body: [
        'Under "Sync devices". Your data is encrypted on this device and put away as a single block — in your hub, in a sync folder, at Dropbox or at Google Drive, as you prefer. Only your devices can open it again.',
        'Or simply set the phone up afresh. Everything except your own judgements can be fetched from Discogs again.',
      ],
    },
    {
      title: 'Does it work without a network?',
      body: [
        'For looking things up, yes. Collection, wantlist, map and the last lists of finds are on the device. The "In the shop" screen exists exactly for this: with the record in your hand, check whether you already have it — record shops are basements.',
        'New digs need a network, because the shop has to be read for one.',
      ],
    },
    {
      title: 'Something is wrong',
      body: [
        'Under "Your data" you can export everything or delete everything. Deleting removes the token too — after that the device is empty and you can start over. Nothing is lost that could not be fetched from Discogs again.',
        'If the app says Discogs cannot be reached although you are online: usually the lookup budget is spent for the moment. Waiting a few minutes helps.',
      ],
    },
  ],

  /**
   * The end of the manual.
   *
   * Was hardcoded German in the page itself, and one of its sentences had been
   * half-translated into "wie eine Punktzahl comes about" — a clause that is a
   * sentence in neither language. Prose belongs in a pack for exactly this
   * reason: a string nobody can see from here is a string nobody proofreads.
   */
  closing: {
    title: 'Still a question open?',
    body: 'Fidelity is open to read — how it calculates is in the code, and why it calculates that way is in the documents beside it. Anyone who wants to know exactly how a score comes about will find it written down there in full.',
    disclaimer: 'This application uses the Discogs API but is not connected with Discogs.',
  },
}

/** Same shape, enforced. A missing key here is a build error, as everywhere. */
const de: typeof en = {
  appearance: {
    title: 'Darstellung',
    hint: 'Sprache, hell oder dunkel, und in welcher Schrift',

    theme: {
      title: 'Thema',
      system: {
        label: 'System',
        about: 'Folgt dem Gerät, samt automatischem Wechsel am Abend.',
      },
      light: { label: 'Hell', about: 'Für Tageslicht und für Papierlisten daneben.' },
      dark: { label: 'Dunkel', about: 'Die Voreinstellung. Cover leuchten auf dunklem Grund.' },
      following: (resolved) =>
        `Auf diesem Gerät gerade ${resolved === 'dark' ? 'dunkel' : 'hell'}.`,
    },

    language: {
      title: 'Sprache',
      about: 'Beim ersten Mal vom Gerät übernommen. Hier geändert, bleibt sie geändert.',
      legend: 'Sprache der Oberfläche',
    },
  },

  title: 'Einstellungen',
  lead: 'Alles, was man einmal einrichtet und danach in Ruhe lässt.',
  back: 'Einstellungen',

  account: {
    lead: 'Nur dein Token, auf diesem Gerät.',
    title: 'Konto',
    hint: 'Dein Discogs-Token und was auf diesem Gerät liegt',
    discogsAccount: 'Discogs-Konto',
    dataLives: 'Daten liegen',
    inThisBrowser: 'in diesem Browser, auf diesem Gerät',
    used: 'Belegt',
    usedLine: (data, covers) => `${data} Daten · ${covers} Cover im Cache`,
    protected: 'vor Aufräumen geschützt',
    signOut: 'Abmelden',
    signOutWarning:
      'Abmelden löscht die Datenbank mit — Token, Sammlung, Horizont und Digs. Es gibt keine Kopie woanders. Vorher exportieren, wenn du sie behalten willst.',
  },
  library: {
    lead: 'Was Fidelity von Discogs weiß. Grundlage für alles Weitere.',
    title: 'Sammlung',
    hint: 'Sammlung, Wantlist, Horizont und Credits',
    summary: (records, wants) => `${records} Platten · ${wants} Wünsche`,

    fetch: {
      title: 'Sammlung und Wantlist',
      collection: 'Sammlung',
      wantlist: 'Wantlist',
      lastSynced: 'Zuletzt synchronisiert',
      fetching: 'Wird geholt …',
      progress: (what, stored, total) => `${what}: ${stored} von ${total}`,
      start: 'Sammlung synchronisieren',
      again: 'Neu synchronisieren',
    },

    horizon: {
      title: 'Horizont',
      about:
        'Deine Sammlung einmal ausgeklappt. Danach kostet jeder Dig keine zusätzlichen Abfragen.',
      entities: 'Künstler und Labels',
      ofTotal: (done, total) => `${done} von ${total}`,
      knownRecords: 'Bekannte Platten',
      remaining: (minutes) =>
        `Dauert noch rund ${counted(minutes, 'Minute', 'Minuten')}. Läuft in Häppchen und übersteht ein Neuladen – was schon fertig ist, wird nicht noch einmal geholt.`,
      stale: (entries) =>
        `${counted(entries, 'Eintrag ist', 'Einträge sind')} älter als 30 Tage. Die werden nach und nach aufgefrischt, ein kleines Kontingent pro Tag.`,
      records: 'Platten',
      eta: (clock) => `noch ca. ${clock}`,
      build: 'Horizont bauen',
      refresh: 'Horizont auffrischen',
      lastBuilt: (when) => `Zuletzt vollständig gebaut am ${when}`,
      neverBuilt:
        'Noch nie ganz durchgelaufen. Was da ist, stammt aus abgebrochenen Läufen, aus der täglichen Auffrischung und aus dem, was Digs gefunden haben.',
      keepsRunning:
        'Läuft weiter, wenn du diesen Bildschirm verlässt — der Bau läuft im Hintergrund, nicht auf dieser Seite.',
    },

    radar: {
      title: 'Auf dem Schirm',
      about: 'Bands, von denen du nichts hast – und die trotzdem vorkommen sollen.',
      lead: 'Ein Dig prüft gegen das, was im Regal steht. Das hier sind die Namen, die er trotzdem erkennen soll: von denen steht noch nichts da, und genau darum geht es.',
      empty: 'Noch niemand auf dem Schirm. Such unten jemanden und nimm ihn auf.',
      searchLabel: 'Band suchen',
      searchPlaceholder: 'Exit North',
      search: 'Suchen',
      add: 'Auf den Schirm',
      onIt: 'Steht drauf',
      remove: 'Runter',
      noHits: 'Niemanden dieses Namens bei Discogs gefunden.',
      needsHorizon:
        'Jeder davon kostet ein bis zwei Abfragen, wenn der Horizont das nächste Mal gebaut oder aufgefrischt wird – das ist es, was aus einem Namen die Platten dahinter macht.',
      toHorizon: 'Zum Horizont',
    },

    credits: {
      title: 'Credits',
      about: 'Wer deine Lieblingsplatten gemacht hat – Produzenten, Engineers, Remixer.',
      lead: 'Wer produziert, gemischt und gemastert hat – gelesen aus deinen Lieblingsplatten, vier und fünf Sterne.',
      whyLabel: 'Warum nur die Lieblingsplatten',
      why: 'Credits stehen nur in der Einzelabfrage pro Platte. Die ganze Sammlung durchzugehen wäre stundenlang – die bewerteten sind ein Bruchteil davon und sagen am meisten über dich.',
      noFavourites:
        'Noch keine Platte mit vier oder fünf Sternen bewertet. Vergib die bei Discogs, dann weiß ich, wo ich nachsehen soll.',
      read: (read, total) => `${read} von ${total} Lieblingsplatten gelesen`,
      worthExpanding: (people) =>
        `${people === 1 ? 'Person taucht' : 'Personen tauchen'} oft genug auf, um in den Horizont zu wandern`,
      remaining: (records, minutes) =>
        `Noch ${counted(records, 'Platte', 'Platten')} – rund ${counted(minutes, 'Minute', 'Minuten')}. Läuft in Häppchen und übersteht ein Neuladen.`,
      people: 'Personen',
      harvest: 'Credits lesen',
      continue: 'Weiterlesen',
    },
  },
  search: {
    lead: 'Gilt für jeden Dig.',
    title: 'Suche',
    hint: 'Wonach gesucht wird und woher die Läden kommen',
    unrestricted: 'Ohne Einschränkung',
    upTo: (price) => `bis ${price}`,
    originalsOnly: 'nur Originale',
    countriesBlocked: (blocked) =>
      blocked === 1 ? '1 Land gesperrt' : `${blocked} Länder gesperrt`,

    filter: {
      title: 'Wonach gesucht wird',
      about: 'Was gar nicht erst auftaucht, und was nur weiter unten landet.',

      hard: 'Hart — was gar nicht erst auftaucht',
      soft: 'Weich — was noch auftaucht, aber weiter unten',

      formats: 'Formate',
      formatsHint:
        'Nichts ausgewählt heißt: alles zählt. Discogs schreibt Vinyl als 12", 2xLP oder 7" – das wird mitgelesen.',

      maxPrice: 'Höchstpreis',
      noLimit: 'kein Limit',
      maxPriceHint: 'Darüber wird verworfen.',

      minRating: 'Verkäuferbewertung mindestens',
      minRatingHint: 'Darunter startet kein Dig.',

      shipsTo: 'Wohin geliefert wird',
      shipsToHint:
        'Entscheidet den Versand: Läden schreiben ihre Preise nach Zielland gestaffelt („Germany:", „Europe:", „Non-Europe:"), und gelesen wird nur der Block, der zu dir gehört. Auf Englisch, wie Discogs es schreibt — „Deutschland" versteht Fidelity auch.',

      blocked: 'Versand aus diesen Ländern nicht',
      blockedPlaceholder: 'Land suchen',
      blockedSearch: 'Land suchen, das übersprungen werden soll',
      unblock: (country) => `${country} nicht mehr überspringen`,
      blockedHint: 'Nützlich gegen Zoll und drei Wochen Wartezeit.',

      condition: 'Zustand ab',
      conditionHint: 'Schlechter zählt nur noch 40 %, verschwindet aber nicht.',
      listen: 'Reinhören bei',
      listenNone: 'Nirgends',
      listenHint: 'Eine Platte trägt dann einen Link zur Suche dieses Dienstes.',

      targetPrice: 'Wohlfühlpreis',
      targetPriceAny: 'egal',
      targetPriceHint:
        'Darüber zählt ein Treffer 55 % – und das ist auch die Grenze, bis zu der der Korb Vorschläge macht.',

      preferOriginals: 'Originalpressungen bevorzugen',
      preferOriginalsHint: 'Neuauflagen zählen dann weniger.',
      preferOriginalsWhyLabel: 'Gedämpft statt verworfen',
      preferOriginalsWhy:
        'Ob eine Platte eine Neuauflage ist, weiß Discogs erst in der Einzelabfrage – und die läuft erst nach dem Scan über die besten 50. Verwerfen könnte sie also nichts.',

      saved: 'Gespeichert. Gilt ab dem nächsten Dig.',
      countryPlaceholder: 'Deutschland',
    },

    dealers: {
      title: 'Woher die Läden kommen',
      about: 'Welche Quellen der Import lesen darf.',
      ordersAlways:
        'Bestellungen werden immer gelesen. Am 2026-09-11 gemessen: dieser Endpunkt ist die Verkaufsseite, für jemanden der nur kauft findet er also nichts – die Freundesliste ist die Hälfte, die funktioniert.',
      friends: 'Auch die Discogs-Freundesliste lesen',
      friendsOff: 'Aus, solange du es nicht einschaltest.',
      friendsOn: 'An. Freunde, die Platten anbieten, werden mitgesucht.',
      whyLabel: 'Warum das eine Ausnahme ist',
      why: 'Diese App benutzt sonst ausschließlich offiziell dokumentierte Discogs-Schnittstellen.',
      whyAfter:
        'ist keiner – er funktioniert, steht aber in keiner Dokumentation und kann ohne Ankündigung verschwinden. Passiert das, verliert der Import eine Quelle und sonst nichts. Deshalb: aus, bis du zustimmst.',
    },
  },
  sync: {
    lead: 'Verschlüsselt, damit der Speicherort keine Rolle spielt.',
    title: 'Geräte abgleichen',
    hint: 'Verschlüsselter Tresor für Handy und Rechner',
    targets: {
      none: 'Aus',
      hub: 'Dein Hub',
      file: 'Datei im Sync-Ordner',
      dropbox: 'Dropbox',
      drive: 'Google Drive',
    },
  },

  audio: {
    label: 'Platte anhören',
    off: 'Aus. Es wird nichts von Google geladen.',
    on: 'An. Platten mit Clips bekommen einen Abspielknopf – und erst beim Tippen spricht er mit Google.',
    whyLabel: 'Was dann passiert',
    why: 'Discogs hat genau eine Tonquelle: YouTube. Eine Hörprobe heißt also, Google einzubetten. Sammlung, Wantlist und Token bleiben auf diesem Gerät – was Google erfährt, ist die Adresse dieses Geräts und welche Platte läuft. Vor dem Tippen wird nichts geladen, auch mit eingeschaltetem Schalter nicht.',
  },

  vault: {
    targets: {
      none: { label: 'Nur dieses Gerät', hint: 'Nichts verlässt den Browser.' },
      hub: { label: 'Dein Hub', hint: 'Verschlüsselt auf deinem eigenen Server.' },
      file: { label: 'Datei im Sync-Ordner', hint: 'iCloud, Dropbox oder Drive tragen sie.' },
      cloud: { hint: 'Mit deiner eigenen App-Registrierung.' },
    },

    blocked: {
      'no-hub': 'Kein Hub eingetragen – die Adresse steht in den Einstellungen unter Hub.',
      'signed-out': 'Erst anmelden: der Tresor gehört zu deinem Discogs-Konto.',
      'not-built': 'Dieses Ziel ist noch nicht gebaut.',
    },

    clientId: (provider) => `Client-ID von ${provider}`,
    redirect: (uri) => `Als Redirect-URL trägst du ${uri} ein.`,
    providerHint: {
      dropbox: 'Scoped access, App folder, dann die App key eintragen.',
      drive: 'OAuth-Client-ID, Typ „Web application", Drive API aktiviert.',
    },
    redirectMoved:
      'Vor August 2026 eingerichtet? Die Adresse endete damals auf /einstellungen/abgleich. Sie funktioniert weiter – da ist nichts zu tun.',
    connect: (provider) => `Mit ${provider} verbinden`,
    connected: 'Verbunden.',
    connectedTo: (provider) => `Mit ${provider} verbunden.`,
    disconnect: 'Trennen',

    pickFile: 'Datei wählen',
    otherFile: 'Andere Datei',

    passphrase: 'Passphrase',
    passphraseHint:
      'Auf jedem Gerät dieselbe. Sie wird nirgends gespeichert – vergessen heißt weg.',
    remember: 'Auf diesem Gerät merken',
    rememberHint: 'Dann gleicht sich Fidelity beim Öffnen von selbst ab.',
    rememberWhyLabel: 'Ist das nicht der Schlüssel neben dem Schloss',
    rememberWhy:
      'Nein – das Schloss sitzt auf der Kopie in der Ferne. Diese Datenbank hier ist unverschlüsselt und war es immer: Sammlung, Merkliste und der Discogs-Token liegen längst darin. Die Passphrase daneben zu legen gibt niemandem etwas, das der Besitz des Geräts nicht ohnehin gibt. Auf einem geteilten Rechner ist das eine andere Frage – dann Haken weg und jedes Mal tippen.',

    syncing: 'Gleiche ab …',
    syncNow: 'Jetzt abgleichen',
    setUp: 'Einrichten',
    merged: (entries) => `Zusammengeführt: ${counted(entries, 'Eintrag', 'Einträge')}.`,
    firstBackup: (entries) => `Erstmals gesichert: ${counted(entries, 'Eintrag', 'Einträge')}.`,
    emptySlot: (entries) =>
      `Dort lag nichts, obwohl dieses Gerät schon einmal abgeglichen hat — ${counted(entries, 'Eintrag', 'Einträge')} sind deshalb als frische Sicherung hochgegangen. Falls du die Passphrase geändert hast: die ältere liegt noch unter dem alten Wort. Einmal damit abgleichen führt beide zusammen.`,
    lastSynced: (when) => `Zuletzt abgeglichen am ${when}.`,

    byHand: {
      title: 'Oder von Hand, als Datei',
      about:
        'Eine Runde ohne festes Ziel: die Datei lesen, die das andere Gerät geschrieben hat, und eine frische speichern. Gut für eine einzelne Übertragung oder ein Gerät, das nicht eingerichtet ist.',
      aboutWebkit:
        'Dieser Browser kann nicht von sich aus in eine Datei schreiben – deshalb steht „Datei im Sync-Ordner" oben nicht zur Wahl, und deshalb gibt es auch keinen iCloud-Eintrag: Safari fehlt die nötige API, an iCloud liegt es nicht. Von Hand geht es: Datei selbst in iCloud Drive legen und auf dem anderen Gerät hier auswählen.',
      file: 'Die Datei vom anderen Gerät',
      fileHint: 'Auf dem ersten Gerät leer lassen – es gibt noch nichts zu lesen.',
      run: 'Abgleichen und Datei speichern',
      saved: 'Die Datei ist gespeichert – leg sie dorthin, wo das andere Gerät sie findet.',
    },

    scopeWhyLabel: 'Was mitgeht und was nicht',
    scopeWhy:
      'Mit: Horizont, Merkliste, Korb, Läden mit Versandstaffeln, Einstellungen. Nicht mit: dein Discogs-Token – ein Zugangsschlüssel auf drei Geräten ist dreimal so viel Angriffsfläche, jedes Gerät meldet sich einmal selbst an. Und keine Digs: Preise sind nach sechs Stunden ohnehin gelöscht und gehören nicht auf einen Server.',
  },

  hubPanel: {
    whyLabel: 'Was ein Hub bringt',
    why: 'Den Horizont – also alles, was Fidelity über deine Künstler und Labels herausgefunden hat – muss dann nicht jedes Gerät für sich aufbauen. Was einmal drinsteht, ist auf dem nächsten Gerät sofort da statt nach Minuten. Dasselbe gilt für Versandkosten pro Laden. Und wenn Freunde denselben Hub benutzen, arbeitet ihr euch gegenseitig zu.',
    optional: 'Ohne Hub funktioniert alles genauso – er nimmt nur Wartezeit weg.',

    url: 'Hub-URL',
    door: 'Zugangsschlüssel oder Shared Secret',
    removeDoor: 'Entfernen',
    notYourToken:
      'Nicht dein Discogs-Token – der verlässt dieses Gerät nie. Ein Schlüssel beginnt mit „fk1." und öffnet einen gehosteten Hub und Katalog; alles andere ist das Secret deines eigenen Hubs.',

    save: 'Speichern',
    test: 'Verbindung testen',
    discover: 'Hier suchen',

    found: 'Auf diesem Rechner läuft einer – Adresse eingetragen. Jetzt speichern.',
    foundAndKept:
      'Auf dieser Seite läuft einer – eingetragen und behalten. Mehr ist nicht zu tun.',
    foundSecured:
      'Auf dieser Seite läuft einer. Er verlangt ein gemeinsames Geheimnis: das Wort, das derjenige gewählt hat, der den Hub aufgesetzt hat. Unten eintragen, dann speichern.',
    blockedByMixedContent:
      'Hier nicht erreichbar: diese Seite läuft über HTTPS, und Safari verweigert von dort jede Verbindung zu einem unverschlüsselten localhost. In Chrome geht es. Dauerhaft hilft nur, den Hub selbst über HTTPS erreichbar zu machen.',
    notFound:
      'Auf diesem Rechner läuft keiner. Adresse von Hand eintragen, falls er woanders steht.',
    searchFailed: 'Suche nicht möglich.',

    reachable: 'Erreichbar',
    horizonEntries: (entries) =>
      `${counted(entries, 'Eintrag', 'Einträge')} im geteilten Horizont`,
    shippingTiers: (tiers) => counted(tiers, 'Versandstaffel', 'Versandstaffeln'),
    secured: 'mit Geheimnis gesichert',
    open: 'offen',
    showDoor: 'Anzeigen',
    hideDoor: 'Verbergen',
    secretOk: 'das Geheimnis öffnet ihn',
    secretWrong:
      'der Hub weist dieses Geheimnis ab – nichts, was du beisteuerst oder holst, kommt durch',
    secretMissing:
      'kein Geheimnis eingetragen – nichts, was du beisteuerst oder holst, kommt durch',
    keyOk: 'dein Zugangsschlüssel öffnet ihn',
    keyWrong:
      'der Hub lehnt deinen Zugangsschlüssel ab – abgelaufen, zurückgezogen oder nicht für diesen Hub',
    keyMissing: 'dieser Hub nimmt Zugangsschlüssel, und keiner ist eingetragen',
  },

  dataPanel: {
    exportAll: 'Alles exportieren',
    importAll: 'Ein Backup wieder einlesen',
    importing: 'Lese …',
    importReport: (rows) => `Eingelesen: ${rows}.`,
    importNothing: 'Nichts in der Datei, das sich einlesen ließe.',
    importStore: {
      collection: 'Sammlung',
      wantlist: 'Wantlist',
      dealers: 'Läden',
      feedback: 'Bewertungen',
      basket: 'Korb',
      places: 'Orte',
      placements: 'Standorte der Platten',
      valueHistory: 'die Schätzung über die Zeit',
    } as Record<string, string>,
    importSkippedPrices: (digs) =>
      `${digs} Digs blieben draußen: Ein Backup trägt keine Preise, und ein Dig ohne sie ist eine Überschrift über nichts.`,
    importSkippedOld:
      'Sammlung und Wantlist in dieser Datei stammen von vor der festen Zeilenform – einmal synchronisieren, dann sind sie wieder da.',
    importMeta:
      'Einstellungen und Geschmacksprofil kamen aus der Datei, weil dieses Gerät keine hatte.',
    exportDig: 'Letzten Dig als Datei',
    contents:
      "Beide Dateien enthalten weder deinen Token noch Preise oder Zustände – Marktplatzdaten dürfen laut Discogs' Nutzungsbedingungen nicht weitergegeben werden. Was drinsteht: welche Platten wie gut passen und warum, mit Link zum jeweiligen Angebot.",
    noDigYet: 'Noch kein Dig da, den man exportieren könnte.',

    exportCollectionCsv: 'Sammlung als CSV',
    exportWantlistCsv: 'Wantlist als CSV',
    csvContents:
      'Für eine Tabelle. Jede Spalte, die Discogs’ eigener Export weglässt – Genres, Stile, Release- und Master-IDs – plus das, was nur deins ist: Bewertung, Ordner, die Zustandsfelder und der Ort, an dem eine Platte steht. Keine Preise und keine Schätzung: das sind Marktplatzdaten und bleiben in der App.',

    deleteAll: 'Alles löschen',
    deleteWarning:
      'Löscht die ganze Datenbank auf diesem Gerät: Token, Sammlung, Horizont, Digs, Korb und Bewertungen. Es gibt keine Kopie woanders und kein Zurück.',
    deleteConfirm: 'Ja, alles löschen',
    cancel: 'Abbrechen',
  },
  cataloguePanel: {
    whyLabel: 'Was ein Katalog bringt',
    why: 'Discogs veröffentlicht einmal im Monat seine ganze Datenbank. Ein Katalog ist dieser Monat, einmal gelesen, und beantwortet, was die API langsam oder gar nicht beantwortet: alle Pressungen eines Albums auf einen Schlag, jede Platte, an der ein Produzent beteiligt war, ein Barcode ohne eine einzige Anfrage. Nichts von dir geht dorthin – er kennt nur die Platten.',
    optional: 'Ohne Katalog funktioniert alles genauso – er nimmt nur Wartezeit weg.',

    url: 'Katalog-URL',
    save: 'Speichern',
    test: 'Verbindung testen',
    discover: 'Hier suchen',

    found: 'Einer gefunden – Adresse eingetragen. Jetzt speichern.',
    notFound:
      'Auf diesem Rechner läuft keiner. Trag die Adresse von Hand ein, wenn er woanders steht.',
    searchFailed: 'Suche nicht möglich.',

    reachable: 'Erreichbar',
    build: (date: string) => `Stand ${date}`,
    releases: (count: string) => `${count} Releases`,
  },

  accessPanel: {
    notAKey: 'Das liest sich nicht wie ein Zugangsschlüssel.',
    reads: (tier, until) => `${tier} · gültig bis ${until}`,
    expired: 'abgelaufen – bitte um einen frischen',
    saved: 'Gespeichert. Hub und Katalog bekommen ihn ab jetzt mit jeder Anfrage.',
    removed:
      'Entfernt. Dein eigener Hub läuft wie bisher; ein gehosteter ist für dich jetzt zu.',
  },

  supportPanel: {
    tierName: (tier) =>
      ({
        beta: 'Beta-Schlüssel',
        seven: 'Eine 7"',
        lp: 'Eine LP',
        double: 'Ein Doppelalbum',
        first: 'Die Erstpressung',
        test: 'Die Testpressung',
      })[tier] ?? tier,
  },

  access: {
    until: (date) => `bis ${date}`,
    expired: 'abgelaufen',
  },
  hub: {
    lead: 'Ein Helfer im eigenen Netz. Er merkt sich, was schon herausgefunden wurde.',
    title: 'Hub',
    hint: 'Optionaler Helfer im eigenen Netz',
    notSetUp: 'Nicht eingerichtet',
    catalogue: 'Katalog',
    unreadable: 'Adresse unlesbar',
  },
  data: {
    lead: 'Mitnehmen oder loswerden.',
    title: 'Deine Daten',
    hint: 'Exportieren oder alles löschen',
  },
  help: {
    lead: 'Wie Fidelity arbeitet, was die Punktzahlen bedeuten und wo deine Daten liegen.',
    title: 'Hilfe',
    hint: 'Wie das hier arbeitet und was die Punktzahlen bedeuten',
  },
  chapters: [
    {
      title: 'Wie fange ich an?',
      body: [
        'Du brauchst einen Personal Access Token von Discogs – den erzeugst du dir unter „Settings → Developers" selbst. Danach holt Fidelity einmal deine Sammlung und deine Wantlist. Das ist die Grundlage: ohne sie weiß die App nicht, was du magst.',
        'Dann gibst du unter „Graben" einen Laden an – seinen Namen oder einfach den Link seiner Discogs-Seite. Fidelity liest sein Sortiment und sagt dir, was davon zu dir passt.',
      ],
    },
    {
      title: 'Was bedeutet die Zahl neben einer Platte?',
      body: [
        'Sie sagt, wie gut diese Platte zu deiner Sammlung passt – von 0 bis 100. Elf verschiedene Hinweise fließen ein: ein Künstler, den du sammelst, ein Wunsch auf deiner Wantlist, ein Label, dem du folgst, eine Lücke in einer Katalogserie, jemand, der auf deinen Lieblingsplatten im Kleingedruckten steht.',
        'Der stärkste Hinweis zählt voll, die übrigen zu je 30 Prozent. Eine Platte mit einem sehr guten Grund schlägt also eine mit drei schwachen – so wie ein Mensch es auch machen würde.',
        'Unter jeder Platte steht ein Satz, der sagt, warum. Wenn der Satz dich nicht überzeugt, ist die Zahl auch nichts wert. Tippst du die Platte an, siehst du jeden einzelnen Hinweis mit seinem Beleg.',
      ],
    },
    {
      title: 'Warum dauert ein Dig so lange?',
      body: [
        'Discogs lässt pro Minute nur eine begrenzte Zahl von Abfragen zu, und Fidelity hält sich daran – eine Anfrage nach der anderen, mit Abstand. Ein Laden mit dreitausend Platten sind also ein paar Minuten.',
        'Du kannst währenddessen weggehen. Der Fortschritt bleibt erhalten, auch wenn du den Tab schließt: beim nächsten Öffnen bietet die App an, dort weiterzumachen.',
        'Für Läden, die du schon einmal durchsucht hast, gibt es „nur das Neue" – das liest nur, was seit deinem letzten Besuch dazugekommen ist, und ist meist in Sekunden fertig.',
      ],
    },
    {
      title: 'Warum verschwinden die Preise nach ein paar Stunden?',
      body: [
        'Weil wir sie nicht länger behalten dürfen. Discogs erlaubt die Nutzung seiner Marktplatzdaten nur für kurze Zeit, und daran hält sich Fidelity ohne Ausnahme.',
        'Die Treffer und die Begründungen bleiben – die haben wir selbst errechnet. Nur die Preise und Zustände gehen. Im Korb bringt „Noch da?" alles auf den neuesten Stand.',
      ],
    },
    {
      title: 'Warum ein Korb pro Laden?',
      body: [
        'Weil Porto pro Sendung anfällt und nicht pro Platte. Zwei Platten bei zwei Läden sind zweimal Versand; zwei Platten bei einem Laden oft einmal.',
        'Deshalb rechnet jeder Korb für sich: Zwischensumme, Versandstaffel, und was jede weitere Platte tatsächlich kostet. Gekauft wird bei Discogs – Fidelity legt nichts in einen fremden Warenkorb.',
      ],
    },
    {
      title: 'Was ist der Horizont?',
      body: [
        'Alles, was Fidelity über deine Künstler und Labels herausgefunden hat – nicht nur das, was bei dir im Regal steht. Damit erkennt die App andere Pressungen derselben Platte, Lücken in Katalogserien und Alben, die du noch nicht kennst.',
        'Er wird einmal aufgebaut und danach nur noch nachgeführt. Ohne ihn funktioniert alles, aber die interessanteren Treffer bleiben unsichtbar.',
      ],
    },
    {
      title: 'Und die Credits?',
      body: [
        'Aus den Platten, die du bei Discogs mit vier oder fünf Sternen bewertet hast, liest Fidelity heraus, wer sie gemacht hat: Produzenten, Remixer, Studioleute.',
        'Wenn dieselbe Person oft auftaucht, findet die App später auch Platten, auf denen sie nicht vorne draufsteht. Das ist der Unterschied zwischen „nach Künstler suchen" und einem Menschen, der den Laden kennt.',
      ],
    },
    {
      title: 'Wo liegen meine Daten?',
      body: [
        'Auf diesem Gerät, im Speicher deines Browsers. Es gibt keinen Server, an den sie gehen könnten – Fidelity besteht nur aus Dateien, die in deinem Browser laufen.',
        'Dein Discogs-Token bleibt ebenfalls hier. Er wird nie in eine Adresse geschrieben, nie protokolliert und an niemanden weitergegeben.',
        'Fidelity liest nur. Es ändert nichts an deinem Discogs-Konto, kauft nichts und schreibt nichts zurück.',
      ],
    },
    {
      title: 'Wie bekomme ich alles auf mein Handy?',
      body: [
        'Unter „Geräte abgleichen". Deine Daten werden auf diesem Gerät verschlüsselt und als ein einziger Block abgelegt – wahlweise in deinem Hub, in einem Sync-Ordner, bei Dropbox oder Google Drive. Nur deine Geräte können ihn wieder öffnen.',
        'Alternativ richtest du das Handy einfach neu ein. Alles außer deinen Urteilen lässt sich von Discogs neu holen.',
      ],
    },
    {
      title: 'Funktioniert das ohne Netz?',
      body: [
        'Zum Nachschlagen ja. Sammlung, Wantlist, Landkarte und die letzten Fundlisten liegen auf dem Gerät. Der Bildschirm „Im Laden" ist genau dafür da: mit der Platte in der Hand nachsehen, ob du sie schon hast – Plattenläden sind Keller.',
        'Neue Digs brauchen Netz, denn dafür muss der Laden gelesen werden.',
      ],
    },
    {
      title: 'Etwas stimmt nicht',
      body: [
        'Unter „Deine Daten" kannst du alles ausgeben oder alles löschen. Löschen entfernt auch den Token – danach ist das Gerät leer und du kannst von vorne anfangen. Verloren geht dabei nichts, was sich nicht von Discogs neu holen ließe.',
        'Sagt die App, Discogs sei nicht erreichbar, obwohl du online bist: meist ist das Anfragebudget für den Moment aufgebraucht. Ein paar Minuten warten hilft.',
      ],
    },
  ],

  closing: {
    title: 'Noch eine Frage offen?',
    body: 'Fidelity ist quelloffen einsehbar – wie es rechnet, steht im Code, und warum es so rechnet, in den Unterlagen daneben. Wer genauer wissen will, wie eine Punktzahl zustande kommt, findet es dort vollständig aufgeschrieben.',
    disclaimer:
      'Diese Anwendung nutzt die Discogs-API, steht aber in keiner Verbindung zu Discogs.',
  },
}

export const packs = { en, de }

/**
 * The settings wording, as a computed.
 *
 * Never `packs[activeLanguage()]` read into a plain constant — that captures
 * whichever language was active at mount. `tests/unit/messages-usage.spec.ts`
 * has the long version of why.
 */
export function useSettingsMessages() {
  return computed(() => packs[activeLanguage()])
}
