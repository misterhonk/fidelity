<script setup lang="ts">
/**
 * The frame every screen stands in.
 *
 * Reported on 2026-09-12 with a stack of screenshots: four different
 * distances from the bar to the title (`py-4`, `py-6`, `py-10`, `py-16`), two
 * widths, and on two of the collection views the tabs above the title
 * instead of under it. Clicking through the tabs made the heading jump up,
 * down and sideways.
 *
 * So one frame, and only here: the measure (`fid-page`, docs/05 §3a), one
 * distance to the top, one gap between the header and what follows. A screen
 * that reads rather than shows — a legal text, the basket, a settings page —
 * takes `narrow`, and the column it gets is **anchored left**, not centred:
 * the title then stands in the same place on every screen, whatever the
 * width of the content under it.
 */
defineProps<{
  /** A reading column of 48rem, left-anchored, for text and lists. */
  narrow?: boolean
}>()
</script>

<template>
  <main v-if="narrow" class="fid-page py-10">
    <div class="@container flex w-full max-w-3xl flex-col gap-8">
      <slot />
    </div>
  </main>
  <main v-else class="@container fid-page flex flex-col gap-8 py-10">
    <slot />
  </main>
</template>
