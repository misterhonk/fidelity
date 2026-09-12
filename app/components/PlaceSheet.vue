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
      <li v-for="record in contents" :key="record.instanceId" class="flex flex-col gap-1">
        <button
          type="button"
          class="fid-cover-button group flex flex-col gap-1 rounded-fid-sm text-left"
          :aria-label="c.open(record.artistNames.join(' · '), record.title)"
          @click="emit('record', record.instanceId)"
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
