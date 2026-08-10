<script setup lang="ts">
import type { Match } from '#shared/types'

const props = defineProps<{ match: Match }>()

const { verdicts, judge } = useFeedback()
const verdict = computed(() => verdicts.value[props.match.listingId])

const { show } = useReleaseSheet()

const price = computed(() => {
  const { price: value, currency } = props.match
  if (value === null || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
})
</script>

<template>
  <!--
    The compact row: 34 px, per docs/05 §3. Density is a feature here because
    collectors want to see a lot at once, and a shelf of four hundred records
    is not readable as four hundred cards.

    The sentence survives the shrink, truncated to a line — a score without a
    reason is an insult in either density. The full one is a hover and a tap
    away in the detail sheet.
  -->
  <div
    class="group grid h-[34px] scroll-mt-28 grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-fid-sm px-2 hover:bg-fid-surface"
  >
    <span
      class="fid-num text-fid-sm font-medium text-fid-text"
      :aria-label="`Barry Score ${match.score} von 100`"
    >
      {{ match.score }}
    </span>

    <p class="flex min-w-0 items-baseline gap-2">
      <button
        type="button"
        class="shrink-0 truncate text-left text-fid-sm text-fid-text underline-offset-4 hover:underline"
        @click="show(match.digId, match.listingId)"
      >
        {{ match.artist }} – {{ match.title }}
      </button>
      <span class="truncate text-fid-xs text-fid-text-muted" :title="match.reason">
        {{ match.reason }}
      </span>
    </p>

    <span class="flex shrink-0 items-center gap-2">
      <span v-if="price" class="fid-num text-fid-sm text-fid-text-muted">{{ price }}</span>

      <!--
        Only the verdict already given stays visible when the row is at rest.
        Four buttons on every one of four hundred rows would be the noisiest
        thing on the screen; the rest appear on hover and on keyboard focus,
        which is what focus-within is here for.
      -->
      <span
        class="flex gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        :class="verdict ? 'opacity-100' : 'opacity-0'"
        role="group"
        aria-label="Wie war der Treffer?"
      >
        <button
          v-for="option in VERDICTS"
          :key="option.key"
          type="button"
          :title="option.label"
          :aria-label="option.label"
          :aria-pressed="verdict === option.key"
          class="min-h-6 min-w-6 rounded-fid-sm border text-fid-xs"
          :class="
            verdict === option.key ? 'border-fid-accent bg-fid-accent/15' : 'border-transparent'
          "
          @click="judge(match, option.key)"
        >
          <span aria-hidden="true">{{ option.icon }}</span>
        </button>
      </span>
    </span>
  </div>
</template>
