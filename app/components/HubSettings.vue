<script setup lang="ts">
const { call } = useFidelityWorker()

const url = ref('')
const secret = ref('')
const busy = ref(false)
const error = ref<unknown>(null)
const status = ref<{ ok: boolean; horizon: number; shipping: number; secured: boolean } | null>(
  null,
)

onMounted(async () => {
  const preferences = await call('preferences.get', undefined)
  url.value = preferences.hubUrl ?? ''
  secret.value = preferences.hubSecret ?? ''
  if (url.value) void test()
})

/**
 * Tested before it is saved, and the result is shown rather than assumed.
 *
 * A hub is somebody's spare machine. Typing a URL and getting silence would
 * leave nobody able to tell "saved and working" from "saved and pointing at
 * nothing" — and since a broken hub is invisible by design (rule 8), that
 * distinction has to be made here or nowhere.
 */
async function test() {
  busy.value = true
  error.value = null
  status.value = null

  try {
    status.value = await call('hub.check', { url: url.value, secret: secret.value })
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function save() {
  busy.value = true
  error.value = null
  try {
    await call('preferences.set', {
      hubUrl: url.value.trim() || null,
      hubSecret: secret.value.trim() || null,
    })
    if (url.value.trim()) await test()
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <!--
      The rule ADR-008 exists to protect, said plainly on the one screen where
      somebody might think otherwise.
    -->
    <p class="text-fid-sm text-fid-text-muted">
      Ein Hub beschleunigt, er trägt nichts. Leer lassen heißt: alles läuft lokal, und kein
      Feature fehlt. Gesetzt heißt: der Horizont wird geteilt — wer Conny Plank schon
      ausgeklappt hat, erspart allen anderen elf Abfragen.
    </p>

    <ErrorNote v-if="error" :cause="error" />

    <div class="flex flex-col gap-2">
      <label class="text-fid-sm font-medium text-fid-text" for="hub-url">Hub-URL</label>
      <input
        id="hub-url"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://hub.example.de"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />

      <label class="text-fid-sm font-medium text-fid-text" for="hub-secret">
        Geteiltes Geheimnis (falls der Hub eins verlangt)
      </label>
      <input
        id="hub-secret"
        v-model="secret"
        type="password"
        autocomplete="off"
        spellcheck="false"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
      <p class="text-fid-xs text-fid-text-muted">
        Das ist <span class="text-fid-text">nicht</span> dein Discogs-Token. Der verlässt dieses
        Gerät nie und der Hub hat keine Stelle, an der er ihn annehmen könnte.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy"
        class="rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-n-990 disabled:opacity-50"
        @click="save"
      >
        Speichern
      </button>
      <button
        type="button"
        :disabled="busy || !url.trim()"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="test"
      >
        Verbindung testen
      </button>
    </div>

    <p v-if="status" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      Erreichbar · <span class="fid-num">{{ status.horizon }}</span> Entitäten im geteilten
      Horizont · <span class="fid-num">{{ status.shipping }}</span> Versandstaffeln ·
      {{ status.secured ? 'mit Geheimnis gesichert' : 'offen' }}
    </p>
  </section>
</template>
