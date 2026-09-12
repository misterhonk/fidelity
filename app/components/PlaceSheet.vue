<script setup lang="ts">
import { addressOf, labelOf } from '#shared/places'
import type { CollectionItem, PlaceNode } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * A compartment, opened (M27.1d).
 *
 * Off the canvas rather than under the wall: the wall stays where it is and
 * the compartment slides in from the right — the same frame the record's
 * sheet uses, full height, scrolling on its own. What it holds as sleeves,
 * and the three things a compartment can do: take a name, be filled from
 * the collection, hand everything to another place.
 */
const props = defineProps<{
  cube: PlaceNode
  /** Every node — the address needs the way up, "move all" the rest. */
  nodes: PlaceNode[]
}>()

const emit = defineEmits<{ close: []; changed: []; record: [instanceId: number] }>()

const c = useCollectionMessages()
const { call } = useFidelityWorker()

const contents = shallowRef<CollectionItem[]>([])
async function load() {
  contents.value = await call('places.contents', { placeId: props.cube.id })
}
onMounted(load)
watch(() => props.nodes, load)

const address = computed(() => addressOf(props.cube.id, props.nodes).join(' · '))

async function rename(name: string) {
  await call('places.rename', { id: props.cube.id, name: name.trim() || props.cube.name })
  emit('changed')
}

const filling = ref(false)
async function filled() {
  await load()
  emit('changed')
}

const moving = ref(false)
async function moveAll(to: string) {
  if (!to) return
  await call('places.moveAll', { from: props.cube.id, to })
  moving.value = false
  await load()
  emit('changed')
}

/** Where "everything" may go: any living place but this one, and not a unit. */
const elsewhere = computed(() =>
  props.nodes.filter((node) => node.id !== props.cube.id && node.kind !== 'unit'),
)

/**
 * Re-sorting (M27.3). "Select" turns the sleeves into things to tick; the
 * ticked ones move to a place picked on the small wall, or come out. Every
 * move leaves a line with a way back — the records remember where they
 * came from for as long as the line stands.
 */
const selecting = ref(false)
const selected = ref(new Set<number>())
const picking = ref(false)
// Shallow on purpose: the ids go back through postMessage, and a deep
// proxy would not clone.
const last = shallowRef<{
  instanceIds: number[]
  from: string | null
  to: string | null
} | null>(null)

function toggleSelect(instanceId: number) {
  const next = new Set(selected.value)
  if (next.has(instanceId)) next.delete(instanceId)
  else next.add(instanceId)
  selected.value = next
}
function selectAll() {
  selected.value = new Set(contents.value.map((record) => record.instanceId))
}
function stopSelecting() {
  selecting.value = false
  picking.value = false
  selected.value = new Set()
}

async function moveSelected(to: string | null) {
  const instanceIds = [...selected.value]
  if (instanceIds.length === 0) return
  await call('places.assignMany', { instanceIds, placeId: to })
  last.value = { instanceIds, from: props.cube.id, to }
  // The move is done; the line with the way back stands, the ticks go.
  stopSelecting()
  await load()
  emit('changed')
}

async function undo() {
  if (!last.value) return
  await call('places.assignMany', {
    instanceIds: [...last.value.instanceIds],
    placeId: last.value.from,
  })
  last.value = null
  await load()
  emit('changed')
}

/** A sleeve lifts on its own — or with everything ticked, when it is one of them. */
const { grab } = usePlaceDrag()
function lift(event: PointerEvent, record: CollectionItem) {
  const ids =
    selecting.value && selected.value.has(record.instanceId)
      ? [...selected.value]
      : [record.instanceId]
  grab(event, {
    kind: 'records',
    instanceIds: ids,
    from: props.cube.id,
    label: c.value.places.dragRecords(count(ids.length)),
  })
}

const labelFor = (placeId: string | null) => {
  const node = props.nodes.find((n) => n.id === placeId)
  return node ? labelOf(node) : ''
}
</script>

