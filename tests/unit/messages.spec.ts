import { describe, expect, it } from 'vitest'

import de from '~/i18n/de'
import en, { type Messages } from '~/i18n/en'
import { LANGUAGES } from '~/composables/useMessages'

/**
 * What the compiler cannot say about a translation.
 *
 * `de.ts` is typed as `Messages`, so a missing key or a stray extra one is
 * already a build error — that part was measured, not assumed, by deleting a
 * key and watching `pnpm typecheck` name it.
 *
 * What TypeScript does *not* catch is a function that ignores its arguments.
 * `() => 'im Korb'` is a perfectly legal value where `(count: number) => string`
 * is expected — that is the language's own assignability rule, not an oversight
 * in the annotation — and the result is a badge that says "in the basket" with
 * no number in it. That is the hole these tests fill.
 */

type Node = Record<string, unknown>

/** Every leaf, as a dotted path, so a failure names the key it is about. */
function walk(value: unknown, path: string[] = []): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [[path.join('.'), value]]
  return Object.entries(value as Node).flatMap(([key, next]) => walk(next, [...path, key]))
}

const english = new Map(walk(en))
const german = new Map(walk(de))

describe('the German pack', () => {
  it('has the same keys as English, and no others', () => {
    expect([...german.keys()].sort()).toEqual([...english.keys()].sort())
  })

  it('answers every key with the same kind of thing', () => {
    for (const [key, value] of english) {
      expect(typeof german.get(key), key).toBe(typeof value)
    }
  })

  it('says something at every key', () => {
    for (const [key, value] of german) {
      if (typeof value === 'string') expect(value.trim(), key).not.toBe('')
    }
  })

  /**
   * The one the compiler lets past.
   *
   * Each function is called in both languages with the same probe. If the
   * English sentence contains the probe, the German one has to as well —
   * whatever it does with the word order. A translation that drops the
   * parameter fails here and nowhere else.
   *
   * The probe is a number no message would ever contain by chance. Functions
   * that take something else (`'light' | 'dark'`) simply do not match it, no
   * assertion is made about them, and nothing breaks: they are covered by the
   * "says something" test above.
   */
  it('keeps the numbers it was given', () => {
    const PROBE = 4711

    for (const [key, value] of english) {
      if (typeof value !== 'function') continue

      const translated = german.get(key)
      expect(typeof translated, key).toBe('function')

      // The probe is deliberately the wrong type for some of these — that is
      // the point of a probe, and JavaScript does not mind.
      const call = (fn: unknown) => String((fn as (...args: unknown[]) => string)(PROBE))

      if (!call(value).includes(String(PROBE))) continue
      expect(call(translated), `${key} drops its number`).toContain(String(PROBE))
    }
  })

  it('names a locale that Intl actually knows', () => {
    for (const pack of [en, de] as Messages[]) {
      expect(Intl.NumberFormat.supportedLocalesOf(pack.meta.locale)).toEqual([pack.meta.locale])
    }
  })
})

describe('the language list', () => {
  it('names every language that has a pack, and only those', () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual(['de', 'en'])
  })

  it('names each language in itself', () => {
    expect(LANGUAGES.en).toBe(en.meta.name)
    expect(LANGUAGES.de).toBe(de.meta.name)
  })
})
