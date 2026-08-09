import { describe, expect, it } from 'vitest'

import { isAnonymousArtist, norm, tokens } from '~~/worker/match/normalize'

describe('name normalisation', () => {
  it.each([
    ['The Beatles', 'beatles'],
    ['Die Krupps', 'krupps'],
    ['Los Lobos', 'lobos'],
    ['Björk', 'bjork'],
    ['Sigur Rós', 'sigur ros'],
    ['Motörhead', 'motorhead'],
    ['AC/DC', 'ac dc'],
    ['Kraftwerk / Neu!', 'kraftwerk neu'],
    ['Simon & Garfunkel', 'simon & garfunkel'],
    ['  Neu!   2  ', 'neu 2'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(norm(input)).toBe(expected)
  })

  it('keeps disambiguation suffixes — they mark a different artist', () => {
    expect(norm('Nirvana (2)')).toBe('nirvana (2)')
    expect(norm('Nirvana (2)')).not.toBe(norm('Nirvana'))
  })

  it('folds letters that carry no combining mark', () => {
    // These survive NFD untouched, so a naive decomposition misses them.
    expect(norm('Ø')).toBe('o')
    expect(norm('Straße')).toBe('strasse')
    expect(norm('Mötley Crüe')).toBe('motley crue')
  })

  it('handles null and undefined like an empty name', () => {
    expect(norm(null)).toBe('')
    expect(norm(undefined)).toBe('')
  })

  it('is idempotent', () => {
    for (const name of ['The Beatles', 'Björk', 'Nirvana (2)', 'Kraftwerk / Neu!']) {
      expect(norm(norm(name))).toBe(norm(name))
    }
  })

  it('only strips a leading article, not one in the middle', () => {
    expect(norm('Death In June')).toBe('death in june')
    expect(norm('The The')).toBe('the')
  })
})

describe('anonymous artists', () => {
  it.each(['Various', 'Various Artists', 'V/A', 'Unknown Artist'])(
    '%s never counts as an artist match',
    (name) => {
      expect(isAnonymousArtist(norm(name))).toBe(true)
    },
  )

  it('does not swallow a real artist', () => {
    expect(isAnonymousArtist(norm('Various Production'))).toBe(false)
  })
})

describe('tokens', () => {
  it('splits a multi-artist string for the containment stage', () => {
    expect(tokens(norm('Kraftwerk / Neu!'))).toEqual(['kraftwerk', 'neu'])
  })

  it('drops single characters, which match everything and mean nothing', () => {
    expect(tokens(norm('A R Kane'))).toEqual(['kane'])
  })
})
