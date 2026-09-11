import type { InjectionKey, Ref } from 'vue'

import type { LandedContext, LandedPrice, Match } from '#shared/types'
import { landedPrice } from '#shared/shipping'

/**
 * The shop's postage, handed down to every card and row of a find list.
 *
 * Provided once by the dig page, which is the only screen that knows which
 * shop the list belongs to and asks the worker for its tiers and its basket
 * count (`basket.landed`). Injected by `MatchCard` and `MatchRow`, which are
 * also rendered on the shared-list screen and in the stack — there nobody
 * provides anything, the default is null, and the number simply does not
 * appear. Provide/inject rather than a prop through `MatchList`, because the
 * virtualised list would otherwise pass a value it never reads.
 */
const KEY: InjectionKey<Ref<LandedContext | null>> = Symbol('landed')

export function provideLanded(context: Ref<LandedContext | null>): void {
  provide(KEY, context)
}

export function useLanded() {
  const context = inject(KEY, null)
  return {
    context,
    of: (match: Match): LandedPrice | null =>
      context ? landedPrice(match, context.value) : null,
  }
}
