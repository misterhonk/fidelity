<script setup lang="ts">
import { DEFAULT_FINISH } from '#shared/places'
import type { Finish, PlaceNode } from '#shared/types'

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
const openCube = computed(
  () => compartments.value.find((cube) => cube.id === open.value) ?? null,
)

function show(id: string) {
  open.value = open.value === id ? null : id
}

const renaming = ref(false)
async function rename(name: string) {
  if (!name.trim() || name.trim() === props.unit.name) return
  await call('places.rename', { id: props.unit.id, name })
  renaming.value = false
  emit('changed')
}

/** The look, changed after the fact: every change is saved as it is made. */
const finishing = ref(false)
const finish = ref<Finish>({ ...(props.unit.finish ?? DEFAULT_FINISH) })
watch(finish, async (next) => {
  await call('places.finish', { id: props.unit.id, finish: { ...next } })
  emit('changed')
})

const dissolving = ref(false)
async function dissolve() {
  await call('places.remove', { id: props.unit.id })
  dissolving.value = false
  emit('changed')
}
</script>

<template>
  <section class="flex flex-col gap-3" :aria-label="unit.name">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 class="fid-display text-fid-base font-semibold text-fid-text">{{ unit.name }}</h3>
      <div class="flex flex-wrap gap-4">
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="finishing = !finishing"
        >
          {{ c.places.finish }}
        </button>
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

    <FinishPicker v-if="finishing" v-model="finish" />

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

    <!-- The open compartment slides in from the right; the wall stays put. -->
    <PlaceSheet
      v-if="openCube"
      :cube="openCube"
      :nodes="nodes"
      @close="open = null"
      @changed="emit('changed')"
      @record="emit('record', $event)"
    />
  </section>
</template>
