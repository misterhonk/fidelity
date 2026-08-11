import { describe, expect, it } from 'vitest'

import { dealerFromInput } from '~/utils/dealer-input'

/**
 * Whatever somebody pastes into the dealer field.
 *
 * The field wanted a username; what people have is the address of the page
 * they are standing on. These are the shapes Discogs actually produces, plus
 * the ones that must be refused rather than sent to the API as if they were a
 * name.
 */
describe('what the dealer field accepts', () => {
  it('nimmt einen Namen, wie er ist', () => {
    expect(dealerFromInput('schoenwettermusik')).toBe('schoenwettermusik')
    expect(dealerFromInput('  fatplastics  ')).toBe('fatplastics')
  })

  it('nimmt Namen mit Punkt, Unterstrich und Bindestrich', () => {
    // All three are real shops. A stricter pattern would reject customers.
    expect(dealerFromInput('spirax.records')).toBe('spirax.records')
    expect(dealerFromInput('430AM_Studio')).toBe('430AM_Studio')
    expect(dealerFromInput('juno-records')).toBe('juno-records')
  })

  it('takes the name out of a dealer page', () => {
    expect(dealerFromInput('https://www.discogs.com/seller/schoenwettermusik/profile')).toBe(
      'schoenwettermusik',
    )
    expect(dealerFromInput('https://www.discogs.com/seller/fatplastics/mp?sort=listed')).toBe(
      'fatplastics',
    )
  })

  it('holt den Namen aus einer Nutzerseite', () => {
    expect(dealerFromInput('https://www.discogs.com/user/430AM_Studio')).toBe('430AM_Studio')
    expect(dealerFromInput('https://www.discogs.com/user/430AM_Studio/collection')).toBe(
      '430AM_Studio',
    )
  })

  it('survives the language prefix in the address', () => {
    // A link copied from a translated page carries /de/ or /pt_BR/. Without
    // this the whole address falls through as "not a username".
    expect(dealerFromInput('https://www.discogs.com/de/seller/spirax.records/profile')).toBe(
      'spirax.records',
    )
    expect(dealerFromInput('https://www.discogs.com/pt_BR/user/fatplastics')).toBe(
      'fatplastics',
    )
  })

  it('findet den Namen auch als Abfrageparameter', () => {
    expect(dealerFromInput('https://www.discogs.com/sell/list?user=fatplastics')).toBe(
      'fatplastics',
    )
    expect(
      dealerFromInput('https://www.discogs.com/sell/list?sort=price&user=juno_records'),
    ).toBe('juno_records')
  })

  it('kommt ohne Schema und ohne www aus', () => {
    expect(dealerFromInput('discogs.com/seller/schoenwettermusik/profile')).toBe(
      'schoenwettermusik',
    )
    expect(dealerFromInput('www.discogs.com/seller/schoenwettermusik')).toBe(
      'schoenwettermusik',
    )
  })

  it('undoes percent encoding', () => {
    // Otherwise it reaches the API encoded twice — the call site encodes again.
    expect(dealerFromInput('https://www.discogs.com/seller/spirax%2Erecords/profile')).toBe(
      'spirax.records',
    )
  })

  it('refuses what is not a dealer', () => {
    expect(dealerFromInput('')).toBeNull()
    expect(dealerFromInput('   ')).toBeNull()
    // A record, not a shop: the seller is not in this address, and finding out
    // would cost a request — see dealer-input.ts.
    expect(dealerFromInput('https://www.discogs.com/sell/item/4309313268')).toBeNull()
    // A release page.
    expect(
      dealerFromInput('https://www.discogs.com/release/636159-Kraftwerk-Das-Model'),
    ).toBeNull()
    // Free text.
    expect(dealerFromInput('der laden in jena')).toBeNull()
    expect(dealerFromInput('foo/bar')).toBeNull()
  })
})
