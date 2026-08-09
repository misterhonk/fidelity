<script setup lang="ts">
import type { Identity } from '#shared/types'

useSeoMeta({
  title: 'Championship',
  description: 'Fidelity – der Verkäufer hinter der Theke für dein Discogs-Sortiment.',
})

const { call } = useFidelityWorker()
const { checkOnce } = useWatchlist()

const identity = ref<Identity | null>(null)
const ready = ref(false)

onMounted(async () => {
  try {
    identity.value = await call('auth.identity', undefined)
  } finally {
    ready.value = true
  }

  // The watchlist check, deliberately not awaited: a shop that is slow to
  // answer must not hold up the screen. There is no nightly job because there
  // is no night — a browser does not run while it is closed.
  if (identity.value) void checkOnce()
})

async function signOut() {
  await call('auth.signOut', undefined)
  identity.value = null
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <p class="text-fid-xs uppercase tracking-[0.2em] text-fid-text-muted">Championship</p>
      <h1 class="text-fid-2xl font-bold text-fid-text">Fidelity</h1>
      <p class="text-fid-base text-fid-text-muted">
        Ein Händler rein, eine bewertete Fundliste raus – mit Begründung pro Treffer.
      </p>
    </div>

    <!-- Nothing is rendered before the worker has answered: flashing the token
         form at someone who is already signed in reads as a session loss. -->
    <template v-if="ready">
      <TokenForm v-if="!identity" @signed-in="identity = $event" />

      <template v-else>
        <OfflineNotice />
        <WatchBanner />

        <LibrarySync />

        <div class="border-t border-fid-border pt-6">
          <HorizonBuild />
        </div>

        <div class="border-t border-fid-border pt-6">
          <CreditHarvest />
        </div>

        <div class="border-t border-fid-border pt-6">
          <DataControls @deleted="identity = null" />
        </div>

        <section class="flex flex-col gap-3 border-t border-fid-border pt-6">
          <p class="text-fid-sm text-fid-text-muted">
            Angemeldet als <span class="text-fid-text">{{ identity.username }}</span
            >. Alles liegt auf diesem Gerät.
          </p>
          <button
            type="button"
            class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
            @click="signOut"
          >
            Abmelden und alle Daten löschen
          </button>
        </section>
      </template>
    </template>
  </main>
</template>
