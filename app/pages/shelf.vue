<script setup lang="ts">
import { DEFAULT_SHELF_DIRECTION } from '#shared/types'
import type { ShelfSort, ShelfView, SortDirection } from '#shared/types'

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
 * Die Richtung, und wie man sie umlegt.
 *
 * Ein zweiter Klick auf denselben Schlüssel dreht — das ist die Geste, die
 * jede Tabelle seit dreißig Jahren benutzt, und sie braucht keinen zweiten
 * Knopf neben jedem Wort. Ein Wechsel auf einen *anderen* Schlüssel fängt bei
 * dessen Vorgabe an, statt eine Richtung mitzuschleppen, die zu ihm nicht
 * passt: Namen wollen A–Z, Bewertungen wollen die beste zuerst.
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
 * Nur die Schlüssel. Die Beschriftung kommt aus dem Paket, der Pfeil aus der
 * Richtung — früher steckte er in der Beschriftung, weil jeder Schlüssel nur
 * eine Richtung hatte.
 */
const SORTS = ['added', 'artist', 'year', 'rating'] as const satisfies readonly ShelfSort[]

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
  <main class="@container mx-auto flex w-full max-w-[110rem] flex-col gap-6 px-6 py-10">
    <!--
      Wider than the reading screens on purpose. A grid of covers is the one
      thing in this app that gets better with room, and a collector at a desk
      has room — the column count follows the container, so the same markup is
      three across on a phone and eight on a monitor.
    -->
    <header class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.title }}</h1>
      <CollectionTabs />
    </header>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ c.loading }}</p>

    <p v-else-if="!view || view.collection === 0" class="text-fid-base text-fid-text-muted">
      {{ c.shelf.empty }}
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

        <p class="ml-auto flex shrink-0 items-center gap-3 text-fid-sm text-fid-text-muted">
          <span v-if="readFullyAt">{{ c.shelf.readFully(since(readFullyAt)) }}</span>
          <button
            type="button"
            class="fid-lift min-h-11 rounded-fid-sm border border-fid-field px-3 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
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
          class="min-w-56 grow rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />

        <nav
          :aria-label="c.shelf.sorting"
          class="flex gap-1 rounded-fid-sm border border-fid-border p-1"
        >
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
            class="min-h-9 rounded-fid-sm px-3 text-fid-sm transition-colors"
            :class="
              sort === key
                ? 'bg-fid-accent/15 text-fid-text'
                : 'text-fid-text-muted hover:text-fid-text'
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
      </div>

      <p v-if="view.records.length === 0" class="text-fid-base text-fid-text-muted">
        {{ c.shelf.noMatch }}
      </p>

      <ul
        v-else
        class="grid grid-cols-3 gap-x-4 gap-y-6 @md:grid-cols-4 @2xl:grid-cols-6 @5xl:grid-cols-8"
      >
        <li v-for="record in view.records" :key="record.instanceId" class="flex flex-col gap-2">
          <button
            type="button"
            :aria-label="c.open(record.artist, record.title)"
            class="fid-cover-button group flex flex-col gap-2 rounded-fid-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fid-accent"
            @click="open = record.instanceId"
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
              sizes="(min-width: 90rem) 12vw, (min-width: 48rem) 16vw, 30vw"
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

            <span class="line-clamp-2 text-fid-sm text-fid-text group-hover:underline">
              {{ record.title }}
            </span>
          </button>

          <span class="line-clamp-1 text-fid-xs text-fid-text-muted">{{ record.artist }}</span>
          <span class="flex flex-wrap gap-x-2 text-fid-xs text-fid-text-muted">
            <span v-if="record.year > 0" class="fid-num">{{ record.year }}</span>
            <!-- Only when it was actually given. 0 means "never said". -->
            <span v-if="record.rating > 0" class="fid-num text-fid-sig-wantlist">
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
  </main>
</template>
