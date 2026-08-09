<script setup lang="ts">
import type { LibrarySummary, SyncProgress } from '#shared/protocol'

const { call } = useFidelityWorker()

const summary = ref<LibrarySummary | null>(null)
const progress = ref<SyncProgress | null>(null)
const running = ref(false)
const error = ref<unknown>(null)

async function refresh() {
  summary.value = await call('library.summary', undefined)
}

onMounted(refresh)

async function sync() {
  if (running.value) return
  running.value = true
  error.value = null
  progress.value = null

  try {
    await call('library.sync', undefined, { onProgress: (p) => (progress.value = p) })
    await refresh()
  } catch (cause) {
    error.value = cause
  } finally {
    running.value = false
  }
}

const label = computed(() => {
  if (!progress.value) return 'Sync läuft …'
  const { kind, stored, total, requests } = progress.value
  const what = kind === 'collection' ? 'Sammlung' : 'Wantlist'
  return `${what}: ${stored} von ${total} · ${requests} Requests`
})

const formatDate = (at: number | null) =>
  at === null
    ? 'noch nie'
    : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(at)
</script>

<template>
  <section id="library" class="scroll-mt-6 flex flex-col gap-4" aria-labelledby="sync-heading">
    <h2 id="sync-heading" class="text-fid-xl font-bold text-fid-text">Deine Daten</h2>

    <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-fid-sm">
      <dt class="text-fid-text-muted">Sammlung</dt>
      <dd class="fid-num text-fid-text">{{ summary?.collection ?? '–' }}</dd>
      <dt class="text-fid-text-muted">Wantlist</dt>
      <dd class="fid-num text-fid-text">{{ summary?.wantlist ?? '–' }}</dd>
      <dt class="text-fid-text-muted">Zuletzt synchronisiert</dt>
      <dd class="text-fid-text">{{ formatDate(summary?.collectionSyncedAt ?? null) }}</dd>
    </dl>

    <!--
      Never a bare spinner. The first run is roughly 25 requests at 1.2 s
      apart, so the only honest thing to show is real numbers moving.
    -->
    <p v-if="running" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ label }}
    </p>

    <ErrorNote v-if="error" :cause="error" />

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="running"
        class="rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
        @click="sync"
      >
        {{ summary?.collectionSyncedAt ? 'Neu synchronisieren' : 'Sammlung synchronisieren' }}
      </button>

      <NuxtLink
        v-if="(summary?.collection ?? 0) > 0"
        to="/landkarte"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        Deine Landkarte
      </NuxtLink>

      <NuxtLink
        v-if="(summary?.collection ?? 0) > 0"
        to="/dig"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        Neuer Dig
      </NuxtLink>

      <NuxtLink
        v-if="(summary?.dealers ?? 0) > 0"
        to="/haendler"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        The Clerk's Take
      </NuxtLink>

      <NuxtLink
        v-if="(summary?.basket ?? 0) > 0"
        to="/korb"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        Der Korb ({{ summary?.basket }})
      </NuxtLink>

      <NuxtLink
        to="/im-laden"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        Im Laden
      </NuxtLink>
    </div>
  </section>
</template>
