<script setup lang="ts">
import type { Dealer, Dig, Match } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'

const messages = useMessages()
const collection = useCollectionMessages()
const emit = defineEmits<{ close: [] }>()

/**
 * ⌘K. Searches **data**, not only navigation (docs/05 §3): the dealers you
 * have scanned, the digs you have run, and the matches in the newest one.
 *
 * Everything it needs already sits in IndexedDB, so it is loaded once on open
 * and filtered in memory. A round trip to the worker per keystroke would put
 * a postMessage hop in front of every letter for a few hundred rows, which is
 * the wrong shape of expensive.
 */

const { call } = useFidelityWorker()
const router = useRouter()

const query = ref('')
const input = useTemplateRef<HTMLInputElement>('input')
const cursor = ref(0)

const dealers = ref<Dealer[]>([])
const digs = ref<Dig[]>([])
const matches = ref<Match[]>([])

onMounted(async () => {
  input.value?.focus()

  dealers.value = await call('dealer.list', undefined)
  digs.value = await call('dig.list', undefined)
  matches.value = (await call('dig.latest', undefined))?.matches ?? []
})

interface Entry {
  id: string
  group: string
  label: string
  hint?: string
  run: () => void
}

function go(path: string, query?: Record<string, string>) {
  return () => {
    void router.push({ path, query })
    emit('close')
  }
}

const entries = computed<Entry[]>(() => {
  const m = messages.value
  const c = collection.value
  const goTo = m.palette.goTo

  return [
    { id: 'nav-dig', group: goTo, label: m.nav.dig.label, run: go('/dig') },
    { id: 'nav-shelf', group: goTo, label: c.tabs.shelf, run: go('/shelf') },
    { id: 'nav-map', group: goTo, label: c.tabs.map, run: go('/map') },
    { id: 'nav-want', group: goTo, label: c.tabs.wantlist, run: go('/wantlist') },
    { id: 'nav-clerk', group: goTo, label: m.nav.dealers.label, run: go('/dealers') },
    { id: 'nav-basket', group: goTo, label: m.nav.basket.label, run: go('/basket') },
    { id: 'nav-store', group: goTo, label: m.palette.inStore, run: go('/in-store') },
    { id: 'nav-settings', group: goTo, label: m.nav.settings, run: go('/settings') },
    { id: 'nav-home', group: goTo, label: m.nav.start.label, run: go('/') },

    ...dealers.value.map((dealer) => ({
      id: `dealer-${dealer.username}`,
      group: m.palette.dealers,
      label: dealer.displayName || dealer.username,
      hint: dealer.affinity ? m.palette.affinity(decimal(dealer.affinity)) : undefined,
      run: go('/dealers'),
    })),

    ...digs.value.map((dig) => ({
      id: `dig-${dig.id}`,
      group: m.palette.digs,
      label: dig.dealer,
      hint: m.palette.digHint(dig.matchCount, shortDay(dig.startedAt)),
      // Every dig entry used to land on the newest one. Five are kept; four
      // were unreachable.
      run: go('/dig', { id: dig.id }),
    })),

    // Matches jump into the dig with the text filter already set, which is the
    // one action that works today for every record in the list.
    ...matches.value.map((match) => ({
      id: `match-${match.listingId}`,
      group: m.palette.lastDig,
      label: `${match.artist ?? '—'} – ${match.title ?? '—'}`,
      hint: `${match.score}`,
      run: go('/dig', { q: `${match.artist ?? ''} ${match.title ?? ''}`.trim() }),
    })),
  ]
})

const results = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const words = needle.split(/\s+/).filter(Boolean)

  const hits =
    words.length === 0
      ? entries.value
      : entries.value.filter((entry) => {
          const haystack = `${entry.group} ${entry.label} ${entry.hint ?? ''}`.toLowerCase()
          return words.every((word) => haystack.includes(word))
        })

  // Capped, because "im letzten Dig" can be several hundred rows and a palette
  // that scrolls forever is a list, not a palette.
  return hits.slice(0, 40)
})

// Any keystroke moves the selection back to the top result; leaving the cursor
// where it was would arm the wrong entry for the next Enter.
watch(query, () => (cursor.value = 0))
watch(results, () => {
  if (cursor.value >= results.value.length) cursor.value = Math.max(0, results.value.length - 1)
})

/** Group headings, computed from the flat list so the order stays one thing. */
const grouped = computed(() => {
  const groups: { name: string; entries: { entry: Entry; index: number }[] }[] = []
  results.value.forEach((entry, index) => {
    const last = groups.at(-1)
    if (last?.name === entry.group) last.entries.push({ entry, index })
    else groups.push({ name: entry.group, entries: [{ entry, index }] })
  })
  return groups
})

function move(delta: number) {
  const count = results.value.length
  if (count === 0) return
  // Wraps, so holding ↓ at the bottom returns to the top instead of stalling.
  cursor.value = (cursor.value + delta + count) % count
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    results.value[cursor.value]?.run()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}
</script>

<template>
  <!--
    A plain overlay rather than <dialog>: this needs no top-layer stacking and
    no browser-styled backdrop, and focus is already trapped by the single
    input that owns every key.
  -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
    @click.self="emit('close')"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Befehle und Suche"
      class="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-fid-md border border-fid-border bg-fid-surface shadow-2xl"
    >
      <div class="flex items-center gap-3 border-b border-fid-border px-4">
        <FidIcon name="search" class="text-fid-text-muted" />
        <input
          ref="input"
          v-model="query"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="messages.palette.placeholder"
          aria-label="Suchen"
          class="grow bg-transparent py-3 text-fid-base text-fid-text outline-none"
          @keydown="onKeydown"
        />
      </div>

      <p v-if="results.length === 0" class="px-4 py-6 text-fid-sm text-fid-text-muted">
        {{ messages.palette.nothing }}
      </p>

      <div v-else class="overflow-y-auto py-2" style="scrollbar-gutter: stable">
        <div v-for="group in grouped" :key="group.name">
          <p class="px-4 py-1 text-fid-xs uppercase tracking-[0.2em] text-fid-text-muted">
            {{ group.name }}
          </p>
          <ul>
            <li v-for="{ entry, index } in group.entries" :key="entry.id">
              <button
                type="button"
                class="flex w-full items-baseline gap-3 px-4 py-2 text-left transition-colors"
                :class="index === cursor ? 'bg-fid-accent/15' : 'hover:bg-fid-inset/50'"
                @click="entry.run()"
                @mouseenter="cursor = index"
              >
                <span class="min-w-0 grow truncate text-fid-sm text-fid-text">
                  {{ entry.label }}
                </span>
                <span
                  v-if="entry.hint"
                  class="fid-num shrink-0 text-fid-xs text-fid-text-muted"
                >
                  {{ entry.hint }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
