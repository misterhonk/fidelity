<script setup lang="ts">
import type { TasteFacet } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

const h = useDealerMessages()
const props = defineProps<{
  title: string
  facets: TasteFacet[]
  /** Token name for the bar, e.g. 'label' → --fid-sig-label. */
  signal: string
  empty?: string
  /**
   * What a click on a row does — if anything at all.
   *
   * Without it they stay bars to look at, and that is exactly what they were
   * on the shop page: "fatplastics carries 13 Kompakt records", and none of
   * them reachable. On the map, where the same component shows your own
   * collection, there is nothing to open — hence optional and not required.
   */
  open?: (facet: TasteFacet) => void
}>()

/**
 * Bars are scaled against the strongest entry, not against the collection.
 * With eighteen records everything would otherwise be a sliver, and the shape
 * of the distribution is the point.
 */
const peak = computed(() => Math.max(1, ...props.facets.map((facet) => facet.n)))
</script>

<template>
  <section class="flex flex-col gap-3" :aria-labelledby="`facet-${signal}`">
    <h3 :id="`facet-${signal}`" class="text-fid-sm font-medium text-fid-text">{{ title }}</h3>

    <p v-if="facets.length === 0" class="text-fid-sm text-fid-text-muted">
      {{ empty ?? h.nothingYet }}
    </p>

    <!-- A description list, not a table: this is name → count, and a screen
         reader should read it as such. -->
    <dl v-else class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
      <template v-for="facet in facets" :key="facet.name">
        <dt class="min-w-0">
          <!--
            A button only where it does something. An element that looks like a
            button and can do nothing is worse than a label — and a screen
            reader otherwise reads "button" twenty times over.
          -->
          <component
            :is="open ? 'button' : 'span'"
            :type="open ? 'button' : undefined"
            class="block w-full min-w-0 truncate text-left text-fid-sm text-fid-text"
            :class="open ? 'fid-action underline-offset-4 hover:underline' : ''"
            :aria-label="open ? h.stock.show(facet.name, facet.n) : undefined"
            @click="open?.(facet)"
            >{{ facet.name }}</component
          >
          <span
            class="mt-1 block h-1.5 rounded-full"
            :style="{
              width: `${Math.max(2, (facet.n / peak) * 100)}%`,
              backgroundColor: `var(--fid-sig-${signal})`,
            }"
          />
        </dt>
        <dd class="fid-num self-start text-fid-sm text-fid-text-muted">{{ facet.n }}</dd>
      </template>
    </dl>
  </section>
</template>
