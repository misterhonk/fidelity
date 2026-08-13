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
   * Was ein Klick auf eine Zeile tut — falls überhaupt etwas.
   *
   * Ohne das bleiben es Balken zum Ansehen, und genau das waren sie auf der
   * Ladenseite: „fatplastics führt 13 Kompakt-Platten", und keine davon war
   * erreichbar. Auf der Landkarte, wo dieselbe Komponente die eigene Sammlung
   * zeigt, gibt es nichts aufzuklappen — deshalb optional und nicht Pflicht.
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
            Ein Knopf nur da, wo er etwas tut. Ein Element, das wie ein Knopf
            aussieht und nichts kann, ist schlimmer als eine Beschriftung —
            und ein Bildschirmleser liest sonst zwanzig Mal „Schaltfläche".
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
