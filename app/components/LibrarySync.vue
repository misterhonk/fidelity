<script setup lang="ts">
import type { LibrarySummary, SyncProgress } from '#shared/protocol'
import { useSettingsMessages } from '~/i18n/settings'

const m = useMessages()
const st = useSettingsMessages()

const { call } = useFidelityWorker()

const summary = ref<LibrarySummary | null>(null)
const progress = ref<SyncProgress | null>(null)
const running = ref(false)
const error = ref<unknown>(null)
const undone = ref<string[]>([])

async function refresh() {
  summary.value = await call('library.summary', undefined)
}

onMounted(refresh)

async function sync() {
  if (running.value) return
  running.value = true
  error.value = null
  progress.value = null
  undone.value = []

  try {
    const result = await call('library.sync', undefined, {
      onProgress: (p) => (progress.value = p),
    })
    undone.value = result.undone
    await refresh()
  } catch (cause) {
    error.value = cause
  } finally {
    running.value = false
  }
}

const label = computed(() => {
  const fetch = st.value.library.fetch
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
      <dt class="text-fid-text-muted">{{ st.library.fetch.collection }}</dt>
      <dd class="fid-num text-fid-text">{{ summary?.collection ?? '–' }}</dd>
      <dt class="text-fid-text-muted">{{ st.library.fetch.wantlist }}</dt>
      <dd class="fid-num text-fid-text">{{ summary?.wantlist ?? '–' }}</dd>
      <dt class="text-fid-text-muted">{{ st.library.fetch.lastSynced }}</dt>
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
    <p
      v-if="undone.length > 0"
      role="status"
      class="flex items-center gap-2 rounded-fid-sm bg-fid-error/10 px-3 py-2 text-fid-sm text-fid-error"
    >
      <FidIcon name="circle-alert" :size="14" />
      {{ m.freshness.undone(undone) }}
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="running"
        class="fid-fill rounded-fid-sm bg-fid-accent-fill px-4 py-2 font-medium text-fid-on-accent disabled:opacity-50"
        @click="sync"
      >
        {{ summary?.collectionSyncedAt ? st.library.fetch.again : st.library.fetch.start }}
      </button>
    </div>
  </section>
</template>
