<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'

import type { Match } from '#shared/types'
import type { Density } from '~/utils/digview'

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
 * Estimates, not measurements — the virtualiser measures each row once it is
 * mounted and corrects itself. These only have to be close enough that the
 * initial scrollbar is not absurd: 34 px is the compact row from docs/05 §3,
 * and a comfortable card runs about 200 with cover, chips and the sentence.
 */
const estimate = computed(() => (props.density === 'compact' ? 34 : 208))

const rows = useVirtualizer(
  computed(() => ({
    count: props.matches.length,
    getScrollElement: () => viewport.value ?? null,
    estimateSize: () => estimate.value,
    // Enough rows above and below that a fast flick does not show white.
    overscan: 8,
    gap: props.density === 'compact' ? 0 : 12,
    getItemKey: (index: number) => props.matches[index]?.listingId ?? index,
  })),
)

const items = computed(() => rows.value.getVirtualItems())
</script>

<template>
  <!--
    Whole list. Short digs are the common case and deserve the simpler DOM.
  -->
  <ul
    v-if="!virtual"
    class="flex flex-col"
    :class="density === 'compact' ? 'gap-0' : 'gap-3'"
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
    aria-label="Alle Treffer"
  >
    <ul class="relative w-full" :style="{ height: `${rows.getTotalSize()}px` }">
      <li
        v-for="item in items"
        :key="String(item.key)"
        :ref="(el) => rows.measureElement(el as Element)"
        :data-index="item.index"
        class="absolute top-0 left-0 w-full"
        :style="{ transform: `translateY(${item.start}px)` }"
      >
        <MatchRow v-if="density === 'compact'" :match="matches[item.index]!" />
        <MatchCard v-else :match="matches[item.index]!" />
      </li>
    </ul>
  </div>
</template>
