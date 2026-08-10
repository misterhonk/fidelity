<script setup lang="ts">
import type { VaultStatus, VaultTarget } from '#shared/types'
import { CLOUD_PROVIDERS } from '~/utils/cloud-vault'

const { call } = useFidelityWorker()
const vaultFile = useVaultFile()
const cloud = useVaultCloud()
const vaultSync = useVaultSync()

/*
 * Remembered by default once a target is chosen.
 *
 * The lock is on the remote copy; this database is plaintext either way. What
 * it buys is a vault that stays current instead of one somebody set up in
 * March and never opened again.
 */
const keepPassphrase = ref(true)

const fileName = ref<string | null>(null)
const clientIds = ref<Record<string, string>>({})
const linked = ref<Record<string, boolean>>({})

const status = ref<VaultStatus | null>(null)
const passphrase = ref('')
const busy = ref(false)
const result = ref<string | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  status.value = await call('vault.status', undefined)
  if (vaultFile.available()) fileName.value = await vaultFile.chosenName()

  const prefs = await call('preferences.get', undefined)
  clientIds.value = { ...prefs.cloudClientIds }

  /*
   * Coming back from a provider. Runs on every mount because it costs a
   * URLSearchParams lookup and returns null on an ordinary visit — asking
   * "was this a redirect?" first would just be the same check written twice.
   */
  try {
    const returned = await cloud.finish(clientIds.value[currentCloud.value ?? ''] ?? '')
    if (returned) result.value = `Mit ${CLOUD_PROVIDERS[returned].label} verbunden.`
  } catch (cause) {
    error.value = cause
  }

  for (const key of ['dropbox', 'drive'] as const)
    linked.value[key] = await cloud.connected(key)

  keepPassphrase.value = prefs.vaultRemember
})

/**
 * The choice is stored, not derived.
 *
 * Deriving it from whether a passphrase happens to be lying around meant
 * somebody who had already synced once got the option switched off without
 * being asked — and a default that depends on history is not a default.
 */
async function setRemember(value: boolean) {
  keepPassphrase.value = value
  await call('preferences.set', { vaultRemember: value })
  if (!value) await vaultSync.remember(null)
}

/** Which of the two, when one of them is the chosen target. */
const currentCloud = computed(() =>
  status.value?.target === 'dropbox' || status.value?.target === 'drive'
    ? status.value.target
    : null,
)

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

  for (const provider of Object.values(CLOUD_PROVIDERS)) {
    list.push({
      key: provider.key,
      label: provider.label,
      hint: 'Verschlüsselt, mit deiner eigenen App-Registrierung.',
      usable: true,
    })
  }

  return list
})

async function saveClientId(key: 'dropbox' | 'drive', value: string) {
  error.value = null
  try {
    const prefs = await call('preferences.set', {
      cloudClientIds: { ...clientIds.value, [key]: value.trim() },
    })
    clientIds.value = { ...prefs.cloudClientIds }
  } catch (cause) {
    error.value = cause
  }
}

async function link(key: 'dropbox' | 'drive') {
  error.value = null
  try {
    await cloud.connect(key, clientIds.value[key] ?? '')
  } catch (cause) {
    error.value = cause
  }
}

async function unlink(key: 'dropbox' | 'drive') {
  await cloud.disconnect(key)
  linked.value = { ...linked.value, [key]: false }
}

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
    const target = status.value?.target
    const report =
      target === 'file'
        ? await vaultFile.sync(passphrase.value)
        : target === 'dropbox' || target === 'drive'
          ? await cloud.sync(target, clientIds.value[target] ?? '', passphrase.value)
          : await call('vault.sync', { passphrase: passphrase.value })
    const total = Object.values(report.counts).reduce((sum, n) => sum + n, 0)
    result.value = report.hadRemote
      ? `Zusammengeführt: ${total} Einträge.`
      : `Erstmals gesichert: ${total} Einträge.`
    // Out of memory the moment it is no longer needed. It is the key to
    // everything in the block and has no business sitting in a form.
    // Kept or dropped as asked, and only after a round that worked — there is
    // no point remembering a passphrase that has not opened anything yet.
    await vaultSync.remember(keepPassphrase.value ? passphrase.value : null)
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
  if (currentCloud.value) return linked.value[currentCloud.value] === true
  return status.value.ready
})

/** Shown so it can be copied into the provider's form without a typo. */
const redirectUri = computed(() =>
  typeof window === 'undefined' ? '' : redirectUriFor(window.location.origin),
)

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
        <label :for="`vault-${option.key}`" class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text">{{ option.label }}</span>
          <span class="text-fid-xs text-fid-text-muted">{{ option.hint }}</span>
        </label>
      </div>
    </div>

    <p v-if="status.blocked" class="text-fid-sm text-fid-sig-gap">{{ status.blocked }}</p>

    <!--
      Your own registration, not the app's. PKCE needs no secret, so a client
      id is public by design — and there is no Fidelity server to register one
      against (ADR-007), which is why this field exists at all.
    -->
    <div v-if="currentCloud" class="flex flex-col gap-3">
      <label class="flex flex-col gap-2">
        <span class="text-fid-sm font-medium text-fid-text">
          Client-ID von {{ CLOUD_PROVIDERS[currentCloud].label }}
        </span>
        <input
          :value="clientIds[currentCloud] ?? ''"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
          @change="saveClientId(currentCloud, ($event.target as HTMLInputElement).value)"
        />
        <span class="text-fid-xs text-fid-text-muted">
          {{ CLOUD_PROVIDERS[currentCloud].hint }} Als Redirect-URL trägst du
          <span class="font-fid-mono">{{ redirectUri }}</span> ein.
        </span>
      </label>

      <div class="flex flex-wrap items-baseline gap-3">
        <button
          v-if="!linked[currentCloud]"
          type="button"
          :disabled="!clientIds[currentCloud]"
          class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
          @click="link(currentCloud)"
        >
          Mit {{ CLOUD_PROVIDERS[currentCloud].label }} verbinden
        </button>
        <template v-else>
          <span class="text-fid-sm text-fid-text-muted">Verbunden.</span>
          <button
            type="button"
            class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
            @click="unlink(currentCloud)"
          >
            Trennen
          </button>
        </template>
      </div>
    </div>

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

      <label class="flex items-start gap-3">
        <input
          :checked="keepPassphrase"
          type="checkbox"
          class="mt-1 size-4"
          @change="setRemember(($event.target as HTMLInputElement).checked)"
        />
        <span class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text">Auf diesem Gerät merken</span>
          <span class="text-fid-xs text-fid-text-muted">
            Dann gleicht sich Fidelity beim Öffnen von selbst ab.
          </span>
        </span>
      </label>

      <WhyNote label="Ist das nicht der Schlüssel neben dem Schloss">
        Nein – das Schloss sitzt auf der Kopie in der Ferne. Diese Datenbank hier ist
        unverschlüsselt und war es immer: Sammlung, Merkliste und der Discogs-Token liegen
        längst darin. Die Passphrase daneben zu legen gibt niemandem etwas, das der Besitz des
        Geräts nicht ohnehin gibt. Auf einem geteilten Rechner ist das eine andere Frage – dann
        Haken weg und jedes Mal tippen.
      </WhyNote>

      <button
        type="button"
        :disabled="busy || passphrase.length < 8"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        @click="sync()"
      >
        {{ busy ? 'Gleiche ab …' : status.lastSyncedAt ? 'Jetzt abgleichen' : 'Einrichten' }}
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
