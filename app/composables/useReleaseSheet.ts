/**
 * Which record's detail sheet is open, and the transition that opens it.
 *
 * App-wide state rather than per-list, because the shortlist and the long list
 * are two components rendering the same records and only one sheet may ever be
 * open.
 */
const open = shallowRef<{ digId: string; listingId: number } | null>(null)

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

export function useReleaseSheet() {
  return {
    open: readonly(open),
    show: (digId: string, listingId: number) =>
      transition(() => (open.value = { digId, listingId })),
    hide: () => transition(() => (open.value = null)),
  }
}
