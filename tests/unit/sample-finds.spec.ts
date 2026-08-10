import { describe, expect, it } from 'vitest'

import { SAMPLE_FINDS } from '~/utils/sample-finds'
import { buildReason } from '~~/worker/match/reason'

/**
 * Die Beispiele sind Ergebnisse, keine Prosa.
 *
 * The setup screen shows what the app produces before asking for a Discogs
 * token — which only helps if what it shows is what the app would actually
 * say. A hand-written example is marketing copy the moment the reason
 * templates change, and nothing would notice.
 *
 * So the sentences are not compared to a fixture: they are recomputed from the
 * signals behind them by the same function the dig uses.
 */
describe('the examples on the setup screen', () => {
  for (const find of SAMPLE_FINDS) {
    it(`says what the app says: "${find.reason.slice(0, 45)}…"`, () => {
      expect(buildReason(find.signals)).toBe(find.reason)
    })
  }

  it('shows more than one kind of reason', () => {
    // Three identical-looking finds would teach a newcomer that Fidelity only
    // knows one trick. It knows eleven; these are three of them.
    const kinds = new Set(SAMPLE_FINDS.map((find) => find.signals[0]!.type))
    expect(kinds.size).toBeGreaterThanOrEqual(3)
  })

  it('runs in the order a dig runs', () => {
    // A dig lists its results strongest first. Examples in another order teach
    // the wrong thing about the list somebody is about to see.
    const scores = SAMPLE_FINDS.map((find) => find.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('stays on the scale the dig uses', () => {
    for (const find of SAMPLE_FINDS) {
      expect(find.score).toBeGreaterThan(0)
      expect(find.score).toBeLessThanOrEqual(100)
    }
  })
})
