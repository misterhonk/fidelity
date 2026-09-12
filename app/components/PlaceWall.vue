<script setup lang="ts">
import { finishStyle, labelOf, slotLabel, textOn } from '#shared/places'
import type { PlaceNode } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * A piece of furniture, seen from the front (M27.1, docs/18).
 *
 * The compartments are laid out in the unit's grid, each with its
 * coordinate, its name if it has one, the first covers of what it holds and
 * a fill level against its capacity. A tap opens the compartment below the
 * wall; the parent decides what "open" shows.
 *
 * A `grid` with roving focus rather than a list of buttons: the arrow keys
 * move across the wall the way the eye does, and the coordinate is what a
 * screen reader hears.
 */
const props = defineProps<{
  unit: PlaceNode
  compartments: PlaceNode[]
  open: string | null
}>()

const emit = defineEmits<{ open: [id: string] }>()

const c = useCollectionMessages()

const columns = computed(() => props.unit.grid?.columns ?? 1)

/** The walls: material as background, thickness as gap; a coloured face where the furniture has one. */
const look = computed(() => finishStyle(props.unit.finish))
const faceText = computed(() => (look.value.face ? textOn(look.value.face) : null))

/** How full, 0–1, or null where a pile has no edge to fill to. */
function fill(cube: PlaceNode): number | null {
  if (!cube.capacity) return null
  return Math.min(1, cube.records / cube.capacity)
}

function coordinate(cube: PlaceNode): string {
  return cube.slot ? slotLabel(cube.slot.column, cube.slot.row) : cube.name
}

/** Arrow keys walk the grid; the focused cube is the one tabbed to. */
function onKey(event: KeyboardEvent, index: number) {
  // The cubes come column by column (A1, A2, …), so a row is one step and a column is `rows` steps.
  const rows = props.unit.grid?.rows ?? 1
  const step: Record<string, number> = {
    ArrowRight: rows,
    ArrowLeft: -rows,
    ArrowDown: 1,
    ArrowUp: -1,
  }
  const delta = step[event.key]
  if (delta === undefined) return
  const next = index + delta
  if (next < 0 || next >= props.compartments.length) return
  event.preventDefault()
  const cells = (event.currentTarget as HTMLElement)
    .closest('[role="grid"]')
    ?.querySelectorAll<HTMLElement>('[role="gridcell"] > button')
  cells?.[next]?.focus()
}
</script>

<template>
  <!--
    The frame is the furniture: a hairline grid on the raised ground, cubes on
    the surface. Sixteen cubes at 80 px on a phone are still tappable; a 5×5
    goes to 60, which is the floor.
  -->
  <div
    role="grid"
    :aria-label="unit.name"
    class="grid w-full max-w-2xl rounded-fid-sm"
    :style="{
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: look.gap,
      padding: look.gap,
      background: look.frame,
    }"
  >
    <div
      v-for="(cube, index) in compartments"
      :key="cube.id"
      role="gridcell"
      class="min-w-0 bg-fid-surface"
      :style="{
        gridColumn: (cube.slot?.column ?? 0) + 1,
        gridRow: (cube.slot?.row ?? 0) + 1,
        ...(look.face ? { background: look.face, color: faceText ?? undefined } : {}),
      }"
    >
      <button
        type="button"
        class="flex aspect-square w-full flex-col items-stretch justify-between gap-1 p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fid-accent"
        :class="open === cube.id ? 'bg-fid-accent/15' : 'hover:bg-fid-raised'"
        :aria-label="c.places.cubeLabel(labelOf(cube), count(cube.records))"
        :aria-pressed="open === cube.id"
        :tabindex="index === 0 ? 0 : -1"
        @click="emit('open', cube.id)"
        @keydown="onKey($event, index)"
      >
        <span class="flex items-baseline justify-between gap-1">
          <span class="fid-plate" :class="look.face ? 'opacity-80' : 'text-fid-text-muted'">{{
            coordinate(cube)
          }}</span>
          <!-- A name if somebody gave one, else the divider the rule wrote (M27.2). -->
          <span
            v-if="(cube.name && cube.name !== coordinate(cube)) || cube.range"
            class="fid-display truncate text-fid-xs font-semibold"
            :class="look.face ? '' : 'text-fid-text'"
          >
            {{ cube.name !== coordinate(cube) ? cube.name : cube.range?.label }}
          </span>
        </span>

        <!--
          The first covers, lazily and never fetched by hand — the same
          thumbnails the shelf shows, from the sync. Three are enough to say
          "records live here" at a glance; the count says how many.
        -->
        <span class="flex h-6 gap-px">
          <img
            v-for="cover in cube.covers"
            :key="cover"
            :src="cover"
            alt=""
            loading="lazy"
            decoding="async"
            width="24"
            height="24"
            class="size-6 rounded-fid-cover bg-fid-inset object-cover"
          />
        </span>

        <span class="flex flex-col gap-1">
          <span
            class="fid-num text-fid-xs"
            :class="fill(cube) === 1 ? 'text-fid-sig-gap' : look.face ? '' : 'text-fid-text'"
          >
            {{
              cube.capacity
                ? c.places.of(count(cube.records), count(cube.capacity))
                : count(cube.records)
            }}
          </span>
          <span
            v-if="fill(cube) !== null"
            class="h-1 overflow-hidden rounded-full bg-fid-inset"
          >
            <span
              class="block h-full rounded-full"
              :class="fill(cube) === 1 ? 'bg-fid-sig-gap' : 'bg-fid-accent'"
              :style="{ width: `${Math.round((fill(cube) ?? 0) * 100)}%` }"
            />
          </span>
        </span>
      </button>
    </div>
  </div>
</template>
