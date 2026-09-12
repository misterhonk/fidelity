<script setup lang="ts">
import { labelOf } from '#shared/places'
import type { PlaceNode } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
const m = useMessages()

useSeoMeta({ title: () => c.value.places.title, description: () => c.value.places.lead })

/**
 * Where they are (M27.1, docs/18, ADR-015).
 *
 * Rooms hold furniture, furniture holds compartments, compartments hold
 * records — and a piece of furniture may stand without a room, because not
 * everybody wants to name the flat first. The furniture is drawn as the
 * wall it is; a room is a heading.
 */
const { call } = useFidelityWorker()
const { drag } = usePlaceDrag()

const nodes = shallowRef<PlaceNode[]>([])
const collection = ref(0)
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  const [overview, summary] = await Promise.all([
    call('places.overview', undefined),
    call('library.summary', undefined),
  ])
  nodes.value = overview
  collection.value = summary.collection
}

onMounted(async () => {
  try {
    await load()
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }
})

const rooms = computed(() =>
  nodes.value.filter((node) => node.depth === 0 && node.kind !== 'unit'),
)
const looseUnits = computed(() =>
  nodes.value.filter((node) => node.depth === 0 && node.kind === 'unit'),
)
const unitsOf = (roomId: string) =>
  nodes.value.filter((node) => node.parentId === roomId && node.kind === 'unit')

const placed = computed(() =>
  nodes.value
    .filter((node) => node.depth === 0)
    .reduce((sum, node) => sum + node.recordsBelow, 0),
)
const unplaced = computed(() => Math.max(0, collection.value - placed.value))

/* Rooms: named, renamed, dissolved, emptied into another place — as before. */
const draft = ref('')
const creating = ref(false)
async function createRoom() {
  const name = draft.value.trim()
  if (!name || creating.value) return
  creating.value = true
  // Cleared before the call, not after: WebKit delivers a second submit for
  // one click on a button that becomes disabled mid-event, and the second
  // one must find nothing to create.
  draft.value = ''
  try {
    await call('places.create', { name, parentId: null })
    await load()
  } finally {
    creating.value = false
  }
}

const renaming = ref<string | null>(null)
async function rename(room: PlaceNode, name: string) {
  if (!name.trim() || name.trim() === room.name) return
  await call('places.rename', { id: room.id, name })
  renaming.value = null
  await load()
}

const dissolving = ref<string | null>(null)
async function dissolve(room: PlaceNode) {
  await call('places.remove', { id: room.id })
  dissolving.value = null
  await load()
}

/** Which room's picker is open — or `'top'` for furniture without a room. */
const picking = ref<string | null>(null)

/** Records a room holds directly, from before it had furniture. */
const openRoom = ref<string | null>(null)
const roomContents = shallowRef<Awaited<ReturnType<typeof call<'places.contents'>>>>([])
async function showRoom(room: PlaceNode) {
  if (openRoom.value === room.id) {
    openRoom.value = null
    return
  }
  openRoom.value = room.id
  roomContents.value = await call('places.contents', { placeId: room.id })
}

const sheet = ref<number | null>(null)

/**
 * A drop (M27.4): sleeves or a whole compartment onto a cube, furniture onto
 * a room or onto "without a room". Every drop leaves a line with a way
 * back, the same line the compartment's sheet writes for its own moves.
 */
const last = shallowRef<{ line: string; undo: () => Promise<void> } | null>(null)
const labelFor = (id: string | null) => {
  const node = nodes.value.find((n) => n.id === id)
  return node ? labelOf(node) : ''
}
onPlaceDrop(async (payload, targetId) => {
  const to = targetId === 'top' ? null : targetId
  if (payload.kind === 'records') {
    const { instanceIds, from } = payload
    if (to === null) return
    await call('places.assignMany', { instanceIds: [...instanceIds], placeId: to })
    last.value = {
      line: c.value.places.moved(count(instanceIds.length), labelFor(to)),
      undo: async () => {
        await call('places.assignMany', { instanceIds: [...instanceIds], placeId: from })
      },
    }
  } else if (payload.kind === 'compartment') {
    if (to === null) return
    const held = (await call('places.contents', { placeId: payload.id })).map(
      (record) => record.instanceId,
    )
    const n = await call('places.moveAll', { from: payload.id, to })
    last.value = {
      line: c.value.places.moved(count(n), labelFor(to)),
      undo: async () => {
        await call('places.assignMany', { instanceIds: held, placeId: payload.id })
      },
    }
  } else {
    const unit = nodes.value.find((n) => n.id === payload.id)
    if (!unit || !(await call('places.move', { id: payload.id, parentId: to }))) return
    const wasIn = unit.parentId
    last.value = {
      line: to
        ? c.value.places.unitMoved(unit.name, labelFor(to))
        : c.value.places.unitMovedOut(unit.name),
      undo: async () => {
        await call('places.move', { id: payload.id, parentId: wasIn })
      },
    }
  }
  await load()
})
async function undo() {
  if (!last.value) return
  await last.value.undo()
  last.value = null
  await load()
}
</script>

