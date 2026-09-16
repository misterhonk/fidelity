<script setup lang="ts">
import type { RoundProgress, RoundSummary } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

/**
 * The round (worker/dealers/round.ts), as one line (M34.4).
 *
 * Asked for as "a favourite-shop list I can scan weekly for new items". It
 * had grown into a box across the top of the screen: ten watched shops made
 * ten result lines, eight of them saying "nothing new". Now it is a plate
 * word, the count and the minutes, the button, and the last round as one
 * line — the finds listed, the quiet stops a count and a fold.
 */
const h = useDealerMessages()
const m = useMessages()

const props = defineProps<{
  plan: { shops: number; reachable: number; neverDug: number; requests: number }
  round: RoundProgress | null
  lastRound: RoundSummary | null
  busy: boolean
}>()

defineEmits<{ start: [] }>()

const minutes = computed(() => Math.max(1, Math.ceil((props.plan.requests * 1.2) / 60)))

const percent = computed(() => {
  const p = props.round
  if (!p || p.total === 0) return 0
  return Math.round((p.done / p.total) * 100)
})

/* The stops, sorted into what is worth a line and what is worth a count. */
const stops = computed(() => props.lastRound?.stops ?? [])
const hits = computed(() => stops.value.filter((stop) => stop.matches > 0))
const quiet = computed(() =>
  stops.value.filter((stop) => stop.matches === 0 && stop.status !== 'never-dug'),
)
const skipped = computed(() => stops.value.filter((stop) => stop.status === 'never-dug'))
const others = computed(() => stops.value.filter((stop) => stop.matches === 0))
const finds = computed(() => hits.value.reduce((sum, stop) => sum + stop.matches, 0))
</script>

<template>
  <section aria-labelledby="round" class="flex flex-col gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="round" class="fid-plate text-fid-text-muted">{{ h.round.title }}</h2>
      <span class="fid-num text-fid-sm text-fid-text-muted" data-prose="data">
        {{ h.round.line(count(plan.shops), minutes) }}
        <!--
          A shop nobody has dug yet has no line to stop at, so "only what is
          new" has nothing to be new since. Said as a count, not a sentence.
        -->
        <template v-if="plan.neverDug > 0"> · {{ h.round.skipped(plan.neverDug) }}</template>
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <!--
        The middle volume: walking every watched shop is the second path, and
        the filled one lives in the profile, once, for the shop that is open.
      -->
      <button
        v-if="plan.reachable > 0"
        type="button"
        :disabled="busy"
        class="fid-tonal rounded-fid-sm px-4 py-2 font-medium disabled:opacity-50"
        @click="$emit('start')"
      >
        {{ h.round.start }}
      </button>
      <WhyNote>{{ h.round.about(plan.reachable, minutes) }}</WhyNote>
    </div>

    <div v-if="round" class="flex flex-col gap-2" aria-live="polite">
      <div class="h-2 w-full overflow-hidden rounded-full bg-fid-inset">
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <p class="text-fid-sm text-fid-text-muted">
        {{ m.common.ofTotal(count(round.done), count(round.total)) }}
        <template v-if="round.dealer"> · {{ round.dealer }}</template>
        · {{ h.round.found(round.found) }}
      </p>
      <p class="text-fid-sm text-fid-text-muted">{{ h.round.keepsRunning }}</p>
    </div>

    <!--
      What the last one turned up. Its own record, because the digs do not
      survive it: five are kept, and a round over ten shops prunes the first
      five before it ends.
    -->
    <div v-if="lastRound && !round" class="flex flex-col gap-2">
      <p class="fid-num text-fid-sm text-fid-text-muted" data-prose="data">
        {{ h.round.lastAt(dayTime(lastRound.startedAt)) }} · {{ h.round.found(finds) }}
        <template v-if="quiet.length > 0"> · {{ h.round.quiet(quiet.length) }}</template>
        <template v-if="skipped.length > 0"> · {{ h.round.skipped(skipped.length) }}</template>
      </p>

      <ul v-if="hits.length > 0" class="flex flex-col gap-1">
        <li
          v-for="stop in hits"
          :key="stop.dealer"
          class="flex flex-wrap items-baseline gap-x-2 text-fid-sm"
        >
          <NuxtLink
            v-if="stop.digId"
            :to="{ path: '/dig', query: { id: stop.digId } }"
            class="font-medium text-fid-accent underline underline-offset-4"
          >
            {{ stop.displayName }}
          </NuxtLink>
          <span v-else class="font-medium text-fid-text">{{ stop.displayName }}</span>
          <span class="text-fid-text-muted">
            {{ h.round.stopFound(stop.matches, count(stop.newListings)) }}
            <template v-if="stop.best">
              — {{ stop.best.artist }} – {{ stop.best.title }}</template
            >
          </span>
        </li>
      </ul>

      <details v-if="others.length > 0" class="group">
        <summary
          class="fid-action w-fit cursor-pointer list-none text-fid-xs text-fid-text-muted underline decoration-dotted underline-offset-4 hover:text-fid-text"
        >
          {{ h.round.others(others.length) }}
        </summary>
        <ul class="mt-2 flex flex-col gap-1">
          <li
            v-for="stop in others"
            :key="stop.dealer"
            class="flex flex-wrap items-baseline gap-x-2 text-fid-sm"
          >
            <span class="font-medium text-fid-text">{{ stop.displayName }}</span>
            <span v-if="stop.status === 'never-dug'" class="text-fid-text-muted">
              {{ h.round.stopNeverDug }}
            </span>
            <span v-else-if="stop.status === 'failed'" class="text-fid-sig-gap">
              {{ h.round.stopFailed }}
            </span>
            <span v-else class="text-fid-text-muted">
              {{ h.round.stopNothing(count(stop.newListings)) }}
            </span>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}
</style>
