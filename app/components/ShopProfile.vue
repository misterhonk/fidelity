<script setup lang="ts">
import type { DealerProfile } from '#shared/protocol'
import type { GradingRecord, TasteFacet } from '#shared/types'

import SheetFrame from '~/components/SheetFrame.vue'
import { useBasketMessages } from '~/i18n/basket'
import { useDealerMessages } from '~/i18n/dealers'
import type { PushState } from '~/composables/usePush'

/**
 * One shop, in the order a buyer asks (M34.1, its own component since M34.4):
 * who is this — does it fit me — what will postage cost — what do they charge
 * — what of mine do they carry — what has moved — what did I buy here. Each
 * answer under a plate word, the one filled action the one the screen exists
 * for. Beside the list on a desk, over it on a phone: `SheetFrame` renders
 * the children in a slot, a plain `<section>` renders them in place.
 */
const h = useDealerMessages()
const b = useBasketMessages()
const m = useMessages()

const props = defineProps<{
  profile: DealerProfile
  grading: GradingRecord | null
  narrow: boolean
  /** Where this shop stands in the list, and how long the list is. */
  position: number
  total: number
  watched: boolean
  /** New listings since the watcher last looked, or zero. */
  moved: number
  push: PushState
  pushBusy: boolean
}>()

const emit = defineEmits<{
  close: []
  step: [delta: number]
  watch: []
  hide: []
  enablePush: []
  disablePush: []
}>()

const { coverFor, request: requestCovers } = useCovers()

/* The four sleeves come from what is on hand; nothing is fetched for them. */
watch(
  () => props.profile,
  (profile) => {
    void requestCovers(
      profile.shelf.map((record) => record.releaseId),
      { fetch: false },
    )
  },
  { immediate: true },
)

const dealer = computed(() => props.profile.dealer)
const shopName = computed(() => dealer.value.displayName || dealer.value.username)

/**
 * The trust line, count before percentage: "59,539 ratings · 99.9 %" and
 * not "99.9 %", because a hundred per cent of three is not a record.
 */
const trust = computed(() => {
  const d = dealer.value
  const parts: string[] = [
    d.ratingCount > 0
      ? h.value.trust.ratings(count(d.ratingCount), decimal(d.sellerRating, 1))
      : h.value.trust.noRatings,
  ]
  const year = d.registeredAt ? new Date(d.registeredAt).getFullYear() : Number.NaN
  if (!Number.isNaN(year)) parts.push(h.value.trust.since(String(year)))
  parts.push(h.value.listings(count(d.numForSale)))
  if (d.shipsFrom) parts.push(h.value.shipsFrom(d.shipsFrom))
  if (d.lastScannedAt) parts.push(h.value.trust.dug(since(d.lastScannedAt)))
  return parts
})

const verdict = computed(() => {
  const p = props.profile
  const rate = decimal(p.rate)
  if (p.factor === null) return h.value.rateAlone(rate)
  const factor = decimal(p.factor, 2)
  if (p.factor >= 1.5) return h.value.rateAbove(rate, factor)
  if (p.factor >= 0.8) return h.value.rateSame(rate)
  return h.value.rateBelow(rate, factor)
})

/** The bar's tick: the median of the others, worked back from the factor. */
const fitReference = computed(() =>
  props.profile.factor && props.profile.factor > 0
    ? props.profile.rate / props.profile.factor
    : null,
)

const pricePosition = computed(() => {
  const factor = props.profile.priceFactor
  if (factor === null || factor === undefined) return null
  if (factor >= 1.25) return h.value.priceHigh
  if (factor <= 0.8) return h.value.priceLow
  return h.value.priceMiddle
})

const median = computed(() => dealer.value.fingerprint?.medianPrice ?? 0)
const priceReference = computed(() =>
  props.profile.priceFactor && props.profile.priceFactor > 0
    ? median.value / props.profile.priceFactor
    : null,
)

/** The cheapest known postage for one record, and where the figure came from. */
const postage = computed(() => {
  const tiers = dealer.value.shippingTiers ?? []
  const one =
    tiers
      .filter((tier) => tier.minItems <= 1 && (tier.maxItems === null || tier.maxItems >= 1))
      .sort((a, b) => a.price - b.price)[0] ?? tiers[0]
  if (!one) return null
  return { amount: money(one.price, one.currency) ?? decimal(one.price, 2), source: one.source }
})

const named = computed(() => {
  const figure = props.profile.postageNamed
  if (!figure) return null
  return h.value.postage.named(
    money(
      figure.original?.value ?? figure.value,
      figure.original?.currency ?? figure.currency,
    ) ?? '',
    figure.original ? money(figure.value, figure.currency) : null,
  )
})

