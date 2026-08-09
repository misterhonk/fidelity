<script setup lang="ts">
import type { CreditStatus, HarvestProgress } from '#shared/protocol'

const { call } = useFidelityWorker()

const status = ref<CreditStatus | null>(null)
const progress = ref<HarvestProgress | null>(null)
const running = ref(false)
const error = ref<string | null>(null)

async function refresh() {
  status.value = await call('credits.status', undefined)
}

onMounted(refresh)

async function harvest() {
  if (running.value) return
  running.value = true
  error.value = null

  try {
    await call('credits.harvest', {}, { onProgress: (p) => (progress.value = p) })
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Die Credits konnten nicht gelesen werden.'
  } finally {
    // Whatever was read before an interruption is kept — the next run picks up
    // where this one stopped.
    await refresh()
    running.value = false
    progress.value = null
  }
}

const number = new Intl.NumberFormat('de-DE')

const remaining = computed(() =>
  status.value ? Math.max(0, status.value.favourites - status.value.harvested) : 0,
)

const minutes = computed(() => Math.ceil((remaining.value * 1.2) / 60))

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
</script>

<template>
  <section v-if="status" class="flex flex-col gap-4" aria-labelledby="credits-harvest">
    <h2 id="credits-harvest" class="text-fid-xl font-bold text-fid-text">
      Wer deine Platten gemacht hat
    </h2>

    <p class="text-fid-base text-fid-text-muted">
      Discogs' größter ungenutzter Schatz sind die Credits – wer produziert, gemischt, gemastert
      hat. Sie stehen nur in der Einzelabfrage pro Platte, und deine ganze Sammlung durchzugehen
      wäre stundenlang. Deshalb nur die Platten, die dir am meisten bedeuten:
      <span class="fid-num">4</span> und <span class="fid-num">5</span> Sterne.
    </p>

    <p v-if="error" role="alert" class="text-fid-sm text-fid-sig-scarcity">{{ error }}</p>

    <p v-if="status.favourites === 0" class="text-fid-sm text-fid-text-muted">
      Du hast noch keine Platte mit vier oder fünf Sternen bewertet. Bewerte deine
      Lieblingsplatten bei Discogs, dann weiß ich, wo ich nachsehen soll.
    </p>

    <template v-else>
      <p class="text-fid-sm text-fid-text-muted">
        <span class="fid-num">{{ number.format(status.harvested) }}</span> von
        <span class="fid-num">{{ number.format(status.favourites) }}</span> Lieblingsplatten
        gelesen<template v-if="status.worthExpanding > 0">
          · <span class="fid-num">{{ status.worthExpanding }}</span>
          {{ status.worthExpanding === 1 ? 'Person' : 'Personen' }} tauchen oft genug auf, um in
          den Horizont zu wandern</template
        >.
      </p>

      <!-- The cost is stated before it is spent, never after. -->
      <p v-if="remaining > 0 && !running" class="text-fid-sm text-fid-text-muted">
        Noch <span class="fid-num">{{ number.format(remaining) }}</span> Platten, also
        <span class="fid-num">{{ number.format(remaining) }}</span> Requests – rund
        {{ minutes }} {{ minutes === 1 ? 'Minute' : 'Minuten' }}. Läuft in Häppchen und
        übersteht ein Neuladen.
      </p>

      <div v-if="progress" class="flex flex-col gap-2" aria-live="polite">
        <div class="h-2 w-full overflow-hidden rounded-full bg-fid-n-800">
          <div
            class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
            :style="{ width: `${percent}%` }"
          />
        </div>
        <p class="text-fid-sm text-fid-text-muted">
          <span class="fid-num">{{ number.format(progress.done) }}</span> von
          <span class="fid-num">{{ number.format(progress.total) }}</span> ·
          <span class="fid-num">{{ number.format(progress.people) }}</span> Personen
          <template v-if="progress.current"> · {{ progress.current }}</template>
          <template v-if="eta"> · noch ca. {{ eta }}</template>
        </p>
      </div>

      <!--
        Who turned up. Worth showing even below the expansion threshold: it is
        the answer to "wer steckt eigentlich hinter meiner Sammlung", which is
        interesting on its own.
      -->
      <ul v-if="status.people.length > 0 && !running" class="flex flex-col gap-1">
        <li
          v-for="person in status.people"
          :key="person.entityId"
          class="flex items-baseline gap-3 text-fid-sm"
        >
          <span class="fid-num w-8 shrink-0 text-right text-fid-text">
            {{ person.appearances }}
          </span>
          <span class="min-w-0 grow truncate text-fid-text">{{ person.name }}</span>
          <span class="shrink-0 truncate text-fid-xs text-fid-text-muted">
            {{ person.roles.slice(0, 2).join(', ') }}
          </span>
        </li>
      </ul>

      <button
        v-if="remaining > 0"
        type="button"
        :disabled="running"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
        @click="harvest"
      >
        {{ status.harvested > 0 ? 'Weiterlesen' : 'Credits lesen' }}
      </button>
    </template>
  </section>
</template>
