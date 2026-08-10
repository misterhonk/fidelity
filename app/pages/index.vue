<script setup lang="ts">
import type { DigWithMatches, LibrarySummary } from '#shared/protocol'

import { since } from '~/utils/when'

useSeoMeta({
  title: 'Start',
  description: 'Fidelity – der Verkäufer hinter der Theke für dein Discogs-Sortiment.',
})

const { call } = useFidelityWorker()
const { checkOnce } = useWatchlist()
const { syncOnStart } = useVaultSync()
const { identity, ready, load, set } = useIdentity()

const library = ref<LibrarySummary | null>(null)
const latest = shallowRef<DigWithMatches | null>(null)

onMounted(async () => {
  await load()
  if (!identity.value) return

  // Neither of these is awaited: a shop that is slow to answer and a vault
  // that is unreachable must not hold up the screen. Both report where
  // somebody would look for them, not in front of what they came for.
  void checkOnce()
  void syncOnStart()

  const [summary, dig] = await Promise.all([
    call('library.summary', undefined),
    call('dig.latest', undefined),
  ])
  library.value = summary
  latest.value = dig
})

const number = new Intl.NumberFormat('de-DE')

const digAge = computed(() => {
  const dig = latest.value?.dig
  return dig ? since(dig.startedAt) : null
})

/** The one number worth putting first: what is waiting for you right now. */
const topHit = computed(() => latest.value?.topFive[0] ?? null)

/**
 * Whether the last dig's prices have aged out (CLAUDE.md rule 4).
 *
 * Only worth saying while a refresh is still the sensible answer. After a day
 * the shop has moved on and scanning again is the honest option, so the line
 * goes away rather than nagging forever.
 */
const REFRESH_WORTH_IT_MS = 24 * 60 * 60 * 1000

const pricesGone = computed(() => {
  const dig = latest.value?.dig
  if (!dig || (latest.value?.matches.length ?? 0) === 0) return false

  const now = Date.now()
  return dig.expiresAt < now && now - dig.startedAt < REFRESH_WORTH_IT_MS
})

/** What is here, and where each of it lives. Ordered as the nav bar is. */
const tiles = computed(() => {
  const summary = library.value
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
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
    <!-- Signed out: nothing but the pitch and the one thing to do. -->
    <template v-if="ready && !identity">
      <header class="flex flex-col gap-3">
        <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Fidelity</h1>
        <p class="text-fid-base text-fid-text-muted">
          Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer.
        </p>
      </header>

      <TokenForm @signed-in="set($event)" />
    </template>

    <template v-else-if="ready && identity">
      <header class="flex flex-wrap items-baseline justify-between gap-2">
        <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Start</h1>
        <p class="text-fid-sm text-fid-text-muted">{{ identity.username }}</p>
      </header>

      <OfflineNotice />
      <WatchBanner />
      <NextStep />

      <!--
        The dashboard answers three questions and stops: what did I find, what
        do I have, what do I do now. Everything that is set up once lives in
        Einstellungen — mixing the two made nine panels of equal weight, and a
        screen where everything looks equally urgent has no answer to "what
        now".
      -->
      <section
        v-if="latest"
        class="flex flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-5"
        aria-labelledby="last-dig"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="last-dig" class="text-fid-base font-medium text-fid-text">
            Letzter Dig · {{ latest.dig.dealer }}
          </h2>
          <span class="text-fid-sm text-fid-text-muted">{{ digAge }}</span>
        </div>

        <p v-if="topHit" class="text-fid-base text-fid-text">
          <span class="fid-num text-fid-xl font-bold">{{ latest.matches.length }}</span>
          Treffer, der beste mit
          <span class="fid-num font-medium">{{ topHit.score }}</span> Punkten:
          <span class="text-fid-text-muted">{{ topHit.artist }} – {{ topHit.title }}</span>
        </p>
        <p v-else class="text-fid-base text-fid-text-muted">
          Nichts dabei. Das ist ein Ergebnis, kein Fehler.
        </p>

        <!--
          Said here because this is where somebody looks before deciding
          whether to open the list at all. The action itself stays on the dig
          screen — two buttons for one thing is a choice nobody needs.
        -->
        <p v-if="pricesGone" class="text-fid-sm text-fid-sig-gap">
          Preise älter als sechs Stunden, dürfen nicht mehr gezeigt werden. Treffer und
          Begründungen bleiben; auffrischen kostet
          <span class="fid-num">{{ latest.matches.length }}</span> Abfragen.
        </p>

        <div class="flex flex-wrap gap-2">
          <NuxtLink
            to="/dig"
            class="rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-n-990"
          >
            Fundliste ansehen
          </NuxtLink>
          <!--
            The in-store mode is reached here because this is where somebody
            decides to go out, not from a nav bar they browse.
          -->
          <NuxtLink
            to="/im-laden"
            class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
          >
            Im Laden öffnen
          </NuxtLink>
        </div>
      </section>

      <section
        v-if="library"
        class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-5"
        aria-labelledby="whats-here"
      >
        <h2 id="whats-here" class="text-fid-base font-medium text-fid-text">Was hier liegt</h2>
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
              <span class="fid-num text-fid-lg text-fid-text" aria-hidden="true">
                {{ number.format(tile.count) }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
