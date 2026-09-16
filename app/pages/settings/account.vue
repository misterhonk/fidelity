<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.account.title })

const { identity, set, signOut } = useIdentity()
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
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${count(Math.round(bytes / 1024))} KB`
    : `${decimal(bytes / 1024 / 1024)} MB`
/*
 * The data apart from the cover cache, where the browser tells them apart.
 * On Chrome the total is mostly padding — every cached cover is booked at
 * about seven megabytes (app/sw/sw.ts) — and "3,898 MB" for sixty-six records
 * read as a fault. The line names what is actually there.
 */
const usage = computed(() => {
  const s = stats.value
  if (!s) return null
  if (s.dataBytes !== null && s.coverEntries !== null)
    return st.value.account.usedLine(size(s.dataBytes), count(s.coverEntries))
  if (s.usageBytes === null) return null
  return size(s.usageBytes)
})
</script>

<template>
  <SettingsPage :title="st.account.title" :lead="st.account.lead">
    <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-fid-sm">
      <dt class="text-fid-text-muted">{{ st.account.discogsAccount }}</dt>
      <dd class="text-fid-text">{{ identity?.username }}</dd>

      <dt class="text-fid-text-muted">{{ st.account.dataLives }}</dt>
      <dd class="text-fid-text">{{ st.account.inThisBrowser }}</dd>

      <template v-if="usage">
        <dt class="text-fid-text-muted">{{ st.account.used }}</dt>
        <dd class="fid-num text-fid-text">
          {{ usage }}<template v-if="stats?.persisted"> · {{ st.account.protected }}</template>
        </dd>
      </template>
    </dl>

    <!--
      Renewing before signing out, because it is the answer to the question
      that brings most people here: Discogs stopped accepting the token. The
      sign-out below is for leaving, and it says what leaving costs.
    -->
    <TokenForm renew @signed-in="set($event)" />

    <div class="flex flex-col gap-2">
      <button
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        @click="signOut"
      >
        {{ st.account.signOut }}
      </button>
      <p class="max-w-prose text-fid-xs text-fid-text-muted">
        {{ st.account.signOutWarning }}
      </p>
    </div>
  </SettingsPage>
</template>
