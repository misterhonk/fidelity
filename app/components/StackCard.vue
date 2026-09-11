<script setup lang="ts">
import type { Match } from '#shared/types'

import { reasonFor } from '~/i18n/reason'
import { useDigMessages } from '~/i18n/dig'

/**
 * Eine Platte, ganzflächig, mit dem Satz dazu, warum sie passt.
 *
 * **Der Begründungssatz ist nicht schmückendes Beiwerk, er ist der
 * Unterschied.** Ohne ihn ist der Stapel ein Spielautomat mit Plattenhüllen;
 * mit ihm ist er das, was diese App ohnehin verspricht, nur schneller zu
 * lesen (`docs/06` M15).
 */
const props = defineProps<{
  match: Match
  /** Grau, sobald `dig.expiresAt` überschritten ist — Preise verschwinden dann. */
  expired: boolean
}>()

const d = useDigMessages()
const { coverFor } = useCovers()
const cover = computed(() => coverFor(props.match.releaseId, props.match.thumbUrl))

const band = computed(() => {
  if (props.match.score >= 85) return d.value.match.band.S
  if (props.match.score >= 70) return d.value.match.band.A
  if (props.match.score >= 50) return d.value.match.band.B
  return d.value.match.band.C
})

const meta = computed(() =>
  [props.match.label, props.match.catno, props.match.format, props.match.year]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <article
    class="flex h-full w-full flex-col gap-4 overflow-y-auto rounded-fid-md border border-fid-border bg-fid-surface p-5"
  >
    <!--
      Das Cover, so groß wie es geht. 600 auf der langen Kante ist die Decke,
      die Discogs hergibt (`docs/02`) — hier bekommt sie die ganze Breite.
    -->
    <img
      v-if="cover"
      :src="cover.coverUrl || cover.thumbUrl"
      alt=""
      loading="lazy"
      decoding="async"
      width="600"
      height="600"
      class="aspect-square w-full shrink-0 rounded-fid-cover bg-fid-inset object-cover"
    />
    <div
      v-else
      class="aspect-square w-full shrink-0 rounded-fid-cover bg-fid-inset"
      aria-hidden="true"
    />

    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-col gap-1">
        <h2 class="text-fid-xl font-bold text-fid-text">
          {{ match.artist }} – {{ match.title }}
        </h2>
        <p v-if="meta" class="font-fid-mono text-fid-xs text-fid-text-muted">{{ meta }}</p>
      </div>
      <p
        class="fid-num shrink-0 rounded-fid-sm border border-fid-border px-2 py-1 text-fid-sm text-fid-text"
        :aria-label="d.match.scoreBand(match.score, band)"
      >
        {{ match.score }}
      </p>
    </div>

    <p class="text-fid-base text-fid-text">{{ reasonFor(match.signals) }}</p>

    <!--
      Nach sechs Stunden verschwinden Preis und Zustand, nicht der Fund.
      Ein Stapel, durch den man schnell wischt, ist der leichteste Ort, an dem
      ein abgelaufener Preis unbemerkt stehen bleibt (Regel 4).
    -->
    <p v-if="!expired && match.price !== null" class="text-fid-base text-fid-text">
      {{ money(match.price, match.currency) }}
      <span v-if="match.condition" class="text-fid-text-muted">· {{ match.condition }}</span>
    </p>
    <p v-else-if="expired" class="text-fid-sm text-fid-text-muted">{{ d.expired }}</p>

    <OutwardLink :to="`https://www.discogs.com/sell/item/${match.listingId}`" class="mt-auto">
      {{ d.sheet.atDiscogs }}
    </OutwardLink>
  </article>
</template>
