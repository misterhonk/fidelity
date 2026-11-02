// Named, so a plain Vitest process can import this module without Nuxt's
// auto-imports — the walk arithmetic below is worth testing on its own.
import { computed, nextTick, readonly, ref, shallowRef } from 'vue'

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
 * The cover in the list the open sheet grew out of, so closing can shrink the
 * sheet's cover back into it (#226). Null when the sheet was opened from
 * anywhere without a cover — an address, the palette — or walked away from it.
 */
let sleeve: HTMLElement | null = null

/** The one name the list's cover and the sheet's cover share, never both at once. */
export const COVER_MORPH = 'fid-cover'

/**
 * Resolves the wait for the sheet's new picture (#226). The sheet's cover is
 * only drawn once `dig.detail` has answered, and a picture taken before that
 * has no cover in it for the list's one to grow into. Capped: a slow answer
 * gets a plain crossfade rather than a frozen screen.
 */
let settle: (() => void) | null = null
const SETTLE_CAP_MS = 250

function ready(): Promise<void> {
  return new Promise((resolve) => {
    settle = resolve
    setTimeout(resolve, SETTLE_CAP_MS)
  })
}

/**
 * When the browser last animated a Back itself — a swipe on iOS. Back reaches
 * the sheet through the address (app.vue), a moment after `popstate`; a
 * transition of ours on top would play the same move twice.
 */
let swipedAt = -Infinity
const SWIPE_WINDOW_MS = 1000
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (event) => {
    const ua = (event as PopStateEvent & { hasUAVisualTransition?: boolean })
      .hasUAVisualTransition
    swipedAt = ua ? performance.now() : -Infinity
  })
}

function name(el: HTMLElement | null, value: string) {
  if (el) el.style.viewTransitionName = value
}

/**
 * Wraps a state change in a same-document View Transition where the browser
 * has one (docs/05 §4). Everything still works without it — the change just
 * happens instantly, which is also what somebody asking for reduced motion
 * gets: no transition is started for them at all.
 *
 * `before` is the cover named in the old picture, `after` the one named in the
 * new; the sheet's own cover carries the name for as long as it is open. A
 * name may stand on only one element per picture, so each is taken off again
 * the moment its picture has been taken.
 */
function transition(
  change: () => void,
  before: HTMLElement | null = null,
  after = before,
  wait = false,
) {
  // No document at all in a plain test process — and nothing to animate there.
  if (typeof document === 'undefined') {
    change()
    return
  }
  const doc = document as Document & {
    startViewTransition?: (cb: () => Promise<void>) => {
      ready: Promise<void>
      finished: Promise<void>
    }
  }
  // Reduced motion gets the change at once, not a paint hold with nothing moving in it.
  const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const swiped = performance.now() - swipedAt < SWIPE_WINDOW_MS
  if (typeof doc.startViewTransition !== 'function' || still || swiped) {
    change()
    return
  }
  name(before, COVER_MORPH)
  const running = doc.startViewTransition(async () => {
    name(before, '')
    // Armed before the change, so a sheet that is ready at once cannot miss it.
    const settled = wait ? ready() : null
    change()
    // Vue patches the DOM on the next tick; the new picture must wait for it.
    await nextTick()
    if (settled) {
      await settled
      await nextTick()
    }
    if (after !== before) name(after, COVER_MORPH)
  })
  // A transition skipped by a newer one is not an error anybody can act on.
  running.ready.catch(() => {})
  running.finished.finally(() => name(after, '')).catch(() => {})
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
    /** `from` is the find's card or row; its cover grows into the sheet's. */
    show: (digId: string, listingId: number, from?: HTMLElement | null) => {
      // The picture, or the label sleeve standing in for it: most finds have no cover.
      sleeve = from?.querySelector<HTMLElement>('[data-sleeve]') ?? null
      transition(
        () => {
          stepped.value = false
          open.value = { digId, listingId }
        },
        sleeve,
        null,
        true,
      )
    },
    /** The same move, from the arrows — and the app may read ahead from here. */
    step: (digId: string, listingId: number) => {
      // Another record now: closing must not fly into the first one's cover.
      sleeve = null
      transition(
        () => {
          stepped.value = true
          open.value = { digId, listingId }
        },
        null,
        null,
        true,
      )
    },
    hide: () => {
      const back = sleeve
      sleeve = null
      transition(
        () => {
          stepped.value = false
          open.value = null
        },
        null,
        back,
      )
    },
    /** Called by the sheet once its record is drawn, or known to be gone. */
    settled: () => {
      settle?.()
      settle = null
    },
    /** The reading order of the list on screen. Null while none is shown. */
    setOrder: (found: { digId: string; ids: number[] } | null) => (order.value = found),
  }
}
