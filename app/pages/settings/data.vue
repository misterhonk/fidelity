<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()
const m = useMessages()

useSeoMeta({ title: () => st.value.data.title })

const { call } = useFidelityWorker()
const stats = ref<Awaited<ReturnType<typeof call<'db.stats'>>> | null>(null)
onMounted(async () => {
  stats.value = await call('db.stats', undefined)
})

// Never "0 MB" for a real 400 KB (see settings/account.vue); the quota runs to gigabytes.
const size = (bytes: number) =>
  bytes < 1024 ** 2
    ? `${count(Math.round(bytes / 1024))} KB`
    : bytes < 1024 ** 3
      ? `${count(Math.round(bytes / 1024 ** 2))} MB`
      : `${decimal(bytes / 1024 ** 3)} GB`
/** Null where the browser withholds the estimate; then the line is left out. */
const storage = computed(() => {
  const s = stats.value
  if (s?.usageBytes == null || s.quotaBytes == null) return null
  return st.value.data.storageLine(size(s.usageBytes), size(s.quotaBytes))
})
// The total alone disagrees with settings/account.vue, which shows the data without the covers.
const storageHint = computed(() => {
  const data = stats.value?.dataBytes
  return storage.value && data != null ? st.value.data.storageHint(size(data)) : null
})
</script>

<template>
  <SettingsPage :title="st.data.title" :lead="st.data.lead">
    <DataControls />

    <p
      v-if="storage"
      class="fid-num text-fid-sm text-fid-text-muted"
      data-testid="storage-estimate"
    >
      {{ st.data.storage }}: {{ storage }}
    </p>
    <p v-if="storageHint" class="text-fid-sm text-fid-text-muted" data-testid="storage-hint">
      {{ storageHint }}
    </p>

    <!--
      What this device has asked Discogs for (M31.12).

      The header carries a pulse on a desktop and nothing on a phone — there is
      no room in that bar. Here the same numbers stand open and full width, on
      the page that is already about what this device holds and spends.
    -->
    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ m.limit.title }}</h2>
      <RateMeter card />
    </section>
  </SettingsPage>
</template>
