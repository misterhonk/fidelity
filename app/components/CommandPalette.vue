<script setup lang="ts">
import type { Dealer, Dig, RecordHit, RecordSearch } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'
import { useSettingsMessages } from '~/i18n/settings'

const messages = useMessages()
const collection = useCollectionMessages()
const settings = useSettingsMessages()
const emit = defineEmits<{ close: [] }>()

/**
 * ⌘K. Searches **data**, not only navigation (docs/05 §3): records on the
 * shelf, the wantlist and in the last dig, the shops and digs, and actions.
 *
 * The records are searched in the worker (`records.search`, #215) — the main
 * thread does not compute, and a collection is thousands of rows. Shops, digs
 * and the fixed entries are a few dozen labels, loaded once and filtered here.
 */

const { call } = useFidelityWorker()
const router = useRouter()
const addMode = useAddMode()

const query = ref('')
const input = useTemplateRef<HTMLInputElement>('input')
const cursor = ref(0)

const dealers = shallowRef<Dealer[]>([])
const digs = shallowRef<Dig[]>([])
const noRecords: RecordSearch = { shelf: [], wantlist: [], dig: [] }
const records = shallowRef<RecordSearch>(noRecords)
/** A query whose records are not back yet: "nothing found" would be a guess. */
const searching = ref(false)

// Focus goes back where it came from: the start page's field, or the page.
const opener = import.meta.client ? (document.activeElement as HTMLElement | null) : null

onMounted(async () => {
  input.value?.focus()
  dealers.value = await call('dealer.list', undefined)
  digs.value = await call('dig.list', undefined)
})

onBeforeUnmount(() => {
  if (opener?.isConnected) opener.focus()
})

/** Numbered so a slower answer to an older query cannot overwrite a newer one. */
let asked = 0
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(timer)
  // An older query's records would stay listed, and armed for Enter, until the
  // worker answers this one.
  records.value = noRecords
  searching.value = true
  const ticket = ++asked
  timer = setTimeout(async () => {
    // A failed search lists no records rather than an unhandled rejection.
    const found = await call('records.search', { query: value }).catch(() => noRecords)
    if (ticket !== asked) return
    records.value = found
    searching.value = false
  }, 120)
})
onBeforeUnmount(() => clearTimeout(timer))

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

/** Found by the worker already; listed as they came, never filtered again. */
const recordEntries = computed<Entry[]>(() => {
  const m = messages.value
  const r = records.value
  const label = (hit: RecordHit) => `${hit.artist || '—'} – ${hit.title || '—'}`
  const hint = (hit: RecordHit) => [hit.label, hit.catno].filter(Boolean).join(' · ')

  return [
    ...r.shelf.map((hit) => ({
      id: `shelf-${hit.releaseId}`,
      group: m.palette.shelf,
      label: label(hit),
      hint: hint(hit),
      run: go('/collection', { q: hit.title }),
    })),
    ...r.wantlist.map((hit) => ({
      id: `want-${hit.releaseId}`,
      group: m.palette.wantlist,
      label: label(hit),
      hint: hint(hit),
      run: go('/wantlist', { q: hit.title }),
    })),
    // A find opens its sheet over its dig; app.vue reads `?find=`.
    ...r.dig.map((hit) => ({
      id: `match-${hit.listingId}`,
      group: m.palette.lastDig,
      label: label(hit),
      hint: hint(hit),
      run: go('/shop', { id: hit.digId ?? '', find: `${hit.digId}~${hit.listingId}` }),
    })),
  ]
})

const entries = computed<Entry[]>(() => {
  const m = messages.value
  const c = collection.value
  const s = settings.value
  const goTo = m.palette.goTo
  const actions = m.palette.actions

  // `sync`, `data` and `hub` are sections now (#229); their old addresses
  // redirect to them, and their names are what somebody types.
  const settingsPages = [
    ['account', s.account.title],
    ['look', s.appearance.title],
    ['collection', s.library.title],
    ['finds', s.search.title],
    ['sync', s.sync.title],
    ['data', s.data.title],
    ['hub', s.hub.title],
    ['advanced', s.advanced.title],
    ['help', s.help.title],
  ] as const

  return [
    ...dealers.value.map((dealer) => ({
      id: `dealer-${dealer.username}`,
      group: m.palette.dealers,
      label: dealer.displayName || dealer.username,
      hint: dealer.affinity ? m.palette.affinity(decimal(dealer.affinity)) : undefined,
      run: go('/shops', { shop: dealer.username }),
    })),

    ...digs.value.map((dig) => ({
      id: `dig-${dig.id}`,
      group: m.palette.digs,
      label: dig.dealer,
      hint: m.palette.digHint(dig.matchCount, shortDay(dig.startedAt)),
      // Every dig entry used to land on the newest one. Five are kept; four
      // were unreachable.
      run: go('/shop', { id: dig.id }),
    })),

    { id: 'nav-dig', group: goTo, label: m.nav.dig.label, run: go('/shop') },
    { id: 'nav-shelf', group: goTo, label: c.tabs.shelf, run: go('/collection') },
    { id: 'nav-map', group: goTo, label: c.tabs.map, run: go('/insights') },
    { id: 'nav-want', group: goTo, label: c.tabs.wantlist, run: go('/wantlist') },
    { id: 'nav-clerk', group: goTo, label: m.nav.dealers.label, run: go('/shops') },
    { id: 'nav-store', group: goTo, label: m.palette.inStore, run: go('/in-store') },
    { id: 'nav-home', group: goTo, label: m.nav.start.label, run: go('/') },

    { id: 'act-scan', group: actions, label: m.palette.scan, run: go('/in-store') },
    {
      id: 'act-add',
      group: actions,
      label: c.add.open,
      run: () => {
        emit('close')
        addMode.open()
      },
    },
    { id: 'act-basket', group: actions, label: m.nav.basket.label, run: go('/basket') },
    // Filled in and checked on the dig page, never started: a scan spends
    // somebody's rate limit, and that takes a second, deliberate press.
    ...dealers.value.map((dealer) => ({
      id: `act-dig-${dealer.username}`,
      group: actions,
      label: m.palette.digAt(dealer.displayName || dealer.username),
      run: go('/shop', { dealer: dealer.username }),
    })),
    ...settingsPages.map(([path, title]) => ({
      id: `act-settings-${path}`,
      group: actions,
      label: m.palette.settings(title),
      run: go(`/settings/${path}`),
    })),
  ]
})

