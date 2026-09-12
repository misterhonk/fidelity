<script setup lang="ts">
import { labelOf } from '#shared/places'
import type { PlaceNode } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * Where to put something (M27.3): the wall as the picker.
 *
 * Every piece of furniture drawn small, a button per compartment with its
 * coordinate and divider, and under them the rooms and loose places as a
 * list. On a phone the small wall is the whole point — sixteen buttons in a
 * grid are read faster than sixteen lines in a dropdown, and they sit
 * where the eye already knows them from the big wall.
 */
const props = defineProps<{
  nodes: PlaceNode[]
  /** The place the records are in now; it is drawn, but cannot be picked. */
  except: string | null
}>()

const emit = defineEmits<{ pick: [placeId: string] }>()

const c = useCollectionMessages()

const units = computed(() => props.nodes.filter((node) => node.kind === 'unit'))
const cubesOf = (unitId: string) => props.nodes.filter((node) => node.parentId === unitId)
/** Rooms and the places from before M27 — anything that holds records and has no grid. */
const plain = computed(() =>
  props.nodes.filter((node) => node.kind !== 'unit' && node.kind !== 'compartment'),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-for="unit in units" :key="unit.id" class="flex flex-col gap-2">
      <span class="fid-plate text-fid-text-muted">{{ unit.name }}</span>
      <div
        role="group"
        :aria-label="unit.name"
        class="grid gap-1"
        :style="{ gridTemplateColumns: `repeat(${unit.grid?.columns ?? 1}, minmax(0, 1fr))` }"
      >
        <button
          v-for="cube in cubesOf(unit.id)"
          :key="cube.id"
          type="button"
          :disabled="cube.id === except"
          class="flex min-h-11 flex-col items-start justify-center rounded-fid-sm border px-2 py-1 text-left transition-colors disabled:opacity-40"
          :class="
            cube.id === except ? 'border-fid-accent' : 'border-fid-border hover:border-fid-text'
          "
          :style="{
            gridColumn: (cube.slot?.column ?? 0) + 1,
            gridRow: (cube.slot?.row ?? 0) + 1,
          }"
          :aria-label="labelOf(cube)"
          @click="emit('pick', cube.id)"
        >
          <span class="fid-plate text-fid-text">{{ labelOf(cube) }}</span>
          <span v-if="cube.range?.label" class="truncate text-fid-xs text-fid-text-muted">
            {{ cube.range.label }}
          </span>
        </button>
      </div>
    </div>

    <div v-if="plain.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="place in plain"
        :key="place.id"
        type="button"
        :disabled="place.id === except"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text disabled:opacity-40"
        @click="emit('pick', place.id)"
      >
        {{ '— '.repeat(place.depth) }}{{ labelOf(place) }}
      </button>
    </div>

    <p v-if="units.length === 0 && plain.length === 0" class="text-fid-sm text-fid-text-muted">
      {{ c.places.empty }}
    </p>
  </div>
</template>
