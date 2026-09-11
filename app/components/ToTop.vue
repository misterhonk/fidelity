<script setup lang="ts">
/**
 * Back to the top, without swiping until your thumb glows.
 *
 * The shelf shows 120 covers and loads more in steps of 240; anyone who has
 * reached 600 and wants the filter bar again scrolls for half a minute. On a
 * phone there is no substitute for Home, and the header is not sticky there.
 *
 * **It floats, so it must cover nothing.** The update notice once stood
 * exactly like this — `fixed bottom-4` — and lay over a match card, over the
 * attribution in the footer, and on a phone over the navigation itself (see
 * `app/app.vue`). Hence: bottom right, small, above the bar, and visible only
 * when something really is behind you.
 */
const m = useMessages()

/**
 * When it appears: two screen heights.
 *
 * A fixed pixel value was the obvious choice and the worse one — 300 px is a
 * third of a phone screen and a fifth of a desktop one. Two heights mean the
 * same thing everywhere: "you have left something behind that can no longer
 * be seen."
 */
const shown = ref(false)

function measure() {
  shown.value = window.scrollY > window.innerHeight * 2
}

onMounted(() => {
  measure()
  // Passive: this listener never prevents anything, and a scroll handler
  // without that costs noticeable frame rate on a long list.
  window.addEventListener('scroll', measure, { passive: true })
  window.addEventListener('resize', measure, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', measure)
  window.removeEventListener('resize', measure)
})

function toTop() {
  /*
   * Smooth, unless somebody has asked for it not to be.
   *
   * `prefers-reduced-motion` is not a matter of taste: for some people a long
   * gliding movement causes nausea, and sending six hundred covers flying past
   * is a long movement.
   */
  const sanft = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: sanft ? 'smooth' : 'auto' })
}
</script>

<template>
  <!--
    Out of the way when it has nothing to do: `v-if` rather than opacity, so
    that it disappears for the keyboard and the screen reader too instead of
    standing there as an invisible target.
  -->
  <Transition
    enter-active-class="transition-opacity"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity"
    leave-to-class="opacity-0"
  >
    <button
      v-if="shown"
      type="button"
      class="fid-lift fixed right-4 z-30 flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm border border-fid-border bg-fid-surface-raised text-fid-text shadow-lg max-md:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6"
      :aria-label="m.common.toTop"
      @click="toTop()"
    >
      <FidIcon name="arrow-up" :size="20" aria-hidden="true" />
    </button>
  </Transition>
</template>