<template>
  <SheetFrame :label="address" transition="place-sheet" @close="emit('close')">
    <template #title>{{ labelOf(cube) }}</template>

    <p class="fid-plate text-fid-text-muted">{{ address }}</p>

    <div class="flex flex-wrap gap-4">
      <button
        type="button"
        class="fid-plate fid-action min-h-11 transition-colors"
        :class="filling ? 'text-fid-text' : 'text-fid-text-muted hover:text-fid-text'"
        :aria-pressed="filling"
        @click="filling = !filling"
      >
        {{ c.places.fill }}
      </button>
      <button
        type="button"
        class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
        @click="moving = !moving"
      >
        {{ c.places.moveAll }}
      </button>
      <button
        v-if="contents.length > 0"
        type="button"
        class="fid-plate fid-action min-h-11 transition-colors"
        :class="selecting ? 'text-fid-text' : 'text-fid-text-muted hover:text-fid-text'"
        :aria-pressed="selecting"
        @click="selecting ? stopSelecting() : (selecting = true)"
      >
        {{ selecting ? c.places.done : c.places.select }}
      </button>
    </div>

    <!-- The way back, for as long as the line stands. -->
    <p
      v-if="last"
      class="flex flex-wrap items-center gap-3 text-fid-sm text-fid-text"
      aria-live="polite"
    >
      {{
        last.to
          ? c.places.moved(count(last.instanceIds.length), labelFor(last.to))
          : c.places.takenOut(count(last.instanceIds.length))
      }}
      <button
        type="button"
        class="fid-action min-h-11 text-fid-sm text-fid-accent underline underline-offset-4"
        @click="undo"
      >
        {{ c.places.undo }}
      </button>
    </p>

    <!-- The selection's actions: where to, or out. -->
    <div v-if="selecting" class="flex flex-wrap items-center gap-4">
      <span class="fid-plate text-fid-text-muted">{{
        c.places.selected(count(selected.size))
      }}</span>
      <button
        type="button"
        class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
        @click="selectAll"
      >
        {{ c.places.all }}
      </button>
      <button
        type="button"
        :disabled="selected.size === 0"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text disabled:opacity-50"
        @click="picking = !picking"
      >
        {{ c.places.moveSelected(count(selected.size)) }}
      </button>
      <button
        type="button"
        :disabled="selected.size === 0"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text disabled:opacity-50"
        @click="moveSelected(null)"
      >
        {{ c.places.takeOut(count(selected.size)) }}
      </button>
    </div>
    <div
      v-if="selecting && picking"
      class="flex flex-col gap-2 border-t border-fid-border pt-3"
    >
      <span class="fid-plate text-fid-text-muted">{{ c.places.whereTo }}</span>
      <PlacePicker :nodes="nodes" :except="cube.id" @pick="moveSelected($event)" />
    </div>

    <input
      :value="cube.name === labelOf(cube) ? '' : cube.name"
      :placeholder="c.places.renameCube"
      :aria-label="c.places.renameCube"
      class="fid-field px-3 py-2 text-fid-sm text-fid-text"
      @change="rename(($event.target as HTMLInputElement).value)"
    />

    <div v-if="moving" class="flex flex-wrap items-center gap-2">
      <label class="text-fid-xs text-fid-text-muted" :for="`move-${cube.id}`">
        {{ c.places.moveTo }}
      </label>
      <select
        :id="`move-${cube.id}`"
        class="fid-field px-3 py-2 text-fid-sm text-fid-text"
        @change="moveAll(($event.target as HTMLSelectElement).value)"
      >
        <option value="">—</option>
        <option v-for="other in elsewhere" :key="other.id" :value="other.id">
          {{ '— '.repeat(other.depth) }}{{ labelOf(other) }}
        </option>
      </select>
    </div>

    <PlaceFill v-if="filling" :place="cube" @filled="filled" @close="filling = false" />

    <p v-if="contents.length === 0" class="text-fid-sm text-fid-text-muted">
      {{ c.places.nothingHere }}
    </p>
    <ul v-else class="grid grid-cols-3 gap-x-3 gap-y-4 @md:grid-cols-4">
      <li
        v-for="record in contents"
        :key="record.instanceId"
        class="relative flex flex-col gap-1"
      >
        <!-- In select mode the sleeve is a thing to tick, not a door. -->
        <input
          v-if="selecting"
          type="checkbox"
          class="absolute top-2 left-2 z-10 size-5"
          :checked="selected.has(record.instanceId)"
          :aria-label="c.places.pick(record.artistNames.join(' · '), record.title)"
          @change="toggleSelect(record.instanceId)"
        />
        <button
          type="button"
          class="fid-cover-button group flex flex-col gap-1 rounded-fid-sm text-left"
          :class="
            selecting && selected.has(record.instanceId)
              ? 'outline-2 outline-offset-2 outline-fid-accent'
              : ''
          "
          :aria-label="c.open(record.artistNames.join(' · '), record.title)"
          @click="
            selecting ? toggleSelect(record.instanceId) : emit('record', record.instanceId)
          "
          @pointerdown="lift($event, record)"
        >
          <img
            v-if="record.thumbUrl || record.coverUrl"
            :src="record.thumbUrl || record.coverUrl"
            alt=""
            loading="lazy"
            decoding="async"
            width="150"
            height="150"
            class="aspect-square w-full rounded-fid-cover bg-fid-inset object-cover"
          />
          <span
            v-else
            class="flex aspect-square w-full items-center justify-center rounded-fid-cover bg-fid-inset text-fid-xs text-fid-text-muted"
          >
            {{ c.noCover }}
          </span>
          <span
            class="fid-display line-clamp-2 text-fid-xs leading-tight font-semibold text-fid-text"
          >
            {{ record.title }}
          </span>
        </button>
        <span class="fid-plate truncate text-fid-text-muted">{{
          record.artistNames.join(' · ')
        }}</span>
      </li>
    </ul>
  </SheetFrame>
</template>
