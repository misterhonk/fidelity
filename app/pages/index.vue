<script setup lang="ts">
import type { HomeOverview } from '#shared/protocol'

import { since } from '~/utils/when'

useSeoMeta({
  title: 'Start',
  description: 'Fidelity – der Verkäufer hinter der Theke für dein Discogs-Sortiment.',
})

const { call } = useFidelityWorker()
const { checkOnce } = useWatchlist()
const { syncOnStart } = useVaultSync()
const { identity, ready, load } = useIdentity()
const { show } = useReleaseSheet()

/*
 * One message for the whole screen, and `shallowRef` for what comes back:
 * twelve covers times four rails is a lot of objects, and none of them is ever
 * mutated in place — the next load replaces the whole thing (CLAUDE.md).
 */
const home = shallowRef<HomeOverview | null>(null)

onMounted(async () => {
  await load()

  /*
   * Nobody signed in lands here. The setup is three steps — token, collection,
   * and what to do with it — and a bare token field on a dashboard full of
   * empty sections was the first of them with the other two left implied.
   */
  if (!identity.value) {
    await navigateTo('/willkommen')
    return
  }

  // Neither of these is awaited: a shop that is slow to answer and a vault
  // that is unreachable must not hold up the screen. Both report where
  // somebody would look for them, not in front of what they came for.
  void checkOnce()
  void syncOnStart()

  home.value = await call('home.overview', undefined)
})

const number = new Intl.NumberFormat('de-DE')

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
}

const digAge = computed(() => {
  const dig = home.value?.dig
  return dig ? since(dig.startedAt) : null
})

/**
 * Whether the last dig's prices have aged out (CLAUDE.md rule 4).
 *
 * Only worth saying while a refresh is still the sensible answer. After a day
 * the shop has moved on and scanning again is the honest option, so the line
 * goes away rather than nagging forever.
 */
const REFRESH_WORTH_IT_MS = 24 * 60 * 60 * 1000

const pricesGone = computed(() => {
  const dig = home.value?.dig
  if (!dig || (home.value?.finds.length ?? 0) === 0) return false

  const now = Date.now()
  return dig.expiresAt < now && now - dig.startedAt < REFRESH_WORTH_IT_MS
})

