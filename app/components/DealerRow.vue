<script setup lang="ts">
import type { DealerWithReasons } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

/**
 * One shop in the list — a row, not a button in a wall.
 *
 * The shops used to be a `flex-wrap` of bordered buttons carrying a logo and a
 * name. That reads as a keypad: with forty shops it is a wall nobody can scan,
 * and — worse — it throws away the ordering. The list is sorted by hit rate,
 * which is the only ordering that answers "where do I look first", and a
 * wrapping grid makes rank invisible the moment it needs a second line.
 *
 * So each shop gets a row with the four facts somebody actually chooses on:
 * how often it has something for you, where it ships from, how big it is, and
 * when you last looked. The bar beside the number is there so the ranking can
 * be *seen* rather than read — the same reason the shop's own stock is drawn
 * as bars a screen further down.
 */
const h = useDealerMessages()
const m = useMessages()
defineEmits<{ open: [] }>()

const props = defineProps<{
  dealer: DealerWithReasons
  selected: boolean
  /**
   * The strongest hit rate in the list, so the bars share one scale.
   *
   * Against the leader rather than against some absolute: hit rates are a few
   * finds per thousand, and a bar drawn against 1000 would be a hairline for
   * every shop including the best one.
   */
  peak: number
}>()

const rate = computed(() => props.dealer.affinity)

/** A floor in pixels, so "a little" never renders as "none" (FacetBars.vue). */
const width = computed(() =>
  rate.value && props.peak > 0 ? `${Math.max(3, (rate.value / props.peak) * 100)}%` : '0%',
)

/**
 * Where it ships from, in the reader's language.
 *
 * `shipsFrom` is Discogs' English country name (docs/02). `countryName` turns
 * it into the one a German reader recognises; an unknown string comes back
 * unchanged rather than disappearing.
 */
const from = computed(() =>
  props.dealer.shipsFrom ? countryName(props.dealer.shipsFrom) : null,
)
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 border-l-2 py-3 pr-2 pl-3 text-left transition-colors"
    :class="
      selected
        ? 'border-fid-accent bg-fid-accent/10'
        : 'border-transparent hover:bg-fid-inset focus-visible:bg-fid-inset'
    "
    :aria-current="selected ? 'true' : undefined"
    @click="$emit('open')"
  >
    <!-- A shop is a place, not a string. -->
    <ShopLogo
      :dealer="dealer.username"
      :avatar-url="dealer.avatarUrl"
      :size="32"
      class="shrink-0"
    />

    <span class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="truncate text-fid-sm font-medium text-fid-text">
        {{ dealer.displayName || dealer.username }}
      </span>

      <span class="fid-num truncate text-fid-xs text-fid-text-muted">
        <template v-if="from">{{ from }} · </template>
        {{ m.home.forSale(count(dealer.numForSale)) }}
        <template v-if="dealer.lastScannedAt"> · {{ since(dealer.lastScannedAt) }}</template>
        <template v-else> · {{ h.notDug }}</template>
      </span>

      <!--
        Why this shop is on the list at all (M30) — the same chips the profile
        carries, because a row without a reason is a row nobody trusts.
      -->
      <span v-if="dealer.reasons.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="reason in dealer.reasons"
          :key="reason"
          class="rounded-fid-sm border border-fid-border px-2 text-fid-xs text-fid-text-muted"
        >
          {{ h.reasons[reason] }}
        </span>
      </span>
    </span>

    <!--
      The number this list is sorted by, and a bar so the order can be seen.
      Neutral on purpose: the signal colours mean one signal each, and a hit
      rate is not one of them.
    -->
    <span v-if="rate !== null" class="flex w-16 shrink-0 flex-col items-end gap-1">
      <span class="fid-num text-fid-sm text-fid-text" :title="h.perThousand(decimal(rate))">
        {{ decimal(rate) }}
      </span>
      <span class="block h-1 w-full rounded-full bg-fid-inset">
        <span class="block h-1 rounded-full bg-fid-text-muted" :style="{ width }" />
      </span>
    </span>
  </button>
</template>
