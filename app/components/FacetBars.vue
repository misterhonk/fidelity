<script setup lang="ts">
import type { TasteFacet } from '#shared/types'

const props = defineProps<{
  title: string
  facets: TasteFacet[]
  /** Token name for the bar, e.g. 'label' → --fid-sig-label. */
  signal: string
  empty?: string
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
      {{ empty ?? 'Noch nichts da.' }}
    </p>

    <!-- A description list, not a table: this is name → count, and a screen
         reader should read it as such. -->
    <dl v-else class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
      <template v-for="facet in facets" :key="facet.name">
        <dt class="min-w-0">
          <span class="block truncate text-fid-sm text-fid-text">{{ facet.name }}</span>
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
