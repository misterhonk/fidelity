<script setup lang="ts">
import type { LibrarySummary, SyncProgress } from '#shared/protocol'

const m = useMessages()

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
  const fetch = m.value.settings.library.fetch
  if (!progress.value) return fetch.fetching
  const { kind, stored, total } = progress.value
  return fetch.progress(
    kind === 'collection' ? fetch.collection : fetch.wantlist,
    stored,
    total,
  )
})

const formatDate = (at: number | null) => (at === null ? m.value.common.never : dayTime(at))
</script>

<template>
  <section id="library" class="flex flex-col gap-4" aria-labelledby="sync-heading">
    <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-fid-sm">
      <dt class="text-fid-text-muted">{{ m.settings.library.fetch.collection }}</dt>
      <dd class="fid-num text-fid-text">{{ summary?.collection ?? '–' }}</dd>
      <dt class="text-fid-text-muted">{{ m.settings.library.fetch.wantlist }}</dt>
      <dd class="fid-num text-fid-text">{{ summary?.wantlist ?? '–' }}</dd>
      <dt class="text-fid-text-muted">{{ m.settings.library.fetch.lastSynced }}</dt>
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
        class="rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-on-accent disabled:opacity-50"
        @click="sync"
      >
        {{
          summary?.collectionSyncedAt
            ? m.settings.library.fetch.again
            : m.settings.library.fetch.start
        }}
      </button>
    </div>
  </section>
</template>
