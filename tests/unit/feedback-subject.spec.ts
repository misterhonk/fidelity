import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'

import { feedbackSubject } from '~~/app/utils/feedback-subject'
import type { Match } from '#shared/types'

const match = (): Match =>
  ({
    digId: 'D1',
    listingId: 1,
    releaseId: 10,
    score: 71,
    signals: [{ type: 'ARTIST_KNOWN', confidence: 1, evidence: { artist: 'Robag', owned: 5 } }],
    reason: 'Weil.',
    title: 'Wuzzelbud KK',
    artist: 'Robag Wruhme',
    price: 19.99,
    currency: 'EUR',
    condition: 'Near Mint (NM or M-)',
    sleeve: 'Very Good Plus (VG+)',
    comments: 'kleine Delle',
    expired: false,
  }) as Match

describe('what a verdict sends', () => {
  it('survives structured clone even when the match came from a reactive ref', () => {
    /*
     * The regression this exists for.
     *
     * Structured clone rejects a Proxy outright, so a match read out of a deep
     * `ref` could not be posted to the worker at all — and because the verdict
     * button applies optimistically, it lit up and saved nothing, silently.
     */
    const proxied = reactive(match())
    expect(() => structuredClone(proxied)).toThrow()
    expect(() => structuredClone(feedbackSubject(proxied))).not.toThrow()
  })

  it('leaves behind everything the six-hour rule deletes', () => {
    const sent = feedbackSubject(match())
    // The offer expires. The verdict is meant to be permanent (docs/03 §7).
    expect(sent).not.toHaveProperty('price')
    expect(sent).not.toHaveProperty('condition')
    expect(sent).not.toHaveProperty('sleeve')
    expect(sent).not.toHaveProperty('comments')
  })

  it('takes the identity that makes it readable later', () => {
    // A dig is pruned at five. Two bare integers are not a shortlist.
    expect(feedbackSubject(match())).toMatchObject({
      listingId: 1,
      releaseId: 10,
      digId: 'D1',
      title: 'Wuzzelbud KK',
      artist: 'Robag Wruhme',
      score: 71,
    })
  })

  it('copies the signals rather than pointing at them', () => {
    const source = match()
    const sent = feedbackSubject(source)
    source.signals[0]!.evidence.owned = 99

    // The style pass rewrites signals in place after a scan; a snapshot that
    // changes afterwards is not one.
    expect(sent.signals[0]?.evidence.owned).toBe(5)
  })
})
