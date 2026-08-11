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
    nothingYet: 'Nothing fetched yet',
    off: 'Off',
    never: 'never',
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
    wanted: (n: string) => `${n} wanted`,
    yourShops: 'Your shops',
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
