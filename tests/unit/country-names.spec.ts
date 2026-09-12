import { describe, expect, it } from 'vitest'

import { useLanguage } from '~/composables/useMessages'
import { countryName } from '~/utils/countries'

/** "Aus Germany" was a chip on 2026-09-12; Discogs writes English, the pack translates. */
describe('country names in the language of the app', () => {
  it('translates a known name in German and leaves the rest as written', async () => {
    await useLanguage().apply('de')
    expect(countryName('Germany')).toBe('Deutschland')
    expect(countryName('United Kingdom')).toBe('Vereinigtes Königreich')
    expect(countryName('Atlantis')).toBe('Atlantis')
    expect(countryName('')).toBe('')
  })

  it('keeps English in English', async () => {
    await useLanguage().apply('en')
    expect(countryName('Germany')).toBe('Germany')
  })
})
