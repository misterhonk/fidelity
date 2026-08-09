<script setup lang="ts">
import type { HorizonProgress, HorizonStatus } from '#shared/protocol'

const { call } = useFidelityWorker()

const status = ref<HorizonStatus | null>(null)
const progress = ref<HorizonProgress | null>(null)
const running = ref(false)
const error = ref<string | null>(null)

async function refresh() {
  status.value = await call('horizon.status', undefined)
}

const stale = ref(0)

onMounted(async () => {
  await refresh()

  /*
   * The staggered revalidation (docs/11 §3).
   *
   * Runs on opening rather than on a schedule: there is no server to schedule
   * anything, and a visit is exactly when spending somebody's rate limit is
   * least in the way. It takes a day's worth — about twenty requests, oldest
   * first — and refuses to run twice in one day however often the app is
   * opened. Entities that were never expanded stay out of it; those belong to
   * the deliberate build below.
   */
  try {
    const result = await call('horizon.revalidate', undefined)
    stale.value = result.stale
    if (result.expanded > 0) await refresh()
  } catch {
    // A stale horizon is still a horizon.
  }
})

async function build() {
  if (running.value) return
  running.value = true
  error.value = null

  try {
    await call('horizon.build', undefined, { onProgress: (p) => (progress.value = p) })
    await refresh()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Der Horizont konnte nicht gebaut werden.'
    // Whatever was expanded before the interruption is kept; refreshing shows
    // how far it got.
    await refresh()
  } finally {
    running.value = false
    progress.value = null
  }
}

const number = new Intl.NumberFormat('de-DE')

const percent = computed(() => {
  const p = progress.value
  if (!p || p.total === 0) return 0
  return Math.round((p.done / p.total) * 100)
})

const eta = computed(() => {
  const ms = progress.value?.etaMs
  if (ms === undefined) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})

const staleNote = computed(() =>
  stale.value > 0
    ? `${number.format(stale.value)} ${stale.value === 1 ? 'Eintrag ist' : 'Einträge sind'} älter als 30 Tage. Die werden nach und nach aufgefrischt, ein kleines Kontingent pro Tag.`
    : null,
)

const complete = computed(
  () => status.value !== null && status.value.expanded >= status.value.entities,
)
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="horizon-heading">
    <h2 id="horizon-heading" class="text-fid-xl font-bold text-fid-text">Der Horizont</h2>

    <p class="max-w-prose text-fid-base text-fid-text-muted">
      Statt jedes Inventar-Listing einzeln nachzuschlagen, wird einmal deine Sammlung
      ausgeklappt: alle Platten deiner Künstler, deiner Labels und jede Pressung deiner
      Wantlist-Alben. Danach kostet jeder Dig dafür
      <span class="text-fid-text">null zusätzliche Requests</span>.
    </p>

    <dl v-if="status" class="grid grid-cols-2 gap-x-6 gap-y-2 text-fid-sm">
      <dt class="text-fid-text-muted">Entitäten</dt>
      <dd class="fid-num text-fid-text">{{ status.expanded }} von {{ status.entities }}</dd>
      <dt class="text-fid-text-muted">Bekannte Release-IDs</dt>
      <dd class="fid-num text-fid-text">{{ number.format(status.releaseIds) }}</dd>
    </dl>

    <!-- Minutes, not seconds. The only honest thing to show is what it costs. -->
    <p v-if="!complete && status && !running" class="text-fid-sm text-fid-text-muted">
      Noch etwa <span class="fid-num">{{ status.estimatedRequests }}</span> Requests, also rund
      {{ Math.ceil((status.estimatedRequests * 1.2) / 60) }} Minuten. Läuft in Häppchen und
      übersteht ein Neuladen – abgeschlossene Entitäten werden nicht noch einmal geholt.
    </p>

    <p v-if="staleNote && !running" class="text-fid-sm text-fid-text-muted">
      {{ staleNote }}
    </p>

    <div v-if="progress" class="flex flex-col gap-2" aria-live="polite">
      <div class="h-2 w-full overflow-hidden rounded-full bg-fid-n-800">
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <p class="text-fid-sm text-fid-text-muted">
        <span class="fid-num">{{ progress.done }}</span> von
        <span class="fid-num">{{ progress.total }}</span>
        <template v-if="progress.current"> · {{ progress.current }}</template>
        · <span class="fid-num">{{ number.format(progress.releaseIds) }}</span> IDs
        <template v-if="eta"> · noch ca. {{ eta }}</template>
      </p>
    </div>

    <p v-if="error" role="alert" class="text-fid-sm text-fid-sig-scarcity">{{ error }}</p>

    <button
      type="button"
      :disabled="running"
      class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      @click="build"
    >
      {{ complete ? 'Horizont auffrischen' : 'Horizont bauen' }}
    </button>
  </section>
</template>
