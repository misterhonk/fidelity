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
    title: 'Look & sound',
    /*
     * The language is named first, and it is named at all, because the person
     * who commissioned the switch could not find it. The picker is the top
     * section of this page — but this line used to read "light or dark, and in
     * which type", which sounds like a complete list, so nobody looking for a
     * language had any reason to open it. A row that enumerates what is behind
     * it has to enumerate all of it, and nothing more: the type picker it
     * also named was removed on 2026-08-11 (#194).
     */
    hint: 'Language, light or dark, and how you hear a record',

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
  lead: 'What you set up once and then leave alone.',
  /** The way back, on every subpage. */
  back: 'Settings',

  account: {
    lead: 'Your token, your other devices, and what this one keeps.',
    title: 'Account & data',
    hint: 'Your Discogs token, syncing devices, export or delete',
    discogsAccount: 'Discogs account',
    dataLives: 'Data lives',
    inThisBrowser: 'in this browser, on this device',
    used: 'Used',
    /* Chrome books every cached cover at ~7 MB; the data and the cache are told apart. */
    usedLine: (data: string, covers: string) => `${data} of data · ${covers} covers cached`,
    protected: 'protected from being cleared',
    signOut: 'Sign out',
    signOutWarning:
      'Signing out deletes the database with it: token, collection, your artists and labels, digs. There is no copy anywhere else. Export first if you want to keep it.',
  },
  library: {
    lead: 'What we know about your records, straight from Discogs. Everything else builds on this.',
    title: 'Collection',
    hint: 'Collection, wantlist, your artists and labels, credits',
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
      /* "Horizon" is the code's word (docs/20): on the screen it is your artists and labels. */
      title: 'Your artists and labels',
      about:
        'Your artists and labels, looked up once. After that no dig costs any extra lookups.',
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
        `About ${counted(minutes, 'minute', 'minutes')} to go. It runs in small bites and survives a reload; nothing already done is fetched twice.`,
      stale: (entries: number) =>
        `${counted(entries, 'entry is', 'entries are')} older than 30 days. Those get refreshed bit by bit, a small helping each day.`,
      records: 'records',
      eta: (clock: string) => `about ${clock} left`,
      build: 'Look up your artists',
      refresh: 'Refresh your artists',
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
        'Never run all the way through yet. What is here came from runs that stopped early, from the daily refresh and from what digs turned up.',
      /*
       * Said while it runs, because the opposite was being read into it.
       *
       * Reported as "the build is aborted as soon as I leave the tab, and I
       * cannot see why". Nothing was aborted — the run lives in the worker and
       * the bar lived on the page, so leaving took the bar and left the run.
       */
      keepsRunning:
        'Carries on if you leave this screen. It runs in the background, not on this page.',
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
      about: 'Bands you have nothing by, and would like to be shown.',
      lead: 'A dig matches against what is on your shelf. These are the names we should recognise anyway: nothing of theirs is here yet, and that is the point.',
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
        'Each of these is one or two lookups the next time we refresh your artists. That is what turns a name into the records behind it.',
      toHorizon: 'To your artists and labels',
    },

    credits: {
      title: 'Credits',
      about: 'Who made your favourite records: producers, engineers, remixers.',
      lead: 'Who produced, mixed and mastered, read off your favourite records, the four- and five-star ones.',
      whyLabel: 'Why only the favourites',
      why: 'Credits only appear when we look up one record at a time. Going through the whole collection would take hours. The rated ones are a fraction of that and say the most about you.',
      noFavourites:
        'No record rated four or five stars yet. Give some ratings on Discogs, and we know where to look.',
      read: (read: string, total: string) => `${read} of ${total} favourites read`,
      worthExpanding: (people: number) =>
        `${people === 1 ? 'person turns' : 'people turn'} up often enough to count as one of your artists`,
      remaining: (records: number, minutes: number) =>
        `${counted(records, 'record', 'records')} to go, about ${counted(minutes, 'minute', 'minutes')}. It runs in small bites and survives a reload.`,
      people: 'people',
      harvest: 'Read the credits',
      continue: 'Keep reading',
    },
  },
  search: {
    lead: 'Applies to every dig.',
    title: 'Finds & shops',
    hint: 'What a dig looks for, and where the shops come from',
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
      hard: 'Hard: what never shows up at all',
      soft: 'Soft: what still shows up, but further down',

      formats: 'Formats',
      formatsHint:
        'Nothing selected means everything counts. Discogs writes vinyl as 12", 2xLP or 7", and we read all of those.',

      maxPrice: 'Maximum price',
      noLimit: 'no limit',
      maxPriceHint: 'Anything above that, we leave out.',

      minRating: 'Seller rating at least',
      minRatingHint: 'Below that, no dig starts.',

      shipsTo: 'Where it ships to',
      shipsToHint:
        'Decides the postage: shops write their prices by destination ("Germany:", "Europe:", "Non-Europe:"), and we read only the block that belongs to you. In English, the way Discogs writes it.',

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
        'Above that a find counts for 55 %, and that is also the ceiling up to which the basket makes suggestions.',

      preferOriginals: 'Prefer original pressings',
      preferOriginalsHint: 'Reissues then count for less.',
      preferOriginalsWhyLabel: 'Dampened rather than discarded',
      preferOriginalsWhy:
        'Whether a record is a reissue, Discogs only says when we look it up on its own, and that happens after the dig, for the best fifty. So leaving out could not leave out anything.',

      saved: 'Saved. Applies from the next dig.',
      countryPlaceholder: 'Germany',
    },

    dealers: {
      title: 'Where the shops come from',
      about: 'Which sources the import may read.',
      ordersAlways:
        'We always read your orders. Discogs only shows us the selling side there, so for anybody who only buys it finds nothing. The friends list is the half that works.',
      friends: 'Read the Discogs friends list as well',
      friendsOff: 'Off until you switch it on.',
      /*
       * Said only while it is on, because the line above it describes the
       * default and kept saying "off until you switch it on" to somebody who
       * already had. Names the price of the exception every time it is read.
       */
      friendsOn: 'On. Friends with records for sale are searched too.',
      whyLabel: 'Why this one is an exception',
      why: 'Otherwise we use only officially documented Discogs interfaces.',
      whyAfter:
        'is not one. It works, but appears in no documentation and can disappear without notice. If it does, the import loses one source and nothing else. So it stays off until you agree.',
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
    title: 'Hear a record',
    lead: 'The clips a record carries come from YouTube. Whether they play here or open over there is your call.',
    label: 'Play clips right here',
    off: 'Off. A clip opens at YouTube in a new tab. Nothing is loaded from Google.',
    on: 'On. Records with clips get a play button here, and Google hears from this device only once you tap it.',
    whyLabel: 'What happens then',
    why: 'Discogs has one source of sound: YouTube. So a preview means embedding Google. Your collection, wantlist and token stay on this device. What Google learns is this device’s address and which record is playing. Nothing loads until you tap Listen, not even with this switch on.',
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
      'no-hub': 'No hub set. The address lives in Settings under Hub.',
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
      'Set this up before August 2026? The address then ended in /einstellungen/abgleich. It still works; nothing to change.',
    connect: (provider: string) => `Connect to ${provider}`,
    connected: 'Connected.',
    connectedTo: (provider: string) => `Connected to ${provider}.`,
    disconnect: 'Disconnect',

    pickFile: 'Choose a file',
    otherFile: 'A different file',

    passphrase: 'Passphrase',
    // The one thing nobody can recover for you, said before it matters rather
    // than after.
    passphraseHint: 'The same on every device. We store it nowhere; forgotten means gone.',
    remember: 'Remember on this device',
    rememberHint: 'Then we sync by ourselves when you open the app.',
    rememberWhyLabel: 'Is that not the key next to the lock',
    rememberWhy:
      'No. The lock is on the copy far away. This database here is unencrypted and always was: collection, shortlist and the Discogs token are already in it. Putting the passphrase beside them gives nobody anything that holding the device does not already give. On a shared computer that is a different question. Then leave the box unticked and type it each time.',

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
      `Nothing was there, though this device has synced before, so ${counted(entries, 'entry', 'entries')} went up as a fresh backup. If you changed your passphrase, the older one is still under the old word: enter it again and sync once to bring the two together.`,
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
        'This browser has no way to write to a file on its own, which is why "file in a sync folder" is not offered above. Safari lacks the API it needs, and that is the whole reason there is no iCloud entry. By hand it works: save the file into iCloud Drive yourself, and pick it here on the other device.',
      file: 'The file from the other device',
      fileHint: 'Leave empty on the first device; there is nothing to read yet.',
      run: 'Merge and save a file',
      saved: 'The file has been saved. Put it where the other device can reach it.',
    },

    scopeWhyLabel: 'What travels and what does not',
    scopeWhy:
      'With: your shortlist, shops with their postage tiers, settings. Not with: your Discogs token, or the basket. Its prices go stale, and a line removed here would come back. One key on three devices is three times the surface, and each device signs itself in once. Each device also looks up your artists and labels itself. And no digs: prices go after six hours anyway and have no business on a server.',
  },

  /** Settings → Hub. */
  hubPanel: {
    whyLabel: 'What a hub gives you',
    why: 'Everything we have worked out about your artists and labels then does not have to be looked up again on every device. What is in it once is there immediately on the next device instead of after minutes. The same goes for postage per shop. And if friends use the same hub, you all work for each other.',
    optional: 'It only takes waiting away.',

    url: 'Hub URL',
    door: 'Access key or shared secret',
    removeDoor: 'Remove',
    notYourToken:
      'Not your Discogs token; that never leaves this device. A key starts with “fk1.” and opens a hosted hub and catalogue. Anything else is the secret of your own hub.',

    save: 'Save',
    test: 'Test the connection',
    discover: 'Look here',

    found: 'One is running on this machine, address filled in. Save it now.',
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
    foundAndKept: 'Found one and kept it. Nothing else to do.',
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

    showDoor: 'Show it',
    hideDoor: 'Hide it',
    /*
     * The test's verdict, one sentence (2026-09-21). It used to be a chain of
     * partial findings — "secured with a secret · no secret entered, nothing
     * gets through · your access key opens it" — and Martin could not tell
     * whether the hub worked. First the answer, then the reason.
     */
    verdict: {
      keyOk: 'Reachable. Your access key opens it, everything gets through.',
      secretOk: 'Reachable. The secret fits, everything gets through.',
      open: 'Reachable and open, no secret needed. Everything gets through.',
      keyWrong:
        'Reachable, but the hub refuses your access key: expired, revoked, or not for this hub. Until that is fixed, nothing gets through.',
      secretWrong:
        'Reachable, but the secret does not fit. Until it does, nothing gets through.',
      locked: (doors: ('secret' | 'key')[]) =>
        `Reachable, but locked. The hub wants ${
          Array.isArray(doors) && doors.includes('key') && doors.includes('secret')
            ? 'a secret or an access key'
            : Array.isArray(doors) && doors.includes('key')
              ? 'an access key'
              : 'a secret'
        }, and none is entered here. Until then, nothing gets through.`,
    },
    holds: (entries: number, tiers: number) =>
      `In it: ${counted(entries, 'entry', 'entries')} about artists and labels, ${counted(tiers, 'postage tier', 'postage tiers')}.`,
  },

  /** Settings → Access (docs/17 §6.2). */
  /** What a key says, on the hub screen (M26.3: the key and the secret share one field). */
  accessPanel: {
    notAKey: 'That does not read as an access key.',
    /** Given the tier’s name and a formatted date. */
    reads: (tier: string, until: string) => `${tier} · valid until ${until}`,
    expired: 'expired, ask for a fresh one',
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
    why: 'Discogs publishes its whole database once a month. A catalogue is that month, read once, answering what the API answers slowly or not at all: every pressing of an album at once, every record a producer touched, a barcode without a single request. Nothing of yours goes there; it only knows the records.',
    optional: 'It only takes waiting away.',

    url: 'Catalogue URL',
    save: 'Save',
    test: 'Test the connection',
    discover: 'Look here',

    found: 'Found one, address filled in. Save it now.',
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
      followed: 'followed artists',
      watched: 'watched records',
    } as Record<string, string>,
    importSkippedPrices: (digs: string) =>
      `${digs} digs stayed out: a backup carries no prices, and a dig without them is a heading over nothing.`,
    importSkippedInvalid: (rows: string) =>
      `${rows} rows in the file were incomplete and stayed out.`,
    importSkippedOld:
      'The shelf and the wantlist in this file are from before the row shape settled. Sync again and they are back.',
    importMeta:
      'Settings and the taste profile came from the file, because this device had none.',
    exportDig: 'Last dig as a file',
    // Said before the file exists, not after. Somebody exporting a dig to send
    // to a friend needs to know what is in it *while deciding to send it*.
    contents:
      "Neither file holds your token, prices or conditions; marketplace data may not be passed on under Discogs' terms. What is in there: which records fit how well and why, with a link to each listing.",
    noDigYet: 'No dig yet that could be exported.',

    /*
     * CSV (M19 #5). Named for what the sheet gets that Discogs' own export
     * lacks — and for what it does not get, because "no prices" is the line
     * somebody expecting a valuation needs to read before opening the file.
     */
    exportCollectionCsv: 'Collection as CSV',
    exportWantlistCsv: 'Wantlist as CSV',
    csvContents:
      'For a spreadsheet. Every column Discogs’ own export leaves out, genres, styles, release and master ids, plus what is yours alone: rating, folder, the condition fields and the place a record sits in. No prices and no estimate: those are marketplace data and stay in the app.',

    deleteAll: 'Delete everything',
    deleteWarning:
      'Deletes the whole database on this device: token, collection, your artists and labels, digs, basket and ratings. There is no copy anywhere else and no way back.',
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
  /** Settings → Advanced: the hub and the catalogue, which nothing needs (#229). */
  advanced: {
    title: 'Advanced',
    hint: 'Hub and catalogue, optional helpers that run elsewhere',
    lead: 'Optional helpers that run somewhere else. Everything works without them.',
  },
  data: {
    lead: 'Take it with you, or be rid of it.',
    title: 'Your data',
    hint: 'Export it, or delete all of it',
    storage: 'Storage',
    /* From navigator.storage.estimate(). When it runs full, the cover cache goes first (db/quota.ts). */
    storageLine: (used: string, quota: string) => `${used} of ${quota} in use`,
    /* Where the browser gives no estimate (WebKit on Linux, in a worker): say so, not nothing. */
    storageUnknown: 'this browser does not say how much is in use',
    /* On Chrome the figure above is mostly cover padding (settings/account.vue), so say what is data. */
    storageHint: (data: string) =>
      `${data} of it is your data. The rest is mostly cached covers, the first to go when space runs out.`,
  },
  help: {
    lead: 'How this works, what the scores mean, and where your data lives.',
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
        'You need a personal access token from Discogs; you make one yourself under "Settings → Developers". After that we fetch your collection and your wantlist once. That is the ground everything stands on: without it we do not know what you like.',
        'Then, under "Dig", you name a shop, by name or simply with the link to their Discogs page. We go through what they have and tell you what in it fits you.',
      ],
    },
    {
      title: 'What does the number next to a record mean?',
      body: [
        'It says how well that record fits your collection, from 0 to 100. Eleven different signals feed into it: an artist you collect, a wish on your wantlist, a label you follow, a gap in a catalogue run, somebody who appears in the small print of your favourite records.',
        'The strongest signal counts in full, the rest at 30 per cent each. So a record with one very good reason beats one with three weak ones, the way a person would do it too.',
        'Under each record is a sentence saying why. If the sentence does not convince you, the number is worth nothing either. Tap the record and you see every single signal with its evidence.',
      ],
    },
    {
      title: 'Why does a dig take so long?',
      body: [
        'Discogs allows only a limited number of lookups per minute, and we keep to it: one request after another, with a gap. So a shop with three thousand records is a few minutes.',
        'You can walk away meanwhile. We keep the progress even if you close the tab: next time you open it, we offer to carry on from there.',
        'For shops you have dug before there is "only what is new". That reads only what has arrived since your last visit, and is usually done in seconds.',
      ],
    },
    {
      title: 'Why do the prices disappear after a few hours?',
      body: [
        'Because we are not allowed to keep them longer. Discogs permits its marketplace data to be used only for a short time, and we keep to that without exception.',
        'The finds and the reasons stay; we worked those out ourselves. Only the prices and conditions go. In the basket, "Still there?" brings everything up to date.',
      ],
    },
    {
      title: 'Why one basket per shop?',
      body: [
        'Because postage is charged per parcel, not per record. Two records at two shops is postage twice; two records at one shop is often postage once.',
        "So every basket does its own arithmetic: subtotal, postage tier, and what each further record actually costs. Buying happens at Discogs; we put nothing in anybody else's cart.",
      ],
    },
    {
      title: 'What does "look up your artists" do?',
      body: [
        'It finds everything about your artists and labels, not only what is on your shelf. With that we recognise other pressings of the same record, gaps in catalogue runs, and albums you do not know yet.',
        'We look them up once and only keep them fresh afterwards. Everything works without it, but the more interesting finds stay invisible.',
      ],
    },
    {
      title: 'And the credits?',
      body: [
        'From the records you rated four or five stars on Discogs, we read who made them: producers, remixers, studio people.',
        'When the same person turns up often, we later find records their name is not on the front of. That is the difference between "search by artist" and somebody who knows the shop.',
      ],
    },
    {
      title: 'Where is my data?',
      body: [
        "On this device, in your browser's storage. There is no server it could go to; Sleeveside is nothing but files running in your browser.",
        'Your Discogs token stays here as well. It is never written into an address, never logged, and never passed to anybody.',
        'We read. We only write back what you change here yourself: ratings, folders, purchases, your wantlist. We buy nothing.',
      ],
    },
    {
      title: 'How do I get all of it onto my phone?',
      body: [
        'Under "Account & data", in "Sync devices". We encrypt your data on this device and put it away as a single block: in your hub, in a sync folder, at Dropbox or at Google Drive, as you prefer. Only your devices can open it again.',
        'Or simply set the phone up afresh. Everything except your own judgements can be fetched from Discogs again.',
      ],
    },
    {
      title: 'What refreshes by itself?',
      body: [
        'Your collection, your wantlist, the shops you watch and your artists and labels: when the app opens, when you come back to the tab, and every twenty minutes. Usually that is a single lookup, because we only ask Discogs what has changed. Two things stay out on purpose. A dig is two to four minutes and a hundred lookups or more, so you start it, never a clock. And your orders we cannot fetch at all; Discogs only lists what you sold, so a purchase is read from its order number.',
      ],
    },
    {
      title: 'Does it work without a network?',
      body: [
        'For looking things up, yes. Collection, wantlist, map and the last lists of finds are on the device. The "In the shop" screen exists exactly for this: with the record in your hand, check whether you already have it. Record shops are basements.',
        'New digs need a network, because the shop has to be read for one.',
      ],
    },
    {
      title: 'Something is wrong',
      body: [
        'Under "Account & data", in "Your data", you can export everything or delete everything. Deleting removes the token too; after that the device is empty and you can start over. Nothing is lost that could not be fetched from Discogs again.',
        'If we say we cannot reach Discogs although you are online, the lookup budget is usually spent for the moment. Waiting a few minutes helps.',
      ],
    },
    {
      title: 'Keyboard shortcuts',
      body: [
        'The first Tab on any screen offers "Skip to content", past the navigation.',
        '⌘K, or Ctrl+K away from a Mac, searches everything: records, shops, screens.',
        'On a dig, / jumps to the search field and j opens the first find. In an open record, j or → goes to the next one, k or ← to the one before. Escape closes it, and so does Back.',
        'On the shops screen, j and k walk the list of shops. In the stack, ← and → move between records.',
        'On a shelf wall, the arrow keys move between compartments, Home and End go to the first and last, a letter jumps to the compartment it is filed under, and M moves everything in one somewhere else.',
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
    body: 'Sleeveside is open to read. How it calculates is in the code, and why it calculates that way is in the documents beside it. Anyone who wants to know exactly how a score comes about will find it written down there in full.',
    disclaimer: 'This application uses the Discogs API but is not connected with Discogs.',
  },
}

