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
