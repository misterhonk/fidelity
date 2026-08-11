import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useLanguage } from '~/composables/useMessages'
import { pressingText } from '~/i18n/pressing'

import {
  pressingContradictions,
  pressingWarnings,
  readPressing,
  REISSUE_YEAR_GAP,
  type ReleaseFacts,
} from '~~/worker/match/pressing'

/**
 * The three pressings of Blue Note's "Newk's Time", pulled live from the API
 * on 2026-08-09 while verifying the field (docs/02). Real runouts, real
 * descriptions — the whole milestone rests on this shape being right.
 */
const ORIGINAL_1959: ReleaseFacts = {
  country: 'US',
  year: 1959,
  formats: [
    { name: 'Vinyl', text: 'Plastylite Pressing', descriptions: ['LP', 'Album', 'Mono'] },
  ],
  identifiers: [
    { type: 'Matrix / Runout', value: 'BN-LP-4001-A [ear] M9 RVG' },
    { type: 'Matrix / Runout', value: 'BN-LP-4001-B [ear] M9 RVG' },
  ],
}

const REISSUE_2015: ReleaseFacts = {
  country: 'US',
  year: 2015,
  formats: [
    { name: 'Vinyl', descriptions: ['LP', 'Album', 'Reissue', 'Remastered', 'Stereo'] },
  ],
  identifiers: [
    { type: 'Matrix / Runout', value: 'B0022336-01 -A G1 IS Ⓤ' },
    { type: 'Matrix / Runout', value: 'MASTERED BY CAPITOL' },
  ],
}

const REISSUE_2023: ReleaseFacts = {
  country: 'Worldwide',
  year: 2023,
  formats: [
    { name: 'Vinyl', text: '180g', descriptions: ['LP', 'Album', 'Reissue', 'Stereo'] },
  ],
  identifiers: [{ type: 'Matrix / Runout', value: 'BNST 84001-A' }],
}

describe('reading what a pressing is', () => {
  it('recognises RVG and the Plastylite ear on the 1959 original', () => {
    const profile = readPressing(ORIGINAL_1959, 1959)

    expect(profile.stamps.map((s) => s.key).sort()).toEqual(['PLASTYLITE', 'RVG'])
    expect(profile.statedReissue).toBe(false)
    expect(profile.yearGap).toBe(0)
  })

  it('takes Discogs at its word on a reissue rather than inferring one', () => {
    // "Reissue" is a field Discogs fills in. That is not a heuristic.
    expect(readPressing(REISSUE_2015, 1959).statedReissue).toBe(true)
    expect(readPressing(REISSUE_2023, 1959).statedReissue).toBe(true)
  })

  it('measures the gap to the album, not to nothing', () => {
    // A year on its own says nothing; 2015 against 1959 says everything.
    expect(readPressing(REISSUE_2015, 1959).yearGap).toBe(56)
    expect(readPressing(REISSUE_2015, null).yearGap).toBeNull()
  })

  it('keeps the runouts so somebody can check the groove themselves', () => {
    expect(readPressing(ORIGINAL_1959, 1959).runouts).toHaveLength(2)
    expect(readPressing(ORIGINAL_1959, 1959).freeText).toEqual(['Plastylite Pressing'])
  })

  it('reads the pressing plant when Discogs names it', () => {
    const profile = readPressing(
      { identifiers: [{ type: 'Pressing Plant ID', value: 'SRC' }] },
      null,
    )
    expect(profile.plant).toBe('SRC')
  })

  it('does not invent a stamp out of a longer word', () => {
    // A runout is hand-transcribed and full of noise. "MASTERING" must not
    // become Sterling, and "CURL" must not become RL.
    const noise = readPressing(
      { identifiers: [{ type: 'Matrix / Runout', value: 'MASTERING CURL RVGX STERLINGS' }] },
      null,
    )
    expect(noise.stamps).toEqual([])
  })

  it('finds a stamp that sits in the free text rather than the groove', () => {
    const profile = readPressing(
      { formats: [{ text: 'Plastylite Pressing', descriptions: ['LP'] }] },
      null,
    )
    expect(profile.stamps.map((s) => s.key)).toEqual(['PLASTYLITE'])
  })

  it('says nothing at all about a release with no data', () => {
    const empty = readPressing({}, null)
    expect(empty).toMatchObject({
      statedReissue: false,
      stamps: [],
      runouts: [],
      plant: null,
      country: null,
      year: null,
      yearGap: null,
    })
  })
})