<template>
  <AppPage narrow>
    <PageHeader :title="c.title" :heading="c.places.title" :lead="c.places.lead">
      <template #tabs><CollectionTabs /></template>
    </PageHeader>

    <ErrorNote v-if="error" :cause="error" />
    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ m.common.loading }}</p>

    <template v-else>
      <p v-if="nodes.length === 0" class="max-w-prose text-fid-base text-fid-text-muted">
        {{ c.places.empty }}
      </p>
      <p v-else class="fid-plate text-fid-text-muted">
        {{ c.places.counts(count(placed), count(unplaced)) }}
      </p>

      <!--
        The way back after a drop, for as long as the line stands. Pinned to
        the bottom of the window: a drop happens wherever the wall is, and
        the line has to be where the eye is, not where the counts are.
      -->
      <p
        v-if="last"
        role="status"
        class="fixed bottom-4 left-4 z-30 flex flex-wrap items-center gap-3 rounded-fid-sm border border-fid-border bg-fid-surface px-4 py-2 text-fid-sm text-fid-text shadow-lg"
      >
        {{ last.line }}
        <button
          type="button"
          class="fid-action min-h-11 text-fid-sm text-fid-accent underline underline-offset-4"
          @click="undo"
        >
          {{ c.places.undo }}
        </button>
      </p>

      <!-- A room is a heading; its furniture stands under it. -->
      <section
        v-for="room in rooms"
        :key="room.id"
        class="flex flex-col gap-4 border-t pt-4 transition-colors"
        :class="drag?.over === room.id ? 'border-fid-accent' : 'border-fid-border'"
        :aria-label="room.name"
        :data-drop="room.id"
        data-drop-accepts="unit"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="fid-display text-fid-xl font-medium text-fid-text">{{ room.name }}</h2>
          <div class="flex flex-wrap gap-4">
            <button
              type="button"
              class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
              @click="picking = picking === room.id ? null : room.id"
            >
              {{ c.places.addUnit }}
            </button>
            <button
              type="button"
              class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
              @click="renaming = renaming === room.id ? null : room.id"
            >
              {{ c.places.rename }}
            </button>
            <button
              type="button"
              class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
              @click="dissolving = dissolving === room.id ? null : room.id"
            >
              {{ c.places.dissolve }}
            </button>
          </div>
        </div>

        <input
          v-if="renaming === room.id"
          :value="room.name"
          :aria-label="c.places.renameLabel(room.name)"
          class="fid-field px-3 py-2 text-fid-base text-fid-text"
          @change="rename(room, ($event.target as HTMLInputElement).value)"
        />

        <div v-if="dissolving === room.id" class="flex flex-col gap-2">
          <p class="text-fid-sm text-fid-text-muted">{{ c.places.dissolveWhat }}</p>
          <button
            type="button"
            class="fid-action min-h-11 self-start rounded-fid-sm border border-fid-sig-scarcity px-4 text-fid-sm text-fid-sig-scarcity"
            @click="dissolve(room)"
          >
            {{ c.places.dissolveConfirm }}
          </button>
        </div>

        <UnitPicker
          v-if="picking === room.id"
          :parent-id="room.id"
          @created="((picking = null), load())"
          @cancel="picking = null"
        />

        <PlaceUnit
          v-for="unit in unitsOf(room.id)"
          :key="unit.id"
          :unit="unit"
          :nodes="nodes"
          @changed="load"
          @record="sheet = $event"
        />

        <!-- Records in the room itself, from before it had furniture. -->
        <button
          v-if="room.records > 0"
          type="button"
          class="fid-plate fid-action min-h-11 self-start text-fid-text-muted underline decoration-dotted underline-offset-4 hover:text-fid-text"
          :aria-expanded="openRoom === room.id"
          @click="showRoom(room)"
        >
          {{ c.places.inRoom(count(room.records)) }}
        </button>
        <ul v-if="openRoom === room.id" class="flex flex-col gap-1">
          <li v-for="record in roomContents" :key="record.instanceId">
            <button
              type="button"
              class="fid-action text-left text-fid-sm text-fid-text underline decoration-fid-border underline-offset-4"
              @click="sheet = record.instanceId"
            >
              {{ record.artistNames.join(' · ') }} – {{ record.title }}
            </button>
          </li>
        </ul>
      </section>

      <section
        v-if="looseUnits.length > 0 || drag?.payload.kind === 'unit'"
        class="flex flex-col gap-4 border-t pt-4 transition-colors"
        :class="drag?.over === 'top' ? 'border-fid-accent' : 'border-fid-border'"
        :aria-label="c.places.noRoom"
        data-drop="top"
        data-drop-accepts="unit"
      >
        <h2 class="fid-plate text-fid-text-muted">{{ c.places.noRoom }}</h2>
        <PlaceUnit
          v-for="unit in looseUnits"
          :key="unit.id"
          :unit="unit"
          :nodes="nodes"
          @changed="load"
          @record="sheet = $event"
        />
      </section>

      <!-- The one filled button on the screen: a room is where most people start. -->
      <form
        class="flex flex-wrap gap-2 border-t border-fid-border pt-4"
        @submit.prevent="createRoom"
      >
        <input
          v-model="draft"
          :placeholder="c.places.namePlaceholder"
          :aria-label="c.places.addTop"
          class="min-w-0 grow fid-field px-3 py-2 text-fid-base text-fid-text"
        />
        <button
          type="submit"
          :disabled="creating"
          class="fid-fill min-h-11 rounded-fid-sm bg-fid-accent-fill px-4 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        >
          {{ c.places.addTop }}
        </button>
      </form>
      <button
        type="button"
        class="fid-plate fid-action min-h-11 self-start text-fid-text-muted underline decoration-dotted underline-offset-4 hover:text-fid-text"
        @click="picking = picking === 'top' ? null : 'top'"
      >
        {{ c.places.addUnitTop }}
      </button>
      <UnitPicker
        v-if="picking === 'top'"
        :parent-id="null"
        @created="((picking = null), load())"
        @cancel="picking = null"
      />

      <p class="text-fid-xs text-fid-text-muted">{{ c.places.staysHere }}</p>
    </template>

    <ShelfSheet v-if="sheet !== null" :instance-id="sheet" @close="sheet = null" />
    <DragGhost />
  </AppPage>
</template>
