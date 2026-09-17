<script setup lang="ts">
import type { DealerWithReasons } from '#shared/types'

import { useBasketMessages } from '~/i18n/basket'
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
const b = useBasketMessages()
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
  /**
   * How many listings have appeared here since the last check, or zero.
   *
   * The watcher measures this on every app start and has always reported it as
   * a banner at the top of the screen — "something moved somewhere". Beside
   * the shop it is an invitation instead: it names which shop, and it stands
   * where somebody would act on it.
   */
  moved?: number
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

/**
 * And as two letters on the row itself (M34.1): the country is one of four
 * facts on a line that has to hold "United Kingdom · 44,498 · 3 days ago",
 * and the full name is in the title for a pointer.
 */
const code = computed(() =>
  props.dealer.shipsFrom ? countryCode(props.dealer.shipsFrom) : null,
)
</script>

<template>
  <!--
    A row, not a button — and that is a correctness point, not a style one.

    The whole row used to be one `<button>`. Putting "dig" inside it would have
    been a button inside a button: invalid HTML, and unreachable with a
    keyboard. So the name carries the opening and stretches over the row with a
    pseudo-element, and the dig action sits above it in the stacking order.
    One row, two controls, both reachable.
  -->
  <div
    class="relative flex w-full items-center gap-3 border-l-2 py-3 pr-2 pl-3 transition-colors"
    :class="
      selected
        ? 'border-fid-accent bg-fid-accent/10'
        : 'border-transparent hover:bg-fid-inset focus-within:bg-fid-inset'
    "
  >
    <!-- A shop is a place, not a string. -->
    <ShopLogo
      :dealer="dealer.username"
      :avatar-url="dealer.avatarUrl"
      :size="32"
      class="shrink-0"
    />

    <span class="flex min-w-0 flex-1 flex-col gap-1">
      <button
        type="button"
        class="truncate text-left text-fid-sm font-medium text-fid-text after:absolute after:inset-0 after:content-['']"
        :aria-current="selected ? 'true' : undefined"
        @click="$emit('open')"
      >
        {{ dealer.displayName || dealer.username }}
      </button>

      <!--
        Short on purpose: the row now carries a dig button too, and "40.000 im
        Angebot · vor 9 Stunden" was being cut off mid-word. The bare figure
        between a country and a time reads as stock, and the long form is one
        line down in the profile — and in the title for a pointer.
      -->
      <span
        class="fid-num truncate text-fid-xs text-fid-text-muted"
        :title="[from, m.home.forSale(count(dealer.numForSale))].filter(Boolean).join(' · ')"
      >
        <template v-if="code"
          ><abbr class="no-underline" :title="from ?? undefined">{{ code }}</abbr> ·
        </template>
        {{ count(dealer.numForSale) }}
        <template v-if="dealer.lastScannedAt"> · {{ since(dealer.lastScannedAt) }}</template>
        <template v-else> · {{ h.notDug }}</template>
        <!-- What one record costs to post from here, as far as this device knows (M34.3). -->
        <template v-if="dealer.postageFrom">
          ·
          <span :title="b.source[dealer.postageFrom.source]">{{
            h.rowPostage(
              money(dealer.postageFrom.value, dealer.postageFrom.currency) ??
                decimal(dealer.postageFrom.value, 2),
            )
          }}</span>
        </template>
      </span>

      <!--
        Why this shop is on the list at all (M30), as plate words (M34.1).
        Bordered chips read as buttons — twelve rows of things that look
        pressable and are not. A reason is a fact, and facts are set in the
        plate face. A row without a reason is still a row nobody trusts.
      -->
      <span
        v-if="dealer.reasons.length > 0 || dealer.fit || dealer.priceBand"
        class="fid-plate flex flex-wrap gap-x-3 text-fid-text-muted"
      >
        <span v-for="reason in dealer.reasons" :key="reason">{{ h.reasons[reason] }}</span>
        <!--
          The verdict pair (M34.4): the profile's two sentences as two words,
          against your other shops. Set a shade stronger than the reasons —
          those say why the row is here, these say what it is worth.
        -->
        <span v-if="dealer.fit" class="text-fid-text">{{ h.verdict.fit[dealer.fit] }}</span>
        <span v-if="dealer.priceBand" class="text-fid-text">{{
          h.verdict.price[dealer.priceBand]
        }}</span>
      </span>
    </span>

    <!--
      The number this list is sorted by, and a bar so the order can be seen.
      Neutral on purpose: the signal colours mean one signal each, and a hit
      rate is not one of them.
    -->
    <span v-if="rate !== null" class="flex w-12 shrink-0 flex-col items-end gap-1">
      <span class="fid-num text-fid-sm text-fid-text" :title="h.perThousand(decimal(rate))">
        {{ decimal(rate) }}
      </span>
      <span class="block h-1 w-full rounded-full bg-fid-inset">
        <span class="block h-1 rounded-full bg-fid-text-muted" :style="{ width }" />
      </span>

      <!--
        And the one number on this screen that is an invitation rather than a
        measurement. It carries the sentence the banner used to carry, so "+37"
        is never a figure somebody has to take on trust.
      -->
      <span
        v-if="moved && moved > 0"
        class="fid-tonal fid-num rounded-fid-sm px-2 text-fid-xs"
        :title="`${dealer.displayName || dealer.username} ${m.watch.moved(count(moved), moved === 1)}`"
      >
        +{{ count(moved) }}
      </span>
    </span>

    <!--
      And the thing somebody came for, on the row itself.

      The middle volume, not the filled one: twelve filled buttons in a column
      would be the wall this list was built to replace. The filled one lives in
      the profile, once, for the shop that is open.
    -->
    <NuxtLink
      :to="`/dig?dealer=${encodeURIComponent(dealer.username)}`"
      class="fid-action fid-tonal relative shrink-0 gap-2 rounded-fid-sm px-3 text-fid-xs font-medium"
      :aria-label="h.digAt(dealer.displayName || dealer.username)"
    >
      <FidIcon name="search" :size="14" aria-hidden="true" />
      {{ h.digShort }}
    </NuxtLink>
  </div>
</template>
