import type { InjectionKey, Ref } from 'vue'

import type { Match, SignalType } from '#shared/types'
import { leadOf } from '~/utils/digview'

/**
 * Which reasons this list repeats often enough to be categories (M33 #1).
 *
 * Provided by `MatchList`, because only the list can see the repetition: a
 * card knows its own reason and nothing about the twenty above it. Injected by
 * the card, because only the card draws — which keeps the decision where the
 * roadmap put it, "the list sees it, the card decides what to draw".
 *
 * Provide/inject rather than a prop for the same reason `useLanded` uses it:
 * the same card is rendered in the top five, in the stack, on the shared-list
 * screen and in the basket, and none of those is a list long enough for a
 * reason to wear out. There nobody provides anything, the default is empty,
 * and every card keeps its sentence.
 */
const KEY: InjectionKey<Ref<Set<SignalType>>> = Symbol('leads')

export function provideLeads(repeated: Ref<Set<SignalType>>): void {
  provide(KEY, repeated)
}

export function useLeads() {
  const repeated = inject(KEY, null)

  return {
    /**
     * Whether this card is one of many in a find list at all (M33 #4).
     *
     * The same fact the plate is derived from, read the other way round: a
     * provider exists exactly where `MatchList` is drawing, and nowhere else.
     * What hangs off it is anything a card should say once per list rather
     * than once per card — the help mark under the score, which repeated
     * twenty-seven times on the walk of 2026-09-16 and answers the same
     * question every time.
     *
     * A plain boolean, not a ref: whether a component sits inside a list
     * cannot change while it is mounted.
     */
    inList: repeated !== null,

    /**
     * The signal this find should wear as a plate instead of a sentence, or
     * null to say it as a sentence like always.
     */
    plated: (match: Match): SignalType | null => {
      const lead = leadOf(match)
      return lead && repeated?.value.has(lead) ? lead : null
    },
  }
}
