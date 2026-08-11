<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.account.title })

const { identity, signOut } = useIdentity()
const { call } = useFidelityWorker()

const stats = ref<Awaited<ReturnType<typeof call<'db.stats'>>> | null>(null)

onMounted(async () => {
  stats.value = await call('db.stats', undefined)
})

/**
 * Storage, in a unit that says something.
 *
 * Rounding to whole megabytes turned a real 400 KB into "0 MB", which reads as
 * "nothing is stored" — the opposite of what the line is there to show.
 */
const usage = computed(() => {
  const bytes = stats.value?.usageBytes
  if (bytes === null || bytes === undefined) return null
  if (bytes < 1024 * 1024) return `${count(Math.round(bytes / 1024))} KB`
  return `${decimal(bytes / 1024 / 1024)} MB`
})
</script>

<template>
  <SettingsPage :title="m.settings.account.title" :lead="m.settings.account.lead">
    <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-fid-sm">
      <dt class="text-fid-text-muted">{{ m.settings.account.discogsAccount }}</dt>
      <dd class="text-fid-text">{{ identity?.username }}</dd>

      <dt class="text-fid-text-muted">{{ m.settings.account.dataLives }}</dt>
      <dd class="text-fid-text">{{ m.settings.account.inThisBrowser }}</dd>

      <template v-if="usage">
        <dt class="text-fid-text-muted">{{ m.settings.account.used }}</dt>
        <dd class="fid-num text-fid-text">
          {{ usage
          }}<template v-if="stats?.persisted"> · {{ m.settings.account.protected }}</template>
        </dd>
      </template>
    </dl>

    <div class="flex flex-col gap-2">
      <button
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        @click="signOut"
      >
        {{ m.settings.account.signOut }}
      </button>
      <p class="max-w-prose text-fid-xs text-fid-text-muted">
        {{ m.settings.account.signOutWarning }}
      </p>
    </div>
  </SettingsPage>
</template>
