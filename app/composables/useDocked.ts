import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

/**
 * From this width a detail sheet docks beside its list instead of covering it
 * (#230): list left, record right, both usable. Below it the sheet stays the
 * modal drawer a phone and a small laptop need.
 *
 * 85rem (1360 px) rather than Tailwind's `xl` because at 1280 the list would
 * be left with 640 px — a stretched phone again, only narrower.
 */
export const DOCK_QUERY = '(min-width: 85rem)'

/** How many docked sheets hold the page's room open — a stacked sheet must not close it. */
let holding = 0

/**
 * Makes room for a docked sheet through `html.fid-docked` (`main.css`), or
 * gives it back. Counted, because a place sheet can stand on a shelf sheet.
 */
export function holdDock(on: boolean): void {
  holding = Math.max(0, holding + (on ? 1 : -1))
  document.documentElement.classList.toggle('fid-docked', holding > 0)
}

/** Whether the window is wide enough to dock, following resizes. */
export function useDocked() {
  const docked = ref(false)
  let query: MediaQueryList | undefined
  const update = () => (docked.value = query?.matches ?? false)

  onMounted(() => {
    query = window.matchMedia(DOCK_QUERY)
    update()
    query.addEventListener('change', update)
  })
  onBeforeUnmount(() => query?.removeEventListener('change', update))

  return readonly(docked)
}
