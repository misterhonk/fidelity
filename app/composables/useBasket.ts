import type { BasketView } from '#shared/types'

/**
 * The basket, shared by every card and by the basket screen.
 *
 * One piece of app-wide state rather than per-component, for the same reason
 * the verdicts are: the same listing appears in the shortlist and the long
 * list, and two buttons disagreeing about whether a record is in the basket is
 * a bug somebody sees immediately.
 */
const view = shallowRef<BasketView>({ baskets: [], listingIds: [] })
const ids = shallowRef(new Set<number>())
/** The last add or remove that did not survive the trip to the worker. */
const failure = shallowRef<unknown>(null)
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
    const before = ids.value
    failure.value = null

    const optimistic = new Set(ids.value)
    if (inBasket) optimistic.delete(listingId)
    else optimistic.add(listingId)
    ids.value = optimistic

    try {
      apply(
        inBasket
          ? await call('basket.remove', { listingId })
          : await call('basket.add', { digId, listingId }),
      )
    } catch (cause) {
      // Rolled back. A record that looks like it is in the basket and is not
      // is the one lie this screen must never tell — the whole point of it is
      // knowing what an order will cost before Discogs says so.
      ids.value = before
      failure.value = cause
    }
  }

  async function clear() {
    apply(await call('basket.clear', undefined))
  }

  return {
    view: readonly(view),
    ids: readonly(ids),
    failure: readonly(failure),
    contains: (listingId: number) => ids.value.has(listingId),
    load,
    refresh,
    toggle,
    clear,
  }
}
