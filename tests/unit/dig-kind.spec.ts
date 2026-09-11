import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { withoutComments } from '../helpers/german'

import { digKind } from '~/utils/dig-kind'

/**
 * What a dig is entitled to say anything about.
 *
 * Found by looking at a real result screen: an incremental visit to a shop
 * holding 35.900 records reported
 *
 *     0 of 0 scanned (100 %)
 *     Nothing here for you at this dealer. That is a result, not a fault.
 *
 * Both numbers are what the record actually holds — an incremental dig's
 * denominator is what it found, and `coverage` is 1 by construction because it
 * stops exactly where the known stock begins. Rendered with the sentences a
 * full dig uses, they became a coverage claim and a verdict about a shop the
 * visit never looked at.
 *
 * The worker was already careful here (it refuses to write an incremental
 * dig's hit rate or fingerprint onto the dealer, tests/unit/dig-since.spec.ts).
 * Only the screen was not.
 */
const dig = (depth: 'normal' | 'deep' | 'neu' | undefined, listingsTotal: number) => ({
  depth,
  listingsTotal,
})

describe('what a dig is entitled to claim', () => {
  it('lets a full dig speak about the shop', () => {
    expect(digKind(dig('normal', 2881))).toBe('full')
    expect(digKind(dig('deep', 35900))).toBe('full')
  })

  it('treats a dig from before the depth field as full', () => {
    // 'normal' is what absent means (shared/types.ts), and reading it as
    // incremental would silently relabel every dig run before M-whatever.
    expect(digKind(dig(undefined, 2881))).toBe('full')
  })

  it('separates an incremental visit that found something', () => {
    expect(digKind(dig('neu', 4))).toBe('incremental')
  })

  it('separates the one that found nothing', () => {
    // The case that produced the wrong sentence. It is not "nothing here for
    // you" — it is "nothing new since you last looked", and the difference is
    // 35.900 records nobody re-read.
    expect(digKind(dig('neu', 0))).toBe('incremental-empty')
  })

  it('never calls an incremental visit full, whatever it found', () => {
    for (const found of [0, 1, 50, 20_000]) {
      expect(digKind(dig('neu', found))).not.toBe('full')
    }
  })
})

/**
 * No acquittal without a basis.
 *
 * "Nothing here for you at this dealer. That is a result, not a fault." is a
 * verdict on the shop. Without a horizon the app cannot reach it: it then
 * knows only the exact release ids of your own records — no other pressing, no
 * same artist, no same label.
 *
 * On 2026-08-13 that exact sentence stood there after 2,863 records had been
 * looked through, while the horizon consisted of a single entry with nine ids.
 * It sent the debugging at the scan for hours, and the scan was perfectly
 * fine.
 *
 * The shape is what is checked: the condition is a decision, and it is visible
 * in the source. No browser is needed for that.
 */
describe('the verdict a dig is allowed to give', () => {
  const DIG = readFileSync('app/pages/dig.vue', 'utf8')

  /**
   * Without comments, because this file explains the decision it checks.
   *
   * The source writes "Not `builtAt === null`" as its reasoning — and a check
   * insisting on the absence of that string would otherwise trip over its own
   * explanation. The same trap is in `template-text.spec.ts`.
   */
  const code = withoutComments(DIG)

  it('asks about the horizon before absolving the shop', () => {
    expect(DIG).toMatch(/await call\('horizon\.status', undefined\)/)
    expect(DIG).toMatch(/result\.matches\.length === 0 && noHorizon/)
  })

  /**
   * On `expanded`, that is, not on `builtAt`.
   *
   * A horizon whose chunks have expired is no more of a basis — but with a
   * date from back then would look like one.
   */
  it('measures what is expanded, not when something was once built', () => {
    expect(code).toMatch(/horizon\.value\.entities > 0 && horizon\.value\.expanded === 0/)
    expect(code).not.toMatch(/builtAt === null/)
  })

  /** The old sentence stays — for the case where it is true. */
  it('keeps the plain answer for a dig that really found nothing', () => {
    expect(DIG).toMatch(/v-else-if="result\.matches\.length === 0"/)
  })

  /** And says where it can be fixed. A finding with no way out is a complaint. */
  it('points at the place that fixes it', () => {
    expect(DIG).toMatch(/to="\/settings\/collection"/)
  })
})
