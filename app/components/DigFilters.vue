<script setup lang="ts">
import type { SignalType } from '#shared/types'
import { SORTS, type Density, type SortKey } from '~/utils/digview'

defineProps<{
  available: { type: SignalType; n: number }[]
  active: SignalType[]
  sort: SortKey
  density: Density
  query: string
  shown: number
  total: number
}>()

const emit = defineEmits<{
  toggleSignal: [SignalType]
  setSort: [SortKey]
  setDensity: [Density]
  setQuery: [string]
  clear: []
}>()

const DENSITIES = [
  { key: 'comfortable', label: 'Ausführlich' },
  { key: 'compact', label: 'Kompakt' },
] as const satisfies readonly { key: Density; label: string }[]
</script>

<template>
  <!--
    Sticky, so the chips stay reachable in a list of several hundred. That
    makes WCAG 2.4.11 this component's problem: anything scrolled to underneath
    it would be focused but hidden, which is why every row carries
    scroll-margin-top matching this bar.
  -->
  <div
    class="sticky top-0 z-10 -mx-6 flex flex-col gap-3 border-b border-fid-border bg-fid-bg/95 px-6 py-3 backdrop-blur"
  >
    <!--
      The text filter. Also where the command palette lands when you pick a
      record out of it — so a query arriving from ⌘K is visible and removable
      rather than an unexplained short list.
    -->
    <input
      :value="query"
      type="search"
      autocomplete="off"
      spellcheck="false"
      placeholder="Künstler, Titel, Label, Katalognummer …"
      aria-label="Treffer durchsuchen"
      class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
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
        Filter zurücksetzen
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex items-center gap-1" role="group" aria-label="Sortierung">
        <span class="text-fid-xs text-fid-text-muted">Sortieren</span>
        <button
          v-for="option in SORTS"
          :key="option.key"
          type="button"
          :aria-pressed="sort === option.key"
          class="min-h-6 rounded-fid-sm px-2 py-1 text-fid-xs transition-colors"
          :class="
            sort === option.key
              ? 'bg-fid-accent/15 text-fid-text'
              : 'text-fid-text-muted hover:text-fid-text'
          "
          @click="emit('setSort', option.key)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="flex items-center gap-1" role="group" aria-label="Dichte">
        <span class="text-fid-xs text-fid-text-muted">Dichte</span>
        <button
          v-for="option in DENSITIES"
          :key="option.key"
          type="button"
          :aria-pressed="density === option.key"
          class="min-h-6 rounded-fid-sm px-2 py-1 text-fid-xs transition-colors"
          :class="
            density === option.key
              ? 'bg-fid-accent/15 text-fid-text'
              : 'text-fid-text-muted hover:text-fid-text'
          "
          @click="emit('setDensity', option.key)"
        >
          {{ option.label }}
        </button>
      </div>

      <p class="ml-auto text-fid-xs text-fid-text-muted" aria-live="polite">
        <span class="fid-num">{{ shown }}</span>
        <template v-if="shown !== total">
          von <span class="fid-num">{{ total }}</span>
        </template>
        Treffer
      </p>
    </div>
  </div>
</template>
