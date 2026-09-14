/**
 * Which record's detail sheet is open, and the transition that opens it.
 *
 * App-wide state rather than per-list, because the shortlist and the long list
 * are two components rendering the same records and only one sheet may ever be
 * open.
 */
const open = shallowRef<{ digId: string; listingId: number } | null>(null)

/**
 * The list the sheet was opened from, so it can be walked without closing it.
 *
 * A find is judged against its neighbours — the one two rows down is the
 * reason you are looking at this one at all. Closing the sheet, finding your
 * place again and opening the next is three actions for a comparison, and on
 * a long list the place is genuinely hard to find again.
 *
 * Here rather than in a prop because the sheet hangs in the shell, outside
 * the page that owns the list, so nothing can be handed down to it. The dig
 * id comes with it: an order from one dig must never walk another one's
 * sheet, and a screen that sets none simply has no arrows.
 */
const order = shallowRef<{ digId: string; ids: number[] } | null>(null)

/**
 * Wraps a state change in a same-document View Transition where the browser
 * has one (docs/05 §4). Everything still works without it — the change just
 * happens instantly, which is also what somebody asking for reduced motion
 * gets, since the transition names are dropped under that media query.
 */
function transition(change: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> }
  }
  if (typeof doc.startViewTransition !== 'function') {
    change()
    return
  }
  doc.startViewTransition(change)
}

/** Where the open record stands in that list, and what is either side of it. */
const walk = computed(() => {
  const list = order.value
  const at = open.value
  if (!list || !at || list.digId !== at.digId) return null
  const index = list.ids.indexOf(at.listingId)
  if (index < 0) return null
  return {
    index,
    total: list.ids.length,
    previous: list.ids[index - 1] ?? null,
    next: list.ids[index + 1] ?? null,
  }
})

export function useReleaseSheet() {
  return {
    open: readonly(open),
    walk,
    show: (digId: string, listingId: number) =>
      transition(() => (open.value = { digId, listingId })),
    hide: () => transition(() => (open.value = null)),
    /** The reading order of the list on screen. Null while none is shown. */
    setOrder: (found: { digId: string; ids: number[] } | null) => (order.value = found),
  }
}
