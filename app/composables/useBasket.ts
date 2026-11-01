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
/** The last add, remove or undo that did not survive the trip to the worker. */
const failure = shallowRef<unknown>(null)
/** The last line taken out, for the undo line (#221). Lives here, not in the card: the card is gone with its last line. */
const removed = shallowRef<{ listingId: number; title: string } | null>(null)
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
    removed.value = null

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
    // An undo after emptying would put one line back into a basket just cleared.
    removed.value = null
    apply(await call('basket.clear', undefined))
  }

  async function remove(listingId: number, title: string) {
    failure.value = null
    try {
      apply(await call('basket.remove', { listingId }))
      removed.value = { listingId, title }
    } catch (cause) {
      failure.value = cause
    }
  }

  async function undoRemove() {
    const last = removed.value
    if (!last) return
    failure.value = null
    try {
      apply(await call('basket.restore', { listingId: last.listingId }))
      // Only now: a restore that failed keeps its undo line for another try.
      removed.value = null
    } catch (cause) {
      failure.value = cause
    }
  }

  /** The page is left: the undo line goes with it. */
  function forgetRemoved() {
    removed.value = null
  }

  return {
    view: readonly(view),
    ids: readonly(ids),
    failure: readonly(failure),
    removed: readonly(removed),
    contains: (listingId: number) => ids.value.has(listingId),
    load,
    refresh,
    toggle,
    clear,
    remove,
    undoRemove,
    forgetRemoved,
  }
}
