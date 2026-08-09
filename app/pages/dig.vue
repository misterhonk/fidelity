<script setup lang="ts">
import type { DigPreflight, DigWithMatches, ScanProgress } from '#shared/protocol'
import type { Dig } from '#shared/types'

useSeoMeta({
  title: 'Neuer Dig',
  description: 'Einen Discogs-Händler scannen und eine bewertete Fundliste bekommen.',
})

const { call } = useFidelityWorker()

const dealer = ref('')
const preflight = ref<DigPreflight | null>(null)
const progress = ref<ScanProgress | null>(null)
const result = ref<DigWithMatches | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const resumable = ref<Dig | null>(null)

onMounted(async () => {
  // An interrupted dig is offered before anything else: the work is already
  // paid for in requests, and throwing it away to start over would spend the
  // rate limit twice.
  resumable.value = await call('dig.resumable', undefined)
  result.value = await call('dig.latest', undefined)
})

const number = new Intl.NumberFormat('de-DE')

async function check() {
  if (!dealer.value.trim() || busy.value) return
  busy.value = true
  error.value = null
  preflight.value = null

  try {
    preflight.value = await call('dig.preflight', { dealer: dealer.value.trim() })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Händler nicht gefunden.'
  } finally {
    busy.value = false
  }
}

async function resume() {
  const dig = resumable.value
  if (!dig || busy.value) return
  busy.value = true
  error.value = null
  result.value = null

  try {
    await call('dig.resume', { digId: dig.id }, { onProgress: (p) => (progress.value = p) })
    resumable.value = null
    result.value = await call('dig.latest', undefined)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Fortsetzen fehlgeschlagen.'
    resumable.value = await call('dig.resumable', undefined)
  } finally {
    busy.value = false
    progress.value = null
  }
}

async function start() {
  if (!preflight.value || busy.value) return
  busy.value = true
  error.value = null
  result.value = null
  progress.value = null

  try {
    await call(
      'dig.run',
      { dealer: preflight.value.dealer },
      { onProgress: (p) => (progress.value = p) },
    )
    resumable.value = null
    result.value = await call('dig.latest', undefined)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Der Dig ist fehlgeschlagen.'
    // A failed run usually means an interrupted one, so ask again what can be
    // continued rather than leaving a stale offer on screen.
    resumable.value = await call('dig.resumable', undefined)
  } finally {
    busy.value = false
    progress.value = null
  }
}

/** Determinate progress with real numbers — never a bare spinner. */
const percent = computed(() => {
  const p = progress.value
  if (!p || p.reachable === 0) return 0
  return Math.min(100, Math.round((p.scanned / p.reachable) * 100))
})

const eta = computed(() => {
  const ms = progress.value?.etaMs ?? null
  if (ms === null) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})

const expired = computed(() => {
  const dig = result.value?.dig
  return dig ? Date.now() > dig.expiresAt : false
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <NuxtLink class="text-fid-sm text-fid-text-muted underline underline-offset-4" to="/">
        ← Championship
      </NuxtLink>
      <h1 class="text-fid-2xl font-bold text-fid-text">Neuer Dig</h1>
    </div>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="check">
      <div class="flex min-w-64 grow flex-col gap-2">
        <label class="text-fid-sm font-medium text-fid-text" for="dealer">Händlername</label>
        <input
          id="dealer"
          v-model="dealer"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="z. B. juno_records"
          class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || dealer.trim().length === 0"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      >
        Prüfen
      </button>
    </form>

    <p v-if="error" role="alert" class="text-fid-sm text-fid-sig-scarcity">{{ error }}</p>

    <!--
      An interrupted run is picked up, not restarted. Those pages already cost
      requests, and the rate limit is the only genuinely scarce resource here.
    -->
    <section
      v-if="resumable && !progress"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
    >
      <p class="text-fid-base text-fid-text">
        Ein Dig bei <span class="font-medium">{{ resumable.dealer }}</span> wurde unterbrochen –
        <span class="fid-num">{{ number.format(resumable.listingsScanned) }}</span> von
        <span class="fid-num">{{ number.format(resumable.listingsTotal) }}</span> waren durch.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
        @click="resume"
      >
        Dig fortsetzen
      </button>
    </section>

    <!--
      Coverage is stated before the scan, not discovered at page 101. Discogs
      hands out at most 10.000 listings per sort order, so 20.000 in total.
    -->
    <section
      v-if="preflight && !progress"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
    >
      <p class="text-fid-base text-fid-text">
        <span class="font-medium">{{ preflight.displayName }}</span> hat
        <span class="fid-num">{{ number.format(preflight.numForSale) }}</span> Listings.
      </p>
      <p v-if="preflight.truncated" class="text-fid-sm text-fid-sig-gap">
        Die API gibt davon höchstens
        <span class="fid-num">{{ number.format(preflight.reachable) }}</span> heraus – das sind
        {{ Math.round((preflight.reachable / preflight.numForSale) * 100) }} %. Vollständig geht
        nicht, und das sagen wir lieber vorher.
      </p>
      <p class="text-fid-sm text-fid-text-muted">
        Dauer etwa
        {{ Math.ceil((preflight.reachable / 100) * 1.2) }} Sekunden bei einem Request pro 1,2
        Sekunden.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
        @click="start"
      >
        Dig starten
      </button>
    </section>

    <section v-if="progress" class="flex flex-col gap-2" aria-live="polite">
      <div class="h-2 w-full overflow-hidden rounded-full bg-fid-n-800">
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <p class="text-fid-sm text-fid-text-muted">
        <span class="fid-num">{{ number.format(progress.scanned) }}</span> von
        <span class="fid-num">{{ number.format(progress.reachable) }}</span> ·
        <span class="fid-num">{{ progress.matches }}</span> Treffer
        <template v-if="eta"> · noch ca. {{ eta }}</template>
      </p>
    </section>

    <section v-if="result" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-fid-xl font-bold text-fid-text">
          {{ result.matches.length }} Treffer bei {{ result.dig.dealer }}
        </h2>
        <p class="text-fid-sm text-fid-text-muted">
          <span class="fid-num">{{ number.format(result.dig.listingsScanned) }}</span> von
          <span class="fid-num">{{ number.format(result.dig.listingsTotal) }}</span> gescannt
          ({{ Math.round(result.dig.coverage * 100) }} %)
        </p>
      </div>

      <!-- The ToS deadline, enforced in the UI and not only in the cleanup job. -->
      <p
        v-if="expired"
        role="status"
        class="rounded-fid-sm border border-fid-border p-3 text-fid-sm text-fid-text-muted"
      >
        Dieser Snapshot ist älter als sechs Stunden. Preise und Zustände dürfen nicht mehr
        angezeigt werden – scanne neu.
      </p>

      <p v-if="result.matches.length === 0" class="text-fid-base text-fid-text-muted">
        Bei diesem Händler nichts für dich. Das ist ein Ergebnis, kein Fehler.
      </p>

      <ul v-else class="flex flex-col gap-3">
        <li v-for="match in result.matches" :key="match.listingId">
          <MatchCard :match="match" />
        </li>
      </ul>
    </section>
  </main>
</template>
