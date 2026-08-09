<script setup lang="ts">
const emit = defineEmits<{ deleted: [] }>()

const { call } = useFidelityWorker()

const busy = ref(false)
const error = ref<unknown>(null)
const confirming = ref(false)

/**
 * Downloads a JSON file.
 *
 * A blob URL rather than a data URL: Safari refuses to download data URLs past
 * a couple of megabytes, and a backup is easily past that.
 */
function download(name: string, payload: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

const stamp = () => new Date().toISOString().slice(0, 10)

async function run(what: 'all' | 'dig') {
  if (busy.value) return
  busy.value = true
  error.value = null

  try {
    if (what === 'all') {
      download(`fidelity-backup-${stamp()}.json`, await call('data.exportAll', undefined))
    } else {
      const latest = await call('dig.latest', undefined)
      if (!latest) {
        error.value = 'Noch kein Dig da, den man exportieren könnte.'
        return
      }
      const file = await call('data.exportDig', { digId: latest.dig.id })
      download(`fidelity-dig-${latest.dig.dealer}-${stamp()}.json`, file)
    }
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function deleteAll() {
  busy.value = true
  try {
    await call('data.deleteAll', undefined)
    emit('deleted')
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
    confirming.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <ErrorNote v-if="error" :cause="error" />

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="run('all')"
      >
        Alles exportieren
      </button>

      <button
        type="button"
        :disabled="busy"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="run('dig')"
      >
        Letzten Dig als Datei
      </button>
    </div>

    <!--
      Said before the file exists, not after. Somebody who exports a dig to
      send to a friend needs to know what is in it *while deciding to send it*.
    -->
    <p class="text-fid-xs text-fid-text-muted">
      Beide Dateien enthalten weder deinen Token noch Preise oder Zustände – Marktplatzdaten
      dürfen laut Discogs' API-Bedingungen nicht weitergegeben werden. Was drinsteht: welche
      Platten wie gut passen und warum, mit Link zum jeweiligen Angebot.
    </p>

    <div class="flex flex-col gap-2 border-t border-fid-border pt-3">
      <button
        v-if="!confirming"
        type="button"
        :disabled="busy"
        class="fid-action self-start text-fid-sm text-fid-sig-scarcity underline underline-offset-4 disabled:opacity-50"
        @click="confirming = true"
      >
        Alles löschen
      </button>

      <template v-else>
        <p class="text-fid-sm text-fid-text">
          Löscht die ganze Datenbank auf diesem Gerät: Token, Sammlung, Horizont, Digs, Korb und
          Bewertungen. Es gibt keine Kopie woanders und kein Zurück.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :disabled="busy"
            class="rounded-fid-sm bg-fid-sig-scarcity px-4 py-2 text-fid-sm font-medium text-fid-n-990 disabled:opacity-50"
            @click="deleteAll"
          >
            Ja, alles löschen
          </button>
          <button
            type="button"
            class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
            @click="confirming = false"
          >
            Abbrechen
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
