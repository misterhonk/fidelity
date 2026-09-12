<script setup lang="ts">
import { ORIGIN_FILTERS, passesOrigin, readOrigin, type OriginFilter } from '#shared/countries'
import type { DealerProfile } from '#shared/protocol'
import type { Dealer, GradingRecord, TasteFacet } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

const h = useDealerMessages()
useSeoMeta({
  title: () => h.value.title,
  description: () => h.value.description,
})

const { call } = useFidelityWorker()
const { isWatched, toggle, load: loadWatchlist } = useWatchlist()
const {
  state: push,
  busy: pushBusy,
  refresh: refreshPush,
  enable: enablePush,
  disable: disablePush,
} = usePush()
const route = useRoute()

const dealers = shallowRef<Dealer[]>([])

/*
 * "Only from Germany / the EU" (M20 #2), on the chips. A view, in the
 * address; the block list in the preferences stays the hard rule. Your
 * country comes from the preferences, the same field the postage uses.
 */
const home = ref('')
const router = useRouter()
const origin = computed(() => readOrigin(route.query.from))
function originBy(key: OriginFilter) {
  void router.replace({ query: { ...route.query, from: key === 'any' ? undefined : key } })
}
const shown = computed(() =>
  dealers.value.filter((dealer) => passesOrigin(dealer.shipsFrom, origin.value, home.value)),
)
/** The shops somebody asked never to see again — listed at the foot, so they can come back. */
const hidden = shallowRef<Dealer[]>([])
const selected = ref<string | null>(null)
const profile = ref<DealerProfile | null>(null)

/**
 * How honestly this shop grades — out of your own purchases (M14).
 *
 * Costs no request: the number is in this device's `feedback` store. Loaded
 * separately from the profile, because it has nothing to do with Discogs — the
 * profile comes from the server, this from your own past.
 */
const grading = ref<GradingRecord | null>(null)
const error = ref<unknown>(null)

async function load() {
  dealers.value = await call('dealer.list', undefined)
  hidden.value = await call('dealer.hidden', undefined)
  home.value = (await call('preferences.get', undefined)).shipsToCountry
  const first = dealers.value[0]
  /*
   * ?dealer= comes from the start page.
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
  try {
    await load()
    await loadWatchlist()
  } catch (cause) {
    error.value = cause
  }

  /*
   * Deliberately last and deliberately not awaited: it asks the hub whether
   * push is possible at all, and a hub that is slow must not hold up the list
   * of shops. Asking, not prompting — the permission dialog only ever comes
   * from the button.
   */
  void refreshPush()
})

