/**
 * How far a dig is, wherever in the app somebody happens to be (#216).
 *
 * A scan outlives the screen that started it, and until now only /dig could
 * tell. The nav asks the worker every two seconds — module state there, no
 * request to Discogs — and draws the answer as a ring on the Dig tab.
 *
 * `null` while nothing is scanning; a percentage of distinct listings while
 * something is, the same figure the bar on /dig shows.
 */
const percent = shallowRef<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

async function look() {
  if (document.visibilityState !== 'visible') return
  try {
    const live = await callWorker('dig.running', undefined)
    const p = live?.progress
    percent.value = !live
      ? null
      : p && p.reachable > 0
        ? Math.min(100, Math.round((p.unique / p.reachable) * 100))
        : 0
  } catch {
    // A worker that does not answer is not a dig that is running.
    percent.value = null
  }
}

export function useRunningDig() {
  onMounted(() => {
    if (timer) return
    void look()
    timer = setInterval(() => void look(), 2000)
  })
  return { percent: readonly(percent) }
}
