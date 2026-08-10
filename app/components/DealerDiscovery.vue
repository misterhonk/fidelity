<script setup lang="ts">
import type { DealerCandidate } from '#shared/types'

const emit = defineEmits<{ imported: [] }>()

const { call } = useFidelityWorker()

const running = ref(false)
const progress = ref<{ done: number; total: number; requests: number } | null>(null)
const found = shallowRef<DealerCandidate[] | null>(null)
const chosen = ref(new Set<string>())
const result = ref<string | null>(null)
const error = ref<unknown>(null)

async function discover() {
  if (running.value) return

  running.value = true
  result.value = null
  error.value = null

  try {
    const answer = await call('dealer.discover', undefined, {
      onProgress: (update) => {
        progress.value = update
      },
    })
    found.value = answer.candidates
    // Everything not already known is preselected: somebody who asked for this
    // wants the shops, not a checkbox exercise.
    chosen.value = new Set(
      answer.candidates.filter((one) => !one.known).map((one) => one.username),
    )
    if (answer.candidates.length === 0) {
      result.value = 'Nichts gefunden, was nach einem Laden aussieht.'
    }
  } catch (cause) {
    error.value = cause
  } finally {
    running.value = false
    progress.value = null
  }
}

function toggle(username: string) {
  const next = new Set(chosen.value)
  if (next.has(username)) next.delete(username)
  else next.add(username)
  chosen.value = next
}

async function keep() {
  const candidates = (found.value ?? []).filter((one) => chosen.value.has(one.username))
  if (candidates.length === 0) return

  error.value = null
  try {
    const answer = await call('dealer.remember', { candidates })
    result.value = answer.added === 1 ? 'Ein Laden dazu.' : `${answer.added} Läden dazu.`
    found.value = null
    emit('imported')
  } catch (cause) {
    error.value = cause
  }
}

const number = new Intl.NumberFormat('de-DE')
</script>

<template>
  <section class="flex flex-col gap-3">
    <ErrorNote v-if="error" :cause="error" />

    <button
      v-if="!found"
      type="button"
      :disabled="running"
      class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      @click="discover()"
    >
      <template v-if="running">
        Suche …
        <template v-if="progress && progress.total > 0">
          <span class="fid-num">{{ progress.done }}</span> von
          <span class="fid-num">{{ progress.total }}</span>
        </template>
      </template>
      <template v-else>Läden bei Discogs suchen</template>
    </button>

    <p v-if="result" class="text-fid-sm text-fid-text-muted" aria-live="polite">{{ result }}</p>

    <WhyNote v-if="!found" label="Wo gesucht wird">
      In deinen Bestellungen – das sind die Läden, bei denen du wirklich gekauft hast. Wenn du
      es in den Einstellungen erlaubst, zusätzlich in deiner Discogs-Freundesliste. Eine Abfrage
      je Quelle, dann eine pro Kandidat, um zu sehen wer überhaupt verkauft.
    </WhyNote>

    <template v-if="found && found.length > 0">
      <ul class="flex flex-col gap-2">
        <li
          v-for="candidate in found"
          :key="candidate.username"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-fid-sm border border-fid-border px-3 py-2"
        >
          <label class="flex min-w-0 grow items-center gap-3">
            <input
              type="checkbox"
              class="size-4 shrink-0"
              :checked="chosen.has(candidate.username)"
              :disabled="candidate.known"
              @change="toggle(candidate.username)"
            />
            <span class="min-w-0 truncate text-fid-sm text-fid-text">
              {{ candidate.username }}
            </span>
          </label>

          <span class="flex shrink-0 flex-wrap gap-x-3 text-fid-xs text-fid-text-muted">
            <span class="fid-num">{{ number.format(candidate.numForSale) }} Listings</span>
            <span v-if="candidate.location">{{ candidate.location }}</span>
            <!--
              Where it came from, named. One source is documented and one is
              not, and somebody deciding whether to trust a list deserves to
              know which half a row came out of (ADR-009).
            -->
            <span :class="candidate.source === 'order' ? 'text-fid-sig-wantlist' : ''">
              {{ candidate.source === 'order' ? 'bestellt' : 'befreundet' }}
            </span>
            <span v-if="candidate.known">schon dabei</span>
          </span>
        </li>
      </ul>

      <button
        type="button"
        :disabled="chosen.size === 0"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-n-990 disabled:opacity-50"
        @click="keep()"
      >
        <span class="fid-num">{{ chosen.size }}</span> übernehmen
      </button>
    </template>
  </section>
</template>
