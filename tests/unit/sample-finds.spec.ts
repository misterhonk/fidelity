import { describe, expect, it } from 'vitest'

import { useLanguage, type Language } from '~/composables/useMessages'
import { packs, reasonFor } from '~/i18n/reason'
import { SAMPLE_FINDS } from '~/utils/sample-finds'

/**
 * The examples are results, not prose.
 *
 * The setup screen shows what the app produces before asking for a Discogs
 * token — which only helps if what it shows is what the app would actually
 * say. A hand-written example is marketing copy the moment the reason phrases
 * change, and nothing would notice.
 *
 * There is no fixture to compare against any more: the screen calls the same
 * `reasonFor` every dig result does, so the sentence cannot drift by
 * construction. What is left to check is that each example *has* something to
 * say — in every language, since the phrase tables are written by hand and a
 * signal with no phrase falls through to a sentence that says nothing.
 */
const LANGUAGES = Object.keys(packs) as Language[]

describe('the examples on the setup screen', () => {
  it.each(LANGUAGES)('says something specific in %s', async (language) => {
    await useLanguage().apply(language)

    for (const find of SAMPLE_FINDS) {
      const sentence = reasonFor(find.signals)
      expect(sentence, `score ${find.score}`).not.toBe('')
      expect(sentence, `score ${find.score}`).not.toBe(packs[language].fallback)
      // Every one of these was picked because it has runners-up worth naming.
      expect(sentence, `score ${find.score}`).toContain(
        packs[language].also('').trim().replace(/\.$/, ''),
      )
    }
  })

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
