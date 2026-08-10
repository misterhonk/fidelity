<script setup lang="ts">
import type { VaultStatus, VaultTarget } from '#shared/types'

const { call } = useFidelityWorker()

const status = ref<VaultStatus | null>(null)
const passphrase = ref('')
const busy = ref(false)
const result = ref<string | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  status.value = await call('vault.status', undefined)
})

/*
 * Only what this device can actually do.
 *
 * The file target needs an API WebKit does not have, so on an iPhone it is
 * not a choice that is greyed out — it is a choice that is not there. Offering
 * it would be a setup screen that lies.
 */
const TARGETS = computed(() => {
  const list: { key: VaultTarget; label: string; hint: string; usable: boolean }[] = [
    {
      key: 'none',
      label: 'Nur dieses Gerät',
      hint: 'Nichts verlässt den Browser.',
      usable: true,
    },
    {
      key: 'hub',
      label: 'Dein Hub',
      hint: 'Verschlüsselt auf deinem eigenen Server. Funktioniert auf jedem Gerät.',
      usable: true,
    },
  ]

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    list.push({
      key: 'file',
      label: 'Datei im Sync-Ordner',
      hint: 'Noch nicht gebaut.',
      usable: false,
    })
  }

  return list
})

async function choose(target: VaultTarget) {
  error.value = null
  result.value = null
  try {
    status.value = await call('vault.setTarget', { target })
  } catch (cause) {
    error.value = cause
  }
}

async function sync() {
  if (busy.value) return

  busy.value = true
  error.value = null
  result.value = null

  try {
    const report = await call('vault.sync', { passphrase: passphrase.value })
    const total = Object.values(report.counts).reduce((sum, n) => sum + n, 0)
    result.value = report.hadRemote
      ? `Zusammengeführt: ${total} Einträge.`
      : `Erstmals gesichert: ${total} Einträge.`
    // Out of memory the moment it is no longer needed. It is the key to
    // everything in the block and has no business sitting in a form.
    passphrase.value = ''
    status.value = await call('vault.status', undefined)
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <section v-if="status" class="flex flex-col gap-4">
    <ErrorNote v-if="error" :cause="error" />

    <div class="flex flex-col gap-2">
      <div
        v-for="option in TARGETS"
        :key="option.key"
        class="flex items-start gap-3"
        :class="option.usable ? '' : 'opacity-50'"
      >
        <input
          :id="`vault-${option.key}`"
          type="radio"
          name="vault-target"
          class="mt-1 size-4"
          :checked="status.target === option.key"
          :disabled="!option.usable"
          @change="choose(option.key)"
        />
        <label :for="`vault-${option.key}`" class="flex flex-col gap-0.5">
          <span class="text-fid-sm text-fid-text">{{ option.label }}</span>
          <span class="text-fid-xs text-fid-text-muted">{{ option.hint }}</span>
        </label>
      </div>
    </div>

    <p v-if="status.blocked" class="text-fid-sm text-fid-sig-gap">{{ status.blocked }}</p>

    <template v-if="status.target !== 'none' && status.ready">
      <label class="flex flex-col gap-2">
        <span class="text-fid-sm font-medium text-fid-text">Passphrase</span>
        <input
          v-model="passphrase"
          type="password"
          autocomplete="new-password"
          class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />
        <!--
          The one thing nobody can recover for you, said before it matters
          rather than after.
        -->
        <span class="text-fid-xs text-fid-text-muted">
          Auf jedem Gerät dieselbe. Sie wird nirgends gespeichert – vergessen heißt weg.
        </span>
      </label>

      <button
        type="button"
        :disabled="busy || passphrase.length < 8"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-n-990 disabled:opacity-50"
        @click="sync()"
      >
        {{ busy ? 'Gleiche ab …' : 'Jetzt abgleichen' }}
      </button>

      <p v-if="result" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ result }}
      </p>
      <p v-else-if="status.lastSyncedAt" class="text-fid-sm text-fid-text-muted">
        Zuletzt abgeglichen am {{ date.format(status.lastSyncedAt) }}.
      </p>
    </template>

    <WhyNote label="Was mitgeht und was nicht">
      Mit: Horizont, Merkliste, Korb, Läden mit Versandstaffeln, Einstellungen. Nicht mit: dein
      Discogs-Token – ein Zugangsschlüssel auf drei Geräten ist dreimal so viel Angriffsfläche,
      jedes Gerät meldet sich einmal selbst an. Und keine Digs: Preise sind nach sechs Stunden
      ohnehin gelöscht und gehören nicht auf einen Server.
    </WhyNote>
  </section>
</template>
