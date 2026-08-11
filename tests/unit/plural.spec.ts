import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { counted, plural } from '~/utils/plural'

/**
 * A number and its noun are decided together.
 *
 * Found by reading the app as a user: "about 1 minutes", "1 postage tiers",
 * "1 entries". Nobody types those on purpose — they happen
 * because a template interpolates a count in front of a noun somebody wrote in
 * the plural, and the singular only ever appears on the one screen where the
 * number happens to be one.
 */
describe('a count and its noun', () => {
  it('uses the singular for exactly one', () => {
    expect(counted(1, 'Minute', 'Minuten')).toBe('1 Minute')
    expect(counted(1, 'Versandstaffel', 'Versandstaffeln')).toBe('1 Versandstaffel')
  })

  it('uses the plural for everything else, zero included', () => {
    // German says "0 Minuten", not "0 Minute".
    expect(counted(0, 'Minute', 'Minuten')).toBe('0 Minuten')
    expect(counted(2, 'Minute', 'Minuten')).toBe('2 Minuten')
    expect(counted(38, 'Request', 'Requests')).toBe('38 Requests')
  })

  it('offers the word on its own, for templates that style the number', () => {
    // The counts are set in the tabular figures of `fid-num`, so most callers
    // render the number themselves and only want the noun.
    expect(plural(1, 'Entität', 'Entitäten')).toBe('Entität')
    expect(plural(7, 'Entität', 'Entitäten')).toBe('Entitäten')
  })
})

/**
 * Kein Wort mehr direkt hinter einer interpolierten Zahl.
 *
 * The helper only helps where it is used, and the failure was never that
 * somebody could not write `n === 1 ? …`. It was that five places each decided
 * it alone. This is the cheap check that a sixth does not appear.
 */
describe('no template pluralises on its own again', () => {
  const FILES = [
    'app/components/NextStep.vue',
    'app/components/HorizonBuild.vue',
    'app/components/CreditHarvest.vue',
    'app/components/HubSettings.vue',
  ]

  /** `{{ n }} Minuten` — an interpolation, a space, and a plural noun. */
  const BARE = /\}\}\s*(Minuten|Requests|Platten|Entitäten|Versandstaffeln|Treffer)\b/

  for (const file of FILES) {
    it(`${file} asks the helper`, () => {
      const source = readFileSync(file, 'utf8')
      const offender = source.split('\n').find((line) => BARE.test(line))
      expect(offender, `pluralisiert selbst: ${offender}`).toBeUndefined()
    })
  }
})
