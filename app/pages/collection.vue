<script setup lang="ts">
import { gradeFieldIds } from '#shared/grades'
import { labelOf } from '#shared/places'
import { DEFAULT_SHELF_DIRECTION, isOwnEntry, SHELF_CHIPS } from '#shared/types'
import { GRADES } from '#shared/format'
import type {
  CollectionField,
  CollectionFolder,
  PlaceNode,
  ShelfChip,
  ShelfRecord,
  ShelfSort,
  ShelfView,
} from '#shared/types'
import type { BulkChange, BulkUndo } from '~~/worker/collection/bulk'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
const { open: openAdd } = useAddMode()
const { identity } = useIdentity()
useSeoMeta({ title: () => c.value.title, description: () => c.value.shelf.description })

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const view = shallowRef<ShelfView | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

const query = ref('')

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

// `?q=` is how the palette (#215) hands over a record: the box fills in.
watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string') query.value = q
  },
  { immediate: true },
)

/** The way back to the whole shelf, keeping whatever was typed in the box. */
function clearFacet() {
  void navigateTo({
    path: '/collection',
    query: { ...route.query, label: undefined, artist: undefined },
  })
}

/*
 * A saved view is an address (#236).
 *
 * Order, direction, chips and rows-or-covers all live in the query string, so
 * a view is kept by bookmarking it and shared by sending it — no store, no
 * list of views to keep in step between devices. Defaults stay out of the
 * address, so the plain shelf is still plain `/collection`.
 */
const router = useRouter()
const SORTS = ['added', 'artist', 'year', 'rating'] as const satisfies readonly ShelfSort[]
const sort = computed<ShelfSort>(() => SORTS.find((key) => key === route.query.sort) ?? 'added')
const direction = computed(() =>
  route.query.dir === 'asc' || route.query.dir === 'desc'
    ? route.query.dir
    : DEFAULT_SHELF_DIRECTION[sort.value],
)
const only = computed<ShelfChip[]>(() => {
  const raw = typeof route.query.only === 'string' ? route.query.only.split(',') : []
  return SHELF_CHIPS.filter((chip) => raw.includes(chip))
})
const rows = computed(() => route.query.as === 'rows')

function setAddress(patch: Record<string, string | undefined>) {
  void router.replace({ query: { ...route.query, ...patch } })
}

