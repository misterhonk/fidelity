<script setup lang="ts">
import { labelOf } from '#shared/places'
import type { PlaceNode, ShelfRecord } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * Filling a compartment from the wall (M27.1c, docs/18 §5c).
 *
 * The collection, in the compartment's drawer: a search field, the filter
 * *not placed yet* on by default — the pile still to sort in is what
 * somebody standing at the shelf has in their hands — and a tick per
 * record. One button puts the ticked ones here. The list refreshes after,
 * so the next armful can follow without leaving the compartment.
 */
const props = defineProps<{ place: PlaceNode }>()
const emit = defineEmits<{ filled: []; close: [] }>()

const c = useCollectionMessages()
const { call } = useFidelityWorker()

const query = ref('')
const unplacedOnly = ref(true)
const records = shallowRef<ShelfRecord[]>([])
const total = ref(0)
const selected = ref(new Set<number>())
const busy = ref(false)
const PAGE = 48

async function load(more = false) {
  const view = await call('collection.records', {
    query: query.value,
    unplaced: unplacedOnly.value,
    sort: 'artist',
    offset: more ? records.value.length : 0,
    limit: PAGE,
  })
  records.value = more ? [...records.value, ...view.records] : view.records
  total.value = view.total
}

watch([query, unplacedOnly], () => void load(), { immediate: true })

/**
 * "All" means the whole answer, not the page of it (M28 #4). Forty-eight
 * rows are loaded at a time; the ids of the rest come in one more call, and
 * the button says the true number: "Put 62 in A1".
 */
async function selectAll() {
  let ids = records.value.map((record) => record.instanceId)
  if (records.value.length < total.value) {
    const rest = await call('collection.records', {
      query: query.value,
      unplaced: unplacedOnly.value,
      sort: 'artist',
      offset: 0,
      limit: total.value,
    })
    ids = rest.records.map((record) => record.instanceId)
  }
  selected.value = new Set(ids)
}

function toggle(instanceId: number) {
  const next = new Set(selected.value)
  if (next.has(instanceId)) next.delete(instanceId)
  else next.add(instanceId)
  selected.value = next
}

async function put() {
  if (selected.value.size === 0 || busy.value) return
  busy.value = true
  try {
    await call('places.assignMany', {
      instanceIds: [...selected.value],
      placeId: props.place.id,
    })
    selected.value = new Set()
    emit('filled')
    await load()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 border-t border-fid-border pt-3">
    <div class="flex flex-wrap items-center gap-4">
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        :placeholder="c.places.fillSearch"
        :aria-label="c.places.fillSearch"
        class="fid-field min-w-0 grow px-3 py-2 text-fid-base text-fid-text"
      />
      <div role="group" :aria-label="c.places.unplacedOnly" class="flex gap-4">
        <button
          v-for="only in [true, false]"
          :key="String(only)"
          type="button"
          class="fid-plate min-h-11 border-b-2 transition-colors"
          :class="
            unplacedOnly === only
              ? 'border-fid-accent text-fid-text'
              : 'border-transparent text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="unplacedOnly === only"
          @click="unplacedOnly = only"
        >
          {{ only ? c.places.unplacedOnly : c.places.everything }}
        </button>
      </div>
      <button
        v-if="total > 0"
        type="button"
        class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
        @click="selectAll"
      >
        {{ c.places.all }}
      </button>
    </div>

    <p v-if="records.length === 0" class="text-fid-sm text-fid-text-muted">
      {{
        query.trim()
          ? c.places.noneFound
          : unplacedOnly
            ? c.places.nothingToSort
            : c.places.noneFound
      }}
    </p>

    <ul v-else class="flex flex-col">
      <li v-for="record in records" :key="record.instanceId">
        <!--
          A row, not a tile: forty records to tick are read, not looked at,
          and a checkbox beside a 40 px sleeve is what a hand expects.
        -->
        <label
          class="flex min-h-11 cursor-pointer items-center gap-3 border-b border-fid-border py-1"
        >
          <input
            type="checkbox"
            class="size-4 shrink-0"
            :checked="selected.has(record.instanceId)"
            :aria-label="c.places.pick(record.artist, record.title)"
            @change="toggle(record.instanceId)"
          />
          <img
            v-if="record.thumbUrl"
            :src="record.thumbUrl"
            alt=""
            loading="lazy"
            decoding="async"
            width="40"
            height="40"
            class="size-10 shrink-0 rounded-fid-cover bg-fid-inset object-cover"
          />
          <span
            v-else
            class="size-10 shrink-0 rounded-fid-cover bg-fid-inset"
            aria-hidden="true"
          />
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-fid-sm text-fid-text">{{ record.title }}</span>
            <span class="fid-plate truncate text-fid-text-muted">{{ record.artist }}</span>
          </span>
        </label>
      </li>
    </ul>

    <div class="flex flex-wrap items-center gap-4">
      <button
        type="button"
        :disabled="selected.size === 0 || busy"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-50"
        @click="put"
      >
        {{ c.places.putHere(count(selected.size), labelOf(place)) }}
      </button>
      <span v-if="selected.size > 0" class="fid-plate text-fid-text-muted">
        {{ c.places.selected(count(selected.size)) }}
      </span>
      <button
        v-if="records.length < total"
        type="button"
        class="fid-plate fid-action min-h-11 text-fid-text-muted underline decoration-dotted underline-offset-4 hover:text-fid-text"
        @click="load(true)"
      >
        {{ c.places.more }}
      </button>
      <button
        type="button"
        class="fid-action min-h-11 px-2 text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="emit('close')"
      >
        {{ c.places.cancel }}
      </button>
    </div>
  </div>
</template>
