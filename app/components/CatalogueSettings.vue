<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'
import { count } from '~/utils/money'

const st = useSettingsMessages()

const { call } = useFidelityWorker()

const url = ref('')
const busy = ref(false)
const error = ref<unknown>(null)
const status = ref<{ ok: boolean; build: string; releases: number } | null>(null)
const hint = ref<string | null>(null)

onMounted(async () => {
  const preferences = await call('preferences.get', undefined)
  url.value = preferences.catalogueUrl ?? ''
  if (url.value) void test()
  else void discover()
})

/**
 * The hub's search, one door fewer: a catalogue has no secret, so a found
 * one is filled in and tested, and saving is the one tap left. Not kept
 * without asking — a catalogue found beside the app is a build somebody
 * else chose; the reader sees its date before deciding.
 */
async function discover() {
  hint.value = null
  busy.value = true
  try {
    const found = await call('catalogue.discover', undefined)
    if (found.url) {
      url.value = found.url
      hint.value = st.value.cataloguePanel.found
      void test()
      return
    }
    hint.value = st.value.cataloguePanel.notFound
  } catch {
    hint.value = st.value.cataloguePanel.searchFailed
  } finally {
    busy.value = false
  }
}

async function test() {
  busy.value = true
  error.value = null
  status.value = null
  try {
    status.value = await call('catalogue.check', { url: url.value })
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
    await call('preferences.set', { catalogueUrl: url.value.trim() || null })
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
    <WhyNote :label="st.cataloguePanel.whyLabel">{{ st.cataloguePanel.why }}</WhyNote>

    <p class="text-fid-sm text-fid-text-muted">{{ st.cataloguePanel.optional }}</p>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="hint" class="max-w-prose text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ hint }}
    </p>

    <div class="flex flex-col gap-2">
      <label class="text-fid-sm font-medium text-fid-text" for="catalogue-url">
        {{ st.cataloguePanel.url }}
      </label>
      <input
        id="catalogue-url"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="http://localhost:8788"
        class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy"
        class="fid-fill rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        @click="save"
      >
        {{ st.cataloguePanel.save }}
      </button>
      <button
        type="button"
        :disabled="busy || !url.trim()"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="test"
      >
        {{ st.cataloguePanel.test }}
      </button>
      <button
        type="button"
        :disabled="busy"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="discover"
      >
        {{ st.cataloguePanel.discover }}
      </button>
    </div>

    <p v-if="status" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ st.cataloguePanel.reachable }} · {{ st.cataloguePanel.build(status.build) }} ·
      {{ st.cataloguePanel.releases(count(status.releases)) }}
    </p>
  </section>
</template>
