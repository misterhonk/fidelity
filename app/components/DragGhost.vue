<script setup lang="ts">
/**
 * What is being dragged, under the pointer (M27.4). One per page, drawn by
 * the page that owns the wall; `pointer-events: none` so the cube under it
 * is what `elementFromPoint` finds.
 */
const { drag } = usePlaceDrag()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="drag"
      aria-hidden="true"
      class="fid-plate pointer-events-none fixed z-50 rounded-fid-sm border border-fid-accent bg-fid-surface px-3 py-2 text-fid-text shadow-lg"
      :style="{ left: `${drag.x + 12}px`, top: `${drag.y + 12}px` }"
    >
      {{ drag.payload.label }}
    </div>
  </Teleport>
</template>
