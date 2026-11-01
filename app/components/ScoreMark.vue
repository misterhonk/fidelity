<script setup lang="ts">
import { bandOf, bandStep, BANDS } from '#shared/score'

import { useDigMessages } from '~/i18n/dig'

/**
 * The score, saying what it means.
 *
 * It used to be a number and a bare letter — `48 c` — and both halves were
 * asked about on 2026-09-14: why 48, and what is the c. The answers exist and
 * were nowhere on the screen. The band names were in an `aria-label`, which is
 * to say invisible to everybody looking at it, and the scale itself was
 * unexplained.
 *
 * Three changes, all of them the same idea:
 *
 * - **The word replaces the letter.** "Randnotiz" is readable; "c" is a code
 *   with the legend missing.
 * - **A ladder of four** shows the rank without a legend at all. Not a
 *   percentage bar: the scale is not linear in anything a reader cares about —
 *   one perfect reason is 87 and two are 96 — but "one of four" is a rank
 *   anybody reads at a glance.
 * - **A question mark opens the rest.** Three sentences: what is counted, why
 *   the hundred almost never falls, and what the four bands are called.
 *
 * The disclosure is a `<details>`, like `WhyNote`: keyboard-operable, announced
 * as open or closed, works without JavaScript, costs nothing. The visible part
 * is a question mark; the announced name is the whole sentence.
 */
const d = useDigMessages()

const props = defineProps<{
  score: number
  /**
   * The sheet's version: the number large, with room for the bands underneath.
   *
   * On a card the score is an aside next to the title; on the sheet it is the
   * thing the section is about, and it stands beside the signals it was
   * computed from — which is the real explanation, the one that needs no
   * question mark.
   */
  block?: boolean
}>()

const band = computed(() => bandOf(props.score))
const lit = computed(() => bandStep(band.value))
const word = computed(() => d.value.match.band[band.value])

/*
 * The question mark lives on the sheet only (#222). A card is one of many, and
 * the list carries the single "Why?" at its head (`MatchList`); the top five,
 * the stack and the basket open the sheet, which answers in full.
 */
</script>

<template>
  <!--
    On a card: a price sticker, "92 · Side One, Track One" (#222). The number
    and its word in one line, the way docs/00 writes a find, with no ladder and
    no disclosure — the explanation stands once at the head of the list.
  -->
  <span
    v-if="!block"
    data-testid="score-sticker"
    class="inline-flex items-baseline gap-1 rounded-fid-sm border border-fid-border px-2 text-fid-xs text-fid-text-muted"
    :aria-label="d.match.scoreBand(score, word)"
  >
    <span class="fid-num text-fid-base font-bold text-fid-text" aria-hidden="true">{{
      score
    }}</span>
    <span aria-hidden="true">· {{ word }}</span>
  </span>

  <div v-else class="flex flex-col gap-2">
    <span
      class="fid-num text-fid-xl font-bold text-fid-text"
      :aria-label="d.match.scoreBand(score, word)"
    >
      {{ score }}
    </span>

    <!--
      Four rungs, and the lit ones are neutral rather than accented: a score is
      a measurement, and the signal colours each already mean one signal. The
      one filled accent per screen belongs to the thing you are meant to press.
    -->
    <div class="flex gap-1" aria-hidden="true">
      <span
        v-for="(step, index) in BANDS.length"
        :key="step"
        class="block h-1 w-3 rounded-full"
        :class="index < lit ? 'bg-fid-text' : 'bg-fid-field'"
      />
    </div>

    <!-- The word and its explanation belong together. -->
    <div class="flex items-center gap-2">
      <span class="text-fid-sm text-fid-text-muted" aria-hidden="true">{{ word }}</span>

      <details class="group">
        <summary
          class="fid-action flex size-5 cursor-pointer list-none items-center justify-center rounded-full border border-fid-border text-fid-xs text-fid-text-muted hover:text-fid-text"
          :aria-label="d.match.scoreWhat"
          :title="d.match.scoreWhat"
        >
          ?
        </summary>
        <p class="mt-2 max-w-prose text-fid-xs text-fid-text-muted">
          {{ d.match.scoreHow }}
        </p>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Safari puts a disclosure triangle here that no other browser does. */
summary::-webkit-details-marker {
  display: none;
}
</style>