/** What is here, and where each of it lives. Ordered as the nav bar is. */
const tiles = computed(() => {
  const summary = home.value?.library
  if (!summary) return []

  return [
    { label: 'Sammlung', count: summary.collection, to: '/regal' },
    { label: 'Wantlist', count: summary.wantlist, to: '/wantlist' },
    { label: 'Gemerkt', count: summary.marked, to: '/gemerkt' },
    { label: 'Läden', count: summary.dealers, to: '/haendler' },
    { label: 'Im Korb', count: summary.basket, to: '/korb' },
  ]
})
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[72rem] flex-col gap-8 py-10">
    <!--
      Signed out there is nothing to draw: the mount redirects to the setup,
      and a dashboard flashing its empty sections on the way there is worse
      than a blank half-second.
    -->
    <template v-if="ready && identity">
      <div class="flex flex-col gap-6 px-6">
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h1 class="fid-display text-fid-xl font-bold text-fid-text">Start</h1>
          <p class="text-fid-sm text-fid-text-muted">{{ identity.username }}</p>
        </header>

        <OfflineNotice />
        <WatchBanner />
        <NextStep />
      </div>

      <!--
        Then the covers.

        Everything above is a sentence or a warning; everything below is the
        collection looking like a collection. A record app whose home screen is
        a list of numbers has buried the only thing on the device worth looking
        at.
      -->
      <template v-if="home">
        <CoverRail
          v-if="home.finds.length > 0 && home.dig"
          title="Zuletzt gefunden"
          to="/dig"
          :note="`${home.dig.dealer} · ${digAge}`"
        >
          <CoverTile
            v-for="(find, index) in home.finds"
            :key="find.listingId"
            :index="index"
            :thumb-url="find.thumbUrl"
            :title="find.title ?? `Release ${find.releaseId}`"
            :subtitle="find.artist"
            :score="find.score"
            :note="money(find.price, find.currency)"
            @open="show(find.digId, find.listingId)"
          />
        </CoverRail>

        <div v-if="home.finds.length > 0" class="flex flex-col gap-2 px-6">
          <p v-if="pricesGone" class="text-fid-sm text-fid-sig-gap">
            Preise älter als sechs Stunden, dürfen nicht mehr gezeigt werden. Treffer und
            Begründungen bleiben.
          </p>

          <!--
            The reasons behind a fold. They are the point of the app and they
            are also five sentences — on a screen meant to be scanned, that is
            a wall. Open once and it is all there.
          -->
          <details class="group">
            <summary
              class="fid-action cursor-pointer list-none gap-2 text-fid-sm text-fid-text-muted hover:text-fid-text"
            >
              Warum diese?
            </summary>
            <ul class="mt-2 flex max-w-prose flex-col gap-2">
              <li
                v-for="find in home.finds.slice(0, 5)"
                :key="find.listingId"
                class="text-fid-sm text-fid-text-muted"
              >
                <span class="fid-num text-fid-text">{{ find.score }}</span>
                · {{ find.reason }}
              </li>
            </ul>
          </details>
        </div>

        <CoverRail
          v-if="home.shelf.length > 0"
          title="Neu im Regal"
          to="/regal"
          :note="`${number.format(home.library.collection)} Platten`"
        >
          <CoverTile
            v-for="(record, index) in home.shelf"
            :key="record.releaseId"
            :index="index"
            :thumb-url="record.thumbUrl"
            :cover-url="record.coverUrl"
            :title="record.title"
            :subtitle="record.artist"
            :note="record.year ? String(record.year) : null"
          />
        </CoverRail>

        <CoverRail
          v-if="home.wanted.length > 0"
          title="Zuletzt notiert"
          to="/wantlist"
          :note="`${number.format(home.library.wantlist)} Wünsche`"
        >
          <CoverTile
            v-for="(record, index) in home.wanted"
            :key="record.releaseId"
            :index="index"
            :thumb-url="record.thumbUrl"
            :cover-url="record.coverUrl"
            :title="record.title"
            :subtitle="record.artist"
            :note="record.year ? String(record.year) : null"
          />
        </CoverRail>

        <!--
          The shops, sorted by how often they actually have something. That is
          what affinity measures and it is the only ordering that answers
          "where should I look next".
        -->
        <section v-if="home.shops.length > 0" class="flex flex-col gap-3 px-6">
          <h2 class="text-fid-base font-medium text-fid-text">
            <NuxtLink to="/haendler" class="underline-offset-4 hover:underline">
              Deine Läden
            </NuxtLink>
          </h2>

          <ul class="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
            <li
              v-for="shop in home.shops"
              :key="shop.username"
              class="flex flex-col gap-1 rounded-fid-md border border-fid-border bg-fid-surface p-4"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="truncate text-fid-sm font-medium text-fid-text">
                  {{ shop.displayName }}
                </span>
                <span v-if="shop.affinity" class="fid-num shrink-0 text-fid-xs text-fid-text">
                  {{ shop.affinity.toFixed(1) }}
                </span>
              </div>
              <p class="fid-num text-fid-xs text-fid-text-muted">
                {{ number.format(shop.numForSale) }} im Angebot<template
                  v-if="shop.lastScannedAt"
                >
                  · {{ since(shop.lastScannedAt) }}</template
                >
              </p>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-3 px-6" aria-labelledby="whats-here">
          <h2 id="whats-here" class="text-fid-base font-medium text-fid-text">
            Was hier liegt
          </h2>
          <!--
            Every one of these numbers names a place, so every one of them goes
            there. They were dead labels next to a nav bar that led to the same
            five screens — a count somebody reads and then has to go find is a
            count that made them do the work twice.
          -->
          <ul class="grid grid-cols-2 gap-2 text-fid-sm @sm:grid-cols-5">
            <li v-for="tile in tiles" :key="tile.to">
              <NuxtLink
                :to="tile.to"
                class="flex min-h-16 flex-col justify-center rounded-fid-sm px-3 py-2 transition-colors hover:bg-fid-surface"
                :aria-label="`${tile.label}: ${number.format(tile.count)}`"
              >
                <span class="text-fid-text-muted">{{ tile.label }}</span>
                <span class="fid-num text-fid-xl text-fid-text" aria-hidden="true">
                  {{ number.format(tile.count) }}
                </span>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </main>
</template>
