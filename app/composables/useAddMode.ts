import type { AddedCopy, Identified } from '#shared/types'

/** What the in-store screen already knows, handed over so add mode asks nothing twice. */
export interface AddPrefill {
  found: Identified
  releaseId: number | null
}

/** One added copy in the tray, with the name the tray shows for it. */
export interface TrayEntry extends AddedCopy {
  label: string
}

/**
 * Add mode (#233), opened from four places: the shelf's "Add", ⌘K, the key `a`,
 * and a result in the shop. `app.vue` owns the sheet and the address; this is
 * the request to open it, and the tray, which outlives the sheet for the visit.
 */
export function useAddMode() {
  const asked = useState('add-asked', () => 0)
  const prefill = useState<AddPrefill | null>('add-prefill', () => null)
  // shortcut: the tray lasts the visit, not a reload; the outbox and the shelf keep the copies either way.
  const tray = useState<TrayEntry[]>('add-tray', () => [])
  function open(given: AddPrefill | null = null) {
    prefill.value = given
    asked.value++
  }
  return { asked, prefill, tray, open }
}
