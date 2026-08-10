<script setup lang="ts">
import { ICONS, type IconName } from '~/utils/icons'

/**
 * Ein Icon, ohne Laufzeit dahinter.
 *
 * No icon library, no sprite sheet, no font: the shapes are a constant this
 * component reads, so an icon costs its own path data and nothing else. That
 * matters at 120 kB for the first paint (CLAUDE.md rule 7) — @iconify/vue
 * alone would have been most of the remaining headroom.
 *
 * Every element is spelled out rather than rendered through `<component :is>`
 * or `v-html`. Both would be shorter; the first has namespace traps inside an
 * <svg> and the second parses markup at runtime for data that was fixed at
 * build time.
 */
const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 20 })

const shapes = computed(() => ICONS[props.name])
</script>

<template>
  <!--
    Hidden from assistive technology by default. Every icon here sits beside
    its own label or inside a control that carries an aria-label — an icon
    announced twice is worse than one announced not at all.
  -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
  >
    <template v-for="(shape, index) in shapes" :key="index">
      <path v-if="shape[0] === 'path'" v-bind="shape[1]" />
      <circle v-else-if="shape[0] === 'circle'" v-bind="shape[1]" />
      <rect v-else-if="shape[0] === 'rect'" v-bind="shape[1]" />
      <line v-else-if="shape[0] === 'line'" v-bind="shape[1]" />
    </template>
  </svg>
</template>