function toggleChip(chip: ShelfChip) {
  const next = only.value.includes(chip)
    ? only.value.filter((one) => one !== chip)
    : [...only.value, chip]
  setAddress({ only: next.length ? next.join(',') : undefined })
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
function chooseSort(key: ShelfSort) {
  if (sort.value === key) {
    const turned = direction.value === 'asc' ? 'desc' : 'asc'
    setAddress({ dir: turned === DEFAULT_SHELF_DIRECTION[key] ? undefined : turned })
    return
  }
  setAddress({ sort: key === 'added' ? undefined : key, dir: undefined })
}
const shown = ref(120)

/**
 * Select, then change them all (M27.5, #237). "Select" turns the sleeves into
 * things to tick — or `x` on the one in focus, shift-click for a run, a long
 * press on a phone. Then one change for all of them: a place (on the small
 * wall, the same picker the compartment's sheet uses), a rating, a grade, a
 * folder, or off the shelf. The line after it says how long Discogs will take
 * to hear of it, and "Undo all" takes all of it back.
 */
const selecting = ref(false)
const selected = ref(new Set<number>())
const panel = ref<'place' | 'remove' | null>(null)
const nodes = shallowRef<PlaceNode[]>([])
const folders = shallowRef<CollectionFolder[]>([])
const last = shallowRef<{ line: string; button: string; undo: BulkUndo } | null>(null)
const notice = ref<string | null>(null)
/** The tick a shift-click runs from. */
let anchor: number | null = null

function toggleSelect(instanceId: number, run = false) {
  const next = new Set(selected.value)
  const ids = view.value?.records.map((record) => record.instanceId) ?? []
  const from = anchor === null ? -1 : ids.indexOf(anchor)
  const to = ids.indexOf(instanceId)
  if (run && from >= 0 && to >= 0)
    for (const id of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(id)
  else if (next.has(instanceId)) next.delete(instanceId)
  else next.add(instanceId)
  anchor = instanceId
  selected.value = next
}
function startSelecting() {
  selecting.value = true
  if (folders.value.length === 0)
    void call('collection.folders', undefined).then((all) => (folders.value = all))
}
function selectAll() {
  selected.value = new Set((view.value?.records ?? []).map((record) => record.instanceId))
}
function stopSelecting() {
  selecting.value = false
  panel.value = null
  selected.value = new Set()
  anchor = null
}

/** Press and hold: a phone has no shift key and no x. */
let holding: ReturnType<typeof setTimeout> | undefined
let held = false
function press(instanceId: number) {
  clearTimeout(holding)
  held = false
  holding = setTimeout(() => {
    held = true
    startSelecting()
    toggleSelect(instanceId)
  }, 500)
}
function release() {
  clearTimeout(holding)
}
onBeforeUnmount(release)

function onTile(event: MouseEvent, instanceId: number) {
  // The click that ends a long press is not a second tick.
  if (held) {
    held = false
    return
  }
  if (event.shiftKey) {
    startSelecting()
    toggleSelect(instanceId, true)
  } else if (selecting.value) toggleSelect(instanceId)
  else open.value = instanceId
}

async function openPicker() {
  panel.value = panel.value === 'place' ? null : 'place'
  if (panel.value && nodes.value.length === 0)
    nodes.value = await call('places.overview', undefined)
}

/** A select's choice, and the select back on its prompt for the next one. */
function chosen(event: Event): string {
  const select = event.target as HTMLSelectElement
  const value = select.value
  select.value = ''
  return value
}

async function apply(change: BulkChange) {
  const instanceIds = [...selected.value]
  if (instanceIds.length === 0) return
  const result = await call('collection.bulk', { instanceIds, change })
  // Every copy was already there: no line, and no Undo all that would undo nothing.
  if (result.changed === 0) return stopSelecting()
  const node = change.kind === 'place' ? nodes.value.find((n) => n.id === change.placeId) : null
  last.value = {
    line:
      change.kind === 'place'
        ? c.value.places.putInto(count(instanceIds.length), node ? labelOf(node) : '')
        : c.value.bulk.done(
            result.changed,
            count(result.changed),
            Math.round(result.ms / 60_000),
          ),
    button: change.kind === 'place' ? c.value.places.undo : c.value.bulk.undoAll,
    undo: result.undo,
  }
  notice.value = null
  stopSelecting()
  await load()
  // In the background: the drain takes as long as the line says, and nobody waits for it.
  if (result.requests > 0) void call('outbox.flush', undefined).catch(() => undefined)
}

async function undo() {
  if (!last.value) return
  const { undo: was } = last.value
  const result = await call('collection.bulkUndo', { undo: was })
  last.value = null
  notice.value = result.gone > 0 ? c.value.bulk.gone(count(result.gone)) : null
  await load()
  if (was.kind !== 'place') void call('outbox.flush', undefined).catch(() => undefined)
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
      only: [...only.value],
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
  // Covers again, when the rows were showing.
  if (rows.value) setAddress({ as: undefined })
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

// A new filter or order starts from the top; loading more does not. Watched as
// one string: opening a record rewrites the address too, and must not reload.
watch(
  () => JSON.stringify([query.value, sort.value, direction.value, facet.value, only.value]),
  () => {
    shown.value = 120
    void load()
  },
)
watch(shown, load)

/*
 * The rows (#236): the same records, one per line, every column editable in
 * place — through the same worker calls and the same outbox as the sheet.
 */
const fields = shallowRef<CollectionField[]>([])
const grades = computed(() => {
  const ids = gradeFieldIds(fields.value)
  return {
    media: fields.value.find((field) => field.id === ids.media) ?? null,
    sleeve: fields.value.find((field) => field.id === ids.sleeve) ?? null,
  }
})
const { state: writeState, push } = useWriteBack()

watch(
  rows,
  async (on) => {
    if (!on) return
    // Definitions only: instance 0 has no values, and none are asked for.
    const [noted, known, overview] = await Promise.all([
      call('collection.fields', { instanceId: 0 }),
      call('collection.folders', undefined),
      call('places.overview', undefined),
    ])
    fields.value = noted.fields
    folders.value = known
    nodes.value = overview
  },
  { immediate: true },
)

async function edit(change: () => Promise<boolean>) {
  await push(change)
  await load()
}
const rate = (record: ShelfRecord, rating: number) =>
  edit(() => call('collection.rate', { instanceId: record.instanceId, rating }))
const grade = (record: ShelfRecord, field: CollectionField, value: string) =>
  edit(() =>
    call('collection.setField', { instanceId: record.instanceId, fieldId: field.id, value }),
  )
const moveTo = (record: ShelfRecord, folderId: number) =>
  edit(() => call('collection.move', { instanceId: record.instanceId, folderId }))
async function placeAt(record: ShelfRecord, placeId: string) {
  // Ours alone (ADR-019): nothing goes to Discogs, so no outbox.
  await call('places.assign', { instanceId: record.instanceId, placeId: placeId || null })
  await load()
}

function syncOf(record: ShelfRecord): string {
  if (!isOwnEntry(record)) return c.value.shelf.rows.local
  if (record.failing) return c.value.shelf.rows.failing
  return record.waiting > 0
    ? c.value.shelf.rows.waiting(record.waiting)
    : c.value.shelf.rows.synced
}
const pressingOf = (record: ShelfRecord) =>
  [record.label, record.catno, record.year > 0 ? String(record.year) : '']
    .filter(Boolean)
    .join(' · ')
const placeName = (record: ShelfRecord) => {
  const node = nodes.value.find((one) => one.id === record.placeId)
  return node ? labelOf(node) : c.value.shelf.rows.none
}
const folderName = (record: ShelfRecord) =>
  folders.value.find((folder) => folder.id === record.folderId)?.name ?? c.value.shelf.rows.none

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

const outboxSeen = ref(0)

async function reread() {
  rereading.value = true
  try {
    await tick({ force: true })
    readFullyAt.value = await call('collection.readFullyAt', undefined)
    await load()
    // A full read is when both sides are compared (#238): the line may have news.
    outboxSeen.value += 1
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
const open = useOpenInQuery('record', asId)
// What the sheet changed (rating, grade, place) shows on the covers, in the rows and under the chips.
watch(open, (now, was) => {
  if (now === null && was !== null) void load()
})

/** Where the open record stands in the list on screen, and what is either side. */
const walk = computed(() => {
  const ids = view.value?.records.map((record) => record.instanceId) ?? []
  const at = open.value
  if (at === null) return null
  const index = ids.indexOf(at)
  if (index < 0) return null
  return {
    index,
    total: ids.length,
    previous: ids[index - 1] ?? null,
    next: ids[index + 1] ?? null,
  }
})
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
      <template #aside>
        <FidButton variant="secondary" aria-keyshortcuts="a" @click="openAdd()">
          + {{ c.add.open }}
        </FidButton>
      </template>
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
        <DiscogsCredit v-if="identity" :to="collectionPage(identity.username)" />

        <!--
          Tertiary, not filled (M28 #7): maintenance must not compete with the
          covers. The reading stays a plate; the action beside it is words.
        -->
        <p class="fid-plate ml-auto flex shrink-0 items-center gap-4 text-fid-text-muted">
          <span v-if="readFullyAt">{{ c.shelf.readFully(since(readFullyAt)) }}</span>
          <FidButton variant="tertiary" :disabled="rereading" @click="reread()">
            {{ rereading ? c.shelf.rereading : c.shelf.reread }}
          </FidButton>
        </p>
        <OutboxStatus :key="outboxSeen" />
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
            :aria-pressed="!rows && density === key"
            class="fid-plate min-h-9 border-b-2 transition-colors"
            :class="
              !rows && density === key
                ? 'border-fid-accent text-fid-text'
                : 'border-transparent text-fid-text-muted hover:text-fid-text'
            "
            @click="setDensity(key)"
          >
            {{ c.shelf.density[key] }}
          </button>
          <!-- The dense table (#236): for a desk, so not offered on a phone. -->
          <button
            type="button"
            :aria-pressed="rows"
            class="fid-plate hidden min-h-9 border-b-2 transition-colors md:inline-block"
            :class="
              rows
                ? 'border-fid-accent text-fid-text'
                : 'border-transparent text-fid-text-muted hover:text-fid-text'
            "
            @click="setAddress({ as: 'rows' })"
          >
            {{ c.shelf.density.rows }}
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
          :title="c.bulk.keys"
          @click="selecting ? stopSelecting() : startSelecting()"
        >
          {{ selecting ? c.places.done : c.places.select }}
        </button>
      </div>

      <!-- The chips (#236): each one narrows, together they combine, all of it in the address. -->
      <div role="group" :aria-label="c.shelf.chips.label" class="flex flex-wrap gap-2">
        <button
          v-for="chip in SHELF_CHIPS"
          :key="chip"
          type="button"
          :aria-pressed="only.includes(chip)"
          class="fid-plate min-h-9 rounded-fid-sm border px-3 transition-colors"
          :class="
            only.includes(chip)
              ? 'border-fid-accent text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          @click="toggleChip(chip)"
        >
          {{ c.shelf.chips[chip] }}
        </button>
      </div>

      <!-- One change for every tick: a place, a rating, a grade, a folder, or off the shelf. -->
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
        <!-- Selects with their name as the prompt: the choice is the action. -->
        <select
          :aria-label="c.bulk.rating"
          :disabled="selected.size === 0"
          class="min-h-11 fid-field px-2 text-fid-sm text-fid-text disabled:opacity-50"
          @change="apply({ kind: 'rating', rating: Number(chosen($event)) })"
        >
          <option value="" disabled selected>{{ c.bulk.rating }}</option>
          <option v-for="stars in [5, 4, 3, 2, 1]" :key="stars" :value="stars">
            {{ '★'.repeat(stars) }}
          </option>
          <option value="0">{{ c.bulk.noRating }}</option>
        </select>
        <select
          :aria-label="c.bulk.grade"
          :disabled="selected.size === 0"
          class="min-h-11 fid-field px-2 text-fid-sm text-fid-text disabled:opacity-50"
          @change="apply({ kind: 'grade', grade: chosen($event) })"
        >
          <option value="" disabled selected>{{ c.bulk.grade }}</option>
          <option v-for="each in GRADES" :key="each" :value="each">{{ each }}</option>
        </select>
        <select
          v-if="folders.length > 0"
          :aria-label="c.bulk.folder"
          :disabled="selected.size === 0"
          class="min-h-11 fid-field px-2 text-fid-sm text-fid-text disabled:opacity-50"
          @change="apply({ kind: 'folder', folderId: Number(chosen($event)) })"
        >
          <option value="" disabled selected>{{ c.bulk.folder }}</option>
          <option v-for="folder in folders" :key="folder.id" :value="folder.id">
            {{ folder.name }}
          </option>
        </select>
        <button
          type="button"
          :disabled="selected.size === 0"
          class="fid-action min-h-11 px-1 text-fid-sm text-fid-text-muted hover:text-fid-text disabled:opacity-50"
          @click="panel = panel === 'remove' ? null : 'remove'"
        >
          {{ c.bulk.remove(count(selected.size)) }}
        </button>
      </div>
      <div
        v-if="selecting && panel === 'place'"
        class="flex flex-col gap-2 border-t border-fid-border pt-3"
      >
        <span class="fid-plate text-fid-text-muted">{{ c.places.whereTo }}</span>
        <PlacePicker
          :nodes="nodes"
          :except="null"
          @pick="apply({ kind: 'place', placeId: $event })"
        />
      </div>
      <!-- The one change Discogs cannot be asked to forget, so it asks first. -->
      <div
        v-if="selecting && panel === 'remove' && selected.size > 0"
        class="flex flex-wrap items-center gap-4 border-t border-fid-border pt-3"
      >
        <span class="text-fid-sm text-fid-text">{{
          c.bulk.removeWhat(count(selected.size))
        }}</span>
        <button
          type="button"
          class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text"
          @click="apply({ kind: 'remove' })"
        >
          {{ c.bulk.removeConfirm }}
        </button>
        <button
          type="button"
          class="fid-action min-h-11 text-fid-sm text-fid-text-muted"
          @click="panel = null"
        >
          {{ c.bulk.keep }}
        </button>
      </div>

      <!-- The way back, pinned where the eye is. -->
      <p v-if="last" role="status" class="fid-toast">
        {{ last.line }}
        <button
          type="button"
          class="fid-action min-h-11 text-fid-sm text-fid-accent underline underline-offset-4"
          @click="undo"
        >
          {{ last.button }}
        </button>
      </p>
      <p v-else-if="notice" role="status" class="text-fid-sm text-fid-text-muted">
        {{ notice }}
      </p>

      <p v-if="view.records.length === 0" class="text-fid-base text-fid-text-muted">
        {{ c.shelf.noMatch }}
      </p>

      <!--
        The rows (#236). Scrolls inside itself rather than the page, and every
        cell that can change is a select: the sheet's own controls, one per
        column, without opening anything. A copy Discogs has no entry for
        shows its values and offers nothing to change.
      -->
      <div v-else-if="rows" class="flex flex-col gap-2">
        <p role="status" class="fid-plate min-h-5 text-fid-text-muted">
          {{ c.shelf.sheet.write[writeState] }}
        </p>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-fid-sm text-fid-text">
            <caption class="sr-only">
              {{
                c.shelf.rows.caption
              }}
            </caption>
            <thead>
              <tr class="fid-plate text-left text-fid-text-muted">
                <th v-if="selecting" scope="col" class="w-8"></th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.record }}</th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.pressing }}</th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.rating }}</th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.media }}</th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.sleeve }}</th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.place }}</th>
                <th scope="col" class="py-2 pr-3 font-normal">{{ c.shelf.rows.folder }}</th>
                <th scope="col" class="py-2 font-normal">{{ c.shelf.rows.sync }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in view.records"
                :key="record.instanceId"
                class="border-t border-fid-border align-middle"
                :class="open === record.instanceId ? 'bg-fid-surface' : ''"
              >
                <td v-if="selecting">
                  <input
                    type="checkbox"
                    class="size-5"
                    :checked="selected.has(record.instanceId)"
                    :aria-label="c.places.pick(record.artist, record.title)"
                    @change="toggleSelect(record.instanceId)"
                  />
                </td>
                <th scope="row" class="max-w-80 py-1 pr-3 text-left font-normal">
                  <button
                    type="button"
                    :aria-label="c.open(record.artist, record.title)"
                    class="fid-action flex min-h-9 w-full flex-col text-left hover:underline"
                    @click="
                      selecting ? toggleSelect(record.instanceId) : (open = record.instanceId)
                    "
                  >
                    <span class="truncate font-semibold">{{ record.title }}</span>
                    <span class="truncate text-fid-text-muted">{{ record.artist }}</span>
                  </button>
                </th>
                <td class="fid-num py-1 pr-3 whitespace-nowrap text-fid-text-muted">
                  {{ pressingOf(record) }}
                </td>
                <td class="py-1 pr-3">
                  <select
                    v-if="isOwnEntry(record)"
                    :value="record.rating"
                    :aria-label="
                      c.shelf.rows.cell(c.shelf.rows.rating, record.artist, record.title)
                    "
                    class="fid-field min-h-9 px-1 text-fid-importance"
                    @change="rate(record, Number(($event.target as HTMLSelectElement).value))"
                  >
                    <option :value="0">{{ c.shelf.rows.none }}</option>
                    <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}</option>
                  </select>
                  <span v-else class="text-fid-importance">{{
                    record.rating > 0 ? '★'.repeat(record.rating) : c.shelf.rows.none
                  }}</span>
                </td>
                <td v-for="side in ['media', 'sleeve'] as const" :key="side" class="py-1 pr-3">
                  <select
                    v-if="isOwnEntry(record) && grades[side]"
                    :value="record[side]"
                    :aria-label="
                      c.shelf.rows.cell(c.shelf.rows[side], record.artist, record.title)
                    "
                    class="fid-field min-h-9 max-w-44 px-1"
                    @change="
                      grade(record, grades[side]!, ($event.target as HTMLSelectElement).value)
                    "
                  >
                    <option value="">{{ c.shelf.rows.none }}</option>
                    <option
                      v-for="option in grades[side]!.options"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                  </select>
                  <span v-else class="text-fid-text-muted">{{
                    record[side] || c.shelf.rows.none
                  }}</span>
                </td>
                <td class="py-1 pr-3">
                  <select
                    v-if="nodes.length > 0"
                    :value="record.placeId ?? ''"
                    :aria-label="
                      c.shelf.rows.cell(c.shelf.rows.place, record.artist, record.title)
                    "
                    class="fid-field min-h-9 max-w-44 px-1"
                    @change="placeAt(record, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">{{ c.places.nowhere }}</option>
                    <option v-for="node in nodes" :key="node.id" :value="node.id">
                      {{ '— '.repeat(node.depth) }}{{ labelOf(node) }}
                    </option>
                  </select>
                  <span v-else class="text-fid-text-muted">{{ placeName(record) }}</span>
                </td>
                <td class="py-1 pr-3">
                  <select
                    v-if="isOwnEntry(record) && folders.length > 1"
                    :value="record.folderId"
                    :aria-label="
                      c.shelf.rows.cell(c.shelf.rows.folder, record.artist, record.title)
                    "
                    class="fid-field min-h-9 max-w-36 px-1"
                    @change="moveTo(record, Number(($event.target as HTMLSelectElement).value))"
                  >
                    <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                      {{ folder.name }}
                    </option>
                  </select>
                  <span v-else class="text-fid-text-muted">{{ folderName(record) }}</span>
                </td>
                <td
                  class="fid-plate py-1 whitespace-nowrap"
                  :class="record.failing ? 'text-fid-error' : 'text-fid-text-muted'"
                  data-testid="row-sync"
                >
                  {{ syncOf(record) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ul v-else class="grid gap-x-4 gap-y-8" :class="GRIDS[density]">
        <li
          v-for="record in view.records"
          :key="record.instanceId"
          class="fid-far relative flex flex-col gap-2"
          style="--fid-far-height: 14rem"
        >
          <!-- In select mode the sleeve is a thing to tick, not a door. -->
          <!-- A shift-click on a ticked box keeps it ticked, so Vue sees nothing to patch: @change sets the box back to the selection. -->
          <input
            v-if="selecting"
            type="checkbox"
            class="absolute top-2 left-2 z-10 size-5"
            :checked="selected.has(record.instanceId)"
            :aria-label="c.places.pick(record.artist, record.title)"
            @click="toggleSelect(record.instanceId, $event.shiftKey)"
            @change="
              ($event.target as HTMLInputElement).checked = selected.has(record.instanceId)
            "
          />
          <button
            type="button"
            :aria-label="c.open(record.artist, record.title)"
            aria-keyshortcuts="x"
            class="fid-cover-button group flex flex-col gap-2 rounded-fid-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fid-accent"
            :class="
              selecting && selected.has(record.instanceId)
                ? 'outline-2 outline-offset-2 outline-fid-accent'
                : ''
            "
            @keydown.x.exact.prevent="(startSelecting(), toggleSelect(record.instanceId))"
            @pointerdown="press(record.instanceId)"
            @pointerup="release"
            @pointerleave="release"
            @pointercancel="release"
            @contextmenu="selecting && $event.preventDefault()"
            @click="onTile($event, record.instanceId)"
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
            <LabelSleeve
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
              :label="record.label"
              width="600"
              height="600"
              class="aspect-square w-full rounded-fid-sm bg-fid-surface object-cover transition-opacity group-hover:opacity-85"
            />

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
            <!-- Only when it was actually given. 0 means "never said". -->
            <span v-if="record.rating > 0" class="text-fid-importance">
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

    <!--
      The sheet walks the list it was opened from (M31.16).

      "The list" is what is on the screen — filtered, sorted, and as far down
      as somebody has asked it to go. A shelf of two thousand loads a hundred
      and twenty of them; the arrows walk those and stop, and "show more" is
      where it always was. Re-keyed on the record, because a step is a
      different record and everything in the sheet has to be fetched again.
    -->
    <ShelfSheet
      v-if="open !== null"
      :key="open"
      :instance-id="open"
      :walk="walk"
      @close="open = null"
      @step="open = $event"
    />
  </AppPage>
</template>
