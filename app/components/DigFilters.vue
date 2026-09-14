<script setup lang="ts">
import type { SignalType, SortDirection } from '#shared/types'
import { SORTS, type Density, type SortKey } from '~/utils/digview'
import { useDigMessages } from '~/i18n/dig'

const props = defineProps<{
  available: { type: SignalType; n: number }[]
  active: SignalType[]
  sort: SortKey
  /** Which way round the ordering runs — the arrow sits on the key in force. */
  direction: SortDirection
  density: Density
  query: string
  shown: number
  total: number
  /** Whether this shop's postage is known — without it there is no "with postage". */
  landedKnown: boolean
  /** The ceiling somebody typed, postage included, or null. */
  upTo: number | null
}>()

const emit = defineEmits<{
  toggleSignal: [SignalType]
  setSort: [SortKey]
  setDensity: [Density]
  setQuery: [string]
  setUpTo: [string]
  clear: []
}>()

const f = computed(() => useDigMessages().value.filters)

const DENSITIES = ['comfortable', 'crate', 'compact'] as const satisfies readonly Density[]

/*
 * The two rows of choices, in the shape the shelf uses (M32.2).
 *
 * Built here rather than in the markup because one of them is conditional:
 * "with postage" only exists where this shop's postage is known.
 */
const sortTabs = computed(() =>
  SORTS.filter((key) => key !== 'landed' || props.landedKnown).map((key) => ({
    key,
    label: f.value.sorts[key].label,
    about: f.value.sorts[key].about,
    // The arrow comes from the state now, not from the label: the same key
    // runs both ways since M32.2.
    suffix: props.direction === 'asc' ? '↑' : '↓',
    spoken: (props.direction === 'asc' ? f.value.sortedAsc : f.value.sortedDesc)(
      f.value.sorts[key].label,
    ),
  })),
)

const densityTabs = computed(() => DENSITIES.map((key) => ({ key, label: f.value[key] })))
</script>

<template>
  <!--
    Sticky, so the chips stay reachable in a list of several hundred. That
    makes WCAG 2.4.11 this component's problem: anything scrolled to underneath
    it would be focused but hidden, which is why every row carries
    scroll-margin-top matching this bar.
  -->
  <div
    class="sticky top-0 z-10 -mx-6 flex flex-col gap-3 border-b border-fid-border bg-fid-bg/95 px-6 py-3 backdrop-blur md:top-[45px]"
  >
    <!--
      The text filter. Also where the command palette lands when you pick a
      record out of it — so a query arriving from ⌘K is visible and removable
      rather than an unexplained short list.
    -->
    <input
      id="dig-search"
      :value="query"
      type="search"
      autocomplete="off"
      spellcheck="false"
      :placeholder="f.searchPlaceholder"
      :aria-label="f.search"
      class="fid-field px-3 py-2 text-fid-sm text-fid-text"
      @input="emit('setQuery', ($event.target as HTMLInputElement).value)"
    />

    <div v-if="available.length > 0" class="flex flex-wrap items-center gap-2">
      <!--
        24x24 minimum target size (WCAG 2.5.8) — the reason these are py-2
        and not the tighter thing they want to be.
      -->
      <button
        v-for="signal in available"
        :key="signal.type"
        type="button"
        :aria-pressed="active.includes(signal.type)"
        class="min-h-6 rounded-fid-sm border px-2 py-1 text-fid-xs text-fid-text transition-opacity"
        :class="
          active.length > 0 && !active.includes(signal.type) ? 'opacity-40' : 'opacity-100'
        "
        :style="signalChipStyle(signal.type)"
        @click="emit('toggleSignal', signal.type)"
      >
        {{ signalLabel(signal.type) }}
        <span class="fid-num ml-1 text-fid-text-muted">{{ signal.n }}</span>
      </button>

      <button
        v-if="active.length > 0 || query"
        type="button"
        class="min-h-6 rounded-fid-sm px-2 py-1 text-fid-xs text-fid-text-muted underline underline-offset-4"
        @click="emit('clear')"
      >
        {{ f.clear }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <!--
        The same row the shelf has (M32.2). "With postage" is offered only
        where the shop's postage is known: a sort key that puts every record
        last is not a sort, and the line below the bar says why it is missing.
      -->
      <PlateTabs
        as="nav"
        :label="f.sorting"
        :options="sortTabs"
        :value="sort"
        @select="emit('setSort', $event as SortKey)"
      />

      <PlateTabs
        :label="f.density"
        :options="densityTabs"
        :value="density"
        @select="emit('setDensity', $event as Density)"
      />

      <!--
        A ceiling with postage, in the shop's currency. A `change` rather than
        an `input` listener: the list re-sorts on every keystroke otherwise,
        and "3" is not a budget on the way to "30".
      -->
      <label v-if="landedKnown" class="flex items-center gap-1 text-fid-xs text-fid-text-muted">
        <span>{{ f.upTo }}</span>
        <input
          type="number"
          inputmode="decimal"
          min="0"
          step="1"
          :value="upTo ?? ''"
          :aria-label="f.upToLabel"
          :title="f.upToLabel"
          class="fid-num w-20 fid-field px-2 py-1 text-fid-xs text-fid-text"
          @change="emit('setUpTo', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <p class="fid-num ml-auto text-fid-xs text-fid-text-muted" aria-live="polite">
        {{ f.shown(count(shown), shown === total ? null : count(total)) }}
      </p>
    </div>

    <p v-if="!landedKnown" class="text-fid-xs text-fid-text-muted">
      {{ f.noPostage }}
    </p>
  </div>
</template>
