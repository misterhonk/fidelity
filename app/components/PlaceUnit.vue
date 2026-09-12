<script setup lang="ts">
import { labelOf } from '#shared/places'
import type { CollectionItem, PlaceNode } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * One piece of furniture on the places screen: its name and actions, the
 * wall, and — once a compartment is tapped — what that compartment holds,
 * as covers, with the two things a compartment can do: take a name, and
 * hand everything to another place.
 */
const props = defineProps<{
  unit: PlaceNode
  /** Every node — the compartments are picked out here, and "move all" needs the rest. */
  nodes: PlaceNode[]
}>()

const emit = defineEmits<{ changed: []; record: [instanceId: number] }>()

const c = useCollectionMessages()
const { call } = useFidelityWorker()

const compartments = computed(() =>
  props.nodes.filter((node) => node.parentId === props.unit.id),
)

const open = ref<string | null>(null)
const contents = shallowRef<CollectionItem[]>([])
const openCube = computed(
  () => compartments.value.find((cube) => cube.id === open.value) ?? null,
)

async function show(id: string) {
  if (open.value === id) {
    open.value = null
    return
  }
  open.value = id
  contents.value = await call('places.contents', { placeId: id })
}

const renaming = ref(false)
async function rename(name: string) {
  if (!name.trim() || name.trim() === props.unit.name) return
  await call('places.rename', { id: props.unit.id, name })
  renaming.value = false
  emit('changed')
}

async function renameCube(cube: PlaceNode, name: string) {
  await call('places.rename', { id: cube.id, name: name.trim() || cube.name })
  emit('changed')
}

const dissolving = ref(false)
async function dissolve() {
  await call('places.remove', { id: props.unit.id })
  dissolving.value = false
  emit('changed')
}

const moving = ref(false)
async function moveAll(from: string, to: string) {
  if (!to) return
  await call('places.moveAll', { from, to })
  moving.value = false
  if (open.value) contents.value = await call('places.contents', { placeId: open.value })
  emit('changed')
}

/** Where "everything" may go: any living place but the one it is in. */
const elsewhere = computed(() =>
  props.nodes.filter((node) => node.id !== open.value && node.kind !== 'unit'),
)

watch(
  () => props.nodes,
  async () => {
    if (open.value) contents.value = await call('places.contents', { placeId: open.value })
  },
)
</script>

<template>
  <section class="flex flex-col gap-3" :aria-label="unit.name">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 class="fid-display text-fid-base font-semibold text-fid-text">{{ unit.name }}</h3>
      <div class="flex flex-wrap gap-4">
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="renaming = !renaming"
        >
          {{ c.places.rename }}
        </button>
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="dissolving = !dissolving"
        >
          {{ c.places.dissolve }}
        </button>
      </div>
    </div>

    <input
      v-if="renaming"
      :value="unit.name"
      :aria-label="c.places.renameLabel(unit.name)"
      class="fid-field px-3 py-2 text-fid-base text-fid-text"
      @change="rename(($event.target as HTMLInputElement).value)"
    />

    <div v-if="dissolving" class="flex flex-col gap-2">
      <p class="text-fid-sm text-fid-text-muted">{{ c.places.dissolveUnitWhat }}</p>
      <button
        type="button"
        class="fid-action min-h-11 self-start rounded-fid-sm border border-fid-sig-scarcity px-4 text-fid-sm text-fid-sig-scarcity"
        @click="dissolve"
      >
        {{ c.places.dissolveConfirm }}
      </button>
    </div>

    <PlaceWall :unit="unit" :compartments="compartments" :open="open" @open="show" />

    <!-- The open compartment: what it holds, as covers, and what it can do. -->
    <div v-if="openCube" class="flex flex-col gap-3 border-t border-fid-border pt-3">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 class="fid-display text-fid-base font-semibold text-fid-text">
          {{ labelOf(openCube) }}
        </h4>
        <div class="flex flex-wrap gap-4">
          <button
            type="button"
            class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
            @click="moving = !moving"
          >
            {{ c.places.moveAll }}
          </button>
        </div>
      </div>

      <input
        :value="openCube.name === labelOf(openCube) ? '' : openCube.name"
        :placeholder="c.places.renameCube"
        :aria-label="c.places.renameCube"
        class="fid-field px-3 py-2 text-fid-sm text-fid-text"
        @change="renameCube(openCube, ($event.target as HTMLInputElement).value)"
      />

      <div v-if="moving" class="flex flex-wrap items-center gap-2">
        <label class="text-fid-xs text-fid-text-muted" :for="`move-${openCube.id}`">
          {{ c.places.moveTo }}
        </label>
        <select
          :id="`move-${openCube.id}`"
          class="fid-field px-3 py-2 text-fid-sm text-fid-text"
          @change="moveAll(openCube.id, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">—</option>
          <option v-for="other in elsewhere" :key="other.id" :value="other.id">
            {{ '— '.repeat(other.depth) }}{{ labelOf(other) }}
          </option>
        </select>
      </div>

      <p v-if="contents.length === 0" class="text-fid-sm text-fid-text-muted">
        {{ c.places.nothingHere }}
      </p>
      <ul v-else class="grid grid-cols-3 gap-x-3 gap-y-4 @md:grid-cols-4 @2xl:grid-cols-6">
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
    </div>
  </section>
</template>
