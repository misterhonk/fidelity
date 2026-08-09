<script setup lang="ts">
import type { Match } from '#shared/types'

const props = defineProps<{ match: Match }>()

const { verdicts, judge } = useFeedback()
const verdict = computed(() => verdicts.value[props.match.listingId])

const { show } = useReleaseSheet()
const { contains, toggle } = useBasket()

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
    class="@container flex scroll-mt-28 flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-4"
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
        <!--
          The title is the way in. A whole-card click would swallow the
          Discogs link and the four verdict buttons that sit inside it.
        -->
        <button
          type="button"
          class="truncate text-left text-fid-base font-medium text-fid-text underline-offset-4 hover:underline"
          @click="show(match.digId, match.listingId)"
        >
          {{ match.artist }} – {{ match.title }}
        </button>
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
        :style="signalChipStyle(signal.type)"
      >
        {{ signalLabel(signal.type) }}
      </li>
    </ul>

    <!-- Never truncated. The sentence is the product. -->
    <p class="text-fid-sm text-fid-text">{{ match.reason }}</p>

    <div class="flex flex-wrap items-center justify-between gap-3">
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

      <!--
        The only way Barry ever gets calibrated. Each press stores the signals
        as they were at the moment of the verdict — the verdict alone would be
        worthless once the weights move (docs/03 §7).
      -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          :aria-pressed="contains(match.listingId)"
          class="rounded-fid-sm border px-3 py-1 text-fid-sm transition-colors"
          :class="
            contains(match.listingId)
              ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          @click="toggle(match.digId, match.listingId)"
        >
          {{ contains(match.listingId) ? 'Im Korb' : 'In den Korb' }}
        </button>

        <div class="flex gap-1" role="group" aria-label="Wie war der Treffer?">
          <button
            v-for="option in VERDICTS"
            :key="option.key"
            type="button"
            :title="option.label"
            :aria-label="option.label"
            :aria-pressed="verdict === option.key"
            class="rounded-fid-sm border px-2 py-1 text-fid-sm transition-colors"
            :class="
              verdict === option.key
                ? 'border-fid-accent bg-fid-accent/15'
                : 'border-transparent opacity-45 hover:opacity-100'
            "
            @click="judge(match, option.key)"
          >
            <span aria-hidden="true">{{ option.icon }}</span>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