const newest = computed(() => {
  const at = dealer.value.newestListedAt
  const when = at ? Date.parse(at) : Number.NaN
  return Number.isNaN(when) ? null : day(when)
})

function facets(dist: Record<string, number>, limit: number): TasteFacet[] {
  return (
    Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      // A dealer's shelf has no lift and no weight: those describe how a
      // collection leans, and this is somebody else's stock.
      .map(([name, n]) => ({ name, n, weight: n, lift: null }))
  )
}

const browsing = ref<{ title: string; label?: string; decade?: number } | null>(null)
const decadeOf = (name: string) => Number.parseInt(name, 10)
const labels = computed(() => facets(dealer.value.fingerprint?.labelDist ?? {}, 12))
const decades = computed(() =>
  facets(dealer.value.fingerprint?.decadeDist ?? {}, 8).sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
)

/* A different shop closes whatever label was open under the bars. */
watch(
  () => dealer.value.username,
  () => (browsing.value = null),
)
</script>

<template>
  <component
    :is="narrow ? SheetFrame : 'section'"
    v-bind="
      narrow
        ? { label: shopName }
        : {
            class:
              'flex min-w-0 flex-col gap-8 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-1',
          }
    "
    @close="emit('close')"
  >
    <template #title>{{ shopName }}</template>

    <!-- Over the list on a phone, the neighbours are one tap away. -->
    <div v-if="narrow && total > 1" class="flex items-center justify-between">
      <button
        type="button"
        class="fid-action fid-plate min-h-11 px-2 text-fid-text-muted hover:text-fid-text disabled:opacity-40"
        :disabled="position <= 0"
        :aria-label="h.prev"
        @click="emit('step', -1)"
      >
        <FidIcon name="arrow-left" :size="16" aria-hidden="true" />
      </button>
      <span class="fid-plate text-fid-text-muted">{{
        m.common.ofTotal(position + 1, total)
      }}</span>
      <button
        type="button"
        class="fid-action fid-plate min-h-11 px-2 text-fid-text-muted hover:text-fid-text disabled:opacity-40"
        :disabled="position >= total - 1"
        :aria-label="h.next"
        @click="emit('step', 1)"
      >
        <FidIcon name="arrow-right" :size="16" aria-hidden="true" />
      </button>
    </div>

    <header class="flex gap-4">
      <ShopLogo
        :dealer="dealer.username"
        :avatar-url="dealer.avatarUrl"
        :size="56"
        class="shrink-0"
      />
      <div class="flex min-w-0 grow flex-col gap-3">
        <h2 v-if="!narrow" class="fid-display text-fid-xl font-medium text-fid-text">
          {{ shopName }}
        </h2>
        <p class="fid-num text-fid-sm text-fid-text-muted" data-prose="data">
          {{ trust.join(' · ') }}
        </p>
        <p v-if="dealer.suspended" class="text-fid-sm text-fid-sig-gap">
          {{ h.trust.suspended }}
        </p>

        <!--
          One filled action, and every other one with its word beside the
          icon. Filled is the one the screen exists for (M31.3); hiding is a
          plate word: reachable, not proposed.
        -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <NuxtLink
            :to="`/dig?dealer=${encodeURIComponent(dealer.username)}`"
            class="fid-action fid-fill rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent"
          >
            {{ dealer.lastScannedAt === null ? h.digNow : h.digAgain }}
          </NuxtLink>
          <button
            type="button"
            :aria-pressed="watched"
            class="fid-action gap-2 rounded-fid-sm px-3 py-2 text-fid-sm transition-colors"
            :class="
              watched
                ? 'fid-tonal'
                : 'border border-fid-border text-fid-text-muted hover:text-fid-text'
            "
            @click="emit('watch')"
          >
            <FidIcon :name="watched ? 'eye' : 'eye-off'" :size="14" aria-hidden="true" />
            {{ watched ? h.watching : h.watch }}
          </button>
          <!--
            The seller's own page (M32.3): postage tables in prose, holiday
            notices, the return policy. `/seller/{u}/profile`, not `/user/{u}`:
            the first is the shop.
          -->
          <OutwardLink
            tone="inherit"
            class="text-fid-sm"
            :to="`https://www.discogs.com/seller/${encodeURIComponent(dealer.username)}/profile`"
          >
            {{ h.atDiscogs }}
          </OutwardLink>
          <button
            type="button"
            class="fid-action fid-plate min-h-11 text-fid-text-muted transition-colors hover:text-fid-text"
            :aria-label="h.hide"
            :title="h.hideWhy"
            @click="emit('hide')"
          >
            {{ h.hideShort }}
          </button>
        </div>
      </div>
    </header>

    <section aria-labelledby="plate-fit" class="flex flex-col gap-2">
      <h2 id="plate-fit" class="fid-plate text-fid-text-muted">{{ h.plates.fit }}</h2>
      <p v-if="dealer.lastScannedAt === null" class="text-fid-base text-fid-text">
        {{ h.neverScanned }}
      </p>
      <template v-else>
        <p class="text-fid-base text-fid-text">{{ verdict }}</p>
        <BulletBar :value="profile.rate" :reference="fitReference" :label="verdict" />
        <WhyNote :label="h.rateWhyLabel">{{ h.rateWhy }}</WhyNote>
      </template>
    </section>

    <!--
      What it costs to get a record here. Discogs' own figure first when a
      fresh basket line carries one (M34.2); then the cheapest tier this device
      knows and where it came from; where there is neither, the honest word
      and the one place it can be typed. The seller's prose stays folded.
    -->
    <section aria-labelledby="plate-postage" class="flex flex-col gap-2">
      <h2 id="plate-postage" class="fid-plate text-fid-text-muted">{{ h.plates.postage }}</h2>
      <p v-if="named" class="fid-num text-fid-base text-fid-text">{{ named }}</p>
      <p
        v-if="postage"
        class="text-fid-base"
        :class="named ? 'text-fid-text-muted' : 'text-fid-text'"
      >
        <span class="fid-num">{{ h.postage.from(postage.amount) }}</span>
        <span class="text-fid-sm text-fid-text-muted"> · {{ b.source[postage.source] }}</span>
      </p>
      <p v-else-if="!named" class="text-fid-base text-fid-text-muted">
        {{ h.postage.unknown }}
        <NuxtLink to="/basket" class="text-fid-accent underline underline-offset-4">
          {{ h.postage.enter }}
        </NuxtLink>
      </p>
      <WhyNote v-if="dealer.shippingNote" :label="h.postage.text">{{
        dealer.shippingNote
      }}</WhyNote>
    </section>

    <section v-if="median > 0" aria-labelledby="plate-price" class="flex flex-col gap-2">
      <h2 id="plate-price" class="fid-plate text-fid-text-muted">{{ h.plates.price }}</h2>
      <!--
        A median is a bare number and carries no unit. Inventory prices come
        back in the seller's currency, so the scan records which one it saw
        and says nothing where a shop mixes them.
      -->
      <p class="text-fid-base text-fid-text">
        <span class="fid-num">{{
          h.median(money(median, dealer.fingerprint?.priceCurrency) ?? count(median))
        }}</span>
        <template v-if="!dealer.fingerprint?.priceCurrency">
          <span class="text-fid-sm text-fid-text-muted"> {{ h.mixedCurrencies }}</span>
        </template>
        <template v-if="pricePosition"> – {{ pricePosition }}</template>
      </p>
      <BulletBar
        :value="median"
        :reference="priceReference"
        :label="`${h.median(money(median, dealer.fingerprint?.priceCurrency) ?? count(median))}${pricePosition ? ` – ${pricePosition}` : ''}`"
      />
      <WhyNote :label="h.priceWhyLabel">{{ h.priceWhy }}</WhyNote>
    </section>

    <!--
      Four sleeves of your own on the labels this shop carries (M31.4): the
      same fact as the bars below, as four records you already own.
    -->
    <section
      v-if="profile.shelf.length > 0"
      aria-labelledby="plate-shelf"
      class="flex flex-col gap-3"
    >
      <h2 id="plate-shelf" class="fid-plate text-fid-text-muted">{{ h.plates.shelf }}</h2>
      <ul class="flex flex-wrap gap-3">
        <li v-for="record in profile.shelf" :key="record.releaseId">
          <NuxtLink
            :to="`/shelf?release=${record.releaseId}`"
            class="fid-cover-button block size-20 overflow-hidden rounded-fid-cover bg-fid-inset"
            :title="`${record.artist} – ${record.title} · ${record.label}`"
            :aria-label="`${record.artist} – ${record.title} · ${record.label}`"
          >
            <img
              v-if="coverFor(record.releaseId, null)"
              :src="coverFor(record.releaseId, null)!.thumbUrl"
              alt=""
              loading="lazy"
              decoding="async"
              width="150"
              height="150"
              class="size-full object-cover"
            />
            <span
              v-else
              class="flex size-full items-center justify-center text-fid-text-muted"
              aria-hidden="true"
            >
              <FidIcon name="record" :size="28" />
            </span>
          </NuxtLink>
        </li>
      </ul>
      <p class="fid-plate text-fid-text-muted">
        {{ profile.shelf.map((record) => record.label).join(' · ') }}
      </p>
    </section>

    <!--
      What is on the shelves. Coverage is stated, not implied: a fingerprint
      built from 20.000 of 36.000 listings describes a bit more than half a
      shop, and saying so is the difference between a statistic and a claim.
    -->
    <section aria-labelledby="plate-range" class="flex flex-col gap-4">
      <h2 id="plate-range" class="fid-plate text-fid-text-muted">{{ h.plates.range }}</h2>
      <p
        v-if="dealer.fingerprint && dealer.fingerprint.coverage < 0.99"
        class="text-fid-sm text-fid-sig-gap"
      >
        {{
          h.coverage(
            count(dealer.fingerprint.sampledItems),
            count(dealer.fingerprint.totalItems),
            Math.round(dealer.fingerprint.coverage * 100),
          )
        }}
      </p>

      <div class="grid gap-8 @md:grid-cols-2 @5xl:grid-cols-3">
        <FacetBars
          :title="h.labelsInStock"
          signal="label"
          :facets="labels"
          :empty="h.noLabels"
          :open="(facet) => (browsing = { title: facet.name, label: facet.name })"
        />
        <FacetBars
          :title="h.decades"
          signal="gap"
          token="label"
          :facets="decades"
          :empty="h.noYears"
          :open="(facet) => (browsing = { title: facet.name, decade: decadeOf(facet.name) })"
        />
      </div>

      <!-- What is behind a bar, underneath the bars. No screen of its own. -->
      <DealerStock
        v-if="browsing"
        :key="browsing.title"
        :dealer="dealer.username"
        :title="browsing.title"
        :label="browsing.label ?? null"
        :decade="browsing.decade ?? null"
        @close="browsing = null"
      />
    </section>

    <!--
      What has moved since you last looked, and the newest thing on the
      shelf. Watching costs one request per app start, not a rescan — said in
      the fold, because "watch" usually means somebody is polling.
    -->
    <section aria-labelledby="plate-movement" class="flex flex-col gap-2">
      <h2 id="plate-movement" class="fid-plate text-fid-text-muted">{{ h.plates.movement }}</h2>
      <p v-if="moved > 0" class="text-fid-base text-fid-text">
        <span class="fid-num">+{{ count(moved) }}</span> · {{ shopName }}
        {{ m.watch.moved(count(moved), moved === 1) }}
      </p>
      <p v-else-if="watched" class="text-fid-base text-fid-text-muted">
        {{ h.movement.still }}
      </p>
      <p v-else class="text-fid-base text-fid-text-muted">{{ h.movement.unwatched }}</p>
      <p v-if="newest" class="fid-num text-fid-sm text-fid-text-muted" data-prose="data">
        {{ h.movement.newest(newest) }}
      </p>
      <WhyNote :label="h.watchCostLabel">{{ h.watchCost }}</WhyNote>

      <!--
        And the part a browser cannot do alone. Only for a shop that is
        watched, and only where it can work: no hub, no support, or a refusal
        in the browser settings and there is nothing here at all (rule 8).
      -->
      <div
        v-if="watched && push !== 'no-hub' && push !== 'unsupported' && push !== 'denied'"
        class="flex flex-wrap items-center gap-3"
      >
        <button
          v-if="push === 'off'"
          type="button"
          :disabled="pushBusy"
          class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text disabled:opacity-60"
          @click="emit('enablePush')"
        >
          {{ h.pushOffer }}
        </button>
        <template v-else-if="push === 'on'">
          <span class="text-fid-sm text-fid-text">{{ h.pushOn }}</span>
          <button
            type="button"
            :disabled="pushBusy"
            class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4 disabled:opacity-60"
            @click="emit('disablePush')"
          >
            {{ h.pushStop }}
          </button>
        </template>
        <span class="text-fid-xs text-fid-text-muted">
          {{ push === 'needs-install' ? h.pushInstall : h.pushWhy }}
        </span>
      </div>
    </section>

    <!--
      The number Discogs does not keep (M14). The seller rating above measures
      the process — shipped quickly, packed properly — and says nothing about
      whether the grade was right. What is stored is only the comparison.
    -->
    <section
      v-if="grading && grading.judged > 0"
      aria-labelledby="plate-purchases"
      class="flex flex-col gap-2"
    >
      <h2 id="plate-purchases" class="fid-plate text-fid-text-muted">
        {{ h.plates.purchases }}
      </h2>
      <p class="fid-num text-fid-base text-fid-text">
        <template v-if="grading.rate !== null">
          {{ h.grading.rate(`${Math.round(grading.rate * 100)} %`, count(grading.judged)) }}
        </template>
        <template v-else>
          {{ h.grading.tooFew(count(grading.judged), grading.judged === 1) }}
        </template>
        <template v-if="grading.worse > 0">
          {{ h.grading.worse(count(grading.worse), grading.worse === 1) }}
        </template>
      </p>
      <WhyNote :label="h.grading.whyLabel">{{ h.grading.why }}</WhyNote>
    </section>
  </component>
</template>
