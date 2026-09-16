<script setup lang="ts">
/**
 * A bullet bar (M34.4): one value as a bar, the reference as a tick.
 *
 * Stephen Few's shape for "this number, against that one" — the profile's
 * "0.3 finds per thousand, 1.2 times your other shops" as something the eye
 * reads before the sentence does. The scale is the larger of the two with
 * some air, so the tick is always inside the drawing. Neutral colours: the
 * signal hues mean one signal each, and a comparison is not one of them.
 */
const props = defineProps<{
  value: number
  /** The median of the others, or null when there is nothing to stand against. */
  reference: number | null
  /** What a screen reader hears — the sentence beside the bar says the same. */
  label: string
}>()

const scale = computed(() => Math.max(props.value, props.reference ?? 0, 0) * 1.15 || 1)
const bar = computed(() => `${Math.min(100, (props.value / scale.value) * 100)}%`)
const tick = computed(() =>
  props.reference === null ? null : `${Math.min(100, (props.reference / scale.value) * 100)}%`,
)
</script>

<template>
  <div role="img" :aria-label="label" class="relative h-3 w-full max-w-xs">
    <span class="absolute inset-x-0 top-1 block h-1 rounded-full bg-fid-inset" />
    <span
      class="absolute top-1 left-0 block h-1 rounded-full bg-fid-text-muted"
      :style="{ width: bar }"
    />
    <span
      v-if="tick"
      class="absolute top-0 block h-3 w-0.5 bg-fid-text"
      :style="{ left: tick }"
    />
  </div>
</template>
