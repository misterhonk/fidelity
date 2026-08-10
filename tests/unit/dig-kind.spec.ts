import { describe, expect, it } from 'vitest'

import { digKind } from '~/utils/dig-kind'

/**
 * Worüber ein Dig etwas sagen darf.
 *
 * Found by looking at a real result screen: a "nur das Neue" visit to a shop
 * holding 35.900 records reported
 *
 *     0 von 0 gescannt (100 %)
 *     Bei diesem Händler nichts für dich. Das ist ein Ergebnis, kein Fehler.
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
