/**
 * A clock that ticks when a deadline passes (rule 4).
 *
 * `Date.now()` inside a `computed` is read once and never again: /dig, the
 * stack and the in-store screen each decided "expired" when they loaded and
 * kept that answer for as long as the tab stayed open — prices included, past
 * their six hours (found 2026-10-21). This one wakes at the deadline itself,
 * and again whenever the tab comes back, because a timer in a background tab
 * is allowed to be late by as much as the browser likes.
 *
 * `onPass` is where a screen asks the worker again; the worker hands out
 * nothing past its clock, so a reload is all it takes.
 */
const LONGEST_TIMER_MS = 2_147_483_647

export function useDeadline(deadline: () => number | null | undefined, onPass?: () => void) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setTimeout> | undefined

  function arm() {
    clearTimeout(timer)
    now.value = Date.now()
    const at = deadline()
    if (at === null || at === undefined || at <= now.value) return
    timer = setTimeout(arm, Math.min(at - now.value + 50, LONGEST_TIMER_MS))
  }

  function onVisible() {
    if (document.visibilityState === 'visible') arm()
  }

  const passed = computed(() => {
    const at = deadline()
    return at !== null && at !== undefined && now.value >= at
  })

  watch(deadline, arm, { immediate: true })
  watch(passed, (gone) => {
    if (gone) onPass?.()
  })

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  onScopeDispose(() => {
    clearTimeout(timer)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible)
    }
  })

  return { now: readonly(now), passed }
}