describe('the trap warning', () => {
  it('names the trap docs/06 M7 asks for', () => {
    const [warning] = pressingWarnings(readPressing(REISSUE_2015, 1959))
    expect(warning).toMatchObject({ kind: 'reissue', severity: 'high' })
    expect(warning?.facts).toEqual({ country: 'US', year: 2015, masterYear: 1959 })
    expect(pressingText(warning!)).toBe('US reissue from 2015, not the 1959 original.')
  })

  it('does not call "Worldwide" a country', () => {
    // A missing country is the fact; a sentence that starts "Worldwide reissue"
    // is what it used to produce.
    const [warning] = pressingWarnings(readPressing(REISSUE_2023, 1959))
    expect(warning?.facts.country).toBeNull()
    expect(pressingText(warning!)).toBe('reissue from 2023, not the 1959 original.')
  })

  it('says nothing about the original', () => {
    expect(pressingWarnings(readPressing(ORIGINAL_1959, 1959))).toEqual([])
  })

  it('is a suspicion, and worded as one, when nothing is stated', () => {
    const late = readPressing({ year: 1975, formats: [{ descriptions: ['LP'] }] }, 1959)
    const [warning] = pressingWarnings(late)
    expect(warning?.kind).toBe('late-pressing')
    expect(warning?.severity).toBe('medium')
    expect(pressingText(warning!)).toContain('probably not a first pressing')
  })

  it('lets a pressing run on a year or two without calling it a reissue', () => {
    const soon = readPressing({ year: 1961, formats: [{ descriptions: ['LP'] }] }, 1959)
    expect(pressingWarnings(soon)).toEqual([])
    expect(REISSUE_YEAR_GAP).toBe(3)
  })

  it('flags a promo, because a price means something different for one', () => {
    const promo = readPressing({ formats: [{ descriptions: ['LP', 'Promo'] }] }, null)
    expect(pressingWarnings(promo)[0]).toMatchObject({ kind: 'special' })
  })
})

describe('where the dealer and the data disagree', () => {
  const reissue = readPressing(REISSUE_2015, 1959)
  const original = readPressing(ORIGINAL_1959, 1959)

  it('catches "Original" written under a stated reissue', () => {
    const [warning] = pressingContradictions('Original US pressing, great copy', reissue)
    expect(warning).toMatchObject({ kind: 'claims-original-but-reissue', severity: 'high' })
  })

  it('catches it in German too', () => {
    expect(pressingContradictions('Erstpressung, top Zustand', reissue)).toHaveLength(1)
  })

  it('says nothing when the dealer is right', () => {
    expect(pressingContradictions('Original 1959 pressing', original)).toEqual([])
  })

  it('says nothing when the dealer already admits it', () => {
    // "Original album, this is the 2015 reissue" is not a contradiction.
    expect(pressingContradictions('Original album, 2015 reissue', reissue)).toEqual([])
  })

  it('says nothing without any comment to read', () => {
    expect(pressingContradictions(null, reissue)).toEqual([])
    expect(pressingContradictions('Near mint, plays great', reissue)).toEqual([])
  })

  it('is milder when only the year disagrees', () => {
    const late = readPressing({ year: 1975, formats: [{ descriptions: ['LP'] }] }, 1959)
    expect(pressingContradictions('original pressing', late)[0]?.severity).toBe('medium')
  })
})

/**
 * The case this milestone exists for, taken from a real dig at a real dealer
 * on 2026-08-09: the highest-scoring hit in the whole list, at 33,99 €, is a
 * 2017 European pressing of a 1994 album that sits on the wantlist.
 *
 * Every number here came off the API: release 10147986 resolves to master
 * 5542, and the horizon holds 1994 as that master's earliest year across 160
 * pressings.
 */
const DUMMY_2017: ReleaseFacts = {
  country: 'Europe',
  year: 2017,
  formats: [{ name: 'Vinyl', text: '180 Gram', descriptions: ['LP', 'Album', 'Reissue'] }],
  identifiers: [
    { type: 'Matrix / Runout', value: '828522-1-A2 -2348- Rc' },
    { type: 'Matrix / Runout', value: '828522-1-B2 -2348- Rc' },
  ],
}

describe('the top hit of a real dig', () => {
  const profile = readPressing(DUMMY_2017, 1994)

  it('says what the record actually is', () => {
    expect(pressingText(pressingWarnings(profile)[0]!)).toBe(
      'Europe reissue from 2017, not the 1994 original.',
    )
  })

  it('does not invent a stamp in a runout that has none', () => {
    // "-2348- Rc" is a plant code, not a mastering signature.
    expect(profile.stamps).toEqual([])
  })

  it('keeps quiet about the dealer, who claimed nothing', () => {
    // "SEALED NEW ITEM" is true of a sealed reissue. No contradiction.
    expect(pressingContradictions('SEALED NEW ITEM', profile)).toEqual([])
  })
})

/**
 * The same warnings in German.
 *
 * Every one of these interpolates a fact into a sentence, and the two phrase
 * tables are written by hand — so a fact that lands in the English sentence and
 * not in the German one is invisible unless both are read.
 */
describe('the same warnings, in German', () => {
  beforeEach(() => useLanguage().apply('de'))
  afterEach(() => useLanguage().apply('en'))

  it('names the record without calling a reissue bad', () => {
    const [warning] = pressingWarnings(readPressing(REISSUE_2015, 1959))
    expect(pressingText(warning!)).toBe('US-Neuauflage von 2015, nicht das Original von 1959.')
  })

  it('stays a suspicion when nothing is stated', () => {
    const late = readPressing({ year: 1975, formats: [{ descriptions: ['LP'] }] }, 1959)
    expect(pressingText(pressingWarnings(late)[0]!)).toContain('vermutlich')
  })
})
