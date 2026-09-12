import type { ShallowRef } from 'vue'

/**
 * Drag and drop on the wall (M27.4, docs/18 §4).
 *
 * Pointer events, not the HTML drag API: the HTML one has no long-press, no
 * haptics, and on iOS it argues with scrolling. Here a mouse drags after a
 * few pixels; a finger has to rest for a moment first — then the phone
 * buzzes once and the sleeve lifts. Until then a finger is scrolling, and
 * scrolling wins.
 *
 * One drag at a time, app-wide, so a sleeve from the sheet can land on a
 * cube of the wall behind it. Targets declare themselves in the markup:
 * `data-drop="<place id>"` and `data-drop-accepts="records compartment"`.
 * Sources call `grab` on pointerdown. The page that owns the wall says what
 * a drop means through `onPlaceDrop`.
 */
export type DragPayload =
  | { kind: 'records'; instanceIds: number[]; from: string | null; label: string }
  | { kind: 'compartment'; id: string; label: string }
  | { kind: 'unit'; id: string; label: string }

export interface DragState {
  payload: DragPayload
  x: number
  y: number
  /** The `data-drop` id under the pointer, when it accepts the payload. */
  over: string | null
}

type DropHandler = (payload: DragPayload, targetId: string) => void

const state: ShallowRef<DragState | null> = shallowRef(null)
const handlers = new Set<DropHandler>()

/** A mouse drags after this many pixels; a finger that moved this far is scrolling. */
const SLOP = 6
/** A finger has to rest this long before the sleeve lifts. */
const HOLD_MS = 400

let pending: {
  pointerId: number
  x: number
  y: number
  payload: DragPayload
  timer: ReturnType<typeof setTimeout> | null
} | null = null

function preventScroll(event: TouchEvent) {
  if (state.value) event.preventDefault()
}

function targetAt(x: number, y: number, payload: DragPayload): string | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
  if (!element) return null
  const accepts = (element.dataset.dropAccepts ?? '').split(/\s+/)
  if (!accepts.includes(payload.kind)) return null
  const id = element.dataset.drop ?? null
  // Not onto itself.
  if (payload.kind !== 'records' && payload.id === id) return null
  if (payload.kind === 'records' && payload.from === id) return null
  return id
}

function begin(x: number, y: number) {
  if (!pending) return
  const { payload } = pending
  if (pending.timer) clearTimeout(pending.timer)
  pending.timer = null
  state.value = { payload, x, y, over: targetAt(x, y, payload) }
  document.body.classList.add('fid-dragging')
  document.addEventListener('touchmove', preventScroll, { passive: false })
  try {
    navigator.vibrate?.(12)
  } catch {
    // A phone that will not buzz is still a phone.
  }
}

function move(event: PointerEvent) {
  if (!pending || event.pointerId !== pending.pointerId) return
  const { x, y } = pending
  const far = Math.hypot(event.clientX - x, event.clientY - y) > SLOP
  if (!state.value) {
    if (!far) return
    if (event.pointerType === 'mouse') begin(event.clientX, event.clientY)
    else release() // the finger is scrolling; let it
    return
  }
  const current = state.value
  state.value = {
    ...current,
    x: event.clientX,
    y: event.clientY,
    over: targetAt(event.clientX, event.clientY, current.payload),
  }
}

function up(event: PointerEvent) {
  if (!pending || event.pointerId !== pending.pointerId) return
  const dragged = state.value
  release()
  if (!dragged) return
  // The pointerup would become a click on whatever is under it; not after a drag.
  const swallow = (click: Event) => click.stopPropagation()
  document.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 0)
  if (dragged.over) for (const handler of handlers) handler(dragged.payload, dragged.over)
}

function release() {
  if (pending?.timer) clearTimeout(pending.timer)
  pending = null
  state.value = null
  document.body.classList.remove('fid-dragging')
  document.removeEventListener('touchmove', preventScroll)
  document.removeEventListener('pointermove', move)
  document.removeEventListener('pointerup', up)
  document.removeEventListener('pointercancel', release)
}

/** On pointerdown of something that can be dragged. */
function grab(event: PointerEvent, payload: DragPayload) {
  if (event.button !== 0 || pending) return
  pending = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    payload,
    timer: null,
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', up)
  document.addEventListener('pointercancel', release)
  if (event.pointerType !== 'mouse') {
    pending.timer = setTimeout(() => begin(event.clientX, event.clientY), HOLD_MS)
  }
}

export function usePlaceDrag() {
  return { drag: state, grab }
}

/** The page that owns the wall says what a drop means. Unregistered with the component. */
export function onPlaceDrop(handler: DropHandler) {
  handlers.add(handler)
  onUnmounted(() => handlers.delete(handler))
}
