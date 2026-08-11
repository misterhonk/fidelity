<script setup lang="ts">
import type { Preferences, VaultStatus } from '#shared/types'
import { useSettingsMessages } from '~/i18n/settings'

import { since } from '~/utils/when'

const m = useMessages()
const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.title })
const { identity, load } = useIdentity()
const { call } = useFidelityWorker()
const { preference: theme } = useTheme()
const { current: typeset, sets } = useTypeset()

const stats = ref<Awaited<ReturnType<typeof call<'db.stats'>>> | null>(null)
const vault = ref<VaultStatus | null>(null)
const preferences = ref<Preferences | null>(null)

onMounted(async () => {
  void load()

  /*
   * Three cheap reads, all local. None of them touches Discogs — an index
   * that costs a request per visit is an index nobody should open twice.
   */
  const [read, status, prefs] = await Promise.all([
    call('db.stats', undefined),
    call('vault.status', undefined),
    call('preferences.get', undefined),
  ])

  stats.value = read
  vault.value = status
  preferences.value = prefs
})

/**
 * What the search is currently narrowed to, in at most three fragments.
 *
 * Twelve preferences do not fit on a line and would not be read if they did.
 * These are the ones somebody actually changes and then forgets about — the
 * ones that quietly explain why a dig came back thin.
 */
const searchSummary = computed(() => {
  const prefs = preferences.value
  if (!prefs) return null

  const search = st.value.search
  const parts: string[] = []
  if (prefs.maxPrice !== null) parts.push(search.upTo(money(prefs.maxPrice, 'EUR') ?? ''))
  if (prefs.excludeReissues) parts.push(search.originalsOnly)
  if (prefs.formatsAllow.length > 0) parts.push(prefs.formatsAllow.join(', '))
  if (prefs.shipsFromBlock.length > 0) {
    parts.push(search.countriesBlocked(prefs.shipsFromBlock.length))
  }

  return parts.length > 0 ? parts.slice(0, 3).join(' · ') : search.unrestricted
})

const library = computed(() => {
  const counts = stats.value?.counts
  if (!counts) return null
  if (!counts.collection) return m.value.common.nothingYet
  return st.value.library.summary(count(counts.collection), count(counts.wantlist ?? 0))
})

const usage = computed(() => {
  const bytes = stats.value?.usageBytes
  if (bytes === null || bytes === undefined) return null
  if (bytes < 1024 * 1024) return `${count(Math.round(bytes / 1024))} KB`
  return `${decimal(bytes / 1024 / 1024)} MB`
})

const sync = computed(() => {
  const status = vault.value
  if (!status || status.target === 'none') return m.value.common.off
  const label = st.value.sync.targets[status.target]
  return status.lastSyncedAt
    ? `${label} · ${since(status.lastSyncedAt)}`
    : `${label} · ${m.value.common.never}`
})

const hub = computed(() => {
  const url = preferences.value?.hubUrl
  if (!url) return st.value.hub.notSetUp
  try {
    return new URL(url).host
  } catch {
    return st.value.hub.unreadable
  }
})

const appearance = computed(() => {
  const themeLabel = st.value.appearance.theme[theme.value].label
  const typeLabel = sets.find((entry) => entry.key === typeset.value)?.label ?? ''
  return `${m.value.meta.name} · ${themeLabel} · ${typeLabel}`
})

/**
 * Ordered by how often somebody comes back: the account is what you check,
 * the collection is what you top up, the appearance is what you play with, and
 * deleting everything is at the bottom where it belongs.
 */
const SECTIONS = computed(() => [
  {
    to: '/einstellungen/konto',
    ...st.value.account,
    status: identity.value?.username ?? null,
  },
  { to: '/einstellungen/sammlung', ...st.value.library, status: library.value },
  { to: '/einstellungen/suche', ...st.value.search, status: searchSummary.value },
  {
    to: '/einstellungen/darstellung',
    title: st.value.appearance.title,
    hint: st.value.appearance.hint,
    status: appearance.value,
  },
  { to: '/einstellungen/abgleich', ...st.value.sync, status: sync.value },
  { to: '/einstellungen/hub', ...st.value.hub, status: hub.value },
  { to: '/einstellungen/daten', ...st.value.data, status: usage.value },
  /*
   * Right at the bottom, because it is looked for rather than stumbled over.
   *
   * Everything on this page above is something you change. This is the one
   * thing you *read*, and somebody only comes looking for it once a question
   * has already formed — so it does not compete with the settings, it waits
   * where a manual waits.
   */
  { to: '/einstellungen/hilfe', ...st.value.help, status: null },
])
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
    <header class="flex flex-col gap-1">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ st.title }}</h1>
      <p class="text-fid-base text-fid-text-muted">{{ st.lead }}</p>
    </header>

    <!--
      An index rather than a stack of ten open panels.

      Each entry says what it currently is, not only what it is for: "Dropbox ·
      2 hours ago" answers the question somebody opened the settings to ask,
      and saves the trip inside.
    -->
    <nav v-if="identity" class="grid gap-3 @2xl:grid-cols-2">
      <NuxtLink
        v-for="section in SECTIONS"
        :key="section.to"
        :to="section.to"
        class="flex flex-col gap-1 rounded-fid-md border border-fid-border bg-fid-surface p-5 transition-colors hover:border-fid-text-muted"
      >
        <span class="text-fid-base font-medium text-fid-text">{{ section.title }}</span>
        <span class="text-fid-sm text-fid-text-muted">{{ section.hint }}</span>
        <span v-if="section.status" class="fid-num mt-1 text-fid-xs text-fid-text-muted">
          {{ section.status }}
        </span>
      </NuxtLink>
    </nav>

    <p v-else class="text-fid-base text-fid-text-muted">
      {{ m.common.signIn.lead }}
      <NuxtLink class="underline underline-offset-4" to="/">{{ m.common.signIn.link }}</NuxtLink
      >.
    </p>
  </main>
</template>
