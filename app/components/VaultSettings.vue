<script setup lang="ts">
import type { VaultStatus, VaultTarget } from '#shared/types'

const { call } = useFidelityWorker()
const vaultFile = useVaultFile()

const fileName = ref<string | null>(null)

const status = ref<VaultStatus | null>(null)
const passphrase = ref('')
const busy = ref(false)
const result = ref<string | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  status.value = await call('vault.status', undefined)
  if (vaultFile.available()) fileName.value = await vaultFile.chosenName()
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

  /*
   * Only where it can work. WebKit has no File System Access API, so on an
   * iPhone this is not a greyed-out choice — it is not a choice, because
   * offering it would be a setup screen that lies.
   */
  if (vaultFile.available()) {
    list.push({
      key: 'file',
      label: 'Datei im Sync-Ordner',
      hint: 'In iCloud, Dropbox oder Drive. Deren Client synchronisiert, Fidelity nicht.',
      usable: true,
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

async function pickFile() {
  error.value = null
  try {
    fileName.value = await vaultFile.choose()
  } catch (cause) {
    // An abandoned picker is not a failure worth a red box.
    if ((cause as { name?: string })?.name !== 'AbortError') error.value = cause
  }
}

async function sync() {
  if (busy.value) return

  busy.value = true
  error.value = null
  result.value = null

  try {
    const report =
      status.value?.target === 'file'
        ? await vaultFile.sync(passphrase.value)
        : await call('vault.sync', { passphrase: passphrase.value })
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

/** A file target is ready once a file has been chosen; the hub once it exists. */
const canSync = computed(() => {
  if (!status.value || status.value.target === 'none') return false
  if (status.value.target === 'file') return fileName.value !== null
  return status.value.ready
})

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

    <!-- Picked once, then remembered — a handle survives in IndexedDB. -->
    <div v-if="status.target === 'file'" class="flex flex-wrap items-baseline gap-3">
      <button
        type="button"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        @click="pickFile()"
      >
        {{ fileName ? 'Andere Datei' : 'Datei wählen' }}
      </button>
      <span v-if="fileName" class="font-fid-mono text-fid-sm text-fid-text-muted">
        {{ fileName }}
      </span>
    </div>

    <template v-if="canSync">
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
