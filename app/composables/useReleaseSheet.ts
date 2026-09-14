// Named, so a plain Vitest process can import this module without Nuxt's
// auto-imports — the walk arithmetic below is worth testing on its own.
import { computed, readonly, ref, shallowRef } from 'vue'

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
  // No document at all in a plain test process — and nothing to animate there.
  if (typeof document === 'undefined') {
    change()
    return
  }
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

/**
 * Whether this sheet was reached by stepping rather than by tapping a card.
 *
 * It decides one thing: whether the sheet looks the *next* record up before
 * anybody asks for it (M31.15). Opening one record is not evidence that
 * somebody wants a second, and a request spent on a guess is a request spent.
 * Pressing the arrow once is evidence — from there on the next one is fetched
 * while the current one is being read, in a slot that would otherwise be idle.
 */
const stepped = ref(false)

export function useReleaseSheet() {
  return {
    open: readonly(open),
    walk,
    stepped: readonly(stepped),
    show: (digId: string, listingId: number) =>
      transition(() => {
        stepped.value = false
        open.value = { digId, listingId }
      }),
    /** The same move, from the arrows — and the app may read ahead from here. */
    step: (digId: string, listingId: number) =>
      transition(() => {
        stepped.value = true
        open.value = { digId, listingId }
      }),
    hide: () =>
      transition(() => {
        stepped.value = false
        open.value = null
      }),
    /** The reading order of the list on screen. Null while none is shown. */
    setOrder: (found: { digId: string; ids: number[] } | null) => (order.value = found),
  }
}
