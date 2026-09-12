<script setup lang="ts">
/**
 * The head of a screen, in one order everywhere: the title, the tabs of the
 * area if it has any, the view's own heading if it differs from the area's,
 * the lead.
 *
 * The order is the point. "On watch" had its tabs above the title, "Shelf"
 * below, "Places" a different title from the other four views of the same
 * collection — six screens of one area and no two heads alike. Now the area
 * is the `h1` on every one of them and the view is the `h2`, so the eye finds
 * the same thing in the same place after every tap.
 */
defineProps<{
  /** The area: "Collection", "Basket", "Dig". A `#title` slot overrides it. */
  title?: string
  /** The view inside the area, where it has a name of its own. */
  heading?: string
  /** One sentence under the head, where the title alone would leave somebody guessing. */
  lead?: string
}>()
</script>

<template>
  <!--
    The one voice (docs/05 §2.5): the area's name in the display face at the
    display size — the only place that size exists. Everything under it is
    text or plate.
  -->
  <header class="flex flex-col gap-4">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <h1 class="fid-display text-fid-display leading-none font-bold text-fid-text">
        <slot name="title">{{ title }}</slot>
      </h1>
      <slot name="aside" />
    </div>
    <slot name="tabs" />
    <h2 v-if="heading" class="fid-display text-fid-xl font-medium text-fid-text">
      {{ heading }}
    </h2>
    <p v-if="lead" class="max-w-prose text-fid-base text-fid-text-muted">{{ lead }}</p>
    <slot />
  </header>
</template>