/*
 * A shop's address offers that shop on top (#217, #314): the nav's Search has one
 * field, and on an iPhone a copied address is the way a shop gets in. Enter or
 * a tap opens it on the shop page — checked, never started. Offered, not
 * followed: an address typed by hand passes through shorter, wrong usernames.
 * Only an address — a bare word is a search, not a guess at a username.
 */
const shopEntry = computed<Entry[]>(() => {
  const shop = /discogs\.com\//i.test(query.value) ? dealerFromInput(query.value) : null
  if (!shop) return []
  const m = messages.value
  return [
    {
      id: 'paste-shop',
      group: m.palette.actions,
      label: m.palette.digAt(shop),
      run: go('/shop', { dealer: shop }),
    },
  ]
})

const results = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const hits =
    words.length === 0
      ? entries.value
      : entries.value.filter((entry) => {
          const haystack = `${entry.group} ${entry.label} ${entry.hint ?? ''}`.toLowerCase()
          return words.every((word) => haystack.includes(word))
        })

  // Records first: a typed name is most often a record. Capped, because a
  // palette that scrolls forever is a list, not a palette.
  return [...shopEntry.value, ...recordEntries.value, ...hits].slice(0, 40)
})

// Any keystroke moves the selection back to the top result; leaving the cursor
// where it was would arm the wrong entry for the next Enter.
watch(query, () => (cursor.value = 0))
// Records arrive late and go on top: an index kept from before points elsewhere.
watch(records, () => (cursor.value = 0))
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

const optionId = (index: number) => `palette-option-${index}`
const active = computed(() => (results.value.length ? optionId(cursor.value) : undefined))

// The active option stays in sight while ↓ walks past the bottom edge.
watch(cursor, async () => {
  await nextTick()
  if (active.value) document.getElementById(active.value)?.scrollIntoView({ block: 'nearest' })
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
  } else if (event.key === 'Tab') {
    // The focus trap: the field is the one stop, the list is walked with arrows.
    event.preventDefault()
  }
}
</script>

<template>
  <!--
    A plain overlay rather than <dialog>: this needs no top-layer stacking and
    no browser-styled backdrop. Focus stays in the one field: options are not
    focusable, Tab is held, and aria-activedescendant names the active option.
  -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
    @click.self="emit('close')"
  >
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="messages.palette.label"
      class="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-fid-md border border-fid-border bg-fid-surface shadow-2xl"
    >
      <div class="flex items-center gap-3 border-b border-fid-border px-4">
        <FidIcon name="search" class="text-fid-text-muted" aria-hidden="true" />
        <input
          ref="input"
          v-model="query"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="palette-list"
          :aria-expanded="results.length > 0"
          :aria-activedescendant="active"
          autocomplete="off"
          spellcheck="false"
          :placeholder="messages.palette.placeholder"
          :aria-label="messages.palette.search"
          class="grow bg-transparent py-3 text-fid-base text-fid-text outline-none"
          @keydown="onKeydown"
        />
      </div>

      <p
        v-if="results.length === 0 && !searching"
        class="px-4 py-6 text-fid-sm text-fid-text-muted"
      >
        {{ messages.palette.nothing }}
      </p>

      <!-- mousedown is held so a click never takes the focus out of the field. -->
      <div
        v-show="results.length > 0"
        id="palette-list"
        role="listbox"
        :aria-label="messages.palette.results"
        class="overflow-y-auto py-2"
        style="scrollbar-gutter: stable"
        @mousedown.prevent
      >
        <div
          v-for="(group, g) in grouped"
          :key="group.name"
          role="group"
          :aria-labelledby="`palette-group-${g}`"
        >
          <p
            :id="`palette-group-${g}`"
            role="presentation"
            class="px-4 py-1 text-fid-xs uppercase tracking-[0.2em] text-fid-text-muted"
          >
            {{ group.name }}
          </p>
          <div
            v-for="{ entry, index } in group.entries"
            :id="optionId(index)"
            :key="entry.id"
            role="option"
            :aria-selected="index === cursor"
            class="flex w-full cursor-pointer items-baseline gap-3 px-4 py-2 text-left transition-colors"
            :class="index === cursor ? 'bg-fid-accent/15' : 'hover:bg-fid-inset/50'"
            @click="entry.run()"
            @mousemove="cursor = index"
          >
            <span class="min-w-0 grow truncate text-fid-sm text-fid-text">
              {{ entry.label }}
            </span>
            <span v-if="entry.hint" class="fid-num shrink-0 text-fid-xs text-fid-text-muted">
              {{ entry.hint }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
