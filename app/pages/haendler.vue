<script setup lang="ts">
import type { DealerProfile } from '#shared/protocol'
import type { Dealer, TasteFacet } from '#shared/types'

useSeoMeta({
  title: 'Läden',
  description: 'Was ein Händler eigentlich führt – und wie gut er zu dir passt.',
})

const { call } = useFidelityWorker()
const { isWatched, toggle, load: loadWatchlist } = useWatchlist()

const dealers = shallowRef<Dealer[]>([])
const selected = ref<string | null>(null)
const profile = ref<DealerProfile | null>(null)

async function load() {
  dealers.value = await call('dealer.list', undefined)
  const first = dealers.value[0]
  if (first && !selected.value) await select(first.username)
}

onMounted(async () => {
  await load()
  await loadWatchlist()
})

async function select(username: string) {
  selected.value = username
  profile.value = await call('dealer.profile', { dealer: username })
}

const number = new Intl.NumberFormat('de-DE')
const rateFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const factorFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function money(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
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

  const rate = rateFormat.format(p.rate)
  if (p.factor === null) {
    return `${rate} Treffer je tausend Listings. Sobald du einen zweiten Händler gescannt hast, steht hier, wie sich das vergleicht.`
  }

  const factor = factorFormat.format(p.factor)
  if (p.factor >= 1.5)
    return `${rate} Treffer je tausend – das ${factor}-Fache deiner übrigen Läden.`
  if (p.factor >= 0.8)
    return `${rate} Treffer je tausend – etwa so viel wie deine übrigen Läden.`
  return `${rate} Treffer je tausend – nur das ${factor}-Fache deiner übrigen Läden.`
})

const pricePosition = computed(() => {
  const factor = profile.value?.priceFactor
  if (factor === null || factor === undefined) return null
  if (factor >= 1.25) return 'am oberen Ende deiner Händler'
  if (factor <= 0.8) return 'am unteren Ende deiner Händler'
  return 'im Mittelfeld deiner Händler'
})

const scanned = computed(() => {
  const at = profile.value?.dealer.lastScannedAt
  return at ? new Date(at).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : null
})
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[80rem] flex-col gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Läden</h1>
      <p class="text-fid-base text-fid-text-muted">
        Was ein Laden eigentlich führt – und wie gut er zu dir passt.
      </p>
    </div>

    <!--
      The shops Discogs already knows you deal with — which beats typing a
      username from memory and getting the underscore wrong.
    -->
    <DealerDiscovery @imported="load()" />

    <p v-if="dealers.length === 0" class="text-fid-base text-fid-text-muted">
      Noch keinen Händler gescannt. Das hier füllt sich mit dem ersten Dig.
    </p>

    <template v-else>
      <!-- Ranked by hit rate: the only ordering that answers "wo zuerst?". -->
      <nav class="flex flex-wrap gap-2" aria-label="Gescannte Händler">
        <button
          v-for="dealer in dealers"
          :key="dealer.username"
          type="button"
          class="rounded-fid-sm border px-3 py-1.5 text-fid-sm transition-colors"
          :class="
            dealer.username === selected
              ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          @click="select(dealer.username)"
        >
          {{ dealer.displayName || dealer.username }}
        </button>
      </nav>

      <section v-if="profile" class="flex flex-col gap-8">
        <div class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4">
          <p v-if="profile.dealer.lastScannedAt === null" class="text-fid-lg text-fid-text">
            Diesen Laden kenne ich nur vom Namen – gescannt wurde er noch nicht.
          </p>
          <p v-else class="text-fid-lg text-fid-text">{{ verdict }}</p>
          <p class="text-fid-sm text-fid-text-muted">
            <span class="fid-num">{{ number.format(profile.dealer.numForSale) }}</span> Listings
            <template v-if="profile.dealer.shipsFrom">
              · aus {{ profile.dealer.shipsFrom }}</template
            >
            <template v-if="profile.dealer.ratingCount > 0">
              · <span class="fid-num">{{ profile.dealer.sellerRating }} %</span> bei
              <span class="fid-num">{{ number.format(profile.dealer.ratingCount) }}</span>
              Bewertungen
            </template>
            <template v-if="scanned"> · zuletzt gescannt am {{ scanned }}</template>
          </p>

          <!--
            Watching costs one request per app start, not a rescan. Worth
            saying, because "beobachten" usually means somebody is polling.
          -->
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              :aria-pressed="isWatched(profile.dealer.username)"
              class="rounded-fid-sm border px-3 py-1.5 text-fid-sm transition-colors"
              :class="
                isWatched(profile.dealer.username)
                  ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                  : 'border-fid-border text-fid-text-muted hover:text-fid-text'
              "
              @click="toggle(profile.dealer.username)"
            >
              {{ isWatched(profile.dealer.username) ? 'Wird beobachtet' : 'Händler merken' }}
            </button>
            <!--
              The shop with the best hit rate sits at the top of this list, and
              until now there was nothing to do about it from here. Ranking
              shops and then making somebody retype the name is the ranking
              doing half its job.
            -->
            <NuxtLink
              :to="`/dig?dealer=${encodeURIComponent(profile.dealer.username)}`"
              class="fid-action rounded-fid-sm border border-fid-border px-3 py-1.5 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
            >
              {{ profile.dealer.lastScannedAt === null ? 'Jetzt graben' : 'Nochmal graben' }}
            </NuxtLink>
            <span class="text-fid-xs text-fid-text-muted">
              Beim Öffnen der App wird nachgesehen, ob sich das Sortiment bewegt hat – eine
              einzige Abfrage, kein neuer Scan.
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
          Aus
          <span class="fid-num">{{
            number.format(profile.dealer.fingerprint.sampledItems)
          }}</span>
          von
          <span class="fid-num">{{
            number.format(profile.dealer.fingerprint.totalItems)
          }}</span>
          Listings – {{ Math.round(profile.dealer.fingerprint.coverage * 100) }} % des Ladens.
        </p>

        <div
          v-if="profile.dealer.fingerprint && profile.dealer.fingerprint.medianPrice > 0"
          class="flex flex-col gap-1"
        >
          <h2 class="text-fid-sm font-medium text-fid-text">Preislage</h2>
          <p class="text-fid-base text-fid-text">
            Median
            <span class="fid-num">{{ money(profile.dealer.fingerprint.medianPrice) }}</span>
            <template v-if="pricePosition"> – {{ pricePosition }}</template>
          </p>
          <WhyNote label="Womit verglichen wird">
            Nur gegen deine eigenen Händler. Was der Markt insgesamt aufruft, kann diese App
            nicht sehen, und sie behauptet es deshalb auch nicht.
          </WhyNote>
        </div>

        <div class="grid gap-8 @md:grid-cols-2 @5xl:grid-cols-3">
          <FacetBars
            title="Labels im Regal"
            signal="label"
            :facets="labels"
            empty="Keine Labelangaben im Sortiment."
          />
          <FacetBars
            title="Dekaden"
            signal="gap"
            :facets="decades"
            empty="Keine Jahresangaben im Sortiment."
          />
        </div>

        <p v-if="profile.dealer.shippingNote" class="text-fid-sm text-fid-text-muted">
          {{ profile.dealer.shippingNote }}
        </p>
      </section>
    </template>
  </main>
</template>
