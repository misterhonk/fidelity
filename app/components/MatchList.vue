<script setup lang="ts">
import { useWindowVirtualizer } from '@tanstack/vue-virtual'

import type { Match, SortDirection } from '#shared/types'
import type { Density, SortKey } from '~/utils/digview'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const props = defineProps<{
  matches: Match[]
  density: Density
  /** The ordering in force, so the compact head can show which column it is. */
  sort?: SortKey
  /** And which way round it runs, for the arrow on that column. */
  direction?: SortDirection
}>()
const emit = defineEmits<{ setSort: [SortKey] }>()

/**
 * The head of the table, in the density that is one (M31.25).
 *
 * The compact row has been a table since docs/05 §3 — cover, score, record,
 * price — and it had no column names, so the one persona who asked for it
 * ("a table instead of cards, columns to sort by") had a table whose columns
 * were unlabelled and unsortable from where they stand.
 *
 * The names do what the bar above the list does, because they select the same
 * orderings: this is a second way to reach them, at the place where somebody
 * is already looking, not a second mechanism. That includes turning one round
 * — clicking the column in force flips it, and the arrow says which way it
 * runs (M32.2).
 *
 * Buttons in a labelled group rather than `role="columnheader"`: the list
 * underneath is a virtualiser, so there is no table for the role to belong
 * to, and claiming one would promise a structure a screen reader would then
 * fail to walk.
 */
const HEAD = [
  { key: null, width: '1.75rem' },
  { key: 'score' as const, width: '2.25rem' },
  { key: 'artist' as const, width: '1fr' },
  { key: 'price' as const, width: 'auto' },
]

/**
 * Below this the list renders whole. Virtualising forty rows costs more in
 * measurement than it saves in nodes, and a plain list keeps ⌘F, printing and
 * the browser's own find-on-page working — which is worth more at that size
 * than anything windowing buys.
 */
const VIRTUALIZE_FROM = 200

const virtual = computed(() => props.matches.length >= VIRTUALIZE_FROM)

const viewport = useTemplateRef<HTMLElement>('viewport')

/**
 * How many cards fit beside each other.
 *
 * The virtualiser windows *rows*, so a multi-column list is a list of rows
 * holding several matches each — that is the only shape it can measure, and
 * it is why this number has to exist rather than being left to CSS.
 *
 * Compact stays one across on purpose. That mode is a table: one line per
 * record, and the whole point is running your eye down the score column.
 * Two of those side by side is two tables, which is harder to read than one.
 */
const MIN_CARD = 384

/**
 * And how wide a spine is in the crate (M31.22).
 *
 * 150 px is the thumbnail Discogs hands over, so a tile never upscales; on a
 * 390 px phone that leaves two across with room for the title under them,
 * which is the number the shelf settled on for the same reason.
 */
const MIN_TILE = 160

const width = ref(0)
const perRow = computed(() => {
  if (props.density === 'compact') return 1
  if (props.density === 'crate') return Math.max(2, Math.floor(width.value / MIN_TILE))
  return Math.max(1, Math.floor(width.value / MIN_CARD))
})

/**
 * Measured rather than guessed from the viewport: this list sits inside a page
 * whose width is a container query away from anything the window knows.
 */
/**
 * Where the list starts on the page. The page scrolls, not the list (since
 * 2026-09-13): a list scrolling inside a 70vh box left the footer standing
 * under it on every screen, taking a fifth of the window for a licence line.
 * The virtualiser works off the window and subtracts this margin; it is
 * measured again whenever the list's width changes, which is when the
 * things above it may have moved.
 */
const listTop = ref(0)
function measureTop() {
  const el = viewport.value
  listTop.value = el ? el.getBoundingClientRect().top + window.scrollY : 0
}

