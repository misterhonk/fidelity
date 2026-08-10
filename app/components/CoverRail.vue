<script setup lang="ts">
/**
 * Eine Reihe Cover, die man seitwärts schiebt.
 *
 * A collection is pictures. Everything else on this screen is a number or a
 * sentence, and a wall of those is the opposite of what somebody opens a
 * record app for — so the covers get the room and the width they need, even
 * when the window does not have it.
 *
 * Scroll-snap rather than a carousel library: no dependency, no timers, no
 * autoplay, and a native flick on a phone. The rail is what a shelf is —
 * something you push along, not something that moves on its own.
 */
defineProps<{
  title: string
  /** Where the whole list lives, when the rail is only the front of it. */
  to?: string
  /** Right-hand note: a count, a shop name, an age. */
  note?: string
}>()
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6">
      <h2 class="text-fid-base font-medium text-fid-text">
        <NuxtLink v-if="to" :to="to" class="underline-offset-4 hover:underline">
          {{ title }}
        </NuxtLink>
        <template v-else>{{ title }}</template>
      </h2>
      <p v-if="note" class="fid-num text-fid-xs text-fid-text-muted">{{ note }}</p>
    </div>

    <!--
      The rail bleeds to both edges while the headings keep the page margin.
      A cover cut off by the right edge is the only honest way to say "there is
      more this way" without drawing an arrow nobody taps.

      `scroll-px-6` so a snapped cover lands on the margin rather than flush
      against the glass, and `overscroll-x-contain` so flicking to the end does
      not turn into a browser back gesture.
    -->
    <ul
      class="fid-rail flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-2 overscroll-x-contain"
    >
      <slot />
    </ul>
  </section>
</template>

<style scoped>
/*
 * The scrollbar is noise under a row of covers, and its 15px would push the
 * images around on the one platform that reserves space for it.
 */
.fid-rail {
  scrollbar-width: none;
}
.fid-rail::-webkit-scrollbar {
  display: none;
}
</style>
