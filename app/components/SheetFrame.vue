<script setup lang="ts">
/**
 * The one drawer both detail sheets slide in on.
 *
 * `ReleaseSheet` and `ShelfSheet` carried this chrome twice, line for line —
 * and drifted: the shelf sheet applied a class that existed only in the other
 * file's scoped style, so its view transition and its reduced-motion opt-out
 * silently did nothing. One frame, one place to get it right.
 *
 * What it guarantees, and the audit that asked for it (2026-09-11):
 *
 * - **Focus stays in.** Tab and Shift+Tab cycle inside the panel. Before, Tab
 *   walked straight out into the page behind the overlay.
 * - **Focus comes back.** Whoever opened the sheet gets focus again when it
 *   closes — the card, the cover, the row — instead of `<body>`.
 * - **The panel is the container.** `@container` sits on the panel, so the
 *   `@sm:` variants inside measure the 512px drawer, not the window.
 * - **Escape closes**, and a click on the scrim does too.
 */
const props = defineProps<{
  /** The accessible name of the dialog — the record it is about. */
  label: string
  /**
   * `view-transition-name` for the slide. Read by `.fid-sheet` in `main.css`,
   * where the reduced-motion opt-out lives once for every sheet.
   */
  transition?: string
}>()
const emit = defineEmits<{ close: [] }>()

const m = useMessages()
const panel = useTemplateRef<HTMLElement>('panel')

/** Whatever had focus when the sheet opened, to hand it back on close. */
let opener: HTMLElement | null = null

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  panel.value?.focus()
  document.addEventListener('keydown', onEscapeAnywhere)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscapeAnywhere)
  if (opener?.isConnected) opener.focus()
})

/**
 * Escape closes the sheet even when the focus has fallen out of it.
 *
 * Found on 2026-09-12: a button inside the sheet disabled itself after the
 * click — "put 1 in B1" with nothing left to put — and the focus went to
 * the body. The panel's own listener never heard the Escape, and the sheet
 * stood over the wall, taking every tap. Only the topmost sheet answers, so
 * two stacked sheets close one at a time.
 */
function onEscapeAnywhere(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !panel.value) return
  if (panel.value.contains(document.activeElement)) return
  const sheets = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
  if (sheets[sheets.length - 1] !== panel.value) return
  emit('close')
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panel.value) return

  // Only what can actually be reached: a hidden control is not a stop.
  const stops = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.offsetParent !== null,
  )
  if (stops.length === 0) {
    event.preventDefault()
    panel.value.focus()
    return
  }
  const first = stops[0]!
  const last = stops.at(-1)!
  const active = document.activeElement

  if (event.shiftKey && (active === first || active === panel.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div
    class="fid-scrim fixed inset-0 z-40 flex justify-end bg-black/60"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <aside
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="props.label"
      tabindex="-1"
      class="fid-sheet @container flex h-full w-full max-w-lg flex-col gap-6 overflow-y-auto border-l border-fid-border bg-fid-surface p-6 outline-none lg:max-w-2xl xl:max-w-3xl"
      :style="{ scrollbarGutter: 'stable', '--fid-sheet-name': props.transition ?? 'none' }"
    >
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-fid-base font-bold text-fid-text">
          <slot name="title" />
        </h2>
        <!-- Whatever this particular sheet can do with itself, beside the ✕. -->
        <div class="flex shrink-0 items-center gap-1">
          <slot name="tools" />
          <button
            type="button"
            :aria-label="m.close"
            class="fid-lift flex min-h-11 min-w-11 items-center justify-center fid-field-raised text-fid-base text-fid-text"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
      </div>

      <slot />
    </aside>
  </div>
</template>
