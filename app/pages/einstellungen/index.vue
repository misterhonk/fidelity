<script setup lang="ts">
import type { Preferences, VaultStatus, VaultTarget } from '#shared/types'

import { since } from '~/utils/when'

useSeoMeta({
  title: 'Einstellungen',
  description: 'Konto, Sammlung, Suche, Abgleich und der optionale Hub.',
})

const { identity, load } = useIdentity()
const { call } = useFidelityWorker()
const { preference: theme, themes } = useTheme()
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

const VAULT_LABELS: Record<VaultTarget, string> = {
  none: 'Aus',
  hub: 'Dein Hub',
  file: 'Datei im Sync-Ordner',
  dropbox: 'Dropbox',
  drive: 'Google Drive',
}

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

  const parts: string[] = []
  if (prefs.maxPrice !== null) parts.push(`bis ${number.format(prefs.maxPrice)} €`)
  if (prefs.excludeReissues) parts.push('nur Originale')
  if (prefs.formatsAllow.length > 0) parts.push(prefs.formatsAllow.join(', '))
  if (prefs.shipsFromBlock.length > 0) {
    const blocked = prefs.shipsFromBlock.length
    parts.push(`${blocked} ${blocked === 1 ? 'Land' : 'Länder'} gesperrt`)
  }

  return parts.length > 0 ? parts.slice(0, 3).join(' · ') : 'Ohne Einschränkung'
})

const library = computed(() => {
  const counts = stats.value?.counts
  if (!counts) return null
  if (!counts.collection) return 'Noch nichts geholt'
  return `${number.format(counts.collection)} Platten · ${number.format(counts.wantlist ?? 0)} Wünsche`
})

const usage = computed(() => {
  const bytes = stats.value?.usageBytes
  if (bytes === null || bytes === undefined) return null
  if (bytes < 1024 * 1024) return `${number.format(Math.round(bytes / 1024))} KB`
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`
})

const sync = computed(() => {
  const status = vault.value
  if (!status || status.target === 'none') return 'Aus'
  const label = VAULT_LABELS[status.target]
  return status.lastSyncedAt
    ? `${label} · ${since(status.lastSyncedAt)}`
    : `${label} · noch nie`
})

const hub = computed(() => {
  const url = preferences.value?.hubUrl
  if (!url) return 'Nicht eingerichtet'
  try {
    return new URL(url).host
  } catch {
    // A hub URL that will not parse is worth showing as such rather than
    // hiding behind "nicht eingerichtet" — the setting is set, it is wrong.
    return 'Adresse unlesbar'
  }
})

const appearance = computed(() => {
  const themeLabel = themes.find((entry) => entry.key === theme.value)?.label ?? 'System'
  const typeLabel = sets.find((entry) => entry.key === typeset.value)?.label ?? ''
  return `${themeLabel} · ${typeLabel}`
})

/**
 * Ordered by how often somebody comes back: the account is what you check,
 * the collection is what you top up, the appearance is what you play with, and
 * deleting everything is at the bottom where it belongs.
 */
const SECTIONS = computed(() => [
  {
    to: '/einstellungen/konto',
    title: 'Konto',
    hint: 'Dein Discogs-Token und was auf diesem Gerät liegt',
    status: identity.value?.username ?? null,
  },
  {
    to: '/einstellungen/sammlung',
    title: 'Sammlung',
    hint: 'Sammlung, Wantlist, Horizont und Credits',
    status: library.value,
  },
  {
    to: '/einstellungen/suche',
    title: 'Suche',
    hint: 'Wonach gesucht wird und woher die Läden kommen',
    status: searchSummary.value,
  },
  {
    to: '/einstellungen/darstellung',
    title: 'Darstellung',
    hint: 'Hell oder dunkel, und in welcher Schrift',
    status: appearance.value,
  },
  {
    to: '/einstellungen/abgleich',
    title: 'Geräte abgleichen',
    hint: 'Verschlüsselter Tresor für Handy und Rechner',
    status: sync.value,
  },
  {
    to: '/einstellungen/hub',
    title: 'Hub',
    hint: 'Optionaler Helfer im eigenen Netz',
    status: hub.value,
  },
  {
    to: '/einstellungen/daten',
    title: 'Deine Daten',
    hint: 'Exportieren oder alles löschen',
    status: usage.value,
  },
  /*
   * Ganz unten, weil man es sucht statt darüber zu stolpern.
   *
   * Everything on this page above is something you change. This is the one
   * thing you *read*, and somebody only comes looking for it once a question
   * has already formed — so it does not compete with the settings, it waits
   * where a manual waits.
   */
  {
    to: '/einstellungen/hilfe',
    title: 'Hilfe',
    hint: 'Wie das hier arbeitet und was die Punktzahlen bedeuten',
    status: null,
  },
])
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
    <header class="flex flex-col gap-1">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">Einstellungen</h1>
      <p class="text-fid-base text-fid-text-muted">
        Alles, was man einmal einrichtet und danach in Ruhe lässt.
      </p>
    </header>

    <!--
      An index rather than a stack of ten open panels.

      Each entry says what it currently is, not only what it is for: "Dropbox ·
      vor 2 Stunden" answers the question somebody opened the settings to ask,
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
      Erst anmelden –
      <NuxtLink class="underline underline-offset-4" to="/">zur Startseite</NuxtLink>.
    </p>
  </main>
</template>
