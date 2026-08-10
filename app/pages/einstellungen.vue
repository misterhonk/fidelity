<script setup lang="ts">
useSeoMeta({
  title: 'Einstellungen',
  description: 'Konto, Daten, Horizont und der optionale Hub.',
})

const { identity, load, signOut } = useIdentity()

onMounted(load)

const number = new Intl.NumberFormat('de-DE')
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
  if (bytes < 1024 * 1024) return `${number.format(Math.round(bytes / 1024))} KB`
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`
})
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
    <header class="flex flex-col gap-1">
      <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Einstellungen</h1>
      <p class="text-fid-base text-fid-text-muted">
        Alles, was man einmal einrichtet und danach in Ruhe lässt.
      </p>
    </header>

    <template v-if="identity">
      <!--
        Ordered by how often somebody comes back to it: the account is what
        you check, the horizon is what you top up, the hub is what you set
        once, and deleting everything is at the bottom where it belongs.
      -->
      <SettingsCard
        title="Konto"
        description="Fidelity spricht direkt mit Discogs. Es gibt kein Konto bei uns – nur deinen Token auf diesem Gerät."
      >
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-fid-sm">
          <dt class="text-fid-text-muted">Discogs-Konto</dt>
          <dd class="text-fid-text">{{ identity.username }}</dd>

          <dt class="text-fid-text-muted">Daten liegen</dt>
          <dd class="text-fid-text">in diesem Browser, auf diesem Gerät</dd>

          <template v-if="usage">
            <dt class="text-fid-text-muted">Belegt</dt>
            <dd class="fid-num text-fid-text">
              {{ usage }}<template v-if="stats?.persisted"> · vor Aufräumen geschützt</template>
            </dd>
          </template>
        </dl>

        <button
          type="button"
          class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
          @click="signOut"
        >
          Abmelden
        </button>
        <p class="text-fid-xs text-fid-text-muted">
          Abmelden löscht die Datenbank mit — Token, Sammlung, Horizont und Digs. Es gibt keine
          Kopie woanders. Vorher exportieren, wenn du sie behalten willst.
        </p>
      </SettingsCard>

      <SettingsCard
        anchor="library"
        title="Sammlung"
        description="Was Fidelity von Discogs geholt hat. Grundlage für alles Weitere."
      >
        <LibrarySync />
      </SettingsCard>

      <!--
        The filters sit right under the collection, because they are the next
        thing somebody wants after seeing what Fidelity knows: not "what do I
        have" but "what should it look for". Twelve of these were already read
        by the matching engine and none of them could be set.
      -->
      <SettingsCard
        anchor="filter"
        title="Wonach gesucht wird"
        description="Gilt für jeden Dig: was gar nicht erst auftaucht, und was nur weiter unten landet."
      >
        <MatchPreferences />
      </SettingsCard>

      <SettingsCard
        anchor="horizon"
        title="Horizont"
        description="Deine Sammlung einmal ausgeklappt. Danach kostet jeder Dig keine zusätzlichen Abfragen."
      >
        <HorizonBuild />
      </SettingsCard>

      <SettingsCard
        anchor="schrift"
        title="Schrift"
        description="Drei Sätze, umschaltbar. Sieh sie dir an echten Listen an, nicht hier."
      >
        <TypesetPicker />
      </SettingsCard>

      <SettingsCard
        anchor="vault"
        title="Geräte abgleichen"
        description="Verschlüsselt, damit der Speicherort keine Rolle spielt."
      >
        <VaultSettings />
      </SettingsCard>

      <SettingsCard
        anchor="dealers"
        title="Läden finden"
        description="Woher der Import die Läden nimmt."
      >
        <FriendImportToggle />
      </SettingsCard>

      <SettingsCard
        title="Credits"
        description="Wer deine Lieblingsplatten gemacht hat – Produzenten, Engineers, Remixer."
      >
        <CreditHarvest />
      </SettingsCard>

      <SettingsCard
        title="Hub"
        description="Optional. Beschleunigt, trägt nichts – leer lassen ist völlig in Ordnung."
      >
        <HubSettings />
      </SettingsCard>

      <SettingsCard
        title="Deine Daten"
        description="Mitnehmen oder loswerden. Beides vollständig, beides ohne Umweg über einen Server."
        danger
      >
        <DataControls />
      </SettingsCard>
    </template>

    <p v-else class="text-fid-base text-fid-text-muted">
      Erst anmelden –
      <NuxtLink class="underline underline-offset-4" to="/">zur Startseite</NuxtLink>.
    </p>
  </main>
</template>
