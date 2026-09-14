import { onBeforeUnmount, onMounted } from 'vue'

/**
 * The two keys that step a list, in the three sheets that have one (M31.24).
 *
 * `←`/`→` because that is how a drawer that slid in from the right is walked,
 * and `k`/`j` because that is how a list is walked in every mail client,
 * every issue tracker and `less` — the reason the concept asked for them, and
 * the reason somebody who has them in their fingers expects them here.
 *
 * Written once because it was written three times: the find's sheet, the
 * shelf's and the wantlist's each had the same handler with the same guard,
 * and the third copy is where the drift starts.
 *
 * **The guard is the whole of it.** A sheet holds a note field, a search box
 * and a folder picker, and in any of those `j` is the letter j and `←` is the
 * cursor. So: nothing while the focus is in a field, nothing with a modifier
 * held — `⌘←` is "back" and belongs to the browser.
 */
export function useWalkKeys(step: (to: 'previous' | 'next') => void): void {
  function onKey(event: KeyboardEvent) {
    const forward = event.key === 'ArrowRight' || event.key === 'j'
    const back = event.key === 'ArrowLeft' || event.key === 'k'
    if (!forward && !back) return
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return

    const on = document.activeElement
    if (
      on instanceof HTMLElement &&
      (on.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(on.tagName))
    )
      return

    event.preventDefault()
    step(forward ? 'next' : 'previous')
  }

  onMounted(() => document.addEventListener('keydown', onKey))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
}
