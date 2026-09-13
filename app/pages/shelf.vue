<script setup lang="ts">
import { labelOf } from '#shared/places'
import { DEFAULT_SHELF_DIRECTION } from '#shared/types'
import type { PlaceNode, ShelfSort, ShelfView, SortDirection } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
useSeoMeta({ title: () => c.value.title, description: () => c.value.shelf.description })

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const view = shallowRef<ShelfView | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

const query = ref('')
const sort = ref<ShelfSort>('added')

/**
 * "What do I own on this label" — asked from a record, answered here.
 *
 * In the address rather than in a variable, so the question survives a reload
 * and can be sent to somebody. Read as a computed rather than copied into a
 * ref: tapping a second label while this one is open has to replace the
 * question, and a copy taken once on mount would quietly keep the first.
 */
const route = useRoute()
const facet = computed(() => {
  const one = (value: unknown) => (typeof value === 'string' && value.trim() ? value : '')
  return { label: one(route.query.label), artist: one(route.query.artist) }
})

/** The way back to the whole shelf, keeping whatever was typed in the box. */
function clearFacet() {
  void navigateTo({ path: '/shelf' })
}

/**
 * The direction, and how it gets turned.
 *
 * A second click on the same key reverses it — the gesture every table has
 * used for thirty years, and it needs no second button beside every word.
 * Switching to a *different* key starts at that key's default rather than
 * dragging along a direction that does not suit it: names want A–Z, ratings
 * want the best first.
 */
const direction = ref<SortDirection>(DEFAULT_SHELF_DIRECTION.added)

