<script setup lang="ts">
import type { ShelfSort, ShelfView } from '#shared/types'

useSeoMeta({ title: 'Dein Regal', description: 'Deine Platten, als Regal.' })

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const view = shallowRef<ShelfView | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

const query = ref('')
const sort = ref<ShelfSort>('added')
const shown = ref(120)

const SORTS = [
  { key: 'added', label: 'Zuletzt dazu' },
  { key: 'artist', label: 'Künstler' },
  { key: 'year', label: 'Jahr' },
  { key: 'rating', label: 'Bewertung' },
] as const satisfies readonly { key: ShelfSort; label: string }[]

let token = 0
async function load() {
  const mine = ++token
  error.value = null
  try {
    const next = await call('collection.records', {
      query: query.value,
      sort: sort.value,
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

onMounted(load)

// A new filter or order starts from the top; loading more does not.
watch([query, sort], () => {
  shown.value = 120
  void load()
})
watch(shown, load)

const number = new Intl.NumberFormat('de-DE')
const rest = computed(() => (view.value ? view.value.total - view.value.records.length : 0))
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
      <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Dein Regal</h1>
      <CollectionTabs />
    </header>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="loading" class="text-fid-base text-fid-text-muted">Wird geladen …</p>

    <p v-else-if="!view || view.collection === 0" class="text-fid-base text-fid-text-muted">
      Noch keine Platten hier. Sammlung in den Einstellungen holen.
    </p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="Künstler, Titel oder Label"
          aria-label="Regal durchsuchen"
          class="min-w-56 grow rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />

        <nav
          aria-label="Sortierung"
          class="flex gap-1 rounded-fid-sm border border-fid-border p-1"
        >
          <button
            v-for="option in SORTS"
            :key="option.key"
            type="button"
            :aria-pressed="sort === option.key"
            class="min-h-9 rounded-fid-sm px-3 text-fid-sm transition-colors"
            :class="
              sort === option.key
                ? 'bg-fid-accent/15 text-fid-text'
                : 'text-fid-text-muted hover:text-fid-text'
            "
            @click="sort = option.key"
          >
            {{ option.label }}
          </button>
        </nav>

        <p class="fid-num shrink-0 text-fid-sm text-fid-text-muted">
          {{ number.format(view.total) }}
          <template v-if="view.total !== view.collection">
            von {{ number.format(view.collection) }}
          </template>
          Platten
        </p>
      </div>

      <p v-if="view.records.length === 0" class="text-fid-base text-fid-text-muted">
        Nichts mit diesem Namen im Regal.
      </p>

      <ul
        v-else
        class="grid grid-cols-3 gap-x-4 gap-y-6 @md:grid-cols-4 @2xl:grid-cols-6 @5xl:grid-cols-8"
      >
        <li
          v-for="record in view.records"
          :key="record.releaseId"
          class="flex flex-col gap-1.5"
        >
          <a
            :href="`https://www.discogs.com/release/${record.releaseId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex flex-col gap-1.5 rounded-fid-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fid-accent"
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
              kein Cover
            </span>

            <span class="line-clamp-2 text-fid-sm text-fid-text group-hover:underline">
              {{ record.title }}
            </span>
          </a>

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
        Weitere <span class="fid-num">{{ number.format(Math.min(rest, 240)) }}</span> zeigen
      </button>
    </template>
  </main>
</template>
