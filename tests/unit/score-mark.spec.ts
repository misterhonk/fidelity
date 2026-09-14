import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

import { bandOf, bandStep, BANDS } from '#shared/score'
import { gradeKey, GRADES } from '#shared/format'
import en from '~/i18n/en'
import de from '~/i18n/de'

/**
 * The score, saying what it means (M31.1).
 *
 * Asked in front of a find on 2026-09-14: *"48 C? Why 48 — that feels low —
 * and what does the C stand for?"* Both halves had answers and neither was on
 * the screen: the band names lived in an `aria-label`, and the scale itself
 * was unexplained anywhere in the interface.
 */
describe('which band a score falls into', () => {
  /** The thresholds are docs/04 §4's, and the boundaries are where they bite. */
  it('draws the lines where the engine draws them', () => {
    expect(bandOf(100)).toBe('S')
    expect(bandOf(85)).toBe('S')
    expect(bandOf(84)).toBe('A')
    expect(bandOf(70)).toBe('A')
    expect(bandOf(69)).toBe('B')
    expect(bandOf(50)).toBe('B')
    expect(bandOf(49)).toBe('C')
    expect(bandOf(0)).toBe('C')
  })

  /**
   * The calibration table of docs/04 §4, read back.
   *
   * Not a duplicate of the scoring test: that one checks the arithmetic, this
   * one checks that the *words* a reader is shown still match the rows the
   * documentation promises. The row that was asked about is the third.
   */
  it('agrees with the worked examples in docs/04', () => {
    expect(bandOf(96)).toBe('S') // wantlist exact + price signal
    expect(bandOf(87)).toBe('S') // wantlist exact alone
    expect(bandOf(63)).toBe('B') // discography gap + catalogue run
    expect(bandOf(48)).toBe('C') // artist known, and nothing else
  })

  it('lights one rung of four at the bottom and all four at the top', () => {
    expect(bandStep('C')).toBe(1)
    expect(bandStep('B')).toBe(2)
    expect(bandStep('A')).toBe(3)
    expect(bandStep('S')).toBe(BANDS.length)
  })

  /**
   * Every band has a word, in both languages.
   *
   * Read out of the pack's source rather than imported: the dig messages are a
   * lazy area pack, and pulling it into a plain Vitest process would drag the
   * composable that loads it along. Two `band:` blocks, one per language, and
   * every letter named in both.
   */
  it('has a name for every band, in both languages', () => {
    const dig = readFileSync('app/i18n/dig.ts', 'utf8')
    const blocks = [...dig.matchAll(/band: \{([^}]*)\}/g)].map((hit) => hit[1]!)
    expect(blocks).toHaveLength(2)

    for (const block of blocks) {
      for (const band of BANDS) {
        expect(block, band).toMatch(new RegExp(`\\b${band}: '[^']+'`))
      }
    }
  })
})

/**
 * And the number explains itself in two places at once.
 *
 * The question mark carries the formula; the sheet puts the score beside the
 * signals it was computed from, which is the explanation that needs no
 * disclosure at all.
 */
describe('how the score is shown', () => {
  const MARK = withoutComments(readFileSync('app/components/ScoreMark.vue', 'utf8'))
  const CARD = withoutComments(readFileSync('app/components/MatchCard.vue', 'utf8'))
  const SHEET = withoutComments(readFileSync('app/components/ReleaseSheet.vue', 'utf8'))

  it('shows the word, never a bare band letter', () => {
    expect(MARK).toMatch(/d\.value\.match\.band\[band\.value\]/)
    // The old card printed `band.key` — a letter with no legend on the screen.
    expect(CARD).not.toMatch(/band\.key/)
  })

  /** The mark is one component, so the two screens cannot drift apart. */
  it('is the same component on the card and on the sheet', () => {
    expect(CARD).toMatch(/<ScoreMark :score="match\.score" \/>/)
    expect(SHEET).toMatch(/<ScoreMark :score="match\.score" block \/>/)
  })

  /**
   * An icon-only control needs its name spoken and shown (the rule for every
   * such control in this app: a glyph nobody can read is not a control).
   */
  it('names the question mark for a screen reader and for a pointer', () => {
    const summary = MARK.slice(MARK.indexOf('<summary'), MARK.indexOf('</summary>'))
    expect(summary).toMatch(/:aria-label="d\.match\.scoreWhat"/)
    expect(summary).toMatch(/:title="d\.match\.scoreWhat"/)
  })

  /** The ladder is a picture of the number beside it, not a second reading. */
  it('hides the ladder from screen readers', () => {
    const ladder = MARK.slice(MARK.indexOf('BANDS.length') - 400, MARK.indexOf('BANDS.length'))
    expect(ladder).toMatch(/aria-hidden="true"/)
  })

  /** And the sheet stands it next to the reasons, not in a corner. */
  it('puts the sheet score beside the signals', () => {
    const section = SHEET.slice(SHEET.indexOf('sheet-signals'))
    expect(section.slice(0, 400)).toMatch(/<ScoreMark/)
  })
})

/**
 * The grades in words (M31.2).
 *
 * "Very Good Plus (VG+)" is a Discogs vocabulary item, not an answer — and for
 * somebody three weeks into collecting it is the biggest hurdle on the screen.
 */
describe('a grade in words', () => {
  it('has a key for every grade Discogs uses', () => {
    for (const grade of GRADES) {
      expect(gradeKey(grade), grade).toBeTruthy()
    }
  })

  it('gives null rather than a guess for anything else', () => {
    expect(gradeKey('Very Good Plus')).toBeNull()
    expect(gradeKey('')).toBeNull()
    expect(gradeKey(null)).toBeNull()
    expect(gradeKey(undefined)).toBeNull()
  })

  /** Both packs answer for every one of them, or the sentence is missing in one language. */
  it('has a sentence for every grade, in both languages', () => {
    for (const grade of GRADES) {
      const key = gradeKey(grade)!
      expect(en.grades[key], `${grade} in English`).toBeTruthy()
      expect(de.grades[key], `${grade} in German`).toBeTruthy()
      // An answer about listening, not a restatement of the abbreviation.
      expect(en.grades[key]).not.toContain(grade)
    }
  })

  /** And the sheet actually shows it, under the grade rather than on hover. */
  it('stands under the grading on the sheet, where a phone can read it too', () => {
    const sheet = withoutComments(readFileSync('app/components/ReleaseSheet.vue', 'utf8'))
    expect(sheet).toMatch(/gradeWord\(match\.condition\)/)
    expect(sheet).toMatch(/gradeWord\(match\.sleeve\)/)
  })
})

/**
 * And the box at the head of the sheet has a job.
 *
 * Reported the same day as "unstyled typography": a mono line, a couple of
 * gradings and a floating number — and once a dig passed six hours the
 * marketplace fields were nulled and only the mono line and the number stayed.
 */
describe('the offer at the head of the sheet', () => {
  const SHEET = withoutComments(readFileSync('app/components/ReleaseSheet.vue', 'utf8'))

  it('labels its values instead of running them together', () => {
    expect(SHEET).toMatch(/d\.sheet\.offer\.price/)
    expect(SHEET).toMatch(/d\.sheet\.offer\.media/)
    expect(SHEET).toMatch(/d\.sheet\.offer\.sleeve/)
  })

  /** Six hours on, it says why there is no price — rather than showing a gap. */
  it('says what happened instead of emptying out', () => {
    expect(SHEET).toMatch(/v-else-if="match\.expired"/)
    expect(SHEET).toMatch(/d\.expired/)
  })
})
