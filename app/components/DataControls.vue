<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

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
        error.value = st.value.dataPanel.noDigYet
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
