<script setup lang="ts">
import { ORIGIN_FILTERS } from '#shared/countries'

import type { ShopListState, ShopSort } from '~/composables/useShopList'
import { useDealerMessages } from '~/i18n/dealers'

/**
 * The list column (M34.4): where from, the name, the order, the rows.
 *
 * Ranked by hit rate, as a list rather than a wall of buttons: forty shops in
 * a wrapping grid is a keypad, and it hides the very ordering that makes the
 * screen worth opening. The state lives in `useShopList`, so the page can
 * walk the same order with j and k.
 */
const h = useDealerMessages()

defineProps<{
  list: ShopListState
  home: string
  selected: string | null
  /** New listings per shop since the watcher last looked, for the "+n". */
  moved: Map<string, number>
}>()

/* The state is the page's; the list asks for changes rather than making them. */
defineEmits<{ open: [username: string]; query: [text: string]; sort: [key: ShopSort] }>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4">
    <!--
      Where from, with the count each chip would keep. A filter that says what
      it leaves is a filter nobody has to try.
    -->
    <div role="group" :aria-label="h.origin.label" class="flex flex-wrap gap-1">
      <button
        v-for="key in ORIGIN_FILTERS"
        :key="key"
        type="button"
        class="fid-action min-h-11 rounded-fid-sm border px-3 text-fid-xs"
        :class="
          list.origin === key
            ? 'border-fid-text bg-fid-inset text-fid-text'
            : 'border-fid-border text-fid-text-muted hover:text-fid-text'
        "
        :aria-pressed="list.origin === key"
        @click="list.originBy(key)"
      >
        {{ key === 'home' ? h.origin.home(home) : h.origin[key] }}
        <span class="fid-num ml-1 text-fid-text-muted">{{ list.originCounts[key] }}</span>
      </button>
    </div>

    <p v-if="list.shown.length === 0" class="text-fid-sm text-fid-text-muted">
      {{ h.origin.none }}
    </p>

    <input
      v-if="list.shown.length > 8"
      :value="list.query"
      type="search"
      autocomplete="off"
      spellcheck="false"
      :placeholder="h.find"
      :aria-label="h.find"
      class="fid-field w-full px-3 py-2 text-fid-sm text-fid-text"
      @input="$emit('query', ($event.target as HTMLInputElement).value)"
    />

    <p v-if="list.matching.length === 0" class="text-fid-sm text-fid-text-muted">
      {{ h.noMatch }}
    </p>

    <!--
      Four orderings as plate words. The default is the only one that answers
      the screen's own question; the other three are for tidying up and
      comparing (M31.10).
    -->
    <PlateTabs
      v-else
      :label="h.sort.label"
      :options="list.sortOptions"
      :value="list.sort"
      @select="$emit('sort', $event as ShopSort)"
    />

    <!--
      One list, with the group names as items of it. Two lists would each need
      their own name and the screen would lose the one region that means "the
      shops" — which is what every screen reader reaches for.
    -->
    <ul
      class="flex flex-col divide-y divide-fid-border border-y border-fid-border"
      :aria-label="h.scanned"
    >
      <template v-for="group in list.groups" :key="group.key ?? 'all'">
        <li v-if="group.key" class="fid-plate px-3 py-2 text-fid-text-muted">
          {{ h.groups[group.key] }}
        </li>
        <li v-for="dealer in group.rows" :key="dealer.username">
          <DealerRow
            :dealer="dealer"
            :selected="dealer.username === selected"
            :peak="list.peak"
            :moved="moved.get(dealer.username) ?? 0"
            @open="$emit('open', dealer.username)"
          />
        </li>
      </template>
    </ul>

    <button
      v-if="list.rest > 0"
      type="button"
      class="fid-action self-start text-fid-sm text-fid-text-muted underline underline-offset-4 hover:text-fid-text"
      @click="list.more()"
    >
      {{ h.more(count(list.rest)) }}
    </button>
  </div>
</template>
