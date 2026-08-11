<script setup lang="ts">
import type { DealerProfile } from '#shared/protocol'
import type { Dealer, TasteFacet } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

const h = useDealerMessages()
useSeoMeta({
  title: () => h.value.title,
  description: () => h.value.description,
})

const { call } = useFidelityWorker()
const { isWatched, toggle, load: loadWatchlist } = useWatchlist()
const route = useRoute()

const dealers = shallowRef<Dealer[]>([])
const selected = ref<string | null>(null)
const profile = ref<DealerProfile | null>(null)

async function load() {
  dealers.value = await call('dealer.list', undefined)
  const first = dealers.value[0]
  /*
   * ?dealer= kommt von der Startseite.
   * Every shop tile there shows a hit rate and a stock size and led nowhere;
   * the heading led here and landed on whichever shop sorted first. A name in
   * the query picks the one somebody actually tapped — and an unknown one
   * falls through to the default rather than showing an empty profile.
   */
  const wanted = route.query.dealer
  const asked =
    typeof wanted === 'string' && dealers.value.some((dealer) => dealer.username === wanted)
      ? wanted
      : null

  if (asked) await select(asked)
  else if (first && !selected.value) await select(first.username)
}

onMounted(async () => {
  await load()
  await loadWatchlist()
})

async function select(username: string) {
  selected.value = username
  profile.value = await call('dealer.profile', { dealer: username })

  /*
   * The list above learns about the sign that was just fetched.
   *
   * Opening a shop backfills its logo the first time (worker/handlers.ts), and
   * without this the row in the nav above would keep its initials until the
   * next page load — the one place where the picture is actually worth having,
   * because that is the list somebody scans.
   */
  const fetched = profile.value?.dealer
  if (!fetched) return
  dealers.value = dealers.value.map((dealer) =>
    dealer.username === username ? { ...dealer, avatarUrl: fetched.avatarUrl } : dealer,
  )
}

/** Distributions come back as name → count; the bars want facets. */
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

const labels = computed(() => facets(profile.value?.dealer.fingerprint?.labelDist ?? {}, 12))
const decades = computed(() =>
  facets(profile.value?.dealer.fingerprint?.decadeDist ?? {}, 8).sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
)

/**
 * The one sentence the screen exists for. Deliberately refuses to say anything
 * comparative until a second shop has been scanned — one data point is not a
 * ranking, and pretending otherwise would be the same invented baseline the
 * affinity factor already declines to make up.
 */
const verdict = computed(() => {
  const p = profile.value
  if (!p) return null

  const rate = decimal(p.rate)
  if (p.factor === null) {
    return h.value.rateAlone(rate)
  }

  const factor = decimal(p.factor, 2)
  if (p.factor >= 1.5) return h.value.rateAbove(rate, factor)
  if (p.factor >= 0.8) return h.value.rateSame(rate)
  return h.value.rateBelow(rate, factor)
})

const pricePosition = computed(() => {
  const factor = profile.value?.priceFactor
  if (factor === null || factor === undefined) return null
  if (factor >= 1.25) return h.value.priceHigh
  if (factor <= 0.8) return h.value.priceLow
  return h.value.priceMiddle
})

