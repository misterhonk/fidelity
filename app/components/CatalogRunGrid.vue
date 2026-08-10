<script setup lang="ts">
import type { CatalogueContext } from '#shared/types'

defineProps<{ run: CatalogueContext; heading?: string }>()
</script>

<template>
  <!--
    The catalogue series, as a grid.

    This is the one view where the horizon shows its work: Brain 1001, 1002,
    1004 and 1005 filled in, 1003 outlined, and the gap explains itself without
    a sentence. CSS Grid and <div>s — no chart library (docs/12 §2).
  -->
  <section class="flex flex-col gap-2" aria-labelledby="run-heading">
    <h3 id="run-heading" class="text-fid-sm font-medium text-fid-text">
      {{ heading ?? `${run.label} · ${run.prefix}` }}
    </h3>

    <ul class="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1">
      <li
        v-for="entry in run.neighbours"
        :key="entry.number"
        class="fid-num rounded-fid-sm border px-1 py-1 text-center text-fid-xs"
        :class="[
          entry.isThis
            ? 'border-fid-accent bg-fid-accent/20 text-fid-text'
            : entry.owned
              ? 'border-fid-border bg-fid-inset text-fid-text'
              : 'border-transparent text-fid-text-muted',
        ]"
        :aria-label="
          entry.isThis
            ? `${entry.number} – diese Platte`
            : entry.owned
              ? `${entry.number} – hast du`
              : `${entry.number} – fehlt dir`
        "
      >
        {{ entry.number }}
      </li>
    </ul>

    <p class="text-fid-xs text-fid-text-muted">
      Ausgefüllt = im Regal. Umrandet = diese Platte.
    </p>
  </section>
</template>