let observer: ResizeObserver | undefined
onMounted(() => {
  const el = viewport.value
  width.value = el?.clientWidth ?? 0
  measureTop()
  if (!el || typeof ResizeObserver === 'undefined') return

  observer = new ResizeObserver(([entry]) => {
    width.value = entry?.contentRect.width ?? 0
    measureTop()
  })
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())

const rowCount = computed(() => Math.ceil(props.matches.length / perRow.value))

/**
 * Estimates, not measurements — the virtualiser measures each row once it is
 * mounted and corrects itself. These only have to be close enough that the
 * initial scrollbar is not absurd: 34 px is the compact row from docs/05 §3,
 * and a comfortable card runs about 200 with cover, chips and the sentence.
 */
const estimate = computed(() =>
  props.density === 'compact' ? 34 : props.density === 'crate' ? 240 : 208,
)

const rows = useWindowVirtualizer(
  computed(() => ({
    count: rowCount.value,
    scrollMargin: listTop.value,
    estimateSize: () => estimate.value,
    // Enough rows above and below that a fast flick does not show white.
    overscan: 8,
    gap: props.density === 'compact' ? 0 : 12,
    // Keyed by the first match in the row, so re-flowing on a resize does not
    // recycle a node into a row it has nothing to do with.
    getItemKey: (index: number) =>
      props.matches[index * perRow.value]?.listingId ?? `row-${index}`,
  })),
)

const items = computed(() => rows.value.getVirtualItems())

/** The matches belonging to one virtual row. */
function rowMatches(index: number): Match[] {
  const from = index * perRow.value
  return props.matches.slice(from, from + perRow.value)
}

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${perRow.value}, minmax(0, 1fr))`,
  gap: props.density === 'compact' ? '0' : '0.75rem',
}))
</script>

<template>
  <!--
    The column names, in the density that is a table (M31.25). Aligned to the
    same grid the rows use, and sticky under the filter bar so they are still
    there three hundred rows in — which is the whole reason somebody picked
    this density.
  -->
  <div
    v-if="density === 'compact' && matches.length > 0"
    role="group"
    :aria-label="d.filters.columns"
    class="sticky top-0 z-10 grid grid-cols-[1.75rem_2.25rem_1fr_auto] items-center gap-x-2 border-b border-fid-border bg-fid-bg px-2 pb-1"
  >
    <template v-for="column in HEAD" :key="column.key ?? 'cover'">
      <span v-if="!column.key" />
      <button
        v-else
        type="button"
        :aria-pressed="sort === column.key"
        :title="d.filters.sorts[column.key].about"
        class="fid-action truncate text-left text-fid-xs transition-colors"
        :class="
          sort === column.key
            ? 'font-medium text-fid-text'
            : 'text-fid-text-muted hover:text-fid-text'
        "
        @click="emit('setSort', column.key)"
      >
        {{ d.filters.sorts[column.key].label
        }}<span
          v-if="sort === column.key"
          aria-hidden="true"
          class="ml-1 text-fid-text-muted"
          >{{ direction === 'asc' ? '↑' : '↓' }}</span
        >
      </button>
    </template>
  </div>

  <!--
    Whole list. Short digs are the common case and deserve the simpler DOM.
  -->
  <ul
    v-if="!virtual"
    :class="
      density === 'compact'
        ? 'flex flex-col gap-0'
        : density === 'crate'
          ? 'grid grid-cols-2 gap-x-3 gap-y-5 @lg:grid-cols-3 @3xl:grid-cols-4 @6xl:grid-cols-6'
          : 'grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3'
    "
    style="scrollbar-gutter: stable"
  >
    <!--
      Far-rendering only for the cards and the crate. A 34 px row is cheap,
      and on iOS Safari `content-visibility: auto` left the compact list
      blank until the first scroll (reported 2026-09-21).
    -->
    <li
      v-for="match in matches"
      :key="match.listingId"
      :class="density === 'compact' ? '' : 'fid-far'"
      :style="{ '--fid-far-height': density === 'compact' ? '2.125rem' : '13rem' }"
    >
      <MatchRow v-if="density === 'compact'" :match="match" />
      <MatchTile v-else-if="density === 'crate'" :match="match" />
      <MatchCard v-else :match="match" />
    </li>
  </ul>

  <!--
    Windowed. A collection scan can produce several hundred matches and the
    comfortable card is not a cheap node — cover, chips, four buttons.

    The page scrolls, the list does not: rows are placed from the list's own
    top (`item.start` minus the scroll margin), and the sticky filter bar
    above keeps clear of the nav with its own offset.
  -->
  <div v-else ref="viewport" role="region" :aria-label="d.match.allFinds">
    <ul class="relative w-full" :style="{ height: `${rows.getTotalSize()}px` }">
      <li
        v-for="item in items"
        :key="String(item.key)"
        :ref="(el) => rows.measureElement(el as Element)"
        :data-index="item.index"
        class="absolute top-0 left-0 w-full"
        :style="{
          transform: `translateY(${item.start - rows.options.scrollMargin}px)`,
          ...gridStyle,
        }"
      >
        <template v-for="match in rowMatches(item.index)" :key="match.listingId">
          <MatchRow v-if="density === 'compact'" :match="match" />
          <MatchTile v-else-if="density === 'crate'" :match="match" />
          <MatchCard v-else :match="match" />
        </template>
      </li>
    </ul>
  </div>
</template>