const scanned = computed(() => {
  const at = profile.value?.dealer.lastScannedAt
  return at ? day(new Date(at)) : null
})
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[80rem] flex-col gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ h.title }}</h1>
      <p class="text-fid-base text-fid-text-muted">{{ h.lead }}</p>
    </div>

    <!--
      The shops Discogs already knows you deal with — which beats typing a
      username from memory and getting the underscore wrong.
    -->
    <DealerDiscovery @imported="load()" />

    <p v-if="dealers.length === 0" class="text-fid-base text-fid-text-muted">
      {{ h.none }}
    </p>

    <template v-else>
      <!-- Ranked by hit rate: the only ordering that answers "wo zuerst?". -->
      <nav class="flex flex-wrap gap-2" :aria-label="h.scanned">
        <button
          v-for="dealer in dealers"
          :key="dealer.username"
          type="button"
          class="flex items-center gap-2 rounded-fid-sm border py-2 pr-3 pl-2 text-fid-sm transition-colors"
          :class="
            dealer.username === selected
              ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          @click="select(dealer.username)"
        >
          <!-- Ein Laden ist ein Ort, kein String. -->
          <ShopLogo :dealer="dealer.username" :avatar-url="dealer.avatarUrl" :size="24" />
          {{ dealer.displayName || dealer.username }}
        </button>
      </nav>

      <section v-if="profile" class="flex flex-col gap-8">
        <div class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4">
          <p v-if="profile.dealer.lastScannedAt === null" class="text-fid-base text-fid-text">
            {{ h.neverScanned }}
          </p>
          <p v-else class="text-fid-base text-fid-text">{{ verdict }}</p>
          <p class="text-fid-sm text-fid-text-muted">
            {{ h.listings(count(profile.dealer.numForSale)) }}
            <template v-if="profile.dealer.shipsFrom">
              · {{ h.shipsFrom(profile.dealer.shipsFrom) }}</template
            >
            <template v-if="profile.dealer.ratingCount > 0">
              ·
              {{
                h.rating(`${profile.dealer.sellerRating} %`, count(profile.dealer.ratingCount))
              }}
            </template>
            <template v-if="scanned"> · {{ h.lastScanned(scanned) }}</template>
          </p>

          <!--
            Watching costs one request per app start, not a rescan. Worth
            saying, because "beobachten" usually means somebody is polling.
          -->
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              :aria-pressed="isWatched(profile.dealer.username)"
              class="rounded-fid-sm border px-3 py-2 text-fid-sm transition-colors"
              :class="
                isWatched(profile.dealer.username)
                  ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                  : 'border-fid-border text-fid-text-muted hover:text-fid-text'
              "
              @click="toggle(profile.dealer.username)"
            >
              {{ isWatched(profile.dealer.username) ? h.watching : h.watch }}
            </button>
            <!--
              The shop with the best hit rate sits at the top of this list, and
              until now there was nothing to do about it from here. Ranking
              shops and then making somebody retype the name is the ranking
              doing half its job.
            -->
            <NuxtLink
              :to="`/dig?dealer=${encodeURIComponent(profile.dealer.username)}`"
              class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
            >
              {{ profile.dealer.lastScannedAt === null ? h.digNow : h.digAgain }}
            </NuxtLink>
            <span class="text-fid-xs text-fid-text-muted">{{ h.watchCost }}</span>
          </div>
        </div>

        <!--
          Coverage is stated, not implied. A fingerprint built from 20.000 of
          36.000 listings describes a bit more than half a shop, and saying so
          is the difference between a statistic and a claim.
        -->
        <p
          v-if="profile.dealer.fingerprint && profile.dealer.fingerprint.coverage < 0.99"
          class="text-fid-sm text-fid-sig-gap"
        >
          {{
            h.coverage(
              count(profile.dealer.fingerprint.sampledItems),
              count(profile.dealer.fingerprint.totalItems),
              Math.round(profile.dealer.fingerprint.coverage * 100),
            )
          }}
        </p>

        <div
          v-if="profile.dealer.fingerprint && profile.dealer.fingerprint.medianPrice > 0"
          class="flex flex-col gap-1"
        >
          <h2 class="text-fid-sm font-medium text-fid-text">{{ h.priceTitle }}</h2>
          <!--
            A median is a bare number and carries no unit.
            This printed it with a hard-coded euro sign, so a shop pricing in
            pounds showed its median as euros — a real number under the wrong
            symbol, which is worse than no number. Inventory prices always come
            back in the seller's currency, so the scan records which one it saw
            and says nothing where a shop mixes them.
          -->
          <p class="text-fid-base text-fid-text">
            <span class="fid-num">{{
              h.median(
                money(
                  profile.dealer.fingerprint.medianPrice,
                  profile.dealer.fingerprint.priceCurrency,
                ) ?? count(profile.dealer.fingerprint.medianPrice),
              )
            }}</span>
            <template v-if="!profile.dealer.fingerprint.priceCurrency">
              <span class="text-fid-sm text-fid-text-muted"> {{ h.mixedCurrencies }}</span>
            </template>
            <template v-if="pricePosition"> – {{ pricePosition }}</template>
          </p>
          <WhyNote :label="h.priceWhyLabel">{{ h.priceWhy }}</WhyNote>
        </div>

        <div class="grid gap-8 @md:grid-cols-2 @5xl:grid-cols-3">
          <FacetBars
            :title="h.labelsInStock"
            signal="label"
            :facets="labels"
            :empty="h.noLabels"
          />
          <FacetBars :title="h.decades" signal="gap" :facets="decades" :empty="h.noYears" />
        </div>

        <p v-if="profile.dealer.shippingNote" class="text-fid-sm text-fid-text-muted">
          {{ profile.dealer.shippingNote }}
        </p>
      </section>
    </template>
  </main>
</template>