/** Same shape, enforced. A missing key here is a build error, as everywhere. */
const de: typeof en = {
  appearance: {
    title: 'Aussehen & Klang',
    hint: 'Sprache, hell oder dunkel, und wie du reinhörst',

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
  lead: 'Was du einmal einrichtest und danach in Ruhe lässt.',
  back: 'Einstellungen',

  account: {
    lead: 'Dein Token, deine anderen Geräte und was dieses hier aufhebt.',
    title: 'Konto & Daten',
    hint: 'Dein Discogs-Token, Geräte abgleichen, exportieren oder löschen',
    discogsAccount: 'Discogs-Konto',
    dataLives: 'Daten liegen',
    inThisBrowser: 'in diesem Browser, auf diesem Gerät',
    used: 'Belegt',
    usedLine: (data, covers) => `${data} Daten · ${covers} Cover im Cache`,
    protected: 'vor Aufräumen geschützt',
    signOut: 'Abmelden',
    signOutWarning:
      'Abmelden löscht die Datenbank mit: Token, Sammlung, deine Künstler und Labels, Digs. Es gibt keine Kopie woanders. Vorher exportieren, wenn du sie behalten willst.',
  },
  library: {
    lead: 'Was wir über deine Platten wissen, direkt von Discogs. Alles andere baut darauf auf.',
    title: 'Sammlung',
    hint: 'Sammlung, Wantlist, deine Künstler und Labels, Credits',
    summary: (records, wants) =>
      `${records} ${records === '1' ? 'Platte' : 'Platten'} · ${wants} ${wants === '1' ? 'Wunsch' : 'Wünsche'}`,

    fetch: {
      title: 'Sammlung und Wantlist',
      collection: 'Sammlung',
      wantlist: 'Wantlist',
      lastSynced: 'Zuletzt geholt',
      fetching: 'Wird geholt …',
      progress: (what, stored, total) => `${what}: ${stored} von ${total}`,
      start: 'Sammlung holen',
      again: 'Nochmal holen',
    },

    horizon: {
      title: 'Deine Künstler und Labels',
      about:
        'Deine Künstler und Labels, einmal nachgeschlagen. Danach kostet kein Dig extra Abfragen.',
      entities: 'Künstler und Labels',
      ofTotal: (done, total) => `${done} von ${total}`,
      knownRecords: 'Bekannte Platten',
      remaining: (minutes) =>
        `Dauert noch rund ${counted(minutes, 'Minute', 'Minuten')}. Läuft in kleinen Happen und übersteht ein Neuladen; was schon fertig ist, holen wir nicht nochmal.`,
      stale: (entries) =>
        `${counted(entries, 'Eintrag ist', 'Einträge sind')} älter als 30 Tage. Die frischen wir nach und nach auf, eine kleine Portion pro Tag.`,
      records: 'Platten',
      eta: (clock) => `noch ca. ${clock}`,
      build: 'Künstler und Labels nachschlagen',
      refresh: 'Künstler und Labels auffrischen',
      lastBuilt: (when) => `Zuletzt vollständig gebaut am ${when}`,
      neverBuilt:
        'Noch nie ganz durchgelaufen. Was da ist, stammt aus Läufen, die früher aufgehört haben, aus der täglichen Auffrischung und aus dem, was Digs gefunden haben.',
      keepsRunning:
        'Läuft weiter, wenn du diesen Bildschirm verlässt. Es läuft im Hintergrund, nicht auf dieser Seite.',
    },

    radar: {
      title: 'Auf dem Schirm',
      about: 'Bands, von denen du nichts hast, und die trotzdem vorkommen sollen.',
      lead: 'Ein Dig vergleicht mit dem, was im Regal steht. Das hier sind die Namen, die wir trotzdem erkennen sollen: Von denen steht noch nichts da, und genau darum geht es.',
      empty: 'Noch niemand auf dem Schirm. Such unten jemanden und nimm ihn auf.',
      searchLabel: 'Band suchen',
      searchPlaceholder: 'Exit North',
      search: 'Suchen',
      add: 'Auf den Schirm',
      onIt: 'Steht drauf',
      remove: 'Runter',
      noHits: 'Niemanden dieses Namens bei Discogs gefunden.',
      needsHorizon:
        'Jeder davon kostet ein bis zwei Abfragen, wenn wir deine Künstler das nächste Mal auffrischen. Das macht aus einem Namen die Platten dahinter.',
      toHorizon: 'Zu deinen Künstlern und Labels',
    },

    credits: {
      title: 'Credits',
      about: 'Wer deine Lieblingsplatten gemacht hat: Produzenten, Engineers, Remixer.',
      lead: 'Wer produziert, gemischt und gemastert hat, gelesen aus deinen Lieblingsplatten, vier und fünf Sterne.',
      whyLabel: 'Warum nur die Lieblingsplatten',
      why: 'Credits bekommen wir nur, wenn wir eine Platte einzeln nachschlagen. Die ganze Sammlung durchzugehen würde Stunden dauern. Die bewerteten sind ein Bruchteil davon und sagen am meisten über dich.',
      noFavourites:
        'Noch keine Platte mit vier oder fünf Sternen bewertet. Vergib die bei Discogs, dann wissen wir, wo wir nachschauen sollen.',
      read: (read, total) => `${read} von ${total} Lieblingsplatten gelesen`,
      worthExpanding: (people) =>
        `${people === 1 ? 'Person taucht' : 'Personen tauchen'} oft genug auf, um als deine Künstler zu zählen`,
      remaining: (records, minutes) =>
        `Noch ${counted(records, 'Platte', 'Platten')}, rund ${counted(minutes, 'Minute', 'Minuten')}. Läuft in kleinen Happen und übersteht ein Neuladen.`,
      people: 'Personen',
      harvest: 'Credits lesen',
      continue: 'Weiterlesen',
    },
  },
  search: {
    lead: 'Gilt für jeden Dig.',
    title: 'Funde & Läden',
    hint: 'Wonach ein Dig sucht und woher die Läden kommen',
    unrestricted: 'Ohne Einschränkung',
    upTo: (price) => `bis ${price}`,
    originalsOnly: 'nur Originale',
    countriesBlocked: (blocked) =>
      blocked === 1 ? '1 Land gesperrt' : `${blocked} Länder gesperrt`,

    filter: {
      title: 'Wonach gesucht wird',
      about: 'Was gar nicht erst auftaucht, und was nur weiter unten landet.',

      hard: 'Hart: was gar nicht erst auftaucht',
      soft: 'Weich: was noch auftaucht, aber weiter unten',

      formats: 'Formate',
      formatsHint:
        'Nichts ausgewählt heißt: Alles zählt. Discogs schreibt Vinyl als 12", 2xLP oder 7", das lesen wir alles mit.',

      maxPrice: 'Höchstpreis',
      noLimit: 'kein Limit',
      maxPriceHint: 'Was darüber liegt, lassen wir weg.',

      minRating: 'Verkäuferbewertung mindestens',
      minRatingHint: 'Darunter startet kein Dig.',

      shipsTo: 'Wohin geliefert wird',
      shipsToHint:
        'Entscheidet über das Porto: Läden schreiben ihre Preise nach Zielland („Germany:", „Europe:", „Non-Europe:"), und wir lesen nur den Block, der zu dir gehört. Auf Englisch, wie Discogs es schreibt; „Deutschland" verstehen wir auch.',

      blocked: 'Versand aus diesen Ländern nicht',
      blockedPlaceholder: 'Land suchen',
      blockedSearch: 'Land suchen, das wir überspringen sollen',
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
        'Darüber zählt ein Fund 55 %, und das ist auch die Grenze, bis zu der der Korb Vorschläge macht.',

      preferOriginals: 'Originalpressungen bevorzugen',
      preferOriginalsHint: 'Neuauflagen zählen dann weniger.',
      preferOriginalsWhyLabel: 'Gedämpft statt verworfen',
      preferOriginalsWhy:
        'Ob eine Platte eine Neuauflage ist, sagt Discogs erst, wenn wir sie einzeln nachschlagen, und das passiert nach dem Dig, für die besten 50. Weglassen könnte also nichts weglassen.',

      saved: 'Gespeichert. Gilt ab dem nächsten Dig.',
      countryPlaceholder: 'Deutschland',
    },

    dealers: {
      title: 'Woher die Läden kommen',
      about: 'Welche Quellen der Import lesen darf.',
      ordersAlways:
        'Deine Bestellungen lesen wir immer. Discogs zeigt uns dort nur die Verkaufsseite, für jemanden, der nur kauft, findet das also nichts. Die Freundesliste ist die Hälfte, die funktioniert.',
      friends: 'Auch die Discogs-Freundesliste lesen',
      friendsOff: 'Aus, solange du es nicht einschaltest.',
      friendsOn: 'An. Freunde, die Platten anbieten, suchen wir mit.',
      whyLabel: 'Warum das eine Ausnahme ist',
      why: 'Sonst benutzen wir nur offiziell dokumentierte Discogs-Schnittstellen.',
      whyAfter:
        'ist keine. Sie funktioniert, steht aber in keiner Dokumentation und kann ohne Ankündigung verschwinden. Passiert das, verliert der Import eine Quelle und sonst nichts. Deshalb bleibt sie aus, bis du zustimmst.',
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
    title: 'Reinhören',
    lead: 'Die Clips einer Platte kommen von YouTube. Ob sie hier laufen oder dort aufgehen, entscheidest du.',
    label: 'Clips gleich hier abspielen',
    off: 'Aus. Ein Clip geht bei YouTube in einem neuen Tab auf. Wir laden nichts von Google.',
    on: 'An. Platten mit Clips bekommen hier einen Abspielknopf, und erst beim Tippen erfährt Google von diesem Gerät.',
    whyLabel: 'Was dann passiert',
    why: 'Discogs hat genau eine Tonquelle: YouTube. Eine Hörprobe heißt also, Google einzubetten. Sammlung, Wantlist und Token bleiben auf diesem Gerät. Was Google erfährt, ist die Adresse dieses Geräts und welche Platte läuft. Vor dem Tippen laden wir nichts, auch mit eingeschaltetem Schalter nicht.',
  },

  vault: {
    targets: {
      none: { label: 'Nur dieses Gerät', hint: 'Nichts verlässt den Browser.' },
      hub: { label: 'Dein Hub', hint: 'Verschlüsselt auf deinem eigenen Server.' },
      file: { label: 'Datei im Sync-Ordner', hint: 'iCloud, Dropbox oder Drive tragen sie.' },
      cloud: { hint: 'Mit deiner eigenen App-Registrierung.' },
    },

    blocked: {
      'no-hub': 'Kein Hub eingetragen. Die Adresse steht in den Einstellungen unter Hub.',
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
      'Vor August 2026 eingerichtet? Die Adresse endete damals auf /einstellungen/abgleich. Sie funktioniert weiter, da ist nichts zu tun.',
    connect: (provider) => `Mit ${provider} verbinden`,
    connected: 'Verbunden.',
    connectedTo: (provider) => `Mit ${provider} verbunden.`,
    disconnect: 'Trennen',

    pickFile: 'Datei wählen',
    otherFile: 'Andere Datei',

    passphrase: 'Passphrase',
    passphraseHint:
      'Auf jedem Gerät dieselbe. Wir speichern sie nirgends; vergessen heißt weg.',
    remember: 'Auf diesem Gerät merken',
    rememberHint: 'Dann gleichen wir beim Öffnen von selbst ab.',
    rememberWhyLabel: 'Ist das nicht der Schlüssel neben dem Schloss',
    rememberWhy:
      'Nein. Das Schloss sitzt auf der Kopie in der Ferne. Diese Datenbank hier ist unverschlüsselt und war es immer: Sammlung, Gemerktes und der Discogs-Token liegen längst darin. Die Passphrase daneben zu legen gibt niemandem etwas, das der Besitz des Geräts nicht ohnehin gibt. Auf einem geteilten Rechner ist das eine andere Frage. Dann Haken weg und jedes Mal tippen.',

    syncing: 'Gleichen ab …',
    syncNow: 'Jetzt abgleichen',
    setUp: 'Einrichten',
    merged: (entries) => `Zusammengeführt: ${counted(entries, 'Eintrag', 'Einträge')}.`,
    firstBackup: (entries) => `Erstmals gesichert: ${counted(entries, 'Eintrag', 'Einträge')}.`,
    emptySlot: (entries) =>
      `Dort lag nichts, obwohl dieses Gerät schon einmal abgeglichen hat. ${counted(entries, 'Eintrag', 'Einträge')} sind deshalb als frische Sicherung hochgegangen. Falls du die Passphrase geändert hast: die ältere liegt noch unter dem alten Wort. Einmal damit abgleichen führt beide zusammen.`,
    lastSynced: (when) => `Zuletzt abgeglichen am ${when}.`,

    byHand: {
      title: 'Oder von Hand, als Datei',
      about:
        'Eine Runde ohne festes Ziel: die Datei lesen, die das andere Gerät geschrieben hat, und eine frische speichern. Gut für eine einzelne Übertragung oder ein Gerät, das nicht eingerichtet ist.',
      aboutWebkit:
        'Dieser Browser kann nicht von sich aus in eine Datei schreiben. Deshalb steht „Datei im Sync-Ordner" oben nicht zur Wahl, und deshalb gibt es auch keinen iCloud-Eintrag: Safari fehlt die nötige API, an iCloud liegt es nicht. Von Hand geht es: Datei selbst in iCloud Drive legen und auf dem anderen Gerät hier auswählen.',
      file: 'Die Datei vom anderen Gerät',
      fileHint: 'Auf dem ersten Gerät leer lassen; es gibt noch nichts zu lesen.',
      run: 'Abgleichen und Datei speichern',
      saved: 'Die Datei ist gespeichert. Leg sie dorthin, wo das andere Gerät sie findet.',
    },

    scopeWhyLabel: 'Was mitgeht und was nicht',
    scopeWhy:
      'Mit: Gemerktes, Läden mit Versandstaffeln, Einstellungen. Nicht mit: dein Discogs-Token und der Korb. Seine Preise veralten, und eine hier entfernte Zeile käme zurück. Ein Schlüssel auf drei Geräten ist dreimal so viel Angriffsfläche, jedes Gerät meldet sich einmal selbst an. Deine Künstler und Labels schlägt auch jedes Gerät selbst nach. Und keine Digs: Preise sind nach sechs Stunden sowieso weg und gehören nicht auf einen Server.',
  },

  hubPanel: {
    whyLabel: 'Was ein Hub bringt',
    why: 'Alles, was wir über deine Künstler und Labels herausgefunden haben, muss dann nicht jedes Gerät für sich nachschlagen. Was einmal drinsteht, ist auf dem nächsten Gerät sofort da statt nach Minuten. Dasselbe gilt für Versandkosten pro Laden. Und wenn Freunde denselben Hub benutzen, arbeitet ihr euch gegenseitig zu.',
    optional: 'Er nimmt nur Wartezeit weg.',

    url: 'Hub-URL',
    door: 'Zugangsschlüssel oder Shared Secret',
    removeDoor: 'Entfernen',
    notYourToken:
      'Nicht dein Discogs-Token; der verlässt dieses Gerät nie. Ein Schlüssel beginnt mit „fk1." und öffnet einen gehosteten Hub und Katalog. Alles andere ist das Secret deines eigenen Hubs.',

    save: 'Speichern',
    test: 'Verbindung testen',
    discover: 'Hier suchen',

    found: 'Auf diesem Rechner läuft einer, Adresse eingetragen. Jetzt speichern.',
    foundAndKept:
      'Auf dieser Seite läuft einer, eingetragen und behalten. Mehr ist nicht zu tun.',
    foundSecured:
      'Auf dieser Seite läuft einer. Er verlangt ein gemeinsames Geheimnis: das Wort, das derjenige gewählt hat, der den Hub aufgesetzt hat. Unten eintragen, dann speichern.',
    blockedByMixedContent:
      'Hier nicht erreichbar: diese Seite läuft über HTTPS, und Safari verweigert von dort jede Verbindung zu einem unverschlüsselten localhost. In Chrome geht es. Dauerhaft hilft nur, den Hub selbst über HTTPS erreichbar zu machen.',
    notFound:
      'Auf diesem Rechner läuft keiner. Adresse von Hand eintragen, falls er woanders steht.',
    searchFailed: 'Suche nicht möglich.',

    showDoor: 'Anzeigen',
    hideDoor: 'Verbergen',
    verdict: {
      keyOk: 'Erreichbar. Dein Zugangsschlüssel öffnet ihn, alles kommt durch.',
      secretOk: 'Erreichbar. Das Geheimnis passt, alles kommt durch.',
      open: 'Erreichbar und offen, ohne Geheimnis. Alles kommt durch.',
      keyWrong:
        'Erreichbar, aber der Hub lehnt deinen Zugangsschlüssel ab: abgelaufen, zurückgezogen oder nicht für diesen Hub. Solange kommt nichts durch.',
      secretWrong: 'Erreichbar, aber das Geheimnis passt nicht. Solange kommt nichts durch.',
      locked: (doors) =>
        `Erreichbar, aber verschlossen. Der Hub will ${
          Array.isArray(doors) && doors.includes('key') && doors.includes('secret')
            ? 'ein Geheimnis oder einen Zugangsschlüssel'
            : Array.isArray(doors) && doors.includes('key')
              ? 'einen Zugangsschlüssel'
              : 'ein Geheimnis'
        }, und hier steht keins. Solange kommt nichts durch.`,
    },
    holds: (entries, tiers) =>
      `Drin: ${counted(entries, 'Eintrag', 'Einträge')} zu Künstlern und Labels, ${counted(tiers, 'Versandstaffel', 'Versandstaffeln')}.`,
  },

  dataPanel: {
    exportAll: 'Alles exportieren',
    importAll: 'Ein Backup wieder einlesen',
    importing: 'Lesen …',
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
      followed: 'gefolgte Künstler',
      watched: 'beobachtete Platten',
    } as Record<string, string>,
    importSkippedPrices: (digs) =>
      `${digs} Digs blieben draußen: Ein Backup trägt keine Preise, und ein Dig ohne sie ist eine Überschrift über nichts.`,
    importSkippedInvalid: (rows) =>
      `${rows} Zeilen in der Datei waren unvollständig und blieben draußen.`,
    importSkippedOld:
      'Sammlung und Wantlist in dieser Datei stammen von vor der festen Zeilenform. Einmal neu holen, dann sind sie wieder da.',
    importMeta:
      'Einstellungen und Geschmacksprofil kamen aus der Datei, weil dieses Gerät keine hatte.',
    exportDig: 'Letzten Dig als Datei',
    contents:
      "Beide Dateien enthalten weder deinen Token noch Preise oder Zustände; Marktplatzdaten dürfen laut Discogs' Nutzungsbedingungen nicht weitergegeben werden. Was drinsteht: welche Platten wie gut passen und warum, mit Link zum jeweiligen Angebot.",
    noDigYet: 'Noch kein Dig da, den man exportieren könnte.',

    exportCollectionCsv: 'Sammlung als CSV',
    exportWantlistCsv: 'Wantlist als CSV',
    csvContents:
      'Für eine Tabelle. Jede Spalte, die Discogs’ eigener Export weglässt, Genres, Stile, Release- und Master-IDs, plus das, was nur deins ist: Bewertung, Ordner, die Zustandsfelder und der Ort, an dem eine Platte steht. Keine Preise und keine Schätzung: das sind Marktplatzdaten und bleiben in der App.',

    deleteAll: 'Alles löschen',
    deleteWarning:
      'Löscht die ganze Datenbank auf diesem Gerät: Token, Sammlung, deine Künstler und Labels, Digs, Korb und Bewertungen. Es gibt keine Kopie woanders und kein Zurück.',
    deleteConfirm: 'Ja, alles löschen',
    cancel: 'Abbrechen',
  },
  cataloguePanel: {
    whyLabel: 'Was ein Katalog bringt',
    why: 'Discogs veröffentlicht einmal im Monat seine ganze Datenbank. Ein Katalog ist dieser Monat, einmal gelesen, und beantwortet, was die API langsam oder gar nicht beantwortet: alle Pressungen eines Albums auf einen Schlag, jede Platte, an der ein Produzent beteiligt war, ein Barcode ohne eine einzige Anfrage. Nichts von dir geht dorthin; er kennt nur die Platten.',
    optional: 'Er nimmt nur Wartezeit weg.',

    url: 'Katalog-URL',
    save: 'Speichern',
    test: 'Verbindung testen',
    discover: 'Hier suchen',

    found: 'Einer gefunden, Adresse eingetragen. Jetzt speichern.',
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
    expired: 'abgelaufen, bitte um einen frischen',
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
    lead: 'Ein Helfer im eigenen Netz. Er merkt sich, was wir schon herausgefunden haben.',
    title: 'Hub',
    hint: 'Optionaler Helfer im eigenen Netz',
    notSetUp: 'Nicht eingerichtet',
    catalogue: 'Katalog',
    unreadable: 'Adresse unlesbar',
  },
  advanced: {
    title: 'Erweitert',
    hint: 'Hub und Katalog, optionale Helfer, die woanders laufen',
    lead: 'Optionale Helfer, die woanders laufen. Alles geht auch ohne sie.',
  },
  data: {
    lead: 'Mitnehmen oder loswerden.',
    title: 'Deine Daten',
    hint: 'Exportieren oder alles löschen',
    storage: 'Speicher',
    storageLine: (used, quota) => `${used} von ${quota} belegt`,
    storageUnknown: 'wie viel belegt ist, sagt dieser Browser nicht',
    storageHint: (data) =>
      `Davon sind ${data} deine Daten. Der Rest sind meist Cover im Cache, die fliegen zuerst raus, wenn der Platz knapp wird.`,
  },
  help: {
    lead: 'Wie das hier funktioniert, was die Punktzahlen bedeuten und wo deine Daten liegen.',
    title: 'Hilfe',
    hint: 'Wie das hier arbeitet und was die Punktzahlen bedeuten',
  },
  chapters: [
    {
      title: 'Wie fange ich an?',
      body: [
        'Du brauchst einen Personal Access Token von Discogs; den erzeugst du dir unter „Settings → Developers" selbst. Danach holen wir einmal deine Sammlung und deine Wantlist. Das ist die Grundlage: Ohne sie wissen wir nicht, was du magst.',
        'Dann nennst du uns unter „Graben" einen Laden, seinen Namen oder einfach den Link zu seiner Discogs-Seite. Wir gehen durch, was er hat, und sagen dir, was davon zu dir passt.',
      ],
    },
    {
      title: 'Was bedeutet die Zahl neben einer Platte?',
      body: [
        'Sie sagt, wie gut diese Platte zu deiner Sammlung passt, von 0 bis 100. Elf verschiedene Hinweise fließen ein: ein Künstler, den du sammelst, ein Wunsch auf deiner Wantlist, ein Label, dem du folgst, eine Lücke in einer Katalogserie, jemand, der auf deinen Lieblingsplatten im Kleingedruckten steht.',
        'Der stärkste Hinweis zählt voll, die übrigen zu je 30 Prozent. Eine Platte mit einem sehr guten Grund schlägt also eine mit drei schwachen, so wie ein Mensch es auch machen würde.',
        'Unter jeder Platte steht ein Satz, der sagt, warum. Wenn der Satz dich nicht überzeugt, ist die Zahl auch nichts wert. Tippst du die Platte an, siehst du jeden einzelnen Hinweis mit seinem Beleg.',
      ],
    },
    {
      title: 'Warum dauert ein Dig so lange?',
      body: [
        'Discogs lässt pro Minute nur eine begrenzte Zahl von Abfragen zu, und wir halten uns daran: eine Anfrage nach der anderen, mit Abstand. Ein Laden mit dreitausend Platten sind also ein paar Minuten.',
        'Du kannst währenddessen weggehen. Den Fortschritt behalten wir, auch wenn du den Tab schließt: Beim nächsten Öffnen bieten wir an, dort weiterzumachen.',
        'Für Läden, die du schon einmal durchgegraben hast, gibt es „nur das Neue". Das liest nur, was seit deinem letzten Besuch dazugekommen ist, und ist meist in Sekunden fertig.',
      ],
    },
    {
      title: 'Warum verschwinden die Preise nach ein paar Stunden?',
      body: [
        'Weil wir sie nicht länger behalten dürfen. Discogs erlaubt die Nutzung seiner Marktplatzdaten nur für kurze Zeit, und daran halten wir uns ohne Ausnahme.',
        'Die Funde und die Begründungen bleiben; die haben wir selbst errechnet. Nur die Preise und Zustände gehen. Im Korb bringt „Noch da?" alles auf den neuesten Stand.',
      ],
    },
    {
      title: 'Warum ein Korb pro Laden?',
      body: [
        'Weil Porto pro Sendung anfällt und nicht pro Platte. Zwei Platten bei zwei Läden sind zweimal Versand; zwei Platten bei einem Laden oft einmal.',
        'Deshalb rechnet jeder Korb für sich: Zwischensumme, Versandstaffel, und was jede weitere Platte tatsächlich kostet. Gekauft wird bei Discogs; wir legen nichts in einen fremden Warenkorb.',
      ],
    },
    {
      title: 'Was heißt „Künstler und Labels nachschlagen"?',
      body: [
        'Wir suchen alles zu deinen Künstlern und Labels zusammen, nicht nur das, was bei dir im Regal steht. Damit erkennen wir andere Pressungen derselben Platte, Lücken in Katalogreihen und Alben, die du noch nicht kennst.',
        'Wir schlagen sie einmal nach und halten sie danach nur frisch. Ohne das funktioniert alles, aber die interessanteren Funde bleiben unsichtbar.',
      ],
    },
    {
      title: 'Und die Credits?',
      body: [
        'Aus den Platten, die du bei Discogs mit vier oder fünf Sternen bewertet hast, lesen wir raus, wer sie gemacht hat: Produzenten, Remixer, Studioleute.',
        'Wenn dieselbe Person oft auftaucht, finden wir später auch Platten, auf denen sie nicht vorne draufsteht. Das ist der Unterschied zwischen „nach Künstler suchen" und einem Menschen, der den Laden kennt.',
      ],
    },
    {
      title: 'Wo liegen meine Daten?',
      body: [
        'Auf diesem Gerät, im Speicher deines Browsers. Es gibt keinen Server, an den sie gehen könnten; Sleeveside besteht nur aus Dateien, die in deinem Browser laufen.',
        'Dein Discogs-Token bleibt ebenfalls hier. Er wird nie in eine Adresse geschrieben, nie protokolliert und an niemanden weitergegeben.',
        'Wir lesen. Zurück schreiben wir nur, was du hier selbst änderst: Bewertungen, Ordner, Käufe, deine Wantlist. Wir kaufen nichts.',
      ],
    },
    {
      title: 'Wie bekomme ich alles auf mein Handy?',
      body: [
        'Unter „Konto & Daten", bei „Geräte abgleichen". Wir verschlüsseln deine Daten auf diesem Gerät und legen sie als einen einzigen Block ab: in deinem Hub, in einem Sync-Ordner, bei Dropbox oder Google Drive, wie du willst. Nur deine Geräte können ihn wieder öffnen.',
        'Alternativ richtest du das Handy einfach neu ein. Alles außer deinen Urteilen lässt sich von Discogs neu holen.',
      ],
    },
    {
      title: 'Was frischt sich von selbst auf?',
      body: [
        'Deine Sammlung, deine Wantlist, die beobachteten Läden und deine Künstler und Labels: beim Öffnen, beim Zurückkommen in den Tab und alle zwanzig Minuten. Meistens ist das eine einzige Abfrage, weil wir Discogs nur fragen, was sich geändert hat. Zwei Dinge bleiben absichtlich draußen. Ein Dig dauert zwei bis vier Minuten und hundert Abfragen und mehr, den startest also du und keine Uhr. Und deine Bestellungen können wir gar nicht holen; Discogs listet nur, was du verkauft hast, einen Kauf lesen wir deshalb über seine Bestellnummer.',
      ],
    },
    {
      title: 'Funktioniert das ohne Netz?',
      body: [
        'Zum Nachschlagen ja. Sammlung, Wantlist, Landkarte und die letzten Fundlisten liegen auf dem Gerät. Der Bildschirm „Im Laden" ist genau dafür da: mit der Platte in der Hand nachschauen, ob du sie schon hast. Plattenläden sind Keller.',
        'Neue Digs brauchen Netz, denn dafür müssen wir den Laden lesen.',
      ],
    },
    {
      title: 'Etwas stimmt nicht',
      body: [
        'Unter „Konto & Daten", bei „Deine Daten", kannst du alles exportieren oder alles löschen. Löschen entfernt auch den Token; danach ist das Gerät leer und du kannst von vorne anfangen. Verloren geht dabei nichts, was sich nicht von Discogs neu holen ließe.',
        'Sagen wir, wir kommen nicht an Discogs ran, obwohl du online bist, ist meist das Anfragebudget für den Moment aufgebraucht. Ein paar Minuten warten hilft.',
      ],
    },
    {
      title: 'Tastenkürzel',
      body: [
        'Das erste Tab auf jedem Bildschirm bietet „Zum Inhalt springen" an. Damit bist du an der Navigation vorbei.',
        '⌘K, oder Strg+K ohne Mac, sucht überall: Platten, Läden, Bildschirme.',
        'In einem Dig springt / ins Suchfeld und j öffnet den ersten Fund. In einer offenen Platte geht j oder → zur nächsten, k oder ← zur vorigen. Escape schließt sie, Zurück auch.',
        'Bei den Läden gehen j und k durch die Liste. Im Stapel wechseln ← und → die Platte.',
        'An einer Regalwand wandern die Pfeiltasten von Fach zu Fach. Pos1 und Ende springen zum ersten und letzten, ein Buchstabe zu dem Fach, unter dem er steht, und M räumt ein Fach komplett um.',
      ],
    },
  ],

  closing: {
    title: 'Noch eine Frage offen?',
    body: 'Sleeveside ist quelloffen. Wie es rechnet, steht im Code, und warum es so rechnet, in den Unterlagen daneben. Wer genauer wissen will, wie eine Punktzahl zustande kommt, findet es dort vollständig aufgeschrieben.',
    disclaimer:
      'Diese Anwendung nutzt die Discogs-API, steht aber in keiner Verbindung zu Discogs.',
  },
}

/** French counts nought and one in the singular. */
const frCounted = (n: number, one: string, many: string) => `${n} ${n < 2 ? one : many}`

const fr: typeof en = {
  appearance: {
    title: 'Apparence & son',
    hint: 'Langue, clair ou sombre, et comment tu écoutes',

    theme: {
      title: 'Thème',
      system: {
        label: 'Système',
        about: 'Suit l’appareil, y compris le passage automatique le soir.',
      },
      light: { label: 'Clair', about: 'Pour la lumière du jour et les listes papier à côté.' },
      dark: {
        label: 'Sombre',
        about: 'Le réglage par défaut. Les pochettes brillent sur fond sombre.',
      },
      following: (resolved) =>
        `Sur cet appareil, en ce moment ${resolved === 'dark' ? 'sombre' : 'clair'}.`,
    },

    language: {
      title: 'Langue',
      about: 'Reprise de l’appareil la première fois. Changée ici, elle reste changée.',
      legend: 'Langue de l’interface',
    },
  },

  title: 'Réglages',
  lead: 'Ce que tu règles une fois et laisses ensuite tranquille.',
  back: 'Réglages',

  account: {
    lead: 'Ton token, tes autres appareils et ce que celui-ci garde.',
    title: 'Compte & données',
    hint: 'Ton token Discogs, synchroniser tes appareils, exporter ou effacer',
    discogsAccount: 'Compte Discogs',
    dataLives: 'Les données sont',
    inThisBrowser: 'dans ce navigateur, sur cet appareil',
    used: 'Utilisé',
    usedLine: (data, covers) => `${data} de données · ${covers} de pochettes en cache`,
    protected: 'protégé contre le nettoyage',
    signOut: 'Se déconnecter',
    signOutWarning:
      'Se déconnecter efface aussi la base de données : token, collection, tes artistes et labels, fouilles. Il n’y a aucune copie ailleurs. Exporte avant, si tu veux les garder.',
  },
  library: {
    lead: 'Ce qu’on sait de tes disques, directement de Discogs. Tout le reste s’appuie dessus.',
    title: 'Collection',
    hint: 'Collection, liste d’envies, tes artistes et labels, crédits',
    summary: (records, wants) =>
      `${records} ${records === '1' || records === '0' ? 'disque' : 'disques'} · ${wants} ${wants === '1' || wants === '0' ? 'envie' : 'envies'}`,

    fetch: {
      title: 'Collection et liste d’envies',
      collection: 'Collection',
      wantlist: 'Liste d’envies',
      lastSynced: 'Dernière récupération',
      fetching: 'Récupération …',
      progress: (what, stored, total) => `${what} : ${stored} sur ${total}`,
      start: 'Récupérer la collection',
      again: 'Récupérer à nouveau',
    },

    horizon: {
      title: 'Tes artistes et labels',
      about:
        'Tes artistes et labels, cherchés une fois. Ensuite, aucune fouille ne coûte de requêtes en plus.',
      entities: 'Artistes et labels',
      ofTotal: (done, total) => `${done} sur ${total}`,
      knownRecords: 'Disques connus',
      remaining: (minutes) =>
        `Encore environ ${frCounted(minutes, 'minute', 'minutes')}. Tourne par petites bouchées et survit à un rechargement ; ce qui est fini, on ne le récupère pas deux fois.`,
      stale: (entries) =>
        `${frCounted(entries, 'entrée a', 'entrées ont')} plus de 30 jours. On les rafraîchit petit à petit, une petite portion par jour.`,
      records: 'Disques',
      eta: (clock) => `encore env. ${clock}`,
      build: 'Chercher artistes et labels',
      refresh: 'Rafraîchir artistes et labels',
      lastBuilt: (when) => `Dernière construction complète le ${when}`,
      neverBuilt:
        'Jamais allé jusqu’au bout. Ce qui est là vient de passages arrêtés plus tôt, du rafraîchissement quotidien et de ce que les fouilles ont trouvé.',
      keepsRunning:
        'Continue si tu quittes cet écran. Ça tourne en arrière-plan, pas sur cette page.',
    },

    radar: {
      title: 'Dans le viseur',
      about: 'Des groupes dont tu n’as rien, et qui doivent quand même compter.',
      lead: 'Une fouille compare avec ce qui est sur l’étagère. Voici les noms qu’on doit reconnaître quand même : rien d’eux n’y est encore, et c’est justement le but.',
      empty:
        'Personne dans le viseur pour l’instant. Cherche quelqu’un ci-dessous et ajoute-le.',
      searchLabel: 'Chercher un groupe',
      searchPlaceholder: 'Exit North',
      search: 'Chercher',
      add: 'Dans le viseur',
      onIt: 'Y est',
      remove: 'Retirer',
      noHits: 'Personne de ce nom trouvé sur Discogs.',
      needsHorizon:
        'Chacun coûte une ou deux requêtes la prochaine fois qu’on rafraîchit tes artistes. C’est ce qui transforme un nom en disques.',
      toHorizon: 'Vers tes artistes et labels',
    },

    credits: {
      title: 'Crédits',
      about: 'Qui a fait tes disques préférés : producteurs, ingénieurs, remixeurs.',
      lead: 'Qui a produit, mixé et masterisé, lu dans tes disques préférés, quatre et cinq étoiles.',
      whyLabel: 'Pourquoi seulement les préférés',
      why: 'On n’obtient les crédits qu’en cherchant un disque à la fois. Passer toute la collection prendrait des heures. Les disques notés en sont une fraction et disent le plus sur toi.',
      noFavourites:
        'Aucun disque noté quatre ou cinq étoiles pour l’instant. Donne-les sur Discogs, et on saura où regarder.',
      read: (read, total) => `${read} disques préférés lus sur ${total}`,
      worthExpanding: (people) =>
        `${people === 1 ? 'personne apparaît' : 'personnes apparaissent'} assez souvent pour compter comme tes artistes`,
      remaining: (records, minutes) =>
        `Encore ${frCounted(records, 'disque', 'disques')}, environ ${frCounted(minutes, 'minute', 'minutes')}. Tourne par petites bouchées et survit à un rechargement.`,
      people: 'Personnes',
      harvest: 'Lire les crédits',
      continue: 'Continuer la lecture',
    },
  },
  search: {
    lead: 'Vaut pour chaque fouille.',
    title: 'Trouvailles & boutiques',
    hint: 'Ce que cherche une fouille et d’où viennent les boutiques',
    unrestricted: 'Sans restriction',
    upTo: (price) => `jusqu’à ${price}`,
    originalsOnly: 'seulement les originaux',
    countriesBlocked: (blocked) =>
      blocked === 1 ? '1 pays bloqué' : `${blocked} pays bloqués`,

    filter: {
      title: 'Ce qu’on cherche',
      about: 'Ce qui n’apparaît même pas, et ce qui atterrit seulement plus bas.',

      hard: 'Strict : ce qui n’apparaît même pas',
      soft: 'Souple : ce qui apparaît encore, mais plus bas',

      formats: 'Formats',
      formatsHint:
        'Rien de choisi veut dire : tout compte. Discogs écrit le vinyle 12", 2xLP ou 7", on lit tout ça.',

      maxPrice: 'Prix maximum',
      noLimit: 'pas de limite',
      maxPriceHint: 'Ce qui est au-dessus, on le laisse de côté.',

      minRating: 'Évaluation du vendeur au moins',
      minRatingHint: 'En dessous, aucune fouille ne démarre.',

      shipsTo: 'Où c’est livré',
      shipsToHint:
        'Décide du port : les boutiques écrivent leurs prix par pays de destination (« Germany: », « Europe: », « Non-Europe: »), et on ne lit que le bloc qui te concerne. En anglais, comme l’écrit Discogs ; « Deutschland », on le comprend aussi.',

      blocked: 'Pas d’envoi depuis ces pays',
      blockedPlaceholder: 'Chercher un pays',
      blockedSearch: 'Chercher un pays à sauter',
      unblock: (country) => `Ne plus sauter ${country}`,
      blockedHint: 'Utile contre la douane et trois semaines d’attente.',

      condition: 'État à partir de',
      conditionHint: 'En dessous, ça ne compte plus que 40 %, mais ça ne disparaît pas.',
      listen: 'Écouter sur',
      listenNone: 'Nulle part',
      listenHint: 'Un disque porte alors un lien vers la recherche de ce service.',

      targetPrice: 'Prix idéal',
      targetPriceAny: 'peu importe',
      targetPriceHint:
        'Au-dessus, une trouvaille compte 55 %, et c’est aussi la limite jusqu’à laquelle le panier fait des propositions.',

      preferOriginals: 'Préférer les pressages originaux',
      preferOriginalsHint: 'Les rééditions comptent alors moins.',
      preferOriginalsWhyLabel: 'Atténué plutôt qu’écarté',
      preferOriginalsWhy:
        'Discogs ne dit si un disque est une réédition que quand on le cherche à part, et ça se fait après la fouille, pour les 50 meilleurs. Écarter n’écarterait donc rien.',

      saved: 'Enregistré. Vaut dès la prochaine fouille.',
      countryPlaceholder: 'France',
    },

    dealers: {
      title: 'D’où viennent les boutiques',
      about: 'Quelles sources l’import a le droit de lire.',
      ordersAlways:
        'Tes commandes, on les lit toujours. Discogs ne nous y montre que le côté vente, pour quelqu’un qui ne fait qu’acheter, ça ne trouve donc rien. La liste d’amis, c’est la moitié qui marche.',
      friends: 'Lire aussi la liste d’amis Discogs',
      friendsOff: 'Désactivé, tant que tu ne l’actives pas.',
      friendsOn: 'Activé. On cherche aussi parmi les amis qui vendent des disques.',
      whyLabel: 'Pourquoi c’est une exception',
      why: 'Sinon, on n’utilise que des interfaces Discogs officiellement documentées.',
      whyAfter:
        'n’en est pas une. Elle marche, mais ne figure dans aucune documentation et peut disparaître sans prévenir. Si ça arrive, l’import perd une source et rien d’autre. C’est pour ça qu’elle reste désactivée jusqu’à ce que tu acceptes.',
    },
  },
  sync: {
    lead: 'Chiffré, pour que l’endroit où c’est stocké ne compte pas.',
    title: 'Synchroniser les appareils',
    hint: 'Coffre chiffré pour téléphone et ordinateur',
    targets: {
      none: 'Désactivé',
      hub: 'Ton hub',
      file: 'Fichier dans le dossier synchronisé',
      dropbox: 'Dropbox',
      drive: 'Google Drive',
    },
  },

  audio: {
    title: 'Écouter',
    lead: 'Les extraits d’un disque viennent de YouTube. Qu’ils jouent ici ou s’ouvrent là-bas, c’est toi qui décides.',
    label: 'Lire les extraits ici même',
    off: 'Désactivé. Un extrait s’ouvre sur YouTube dans un nouvel onglet. On ne charge rien depuis Google.',
    on: 'Activé. Les disques avec extraits ont ici un bouton lecture, et Google n’apprend l’existence de cet appareil qu’au moment où tu appuies.',
    whyLabel: 'Ce qui se passe alors',
    why: 'Discogs n’a qu’une seule source sonore : YouTube. Une écoute veut donc dire intégrer Google. Collection, liste d’envies et token restent sur cet appareil. Ce que Google apprend, c’est l’adresse de cet appareil et le disque qui joue. Avant d’appuyer, on ne charge rien, même avec l’interrupteur activé.',
  },

  vault: {
    targets: {
      none: { label: 'Seulement cet appareil', hint: 'Rien ne quitte le navigateur.' },
      hub: { label: 'Ton hub', hint: 'Chiffré sur ton propre serveur.' },
      file: {
        label: 'Fichier dans le dossier synchronisé',
        hint: 'iCloud, Dropbox ou Drive le transportent.',
      },
      cloud: { hint: 'Avec ta propre inscription d’appli.' },
    },

    blocked: {
      'no-hub': 'Aucun hub saisi. L’adresse se règle dans les réglages, sous Hub.',
      'signed-out': 'Connecte-toi d’abord : le coffre appartient à ton compte Discogs.',
      'not-built': 'Cette destination n’est pas encore construite.',
    },

    clientId: (provider) => `Client ID de ${provider}`,
    redirect: (uri) => `Comme URL de redirection, saisis ${uri}.`,
    providerHint: {
      dropbox: 'Scoped access, App folder, puis saisis l’App key.',
      drive: 'ID client OAuth, type « Web application », Drive API activée.',
    },
    redirectMoved:
      'Installé avant août 2026 ? L’adresse se terminait alors par /einstellungen/abgleich. Elle marche toujours, il n’y a rien à faire.',
    connect: (provider) => `Se connecter à ${provider}`,
    connected: 'Connecté.',
    connectedTo: (provider) => `Connecté à ${provider}.`,
    disconnect: 'Déconnecter',

    pickFile: 'Choisir un fichier',
    otherFile: 'Autre fichier',

    passphrase: 'Phrase secrète',
    passphraseHint:
      'La même sur chaque appareil. On ne l’enregistre nulle part ; oubliée veut dire perdue.',
    remember: 'Mémoriser sur cet appareil',
    rememberHint: 'Alors on synchronise tout seul à l’ouverture.',
    rememberWhyLabel: 'Ce n’est pas la clé posée à côté de la serrure ?',
    rememberWhy:
      'Non. La serrure est sur la copie au loin. Cette base de données ici n’est pas chiffrée et ne l’a jamais été : collection, notés et token Discogs y sont depuis longtemps. Poser la phrase secrète à côté ne donne à personne quoi que ce soit que posséder l’appareil ne donne pas déjà. Sur un ordinateur partagé, c’est une autre question. Alors décoche, et tape-la à chaque fois.',

    syncing: 'Synchro …',
    syncNow: 'Synchroniser maintenant',
    setUp: 'Configurer',
    merged: (entries) => `Fusionné : ${frCounted(entries, 'entrée', 'entrées')}.`,
    firstBackup: (entries) => `Première copie : ${frCounted(entries, 'entrée', 'entrées')}.`,
    emptySlot: (entries) =>
      `Il n’y avait rien là-bas, alors que cet appareil a déjà synchronisé. ${frCounted(entries, 'entrée est partie', 'entrées sont parties')} comme copie neuve. Si tu as changé la phrase secrète : l’ancienne copie est toujours sous l’ancien mot. Synchroniser une fois avec lui réunit les deux.`,
    lastSynced: (when) => `Dernière synchro le ${when}.`,

    byHand: {
      title: 'Ou à la main, en fichier',
      about:
        'Un tour sans destination fixe : lire le fichier écrit par l’autre appareil, et en enregistrer un neuf. Bien pour un transfert unique ou un appareil qui n’est pas configuré.',
      aboutWebkit:
        'Ce navigateur ne sait pas écrire dans un fichier de lui-même. C’est pour ça que « Fichier dans le dossier synchronisé » n’est pas proposé ci-dessus, et pour ça qu’il n’y a pas d’entrée iCloud : il manque à Safari l’API nécessaire, iCloud n’y est pour rien. À la main, ça marche : mets toi-même le fichier dans iCloud Drive et choisis-le ici sur l’autre appareil.',
      file: 'Le fichier de l’autre appareil',
      fileHint: 'Laisse vide sur le premier appareil ; il n’y a encore rien à lire.',
      run: 'Synchroniser et enregistrer le fichier',
      saved: 'Le fichier est enregistré. Mets-le là où l’autre appareil le trouvera.',
    },

    scopeWhyLabel: 'Ce qui part et ce qui reste',
    scopeWhy:
      'Part : les notés, les boutiques avec leurs tarifs de port, les réglages. Ne part pas : ton token Discogs et le panier. Ses prix vieillissent, et une ligne retirée ici reviendrait. Une clé sur trois appareils, c’est trois fois plus de surface d’attaque, chaque appareil se connecte donc lui-même. Tes artistes et labels, chaque appareil les cherche aussi lui-même. Et pas de fouilles : les prix partent de toute façon au bout de six heures et n’ont rien à faire sur un serveur.',
  },

  hubPanel: {
    whyLabel: 'Ce qu’apporte un hub',
    why: 'Tout ce qu’on a trouvé sur tes artistes et labels, chaque appareil n’a plus à le chercher de son côté. Ce qui y est une fois est là tout de suite sur l’appareil suivant, au lieu d’après des minutes. Pareil pour les frais de port par boutique. Et si des amis utilisent le même hub, chacun travaille pour les autres.',
    optional: 'Il ne fait qu’enlever de l’attente.',
    url: 'URL du hub',
    door: 'Clé d’accès ou secret partagé',
    removeDoor: 'Retirer',
    notYourToken:
      'Pas ton token Discogs ; lui ne quitte jamais cet appareil. Une clé commence par « fk1. » et ouvre un hub et un catalogue hébergés. Tout le reste est le secret de ton propre hub.',

    save: 'Enregistrer',
    test: 'Tester la connexion',
    discover: 'Chercher ici',

    found: 'Il y en a un sur cet ordinateur, adresse saisie. Enregistre maintenant.',
    foundAndKept: 'Il y en a un sur cette page, saisi et gardé. Il n’y a rien d’autre à faire.',
    foundSecured:
      'Il y en a un sur cette page. Il demande un secret partagé : le mot choisi par la personne qui a installé le hub. Saisis-le ci-dessous, puis enregistre.',
    blockedByMixedContent:
      'Injoignable d’ici : cette page passe par HTTPS, et Safari refuse depuis là toute connexion à un localhost non chiffré. Dans Chrome, ça passe. La seule solution durable est de rendre le hub joignable en HTTPS.',
    notFound:
      'Il n’y en a aucun sur cet ordinateur. Saisis l’adresse à la main, s’il est ailleurs.',
    searchFailed: 'Recherche impossible.',

    showDoor: 'Afficher',
    hideDoor: 'Masquer',
    verdict: {
      keyOk: 'Joignable. Ta clé d’accès l’ouvre, tout passe.',
      secretOk: 'Joignable. Le secret est bon, tout passe.',
      open: 'Joignable et ouvert, sans secret. Tout passe.',
      keyWrong:
        'Joignable, mais le hub refuse ta clé d’accès : expirée, retirée ou pas pour ce hub. En attendant, rien ne passe.',
      secretWrong: 'Joignable, mais le secret n’est pas bon. En attendant, rien ne passe.',
      locked: (doors) =>
        `Joignable, mais fermé. Le hub veut ${
          Array.isArray(doors) && doors.includes('key') && doors.includes('secret')
            ? 'un secret ou une clé d’accès'
            : Array.isArray(doors) && doors.includes('key')
              ? 'une clé d’accès'
              : 'un secret'
        }, et il n’y en a pas ici. En attendant, rien ne passe.`,
    },
    holds: (entries, tiers) =>
      `Dedans : ${frCounted(entries, 'entrée', 'entrées')} sur des artistes et labels, ${frCounted(tiers, 'tarif de port', 'tarifs de port')}.`,
  },

  dataPanel: {
    exportAll: 'Tout exporter',
    importAll: 'Relire une sauvegarde',
    importing: 'Lecture …',
    importReport: (rows) => `Relu : ${rows}.`,
    importNothing: 'Rien dans le fichier qui puisse être relu.',
    importStore: {
      collection: 'collection',
      wantlist: 'liste d’envies',
      dealers: 'boutiques',
      feedback: 'évaluations',
      basket: 'panier',
      places: 'lieux',
      placements: 'places des disques',
      valueHistory: 'l’estimation au fil du temps',
      followed: 'artistes suivis',
      watched: 'disques à l’œil',
    } as Record<string, string>,
    importSkippedPrices: (digs) =>
      `${digs} fouilles sont restées dehors : une sauvegarde ne porte pas de prix, et une fouille sans eux est un titre au-dessus de rien.`,
    importSkippedInvalid: (rows) =>
      `${rows} lignes du fichier étaient incomplètes et sont restées dehors.`,
    importSkippedOld:
      'La collection et la liste d’envies de ce fichier datent d’avant la forme de ligne fixe. Récupère-les une fois, et elles sont de retour.',
    importMeta:
      'Les réglages et le profil de goût viennent du fichier, parce que cet appareil n’en avait pas.',
    exportDig: 'Dernière fouille en fichier',
    contents:
      'Aucun des deux fichiers ne contient ton token, ni prix ni états ; selon les conditions d’utilisation de Discogs, les données du marché ne doivent pas être transmises. Ce qu’il y a dedans : quels disques collent à quel point et pourquoi, avec un lien vers chaque annonce.',
    noDigYet: 'Pas encore de fouille à exporter.',

    exportCollectionCsv: 'Collection en CSV',
    exportWantlistCsv: 'Liste d’envies en CSV',
    csvContents:
      'Pour un tableur. Chaque colonne que l’export de Discogs laisse de côté, genres, styles, identifiants de sortie et de master, plus ce qui n’est qu’à toi : note, dossier, les champs d’état et l’endroit où est un disque. Ni prix ni estimation : ce sont des données du marché, elles restent dans l’appli.',

    deleteAll: 'Tout effacer',
    deleteWarning:
      'Efface toute la base de données sur cet appareil : token, collection, tes artistes et labels, fouilles, panier et évaluations. Il n’y a aucune copie ailleurs et aucun retour possible.',
    deleteConfirm: 'Oui, tout effacer',
    cancel: 'Annuler',
  },
  cataloguePanel: {
    whyLabel: 'Ce qu’apporte un catalogue',
    why: 'Discogs publie une fois par mois toute sa base de données. Un catalogue, c’est ce mois-là, lu une fois, et il répond à ce que l’API répond lentement ou pas du tout : tous les pressages d’un album d’un coup, chaque disque auquel un producteur a participé, un code-barres sans une seule requête. Rien de toi n’y va ; il ne connaît que les disques.',
    optional: 'Il ne fait qu’enlever de l’attente.',

    url: 'URL du catalogue',
    save: 'Enregistrer',
    test: 'Tester la connexion',
    discover: 'Chercher ici',

    found: 'Un trouvé, adresse saisie. Enregistre maintenant.',
    notFound:
      'Il n’y en a aucun sur cet ordinateur. Saisis l’adresse à la main, s’il est ailleurs.',
    searchFailed: 'Recherche impossible.',

    reachable: 'Joignable',
    build: (date: string) => `État au ${date}`,
    releases: (count: string) => `${count} sorties`,
  },

  accessPanel: {
    notAKey: 'Ça ne ressemble pas à une clé d’accès.',
    reads: (tier, until) => `${tier} · valable jusqu’au ${until}`,
    expired: 'expirée, demandes-en une neuve',
    saved: 'Enregistrée. Le hub et le catalogue la reçoivent désormais avec chaque requête.',
    removed:
      'Retirée. Ton propre hub tourne comme avant ; un hub hébergé t’est maintenant fermé.',
  },

  supportPanel: {
    tierName: (tier) =>
      ({
        beta: 'Clé bêta',
        seven: 'Un 7"',
        lp: 'Un LP',
        double: 'Un double album',
        first: 'Le premier pressage',
        test: 'Le test pressing',
      })[tier] ?? tier,
  },

  access: {
    until: (date) => `jusqu’au ${date}`,
    expired: 'expirée',
  },
  hub: {
    lead: 'Un assistant sur ton propre réseau. Il retient ce qu’on a déjà trouvé.',
    title: 'Hub',
    hint: 'Assistant facultatif sur ton propre réseau',
    notSetUp: 'Pas configuré',
    catalogue: 'Catalogue',
    unreadable: 'Adresse illisible',
  },
  advanced: {
    title: 'Avancé',
    hint: 'Hub et catalogue, assistants facultatifs qui tournent ailleurs',
    lead: 'Des assistants facultatifs qui tournent ailleurs. Tout marche aussi sans eux.',
  },
  data: {
    lead: 'L’emporter ou t’en débarrasser.',
    title: 'Tes données',
    hint: 'Exporter ou tout effacer',
    storage: 'Stockage',
    storageLine: (used, quota) => `${used} utilisés sur ${quota}`,
    storageUnknown: 'combien est utilisé, ce navigateur ne le dit pas',
    storageHint: (data) =>
      `Dont ${data} de tes données. Le reste, ce sont surtout des pochettes en cache, elles partent en premier quand la place manque.`,
  },
  help: {
    lead: 'Comment ça marche ici, ce que veulent dire les notes et où sont tes données.',
    title: 'Aide',
    hint: 'Comment ça marche ici et ce que veulent dire les notes',
  },
  chapters: [
    {
      title: 'Comment je commence ?',
      body: [
        'Il te faut un Personal Access Token de Discogs ; tu le crées toi-même sous « Settings → Developers ». Ensuite, on récupère une fois ta collection et ta liste d’envies. C’est la base : sans elles, on ne sait pas ce que tu aimes.',
        'Puis tu nous donnes une boutique sous « Fouiller », son nom ou simplement le lien de sa page Discogs. On passe en revue ce qu’elle a, et on te dit ce qui te va.',
      ],
    },
    {
      title: 'Que veut dire le chiffre à côté d’un disque ?',
      body: [
        'Il dit à quel point ce disque va avec ta collection, de 0 à 100. Onze indices différents entrent en jeu : un artiste que tu collectionnes, une envie sur ta liste, un label que tu suis, un trou dans une série de catalogue, quelqu’un qui figure en petits caractères sur tes disques préférés.',
        'L’indice le plus fort compte pleinement, les autres à 30 % chacun. Un disque avec une très bonne raison bat donc un disque avec trois faibles, comme le ferait une personne.',
        'Sous chaque disque, une phrase dit pourquoi. Si la phrase ne te convainc pas, le chiffre ne vaut rien non plus. Appuie sur le disque, et tu vois chaque indice avec sa preuve.',
      ],
    },
    {
      title: 'Pourquoi une fouille prend-elle autant de temps ?',
      body: [
        'Discogs n’autorise qu’un nombre limité de requêtes par minute, et on le respecte : une requête après l’autre, avec de l’écart. Une boutique de trois mille disques, ça fait donc quelques minutes.',
        'Tu peux t’en aller pendant ce temps. On garde la progression, même si tu fermes l’onglet : à la prochaine ouverture, on propose de reprendre là.',
        'Pour les boutiques que tu as déjà fouillées, il y a « seulement le nouveau ». Ça ne lit que ce qui est arrivé depuis ta dernière visite, et c’est en général fini en quelques secondes.',
      ],
    },
    {
      title: 'Pourquoi les prix disparaissent-ils au bout de quelques heures ?',
      body: [
        'Parce qu’on n’a pas le droit de les garder plus longtemps. Discogs n’autorise l’usage de ses données du marché que peu de temps, et on s’y tient sans exception.',
        'Les trouvailles et les raisons restent ; on les a calculées nous-mêmes. Seuls les prix et les états partent. Dans le panier, « Encore là ? » remet tout à jour.',
      ],
    },
    {
      title: 'Pourquoi un panier par boutique ?',
      body: [
        'Parce que le port se paie par envoi, pas par disque. Deux disques dans deux boutiques, c’est deux envois ; deux disques dans une boutique, souvent un seul.',
        'C’est pour ça que chaque panier compte pour lui-même : sous-total, tarif de port, et ce que coûte vraiment chaque disque de plus. L’achat se fait sur Discogs ; on ne met rien dans le panier de quelqu’un d’autre.',
      ],
    },
    {
      title: 'Que veut dire « chercher artistes et labels » ?',
      body: [
        'On rassemble tout sur tes artistes et labels, pas seulement ce qui est sur ton étagère. Ça nous permet de reconnaître d’autres pressages du même disque, des trous dans les séries de catalogue et des albums que tu ne connais pas encore.',
        'On les cherche une fois, puis on ne fait que les garder frais. Sans ça, tout marche, mais les trouvailles les plus intéressantes restent invisibles.',
      ],
    },
    {
      title: 'Et les crédits ?',
      body: [
        'Des disques que tu as notés quatre ou cinq étoiles sur Discogs, on lit qui les a faits : producteurs, remixeurs, gens de studio.',
        'Quand la même personne revient souvent, on trouve plus tard aussi des disques où elle n’est pas sur la pochette. C’est la différence entre « chercher par artiste » et une personne qui connaît la boutique.',
      ],
    },
    {
      title: 'Où sont mes données ?',
      body: [
        'Sur cet appareil, dans le stockage de ton navigateur. Il n’y a aucun serveur où elles pourraient aller ; Sleeveside n’est fait que de fichiers qui tournent dans ton navigateur.',
        'Ton token Discogs reste ici aussi. Il n’est jamais écrit dans une adresse, jamais journalisé et jamais transmis à personne.',
        'On lit. On ne réécrit que ce que tu changes toi-même ici : notes, dossiers, achats, ta liste d’envies. On n’achète rien.',
      ],
    },
    {
      title: 'Comment tout mettre sur mon téléphone ?',
      body: [
        'Sous « Compte & données », à « Synchroniser les appareils ». On chiffre tes données sur cet appareil et on les dépose en un seul bloc : dans ton hub, dans un dossier synchronisé, sur Dropbox ou Google Drive, comme tu veux. Seuls tes appareils peuvent le rouvrir.',
        'Sinon, tu configures simplement le téléphone à neuf. Tout sauf tes avis se récupère à nouveau depuis Discogs.',
      ],
    },
    {
      title: 'Qu’est-ce qui se rafraîchit tout seul ?',
      body: [
        'Ta collection, ta liste d’envies, les boutiques suivies et tes artistes et labels : à l’ouverture, au retour dans l’onglet et toutes les vingt minutes. La plupart du temps, c’est une seule requête, parce qu’on ne demande à Discogs que ce qui a changé. Deux choses restent dehors exprès. Une fouille prend deux à quatre minutes et cent requêtes ou plus, c’est donc toi qui la lances, pas une horloge. Et tes commandes, on ne peut pas les récupérer du tout ; Discogs ne liste que ce que tu as vendu, alors on lit un achat par son numéro de commande.',
      ],
    },
    {
      title: 'Ça marche sans réseau ?',
      body: [
        'Pour consulter, oui. Collection, liste d’envies, carte et dernières listes de trouvailles sont sur l’appareil. L’écran « En boutique » est fait pour ça : le disque en main, regarder si tu l’as déjà. Les boutiques de disques, ce sont des caves.',
        'Les nouvelles fouilles ont besoin du réseau, car il faut lire la boutique.',
      ],
    },
    {
      title: 'Quelque chose ne va pas',
      body: [
        'Sous « Compte & données », à « Tes données », tu peux tout exporter ou tout effacer. Effacer retire aussi le token ; ensuite l’appareil est vide et tu peux recommencer de zéro. Rien ne se perd qui ne puisse se récupérer à nouveau depuis Discogs.',
        'Si on dit qu’on n’arrive pas à joindre Discogs alors que tu es en ligne, c’est en général que le budget de requêtes est épuisé pour le moment. Attendre quelques minutes aide.',
      ],
    },
    {
      title: 'Raccourcis clavier',
      body: [
        'La première tabulation sur chaque écran propose « Aller au contenu ». Ça te fait passer la navigation.',
        '⌘K, ou Ctrl+K hors Mac, cherche partout : disques, boutiques, écrans.',
        'Dans une fouille, / saute dans le champ de recherche et j ouvre la première trouvaille. Dans un disque ouvert, j ou → passe au suivant, k ou ← au précédent. Échap le ferme, Retour aussi.',
        'Dans les boutiques, j et k parcourent la liste. Dans la pile, ← et → changent de disque.',
        'Devant une étagère, les flèches vont de casier en casier. Début et Fin sautent au premier et au dernier, une lettre au casier où elle figure, et M réarrange tout un casier.',
      ],
    },
  ],

  closing: {
    title: 'Encore une question ?',
    body: 'Sleeveside est open source. Comment il calcule, c’est dans le code, et pourquoi il calcule ainsi, dans les documents à côté. Qui veut savoir précisément comment une note se forme y trouve tout écrit.',
    disclaimer:
      'Cette application utilise l’API de Discogs, mais n’est pas affiliée à Discogs.',
  },
}

export const packs = { en, de, fr }

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
