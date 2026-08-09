<script setup lang="ts">
import type { DigWithMatches, LibrarySummary } from '#shared/protocol'

useSeoMeta({
  title: 'Championship',
  description: 'Fidelity – der Verkäufer hinter der Theke für dein Discogs-Sortiment.',
})

const { call } = useFidelityWorker()
const { checkOnce } = useWatchlist()
const { identity, ready, load, set } = useIdentity()

const library = ref<LibrarySummary | null>(null)
const latest = shallowRef<DigWithMatches | null>(null)

onMounted(async () => {
  await load()
  if (!identity.value) return

  // The watchlist check is deliberately not awaited: a shop that is slow to
  // answer must not hold up the screen.
  void checkOnce()

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
  if (!dig) return null
  const hours = Math.floor((Date.now() - dig.startedAt) / 3_600_000)
  if (hours < 1) return 'gerade eben'
  if (hours < 24) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`
  const days = Math.floor(hours / 24)
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`
})

/** The one number worth putting first: what is waiting for you right now. */
const topHit = computed(() => latest.value?.topFive[0] ?? null)
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
    <!-- Signed out: nothing but the pitch and the one thing to do. -->
    <template v-if="ready && !identity">
      <header class="flex flex-col gap-3">
        <p class="text-fid-xs uppercase tracking-[0.2em] text-fid-text-muted">Championship</p>
        <h1 class="text-fid-2xl font-bold text-fid-text">Fidelity</h1>
        <p class="text-fid-base text-fid-text-muted">
          Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer.
        </p>
      </header>

      <TokenForm @signed-in="set($event)" />
    </template>

    <template v-else-if="ready && identity">
      <header class="flex flex-wrap items-baseline justify-between gap-2">
        <h1 class="text-fid-2xl font-bold text-fid-text">Championship</h1>
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
        <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-fid-sm @sm:grid-cols-4">
          <div class="flex flex-col">
            <dt class="text-fid-text-muted">Sammlung</dt>
            <dd class="fid-num text-fid-lg text-fid-text">
              {{ number.format(library.collection) }}
            </dd>
          </div>
          <div class="flex flex-col">
            <dt class="text-fid-text-muted">Wantlist</dt>
            <dd class="fid-num text-fid-lg text-fid-text">
              {{ number.format(library.wantlist) }}
            </dd>
          </div>
          <div class="flex flex-col">
            <dt class="text-fid-text-muted">Läden</dt>
            <dd class="fid-num text-fid-lg text-fid-text">
              {{ number.format(library.dealers) }}
            </dd>
          </div>
          <div class="flex flex-col">
            <dt class="text-fid-text-muted">Im Korb</dt>
            <dd class="fid-num text-fid-lg text-fid-text">
              {{ number.format(library.basket) }}
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </main>
</template>
