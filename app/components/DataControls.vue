<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'
import type { Signal } from '#shared/types'

import { reasonFor } from '~/i18n/reason'

const st = useSettingsMessages()

const emit = defineEmits<{ deleted: []; imported: [] }>()

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
  downloadText(name, JSON.stringify(payload, null, 1), 'application/json')
}

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

const stamp = () => new Date().toISOString().slice(0, 10)

async function run(what: 'all' | 'dig' | 'collection' | 'wantlist') {
  if (busy.value) return
  busy.value = true
  error.value = null

  try {
    if (what === 'collection' || what === 'wantlist') {
      // CSV, for a spreadsheet — the columns Discogs' own export lacks (M19 #5).
      const file = await call('data.exportCsv', { what })
      downloadText(`fidelity-${what}-${stamp()}.csv`, file.csv, 'text/csv;charset=utf-8')
    } else if (what === 'all') {
      download(
        `fidelity-backup-${stamp()}.json`,
        withReasons(await call('data.exportAll', undefined)),
      )
    } else {
      const latest = await call('dig.latest', undefined)
      if (!latest) {
        error.value = st.value.dataPanel.noDigYet
        return
      }
      const file = await call('data.exportDig', { digId: latest.dig.id })
      download(`fidelity-dig-${latest.dig.dealer}-${stamp()}.json`, withReasons(file))
    }
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

/**
 * The sentence is added here, not in the worker.
 *
 * An export is a file somebody opens outside the app, and the readable line
 * under each find is the point of it. The worker assembles the data and has no
 * idea what language the interface is in — so it ships the signals and this
 * writes the sentence, in whatever language the person doing the exporting is
 * reading.
 */
function withReasons<T>(file: T): T {
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return

    const record = node as Record<string, unknown>
    if (Array.isArray(record.signals) && record.listingId !== undefined) {
      record.reason = reasonFor(record.signals as Signal[])
    }
    Object.values(record).forEach(walk)
  }

  walk(file)
  return file
}

// --- The way back (M24) ------------------------------------------------------
const picker = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const imported = ref<string[] | null>(null)

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || importing.value) return
  importing.value = true
  error.value = null
  imported.value = null
  try {
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      parsed = null
    }
    const report = await call('data.importAll', { file: parsed })
    const rows = Object.entries(report.imported)
      .filter(([, n]) => n > 0)
      .map(([store, n]) => `${count(n)} ${st.value.dataPanel.importStore[store] ?? store}`)
    const lines = [
      rows.length
        ? st.value.dataPanel.importReport(rows.join(', '))
        : st.value.dataPanel.importNothing,
    ]
    const digs = report.skipped.find((s) => s.store === 'digs')
    if (digs) lines.push(st.value.dataPanel.importSkippedPrices(count(digs.rows)))
    if (report.skipped.some((s) => s.reason === 'too-old'))
      lines.push(st.value.dataPanel.importSkippedOld)
    if (report.meta.length > 0) lines.push(st.value.dataPanel.importMeta)
    imported.value = lines
    emit('imported')
  } catch (cause) {
    error.value = cause
  } finally {
    importing.value = false
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
        class="flex items-center gap-2 rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="run('all')"
      >
        <FidIcon name="download" :size="16" />
        {{ st.dataPanel.exportAll }}
      </button>

      <button
        type="button"
        :disabled="busy"
        class="flex items-center gap-2 rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="run('dig')"
      >
        <FidIcon name="download" :size="16" />
        {{ st.dataPanel.exportDig }}
      </button>
    </div>

    <p class="text-fid-xs text-fid-text-muted">{{ st.dataPanel.contents }}</p>

    <!--
      The way back (M24). A file picker behind a button, because the input
      itself is not something to style; the report says, line by line, what
      came back and what stayed out and why.
    -->
    <div class="flex flex-col gap-2 border-t border-fid-border pt-3">
      <input
        ref="picker"
        type="file"
        accept="application/json,.json"
        class="sr-only"
        :aria-label="st.dataPanel.importAll"
        @change="importFile"
      />
      <button
        type="button"
        :disabled="busy || importing"
        class="flex items-center gap-2 self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="picker?.click()"
      >
        <FidIcon name="download" :size="16" class="rotate-180" />
        {{ importing ? st.dataPanel.importing : st.dataPanel.importAll }}
      </button>
      <ul
        v-if="imported"
        class="flex flex-col gap-1 text-fid-sm text-fid-text-muted"
        aria-live="polite"
      >
        <li v-for="line in imported" :key="line">{{ line }}</li>
      </ul>
    </div>

    <!--
      CSV, for a spreadsheet (M19 #5). Two files rather than one with a column
      saying which list a row is from: a wantlist row has no copy, no folder
      and no place, and a sheet with half its columns empty is a sheet nobody
      sorts.
    -->
    <div class="flex flex-wrap gap-2 border-t border-fid-border pt-3">
      <button
        type="button"
        :disabled="busy"
        class="flex items-center gap-2 rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="run('collection')"
      >
        <FidIcon name="download" :size="16" />
        {{ st.dataPanel.exportCollectionCsv }}
      </button>
      <button
        type="button"
        :disabled="busy"
        class="flex items-center gap-2 rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="run('wantlist')"
      >
        <FidIcon name="download" :size="16" />
        {{ st.dataPanel.exportWantlistCsv }}
      </button>
    </div>

    <p class="text-fid-xs text-fid-text-muted">{{ st.dataPanel.csvContents }}</p>

    <div class="flex flex-col gap-2 border-t border-fid-border pt-3">
      <button
        v-if="!confirming"
        type="button"
        :disabled="busy"
        class="fid-action gap-2 self-start text-fid-sm text-fid-sig-scarcity underline underline-offset-4 disabled:opacity-50"
        @click="confirming = true"
      >
        <FidIcon name="trash-2" :size="16" />
        {{ st.dataPanel.deleteAll }}
      </button>

      <template v-else>
        <p class="text-fid-sm text-fid-text">{{ st.dataPanel.deleteWarning }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :disabled="busy"
            class="rounded-fid-sm bg-fid-sig-scarcity px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
            @click="deleteAll"
          >
            {{ st.dataPanel.deleteConfirm }}
          </button>
          <button
            type="button"
            class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
            @click="confirming = false"
          >
            {{ st.dataPanel.cancel }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