async function select(username: string) {
  selected.value = username
  grading.value = null
  error.value = null
  try {
    profile.value = await call('dealer.profile', { dealer: username })
    grading.value = await call('grading.forDealer', { dealer: username })
  } catch (cause) {
    error.value = cause
    return
  }

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

/**
 * "Never show this one again", and its undoing.
 *
 * The worker answers with both lists, so the shop moves from one to the other
 * in the same breath. Hiding the shop that is open closes its profile and
 * opens the next one — a profile of a shop that is no longer on the list would
 * be the screen contradicting itself.
 */
async function setHidden(username: string, hide: boolean) {
  error.value = null
  try {
    const lists = await call('dealer.hide', { dealer: username, hidden: hide })
    dealers.value = lists.visible
    hidden.value = lists.hidden
  } catch (cause) {
    error.value = cause
    return
  }

  if (hide && selected.value === username) {
    selected.value = null
    profile.value = null
    grading.value = null
    const next = dealers.value[0]
    if (next) await select(next.username)
  } else if (!hide) {
    await select(username)
  }
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

/**
 * Which bar is currently open.
 *
 * One only, not several: two open lists side by side are two questions at
 * once, and the second pushes the first off the screen anyway.
 */
const browsing = ref<{ title: string; label?: string; decade?: number } | null>(null)

/**
 * `"1990s"` back into `1990`.
 *
 * The fingerprint writes the decade as a word, because there it sits on a bar;
 * it is stored as a number, because that is what gets searched. The reverse
 * belongs here and not in both.
 */
const decadeOf = (name: string) => Number.parseInt(name, 10)

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
  <AppPage>
    <PageHeader :title="h.title" :lead="h.lead" />

    <!--
      The shops Discogs already knows you deal with — which beats typing a
      username from memory and getting the underscore wrong.
    -->
    <ErrorNote v-if="error" :cause="error" />

    <DealerDiscovery :first-time="dealers.length === 0" @imported="load()" />

    <p v-if="dealers.length === 0" class="text-fid-base text-fid-text-muted">
      {{ h.none }}
    </p>

    <template v-else>
      <div role="group" :aria-label="h.origin.label" class="flex flex-wrap gap-1">
        <button
          v-for="key in ORIGIN_FILTERS"
          :key="key"
          type="button"
          class="fid-action min-h-11 rounded-fid-sm border px-3 text-fid-xs"
          :class="
            origin === key
              ? 'border-fid-text bg-fid-inset text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="origin === key"
          @click="originBy(key)"
        >
          {{ key === 'home' ? h.origin.home(home) : h.origin[key] }}
        </button>
      </div>

      <p v-if="shown.length === 0" class="text-fid-sm text-fid-text-muted">
        {{ h.origin.none }}
      </p>

      <!-- Ranked by hit rate: the only ordering that answers "wo zuerst?". -->
      <nav v-else class="flex flex-wrap gap-2" :aria-label="h.scanned">
        <button
          v-for="dealer in shown"
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
          <!-- A shop is a place, not a string. -->
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
            And directly below it, the number Discogs does not keep.

            Above the row sits the seller rating: that measures the process —
            shipped quickly, packed properly — and says nothing about whether
            the grade was right. Which is exactly why this row is here and not
            in a section of its own: side by side you read the difference; one
            above the other they would never meet.

            The promised grade is in none of these numbers. What is stored is
            only the comparison (worker/grading.ts).
          -->
          <div v-if="grading && grading.judged > 0" class="flex flex-col gap-1">
            <p class="fid-num text-fid-sm text-fid-text">
              <template v-if="grading.rate !== null">
                {{
                  h.grading.rate(`${Math.round(grading.rate * 100)} %`, count(grading.judged))
                }}
              </template>
              <template v-else>
                {{ h.grading.tooFew(count(grading.judged), grading.judged === 1) }}
              </template>
              <template v-if="grading.worse > 0">
                {{ h.grading.worse(count(grading.worse), grading.worse === 1) }}
              </template>
            </p>
            <WhyNote :label="h.grading.whyLabel">{{ h.grading.why }}</WhyNote>
          </div>

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
            <button
              type="button"
              class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
              :title="h.hideWhy"
              @click="setHidden(profile.dealer.username, true)"
            >
              {{ h.hide }}
            </button>
            <span class="text-fid-xs text-fid-text-muted">{{ h.watchCost }}</span>
          </div>

          <!--
            And the part a browser cannot do alone.
            Only shown for a shop that is actually watched, and only where it
            can work: no hub, no support, or a refusal in the browser settings
            and there is nothing here at all — rather than a switch that would
            promise something nobody can keep (rule 8).
          -->
          <div
            v-if="
              isWatched(profile.dealer.username) &&
              push !== 'no-hub' &&
              push !== 'unsupported' &&
              push !== 'denied'
            "
            class="flex flex-wrap items-center gap-3"
          >
            <button
              v-if="push === 'off'"
              type="button"
              :disabled="pushBusy"
              class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text disabled:opacity-60"
              @click="enablePush()"
            >
              {{ h.pushOffer }}
            </button>
            <template v-else-if="push === 'on'">
              <span class="text-fid-sm text-fid-text">{{ h.pushOn }}</span>
              <button
                type="button"
                :disabled="pushBusy"
                class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4 disabled:opacity-60"
                @click="disablePush()"
              >
                {{ h.pushStop }}
              </button>
            </template>
            <span class="text-fid-xs text-fid-text-muted">
              {{ push === 'needs-install' ? h.pushInstall : h.pushWhy }}
            </span>
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
            :open="(facet) => (browsing = { title: facet.name, label: facet.name })"
          />
          <FacetBars
            :title="h.decades"
            signal="gap"
            :facets="decades"
            :empty="h.noYears"
            :open="(facet) => (browsing = { title: facet.name, decade: decadeOf(facet.name) })"
          />
        </div>

        <!--
          What is behind a bar, underneath the bars. No screen of its own and
          no dialog: the number above is the context, and somebody going
          through a row of labels does not want to navigate back after each
          one.
        -->
        <DealerStock
          v-if="browsing"
          :key="browsing.title"
          :dealer="profile.dealer.username"
          :title="browsing.title"
          :label="browsing.label ?? null"
          :decade="browsing.decade ?? null"
          @close="browsing = null"
        />

        <p v-if="profile.dealer.shippingNote" class="text-fid-sm text-fid-text-muted">
          {{ profile.dealer.shippingNote }}
        </p>
      </section>
    </template>

    <!--
      The hidden ones, at the foot and only when there are any. Outside the
      `v-else` above on purpose: hiding the last shop must not take the one
      place it can be brought back from with it.
    -->
    <section
      v-if="hidden.length > 0"
      class="flex flex-col gap-2"
      :aria-label="h.hidden.title(hidden.length)"
    >
      <h2 class="text-fid-sm font-medium text-fid-text-muted">
        {{ h.hidden.title(hidden.length) }}
      </h2>
      <p class="text-fid-xs text-fid-text-muted">{{ h.hideWhy }}</p>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="shop in hidden"
          :key="shop.username"
          class="flex items-center gap-2 rounded-fid-sm border border-fid-border py-1 pr-1 pl-3 text-fid-sm text-fid-text-muted"
        >
          {{ shop.displayName || shop.username }}
          <button
            type="button"
            class="fid-action rounded-fid-sm px-2 py-1 text-fid-xs text-fid-text underline underline-offset-4"
            @click="setHidden(shop.username, false)"
          >
            {{ h.hidden.restore }}
          </button>
        </li>
      </ul>
    </section>
  </AppPage>
</template>
