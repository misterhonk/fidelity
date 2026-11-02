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

/**
 * Everything beside the sheet, made `inert` while it is open (#227).
 *
 * `aria-modal` is a request a screen reader may ignore, and the focus trap
 * only guards Tab: the rotor, a swipe through the page and Find still walked
 * the list behind the scrim. Every sibling on the way up to `<body>` is
 * switched off; only the ones this sheet switched are switched back, so a
 * second sheet on top of the first undoes its own and nothing else.
 */
const madeInert: HTMLElement[] = []

function lockBehind() {
  for (let at = panel.value?.parentElement; at && at !== document.body; at = at.parentElement) {
    for (const sibling of at.parentElement?.children ?? []) {
      if (sibling === at || !(sibling instanceof HTMLElement) || sibling.inert) continue
      sibling.inert = true
      madeInert.push(sibling)
    }
  }
}

function releaseBehind() {
  for (const element of madeInert.splice(0)) element.inert = false
}

/**
 * Docked beside the list on a wide screen (#230): no scrim, nothing inert, no
 * focus trap. The list on the left is the other half of the same view, and
 * `j`/`k` or a click there walks the sheet. Followed live, so narrowing the
 * window turns the sheet back into the modal drawer.
 */
const docked = useDocked()
let holdingDock = false
function setDocked(on: boolean) {
  if (on !== holdingDock) holdDock((holdingDock = on))
  if (on) releaseBehind()
  else if (madeInert.length === 0) lockBehind()
}
watch(docked, setDocked)

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  setDocked(docked.value)
  panel.value?.focus()
  document.addEventListener('keydown', onEscapeAnywhere)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscapeAnywhere)
  if (holdingDock) holdDock(false)
  releaseBehind()
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
  // Focus in another dialog — the palette over a docked sheet — is that dialog's Escape.
  if (document.activeElement?.closest('[role="dialog"]')) return
  const sheets = document.querySelectorAll('.fid-sheet[role="dialog"]')
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
  if (event.key !== 'Tab' || !panel.value || docked.value) return

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
    class="fid-scrim fixed inset-0 z-40 flex justify-end"
    :class="docked ? 'pointer-events-none' : 'bg-black/60'"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <!-- A sheet with a sticky action bar leaves the home indicator to the bar. -->
    <aside
      ref="panel"
      role="dialog"
      :aria-modal="docked ? undefined : 'true'"
      :aria-label="props.label"
      tabindex="-1"
      class="fid-sheet @container relative isolate flex h-full w-full max-w-lg flex-col gap-6 overflow-y-auto border-l border-fid-border bg-fid-surface p-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] outline-none [&:not(:has(.sticky))]:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] lg:max-w-2xl xl:max-w-3xl"
      :class="docked && 'fid-sheet-docked pointer-events-auto'"
      :style="{ scrollbarGutter: 'stable', '--fid-sheet-name': props.transition ?? 'none' }"
    >
      <!--
        The sleeve's colour, behind everything, from the very top edge.

        It belongs to the frame rather than to the sheet's first block because
        that is where the top edge is: put on the block, the tint started
        underneath the close button and left a bare strip above it that read
        as a mistake. Absolutely positioned inside the scroller, so it moves
        with the head it belongs to instead of standing still behind it.
      -->
      <div
        v-if="$slots.wash"
        class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 overflow-hidden"
      >
        <slot name="wash" />
      </div>

      <div class="relative flex items-start justify-between gap-4">
        <!--
          Empty where the sheet carries its own masthead (M31.19): the same
          name twice, six millimetres apart, is a duplicate and not a heading.
          The dialog's accessible name comes from `aria-label` either way.
        -->
        <h2 v-if="$slots.title" class="text-fid-base font-bold text-fid-text">
          <slot name="title" />
        </h2>
        <span v-else />
        <!-- Whatever this particular sheet can do with itself, beside the ✕. -->
        <div class="flex shrink-0 items-center gap-2">
          <slot name="tools" />
          <button
            type="button"
            :aria-label="m.close"
            aria-keyshortcuts="Escape"
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
