import type { BasketView } from '#shared/types'

/**
 * The basket, shared by every card and by the basket screen.
 *
 * One piece of app-wide state rather than per-component, for the same reason
 * the verdicts are: the same listing appears in the shortlist and the long
 * list, and two buttons disagreeing about whether a record is in the basket is
 * a bug somebody sees immediately.
 */
const view = shallowRef<BasketView>({ summary: null, listingIds: [], candidates: [] })
const ids = shallowRef(new Set<number>())
let loaded = false

function apply(next: BasketView) {
  view.value = next
  ids.value = new Set(next.listingIds)
}

export function useBasket() {
  const { call } = useFidelityWorker()

  async function load() {
    if (loaded) return
    loaded = true
    apply(await call('basket.get', undefined))
  }

  async function refresh() {
    apply(await call('basket.get', undefined))
  }

  /**
   * Adding and removing are the same button. Optimistic, because the worker is
   * often halfway through a rate-limited scan and a button that waits for it
   * feels broken even though nothing is (docs/05 §4 allows optimistic UI for
   * exactly this and not for anything with real money in it).
   */
  async function toggle(digId: string, listingId: number) {
    const inBasket = ids.value.has(listingId)

    const optimistic = new Set(ids.value)
    if (inBasket) optimistic.delete(listingId)
    else optimistic.add(listingId)
    ids.value = optimistic

    apply(
      inBasket
        ? await call('basket.remove', { listingId })
        : await call('basket.add', { digId, listingId }),
    )
  }

  async function clear() {
    apply(await call('basket.clear', undefined))
  }

  return {
    view: readonly(view),
    ids: readonly(ids),
    contains: (listingId: number) => ids.value.has(listingId),
    load,
    refresh,
    toggle,
    clear,
  }
}
