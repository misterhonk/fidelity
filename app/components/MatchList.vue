<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'

import type { Match } from '#shared/types'
import type { Density } from '~/utils/digview'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const props = defineProps<{ matches: Match[]; density: Density }>()

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

const width = ref(0)
const perRow = computed(() =>
  props.density === 'compact' ? 1 : Math.max(1, Math.floor(width.value / MIN_CARD)),
)

/**
 * Measured rather than guessed from the viewport: this list sits inside a page
 * whose width is a container query away from anything the window knows.
 */
let observer: ResizeObserver | undefined
onMounted(() => {
  const el = viewport.value
  width.value = el?.clientWidth ?? 0
  if (!el || typeof ResizeObserver === 'undefined') return

  observer = new ResizeObserver(([entry]) => {
    width.value = entry?.contentRect.width ?? 0
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
const estimate = computed(() => (props.density === 'compact' ? 34 : 208))

const rows = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => viewport.value ?? null,
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
    Whole list. Short digs are the common case and deserve the simpler DOM.
  -->
  <ul
    v-if="!virtual"
    :class="
      density === 'compact'
        ? 'flex flex-col gap-0'
        : 'grid gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3'
    "
    style="scrollbar-gutter: stable"
  >
    <li v-for="match in matches" :key="match.listingId">
      <MatchRow v-if="density === 'compact'" :match="match" />
      <MatchCard v-else :match="match" />
    </li>
  </ul>

  <!--
    Windowed. A collection scan can produce several hundred matches and the
    comfortable card is not a cheap node — cover, chips, four buttons.

    The viewport scrolls itself rather than the page, because a virtualiser
    driven by window scroll fights the sticky filter bar above it.
  -->
  <div
    v-else
    ref="viewport"
    class="max-h-[70vh] overflow-y-auto"
    style="scrollbar-gutter: stable"
    tabindex="0"
    role="region"
    :aria-label="d.match.allFinds"
  >
    <ul class="relative w-full" :style="{ height: `${rows.getTotalSize()}px` }">
      <li
        v-for="item in items"
        :key="String(item.key)"
        :ref="(el) => rows.measureElement(el as Element)"
        :data-index="item.index"
        class="absolute top-0 left-0 w-full"
        :style="{ transform: `translateY(${item.start}px)`, ...gridStyle }"
      >
        <template v-for="match in rowMatches(item.index)" :key="match.listingId">
          <MatchRow v-if="density === 'compact'" :match="match" />
          <MatchCard v-else :match="match" />
        </template>
      </li>
    </ul>
  </div>
</template>
