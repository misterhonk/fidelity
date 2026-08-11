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

import type { VaultTarget } from '#shared/types'
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
    nothingYet: 'Nothing fetched yet',
    off: 'Off',
    never: 'never',
  },

  settings: {
    title: 'Settings',
    lead: 'Everything you set up once and then leave alone.',
    /** The way back, on every subpage. */
    back: 'Settings',

    account: {
      lead: 'There is no account with us — only your token, on this device.',
      title: 'Account',
      hint: 'Your Discogs token, and what is kept on this device',
      discogsAccount: 'Discogs account',
      dataLives: 'Data lives',
      inThisBrowser: 'in this browser, on this device',
      used: 'Used',
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
        minRatingHint: 'Below that, the dig does not start at all.',

        shipsTo: 'Where it ships to',
        shipsToHint:
          'Decides the postage: dealers write their prices by destination ("Germany:", "Europe:", "Non-Europe:"), and only the block that belongs to you is read. In English, the way Discogs writes it.',

        blocked: 'No shipping from these countries',
        blockedPlaceholder: 'e.g. USA, Japan',
        blockedHint: 'Separate with commas. Useful against customs and three weeks of waiting.',

        condition: 'Condition from',
        conditionHint: 'Anything worse counts for 40 %, but does not disappear.',

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
      },

      dealers: {
        title: 'Where the shops come from',
        about: 'Which sources the import may read.',
        ordersAlways: 'Orders are always read — those are the shops you have bought from.',
        friends: 'Read the Discogs friends list as well',
        friendsOff: 'Off until you switch it on.',
        whyLabel: 'Why this one is an exception',
        why: 'Otherwise this app uses only officially documented Discogs interfaces.',
        whyAfter:
          'is not one — it works, but appears in no documentation and can disappear without notice. If it does, the import loses one source and nothing else. Hence: off until you agree.',
      },
    },
    appearance: { hint: 'Light or dark, and in which type' },
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
    hub: {
      lead: 'A small service on a machine you run yourself. It remembers what Fidelity has already worked out, so the next time is immediate.',
      title: 'Hub',
      hint: 'An optional helper on your own network',
      notSetUp: 'Not set up',
      // A hub address that will not parse is worth showing as such rather than
      // hiding behind "not set up" — the setting is set, it is wrong.
      unreadable: 'Address unreadable',
    },
    data: {
      lead: 'Take it with you, or be rid of it. Both complete, both without a detour through a server.',
      title: 'Your data',
      hint: 'Export it, or delete all of it',
    },
    help: {
      lead: 'How Fidelity works, what the scores mean, and where your data lives.',
      title: 'Help',
      hint: 'How this works, and what the scores mean',
    },
  },

  nav: {
    label: 'Main sections',
    start: { label: 'Start', hint: "What's new, what's waiting" },
    dig: { label: 'Dig', hint: 'Scan a shop' },
    basket: { label: 'Basket', hint: 'What you mean to buy' },
    shelf: { label: 'Collection', hint: 'What you own and what you are after' },
    dealers: { label: 'Shops', hint: 'Who you buy from' },
    settings: 'Settings',
    inBasket: (count: number) => `${count} in the basket`,
  },

  appearance: {
    title: 'Appearance',

    theme: {
      title: 'Theme',
      system: { label: 'System', about: 'Follows the device, including the switch at dusk.' },
      light: { label: 'Light', about: 'For daylight, and for paper lists next to the screen.' },
      dark: { label: 'Dark', about: 'The default. Covers glow on a dark ground.' },
      /** Appended to the "System" description so the word says what it means today. */
      following: (resolved: 'light' | 'dark') =>
        `On this device that is ${resolved === 'dark' ? 'dark' : 'light'} right now.`,
    },

    type: {
      title: 'Type',
      about: 'Three sets. Switch, then walk through one list.',
      // The set names are names. They do not translate.
      presswerk: 'Narrow and technical, like the lettering on a record spine.',
      kontor: 'Rounder and warmer. Headings carry more weight.',
      schweiz: 'No display face — hierarchy from size and weight alone.',
      /**
       * The specimen under the three options: a heading, a line of prose and
       * the numerals, which are what this app mostly sets.
       */
      specimen:
        'You own 5 records by Robag Wruhme — not this one. Style fits (Minimal), and only 3 are for sale.',
    },

    language: {
      title: 'Language',
      about: 'Picked from your device the first time. Change it here and it stays changed.',
      /** The switch is a set of radios, so it needs a name for a screen reader. */
      legend: 'Interface language',
    },
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
