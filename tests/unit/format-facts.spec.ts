import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { describeFormat, kindOf, MEDIUMS, mediumOf, sizeOf } from '#shared/format'

/**
 * Was auf der Platte steht, in Teilen, die jemand lesen will.
 *
 * The app knew the medium — it had to, for the filter — and showed neither it
 * nor anything else. A dig listed "Freude Am Tanzen · FAT 016 · 2003" and left
 * out whether that is a 7", a 12" or a CD, which for a record buyer is most of
 * the decision.
 *
 * Fixtures are real strings, counted out of two dealers' inventories today:
 * `7", Single` (101×), `CD, Album` (81×), `2xCD, Album, Mono, Dlx, RE, RM`.
 */
describe('the medium', () => {
  it('reads the ways Discogs writes vinyl', () => {
    for (const raw of ['7", Single', '12", 33 ⅓ RPM, EP', '2xLP, Album', 'Vinyl, LP, Album']) {
      expect(mediumOf(raw)).toBe('Vinyl')
    }
  })

  it('tells a reel from a cassette', () => {
    // Different machine, different money, different buyer. Folding reels into
    // cassettes would hand somebody a tape they cannot play.
    expect(mediumOf('Reel-To-Reel, 7 ½ ips, Album')).toBe('Reel-to-Reel')
    expect(mediumOf('Cass, Album')).toBe('Cassette')
  })

  it('offers one list for the filter and the display', () => {
    // The settings screen used to keep its own copy of these names.
    expect(MEDIUMS).toContain('Vinyl')
    expect(MEDIUMS).toContain('Reel-to-Reel')
  })

  it('is the list the settings screen offers', () => {
    // The copy is what let reels exist for the matcher and not for the person
    // choosing what to look for.
    const source = readFileSync('app/components/MatchPreferences.vue', 'utf8')
    expect(source).toContain('const FORMATS = MEDIUMS')
    expect(source).not.toMatch(/const FORMATS = \[/)
  })
})

describe('the kind of release', () => {
  it('reads the common ones', () => {
    expect(kindOf('7", Single')).toBe('Single')
    expect(kindOf('CD, Album')).toBe('Album')
    expect(kindOf('12", EP')).toBe('EP')
    expect(kindOf('CD, Comp')).toBe('Kompilation')
    expect(kindOf('3xLP, Box Set')).toBe('Box')
  })

  it('does not call a maxi a single', () => {
    // "Maxi-Single" contains "Single". Order decides, and a 12" maxi is not
    // the 7" somebody was looking for.
    expect(kindOf('12", Maxi-Single, 45 RPM')).toBe('Maxi')
  })

  it('says nothing where the string says nothing', () => {
    expect(kindOf('7"')).toBeNull()
    expect(kindOf(null)).toBeNull()
  })
})

describe('the size', () => {
  it('reads what a vinyl buyer reads first', () => {
    expect(sizeOf('7", Single')).toBe('7"')
    expect(sizeOf('12", 33 ⅓ RPM, EP')).toBe('12"')
    expect(sizeOf('CD, Album')).toBeNull()
  })
})

describe('all three at once', () => {
  it('keeps only what is worth a glance', () => {
    // Mono, Dlx, RE and RM are real and belong in the pressing profile, not in
    // a line somebody scans.
    expect(describeFormat('2xCD, Album, Mono, Dlx, RE, RM')).toEqual({
      medium: 'CD',
      kind: 'Album',
      size: null,
    })
    expect(describeFormat('7", Single, RE')).toEqual({
      medium: 'Vinyl',
      kind: 'Single',
      size: '7"',
    })
  })
})
