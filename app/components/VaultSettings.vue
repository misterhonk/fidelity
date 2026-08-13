<script setup lang="ts">
import type { VaultStatus, VaultTarget } from '#shared/types'
import { CLOUD_PROVIDERS } from '~/utils/cloud-vault'
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

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
    if (returned) result.value = st.value.vault.connectedTo(CLOUD_PROVIDERS[returned].label)
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
  const words = st.value.vault.targets
  const list: { key: VaultTarget; label: string; hint: string; usable: boolean }[] = [
    { key: 'none', ...words.none, usable: true },
    { key: 'hub', ...words.hub, usable: true },
  ]

  /*
   * Only where it can work. WebKit has no File System Access API, so on an
   * iPhone this is not a greyed-out choice — it is not a choice, because
   * offering it would be a setup screen that lies.
   */
  if (vaultFile.available()) {
    list.push({ key: 'file', ...words.file, usable: true })
  }

  for (const provider of Object.values(CLOUD_PROVIDERS)) {
    list.push({ key: provider.key, label: provider.label, ...words.cloud, usable: true })
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
    /*
     * „Nichts gefunden" heißt zweierlei, und der Unterschied ist teuer.
     *
     * Seit die Ablage an der Passphrase hängt, verschiebt ein anderes Wort auch
     * den Ort. Wer sein Wort ändert, sieht sonst „erste Sicherung angelegt" —
     * und zwei Geräte laufen ab da nebeneinanderher, ohne dass irgendwo etwas
     * kaputt aussieht.
     *
     * Nur der Hub kennt den Fall — eine Datei und ein Cloud-Ordner liegen da,
     * wo jemand hingezeigt hat, und wandern nicht mit einem Wort. Deshalb die
     * Prüfung auf das Feld statt auf seinen Wert.
     */
    result.value = report.hadRemote
      ? st.value.vault.merged(total)
      : 'emptyThoughSyncedBefore' in report && report.emptyThoughSyncedBefore
        ? st.value.vault.emptySlot(total)
        : st.value.vault.firstBackup(total)
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

    <p v-if="status.blocked" class="text-fid-sm text-fid-sig-gap">
      {{ st.vault.blocked[status.blocked] }}
    </p>

    <!--
      Your own registration, not the app's. PKCE needs no secret, so a client
      id is public by design — and there is no Fidelity server to register one
      against (ADR-007), which is why this field exists at all.
    -->
    <div v-if="currentCloud" class="flex flex-col gap-3">
      <label class="flex flex-col gap-2">
        <span class="text-fid-sm font-medium text-fid-text">
          {{ st.vault.clientId(CLOUD_PROVIDERS[currentCloud].label) }}
        </span>
        <input
          :value="clientIds[currentCloud] ?? ''"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
          @change="saveClientId(currentCloud, ($event.target as HTMLInputElement).value)"
        />
        <span class="text-fid-xs text-fid-text-muted">
          {{ CLOUD_PROVIDERS[currentCloud].hint }} {{ st.vault.redirect(redirectUri) }}
        </span>
        <span class="text-fid-xs text-fid-text-muted">{{ st.vault.redirectMoved }}</span>
      </label>

      <div class="flex flex-wrap items-baseline gap-3">
        <button
          v-if="!linked[currentCloud]"
          type="button"
          :disabled="!clientIds[currentCloud]"
          class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
          @click="link(currentCloud)"
        >
          {{ st.vault.connect(CLOUD_PROVIDERS[currentCloud].label) }}
        </button>
        <template v-else>
          <span class="text-fid-sm text-fid-text-muted">{{ st.vault.connected }}</span>
          <button
            type="button"
            class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
            @click="unlink(currentCloud)"
          >
            {{ st.vault.disconnect }}
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
        {{ fileName ? st.vault.otherFile : st.vault.pickFile }}
      </button>
      <span v-if="fileName" class="font-fid-mono text-fid-sm text-fid-text-muted">
        {{ fileName }}
      </span>
    </div>

    <template v-if="canSync">
      <label class="flex flex-col gap-2">
        <span class="text-fid-sm font-medium text-fid-text">{{ st.vault.passphrase }}</span>
        <input
          v-model="passphrase"
          type="password"
          autocomplete="new-password"
          class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />
        <span class="text-fid-xs text-fid-text-muted">{{ st.vault.passphraseHint }}</span>
      </label>

      <label class="flex items-start gap-3">
        <input
          :checked="keepPassphrase"
          type="checkbox"
          class="mt-1 size-4"
          @change="setRemember(($event.target as HTMLInputElement).checked)"
        />
        <span class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text">{{ st.vault.remember }}</span>
          <span class="text-fid-xs text-fid-text-muted">{{ st.vault.rememberHint }}</span>
        </span>
      </label>

      <WhyNote :label="st.vault.rememberWhyLabel">{{ st.vault.rememberWhy }}</WhyNote>

      <button
        type="button"
        :disabled="busy || passphrase.length < 8"
        class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        @click="sync()"
      >
        {{ busy ? st.vault.syncing : status.lastSyncedAt ? st.vault.syncNow : st.vault.setUp }}
      </button>

      <p v-if="result" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ result }}
      </p>
      <p v-else-if="status.lastSyncedAt" class="text-fid-sm text-fid-text-muted">
        {{ st.vault.lastSynced(dayTime(status.lastSyncedAt)) }}
      </p>
    </template>

    <WhyNote :label="st.vault.scopeWhyLabel">{{ st.vault.scopeWhy }}</WhyNote>
  </section>
</template>