function chooseSort(key: ShelfSort) {
  if (sort.value === key) {
    direction.value = direction.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sort.value = key
  direction.value = DEFAULT_SHELF_DIRECTION[key]
}
const shown = ref(120)

/**
 * The keys only. The label comes from the language pack, the arrow from the
 * direction — it used to sit inside the label, because each key had only one
 * direction.
 */
const SORTS = ['added', 'artist', 'year', 'rating'] as const satisfies readonly ShelfSort[]

/**
 * From the shelf into a compartment (M27.5, docs/18 §4). "Select" turns the
 * sleeves into things to tick; "Put n in …" opens the wall small as the
 * picker, the same one the compartment's sheet uses; the line with "Undo"
 * puts them back where they were — a compartment, or no place at all.
 */
const selecting = ref(false)
const selected = ref(new Set<number>())
const picking = ref(false)
const nodes = shallowRef<PlaceNode[]>([])
const last = shallowRef<{
  line: string
  was: { instanceId: number; placeId: string | null }[]
} | null>(null)
function toggleSelect(instanceId: number) {
  const next = new Set(selected.value)
  if (next.has(instanceId)) next.delete(instanceId)
  else next.add(instanceId)
  selected.value = next
}
function selectAll() {
  selected.value = new Set((view.value?.records ?? []).map((record) => record.instanceId))
}
function stopSelecting() {
  selecting.value = false
  picking.value = false
  selected.value = new Set()
}
async function openPicker() {
  picking.value = !picking.value
  if (picking.value && nodes.value.length === 0)
    nodes.value = await call('places.overview', undefined)
}
async function putIn(placeId: string) {
  const instanceIds = [...selected.value]
  if (instanceIds.length === 0) return
  // Where each one was, for the way back.
  const was = await Promise.all(
    instanceIds.map(async (instanceId) => ({
      instanceId,
      placeId: await call('places.of', { instanceId }),
    })),
  )
  await call('places.assignMany', { instanceIds, placeId })
  const node = nodes.value.find((n) => n.id === placeId)
  last.value = {
    line: c.value.places.putInto(count(instanceIds.length), node ? labelOf(node) : ''),
    was,
  }
  stopSelecting()
}
async function undo() {
  if (!last.value) return
  const byPlace = new Map<string | null, number[]>()
  for (const { instanceId, placeId } of last.value.was) {
    byPlace.set(placeId, [...(byPlace.get(placeId) ?? []), instanceId])
  }
  for (const [placeId, instanceIds] of byPlace) {
    await call('places.assignMany', { instanceIds, placeId })
  }
  last.value = null
}

let token = 0
async function load() {
  const mine = ++token
  error.value = null
  try {
    const next = await call('collection.records', {
      query: query.value,
      label: facet.value.label,
      artist: facet.value.artist,
      sort: sort.value,
      direction: direction.value,
      limit: shown.value,
    })
    // A slower answer to an older query must not overwrite a newer one.
    if (mine === token) view.value = next
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }
}

/**
 * How many across (M26.2, docs/05 §1 "density is a feature").
 *
 * Six columns on a monitor and two on a phone are the sleeve size; eight and
 * three are the crate. A switch rather than a compromise between them, kept
 * per device — how big somebody wants their covers is a fact about the
 * screen in front of them, not about their collection.
 */
type ShelfDensity = 'roomy' | 'compact'
const DENSITY_KEY = 'fidelity:shelf-density'
const density = ref<ShelfDensity>('roomy')
const GRIDS: Record<ShelfDensity, string> = {
  roomy: 'grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-4 @5xl:grid-cols-6',
  compact: 'grid-cols-3 @md:grid-cols-4 @2xl:grid-cols-6 @5xl:grid-cols-8',
}
function setDensity(value: ShelfDensity) {
  density.value = value
  try {
    localStorage.setItem(DENSITY_KEY, value)
  } catch {
    // Private mode, or storage refused: the switch still works for this visit.
  }
}
onMounted(() => {
  try {
    if (localStorage.getItem(DENSITY_KEY) === 'compact') density.value = 'compact'
  } catch {
    // Nothing remembered, nothing lost.
  }
})

onMounted(async () => {
  await load()
  readFullyAt.value = await call('collection.readFullyAt', undefined)
})

// A new filter or order starts from the top; loading more does not.
watch([query, sort, direction, facet], () => {
  shown.value = 120
  void load()
})
watch(shown, load)

const rest = computed(() => (view.value ? view.value.total - view.value.records.length : 0))

/*
 * How far the two can have drifted, and a way to close the gap.
 *
 * The everyday sync is a delta: it stops at the first record it already knows,
 * which makes an unchanged collection cost one request. The price is that it
 * can only ever see *additions* — a rating changed on the Discogs website
 * leaves `date_added` untouched, and Discogs offers no modification date to
 * ask about instead (docs/02). Reading the whole list is the only way to
 * notice, so this says when that last happened and offers to do it now.
 */
const readFullyAt = ref<number | null>(null)
const rereading = ref(false)
const { tick } = useKeeper()

async function reread() {
  rereading.value = true
  try {
    await tick({ force: true })
    readFullyAt.value = await call('collection.readFullyAt', undefined)
    await load()
  } finally {
    rereading.value = false
  }
}

/*
 * A record of your own now opens here, not at Discogs.
 *
 * The tile used to be a link straight out of the app, on the grounds that a
 * shelf entry has no market data and so nothing to show. It has plenty: the
 * label, the catalogue number, the pressing, the styles, when it arrived and
 * what it was rated — all of it already in IndexedDB, all of it readable in a
 * basement with no signal. Discogs is one button away for the rest.
 */
const open = ref<number | null>(null)
</script>

<template>
  <AppPage>
    <!--
      Wider than the reading screens on purpose. A grid of covers is the one
      thing in this app that gets better with room, and a collector at a desk
      has room — the column count follows the container, so the same markup is
      three across on a phone and eight on a monitor.
    -->
    <PageHeader :title="c.title">
      <template #tabs><CollectionTabs /></template>
    </PageHeader>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ c.loading }}</p>

    <p v-else-if="!view || view.collection === 0" class="text-fid-base text-fid-text-muted">
      {{ c.shelf.empty }}
      <NuxtLink
        class="fid-action text-fid-text underline underline-offset-4"
        to="/settings/collection"
        >{{ c.shelf.emptyAction }}</NuxtLink
      >
    </p>

    <template v-else>
      <!--
        Two rows, and they answer two different things.

        This one is the state of the shelf: how many records there are, and
        how long ago the app and Discogs last agreed. Nothing here changes
        what is shown — the count is the answer somebody arrives with, and the
        sync is housekeeping, so it sits where the eye stops.
      -->
      <div class="flex flex-wrap items-center gap-3">
        <p class="fid-num shrink-0 text-fid-sm text-fid-text-muted">
          {{
            c.shelfCount(
              count(view.total),
              view.total !== view.collection ? count(view.collection) : null,
              c.records,
            )
          }}
        </p>

        <!-- A plate, not a button (M28 #7): maintenance must not compete with the covers. -->
        <p class="fid-plate ml-auto flex shrink-0 items-center gap-4 text-fid-text-muted">
          <span v-if="readFullyAt">{{ c.shelf.readFully(since(readFullyAt)) }}</span>
          <button
            type="button"
            class="fid-plate fid-action min-h-11 text-fid-text-muted transition-colors hover:text-fid-text disabled:opacity-50"
            :disabled="rereading"
            @click="reread()"
          >
            {{ rereading ? c.shelf.rereading : c.shelf.reread }}
          </button>
        </p>
      </div>

      <!--
        What the shelf has been narrowed to, and the way out of it.

        Without this the screen shows three records where there are thirty-four
        and says nothing about why — which reads as a broken collection rather
        than an answered question. It names the label or the artist, because
        "Filter active" would be a word about the app instead of about music.
      -->
      <p
        v-if="facet.label || facet.artist"
        class="flex flex-wrap items-center gap-3 text-fid-sm text-fid-text"
      >
        <span>{{ c.shelf.onlyFrom(facet.label || facet.artist) }}</span>
        <button
          type="button"
          class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
          @click="clearFacet()"
        >
          {{ c.shelf.showAll }}
        </button>
      </p>

      <!--
        And this one is the controls: what to look for, and in which order.
        Together on a line of their own, because they are used together and
        nothing else on the screen is used with them.
      -->
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          :placeholder="c.shelf.search"
          :aria-label="c.shelf.searchLabel"
          class="fid-field min-w-56 grow px-3 py-2 text-fid-sm text-fid-text"
        />

        <nav :aria-label="c.shelf.sorting" class="flex gap-4">
          <button
            v-for="key in SORTS"
            :key="key"
            type="button"
            :aria-pressed="sort === key"
            :aria-label="
              sort === key
                ? (direction === 'asc' ? c.sortedAsc : c.sortedDesc)(c.shelf.sorts[key].label)
                : undefined
            "
            class="fid-plate min-h-9 border-b-2 transition-colors"
            :class="
              sort === key
                ? 'border-fid-accent text-fid-text'
                : 'border-transparent text-fid-text-muted hover:text-fid-text'
            "
            :title="c.shelf.sorts[key].about"
            @click="chooseSort(key)"
          >
            {{ c.shelf.sorts[key].label
            }}<span v-if="sort === key" aria-hidden="true" class="ml-1 text-fid-text-muted">{{
              direction === 'asc' ? '↑' : '↓'
            }}</span>
          </button>
        </nav>

        <div role="group" :aria-label="c.shelf.density.label" class="flex gap-4">
          <button
            v-for="key in ['roomy', 'compact'] as const"
            :key="key"
            type="button"
            :aria-pressed="density === key"
            class="fid-plate min-h-9 border-b-2 transition-colors"
            :class="
              density === key
                ? 'border-fid-accent text-fid-text'
                : 'border-transparent text-fid-text-muted hover:text-fid-text'
            "
            @click="setDensity(key)"
          >
            {{ c.shelf.density[key] }}
          </button>
        </div>

        <button
          type="button"
          class="fid-plate min-h-9 border-b-2 transition-colors"
          :class="
            selecting
              ? 'border-fid-accent text-fid-text'
              : 'border-transparent text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="selecting"
          @click="selecting ? stopSelecting() : (selecting = true)"
        >
          {{ selecting ? c.places.done : c.places.select }}
        </button>
      </div>

      <!-- The selection's one action: into a compartment, picked on the small wall. -->
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
          @click="openPicker"
        >
          {{ c.places.putSelected(count(selected.size)) }}
        </button>
      </div>
      <div
        v-if="selecting && picking"
        class="flex flex-col gap-2 border-t border-fid-border pt-3"
      >
        <span class="fid-plate text-fid-text-muted">{{ c.places.whereTo }}</span>
        <PlacePicker :nodes="nodes" :except="null" @pick="putIn($event)" />
      </div>

      <!-- The way back, pinned where the eye is. -->
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

      <p v-if="view.records.length === 0" class="text-fid-base text-fid-text-muted">
        {{ c.shelf.noMatch }}
      </p>

      <ul v-else class="grid gap-x-4 gap-y-8" :class="GRIDS[density]">
        <li
          v-for="record in view.records"
          :key="record.instanceId"
          class="relative flex flex-col gap-2"
        >
          <!-- In select mode the sleeve is a thing to tick, not a door. -->
          <input
            v-if="selecting"
            type="checkbox"
            class="absolute top-2 left-2 z-10 size-5"
            :checked="selected.has(record.instanceId)"
            :aria-label="c.places.pick(record.artist, record.title)"
            @change="toggleSelect(record.instanceId)"
          />
          <button
            type="button"
            :aria-label="c.open(record.artist, record.title)"
            class="fid-cover-button group flex flex-col gap-2 rounded-fid-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fid-accent"
            :class="
              selecting && selected.has(record.instanceId)
                ? 'outline-2 outline-offset-2 outline-fid-accent'
                : ''
            "
            @click="selecting ? toggleSelect(record.instanceId) : (open = record.instanceId)"
          >
            <!--
              Lazy, never fetched by hand. i.discogs.com has its own budget of
              roughly thirty a minute (docs/02) and the service worker keeps
              what it gets, so scrolling costs once and never again.
            -->
            <!--
              Two sizes, both already in the sync response. A 150px thumb
              stretched across a desktop cell looks like a thumbnail; the 600px
              one on a phone is four times the bytes for nothing. srcset lets
              the browser pick, and it picks better than a breakpoint would.
            -->
            <img
              v-if="record.thumbUrl || record.coverUrl"
              :src="record.coverUrl || record.thumbUrl"
              :srcset="
                record.coverUrl && record.thumbUrl
                  ? `${record.thumbUrl} 150w, ${record.coverUrl} 600w`
                  : undefined
              "
              :sizes="
                density === 'compact'
                  ? '(min-width: 90rem) 12vw, (min-width: 48rem) 16vw, 30vw'
                  : '(min-width: 90rem) 16vw, (min-width: 48rem) 25vw, 50vw'
              "
              alt=""
              loading="lazy"
              decoding="async"
              width="600"
              height="600"
              class="aspect-square w-full rounded-fid-sm bg-fid-surface object-cover transition-opacity group-hover:opacity-85"
            />
            <span
              v-else
              class="flex aspect-square w-full items-center justify-center rounded-fid-sm bg-fid-surface text-fid-xs text-fid-text-muted"
            >
              {{ c.noCover }}
            </span>

            <!-- The title in the display face; the rest is a plate under it (M26.2). -->
            <span
              class="fid-display line-clamp-2 text-fid-sm leading-tight font-semibold text-fid-text group-hover:underline"
            >
              {{ record.title }}
            </span>
          </button>

          <span class="fid-plate truncate text-fid-text-muted">{{ record.artist }}</span>
          <span class="fid-plate flex flex-wrap gap-x-2 text-fid-text-muted">
            <span v-if="record.year > 0">{{ record.year }}</span>
            <!--
              Only when it was actually given. 0 means "never said". Gold, not
              magenta: magenta is the wantlist's colour, and a rating on the
              shelf has nothing to do with the wantlist.
            -->
            <span v-if="record.rating > 0" class="text-fid-sig-gap">
              {{ '★'.repeat(record.rating) }}
            </span>
          </span>
        </li>
      </ul>

      <button
        v-if="rest > 0"
        type="button"
        class="fid-action self-center text-fid-sm text-fid-accent underline underline-offset-4"
        @click="shown += 240"
      >
        {{ c.showMore(count(Math.min(rest, 240))) }}
      </button>
    </template>

    <ShelfSheet v-if="open !== null" :instance-id="open" @close="open = null" />
  </AppPage>
</template>
