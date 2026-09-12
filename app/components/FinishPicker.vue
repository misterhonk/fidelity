<script setup lang="ts">
import { FINISH_COLOURS, FINISH_MATERIALS, finishStyle } from '#shared/places'
import type { Finish } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * The look of a piece of furniture (M27.1b), the way a rack picks its theme
 * on ModularGrid: a material for the walls, a thickness, a colour. Swatches
 * rather than words — a material is recognised, not read.
 */
const finish = defineModel<Finish>({ required: true })

const c = useCollectionMessages()

function set(patch: Partial<Finish>) {
  finish.value = { ...finish.value, ...patch }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div role="group" :aria-label="c.places.finish" class="flex flex-wrap gap-2">
      <button
        v-for="material in FINISH_MATERIALS"
        :key="material"
        type="button"
        class="flex min-h-11 items-center gap-2 rounded-fid-sm border px-2 text-fid-xs transition-colors"
        :class="
          finish.material === material
            ? 'border-fid-accent text-fid-text'
            : 'border-fid-border text-fid-text-muted hover:text-fid-text'
        "
        :aria-pressed="finish.material === material"
        @click="set({ material })"
      >
        <span
          class="size-6 rounded-fid-cover border border-fid-border"
          :style="{
            background: finishStyle({ material, thickness: 'thin', colour: null }).frame,
          }"
          aria-hidden="true"
        />
        {{ c.places.materials[material] }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <div role="group" :aria-label="c.places.thickness.label" class="flex gap-4">
        <button
          v-for="thickness in ['thin', 'medium', 'thick'] as const"
          :key="thickness"
          type="button"
          class="fid-plate min-h-11 border-b-2 transition-colors"
          :class="
            finish.thickness === thickness
              ? 'border-fid-accent text-fid-text'
              : 'border-transparent text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="finish.thickness === thickness"
          @click="set({ thickness })"
        >
          {{ c.places.thickness[thickness] }}
        </button>
      </div>

      <div role="group" :aria-label="c.places.colour" class="flex items-center gap-2">
        <button
          type="button"
          class="fid-plate min-h-11 border-b-2 transition-colors"
          :class="
            finish.colour === null
              ? 'border-fid-accent text-fid-text'
              : 'border-transparent text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="finish.colour === null"
          @click="set({ colour: null })"
        >
          {{ c.places.noColour }}
        </button>
        <button
          v-for="colour in FINISH_COLOURS"
          :key="colour"
          type="button"
          class="size-8 rounded-full border-2 transition-transform hover:scale-110"
          :class="finish.colour === colour ? 'border-fid-text' : 'border-transparent'"
          :style="{ background: colour }"
          :aria-label="c.places.colourOf(colour)"
          :aria-pressed="finish.colour === colour"
          @click="set({ colour })"
        />
      </div>
    </div>
  </div>
</template>
