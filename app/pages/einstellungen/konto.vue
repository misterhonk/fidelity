<script setup lang="ts">
useSeoMeta({ title: 'Konto' })

const { identity, signOut } = useIdentity()
const { call } = useFidelityWorker()

const number = new Intl.NumberFormat('de-DE')
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
  if (bytes < 1024 * 1024) return `${number.format(Math.round(bytes / 1024))} KB`
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`
})
</script>

<template>
  <SettingsPage
    title="Konto"
    lead="Es gibt kein Konto bei uns – nur deinen Token auf diesem Gerät."
  >
    <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-fid-sm">
      <dt class="text-fid-text-muted">Discogs-Konto</dt>
      <dd class="text-fid-text">{{ identity?.username }}</dd>

      <dt class="text-fid-text-muted">Daten liegen</dt>
      <dd class="text-fid-text">in diesem Browser, auf diesem Gerät</dd>

      <template v-if="usage">
        <dt class="text-fid-text-muted">Belegt</dt>
        <dd class="fid-num text-fid-text">
          {{ usage }}<template v-if="stats?.persisted"> · vor Aufräumen geschützt</template>
        </dd>
      </template>
    </dl>

    <div class="flex flex-col gap-2">
      <button
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        @click="signOut"
      >
        Abmelden
      </button>
      <p class="max-w-prose text-fid-xs text-fid-text-muted">
        Abmelden löscht die Datenbank mit — Token, Sammlung, Horizont und Digs. Es gibt keine
        Kopie woanders. Vorher exportieren, wenn du sie behalten willst.
      </p>
    </div>
  </SettingsPage>
</template>
