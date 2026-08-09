<script setup lang="ts">
import type { Match } from '#shared/types'

const props = defineProps<{ match: Match }>()

/** Which token colours a chip. S1 and S2 share one — ten for eleven signals. */
const SIGNAL_TOKEN: Record<string, string> = {
  WANTLIST_EXACT: 'wantlist',
  WANTLIST_PRESSING: 'wantlist',
  ARTIST_KNOWN: 'artist',
  ARTIST_GAP: 'gap',
  LABEL_AFFINITY: 'label',
  CATALOG_RUN: 'catalog',
  STYLE_ADJACENT: 'style',
  CREDIT_GRAPH: 'credit',
  FORMAT_UPGRADE: 'upgrade',
  PRICE_SIGNAL: 'price',
  SCARCITY: 'scarcity',
}

const SIGNAL_LABEL: Record<string, string> = {
  WANTLIST_EXACT: 'Wantlist',
  WANTLIST_PRESSING: 'Anderes Pressing',
  ARTIST_KNOWN: 'Künstler',
  ARTIST_GAP: 'Lücke',
  LABEL_AFFINITY: 'Label',
  CATALOG_RUN: 'Katalogserie',
  STYLE_ADJACENT: 'Stil',
  CREDIT_GRAPH: 'Credits',
  FORMAT_UPGRADE: 'Upgrade',
  PRICE_SIGNAL: 'Preis',
  SCARCITY: 'Seltenheit',
}

const band = computed(() => {
  if (props.match.score >= 85) return { key: 'S', label: 'Side One, Track One' }
  if (props.match.score >= 70) return { key: 'A', label: 'Top Five' }
  if (props.match.score >= 50) return { key: 'B', label: 'Solide' }
  return { key: 'C', label: 'Randnotiz' }
})

const price = computed(() => {
  const { price: value, currency } = props.match
  if (value === null || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
})

const meta = computed(() =>
  [props.match.label, props.match.catno, props.match.year].filter(Boolean).join(' · '),
)
</script>

<template>
  <article
    class="@container flex flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-4"
  >
    <div class="flex items-start gap-4">
      <!--
        The cover is fetched by the browser, lazily and only in the viewport.
        i.discogs.com has its own Cloudflare limit that has nothing to do with
        the API budget, so it is never fetched actively.
      -->
      <img
        v-if="match.thumbUrl"
        :src="match.thumbUrl"
        alt=""
        loading="lazy"
        decoding="async"
        width="72"
        height="72"
        class="size-18 shrink-0 rounded-fid-cover bg-fid-n-800 object-cover"
      />
      <div v-else class="size-18 shrink-0 rounded-fid-cover bg-fid-n-800" aria-hidden="true" />

      <div class="flex min-w-0 grow flex-col gap-1">
        <p class="truncate text-fid-base font-medium text-fid-text">
          {{ match.artist }} – {{ match.title }}
        </p>
        <p v-if="meta" class="truncate font-fid-mono text-fid-xs text-fid-text-muted">
          {{ meta }}
        </p>
      </div>

      <div
        class="flex shrink-0 flex-col items-center"
        role="img"
        :aria-label="`Barry Score ${match.score} von 100 – ${band.label}`"
      >
        <span class="fid-num text-fid-xl font-bold text-fid-text">{{ match.score }}</span>
        <span class="text-fid-xs text-fid-text-muted">{{ band.key }}</span>
      </div>
    </div>

    <ul class="flex flex-wrap gap-1.5">
      <li
        v-for="signal in match.signals"
        :key="signal.type"
        class="rounded-fid-sm border px-2 py-0.5 text-fid-xs text-fid-text"
        :style="{
          backgroundColor: `color-mix(in oklch, var(--fid-sig-${SIGNAL_TOKEN[signal.type]}) 12%, transparent)`,
          borderColor: `color-mix(in oklch, var(--fid-sig-${SIGNAL_TOKEN[signal.type]}) 40%, transparent)`,
        }"
      >
        {{ SIGNAL_LABEL[signal.type] ?? signal.type }}
      </li>
    </ul>

    <!-- Never truncated. The sentence is the product. -->
    <p class="text-fid-sm text-fid-text">{{ match.reason }}</p>

    <p class="flex flex-wrap items-center gap-x-3 text-fid-sm text-fid-text-muted">
      <span v-if="match.condition">{{ match.condition }}</span>
      <span v-if="price" class="fid-num text-fid-text">{{ price }}</span>
      <a
        class="text-fid-accent underline underline-offset-4"
        :href="`https://www.discogs.com/sell/item/${match.listingId}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        Bei Discogs ansehen
      </a>
    </p>
  </article>
</template>
