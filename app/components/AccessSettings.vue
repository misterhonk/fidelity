<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()
const { call } = useFidelityWorker()

const key = ref('')
const stored = ref<string | null>(null)
const shown = ref(false)
const busy = ref(false)
const error = ref<unknown>(null)
const saved = ref(false)

onMounted(async () => {
  const preferences = await call('preferences.get', undefined)
  stored.value = preferences.accessKey
  key.value = preferences.accessKey ?? ''
})

/** What the key says about itself — tier and validity, read off the string. */
const claims = computed(() => decodeAccessKey(key.value))
const expired = computed(() => claims.value !== null && claims.value.validUntil <= Date.now())

async function save() {
  busy.value = true
  error.value = null
  saved.value = false
  try {
    const trimmed = key.value.trim() || null
    await call('preferences.set', { accessKey: trimmed })
    stored.value = trimmed
    key.value = trimmed ?? ''
    saved.value = true
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function remove() {
  key.value = ''
  await save()
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <WhyNote :label="st.accessPanel.whyLabel">{{ st.accessPanel.why }}</WhyNote>
    <p class="text-fid-sm text-fid-text-muted">{{ st.accessPanel.optional }}</p>

    <ErrorNote v-if="error" :cause="error" />

    <div class="flex flex-col gap-2">
      <label class="text-fid-sm font-medium text-fid-text" for="access-key">
        {{ st.accessPanel.key }}
      </label>
      <!-- The same eye the hub's secret has: a long word typed against dots is typed twice. -->
      <div class="flex gap-2">
        <input
          id="access-key"
          v-model="key"
          :type="shown ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          autocapitalize="off"
          class="min-w-0 grow fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
        <button
          type="button"
          class="fid-action flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm border border-fid-border text-fid-text-muted hover:text-fid-text"
          :aria-label="shown ? st.accessPanel.hideKey : st.accessPanel.showKey"
          :aria-pressed="shown"
          @click="shown = !shown"
        >
          <FidIcon :name="shown ? 'eye-off' : 'eye'" :size="18" aria-hidden="true" />
        </button>
      </div>
      <p class="text-fid-xs text-fid-text-muted">{{ st.accessPanel.notYourToken }}</p>
    </div>

    <!-- What the string says, before it is saved: a wrong paste shows as "not a key" here. -->
    <p
      v-if="key.trim() && !claims"
      class="text-fid-sm text-fid-sig-scarcity"
      aria-live="polite"
    >
      {{ st.accessPanel.notAKey }}
    </p>
    <p v-else-if="claims" class="text-fid-sm text-fid-text" aria-live="polite">
      {{ st.accessPanel.reads(st.supportPanel.tierName(claims.tier), day(claims.validUntil)) }}
      <span v-if="expired" class="text-fid-sig-scarcity"> · {{ st.accessPanel.expired }}</span>
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :disabled="busy"
        class="fid-fill rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent disabled:opacity-50"
        @click="save"
      >
        {{ st.accessPanel.save }}
      </button>
      <button
        v-if="stored"
        type="button"
        :disabled="busy"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="remove"
      >
        {{ st.accessPanel.remove }}
      </button>
    </div>

    <p v-if="saved" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ stored ? st.accessPanel.saved : st.accessPanel.removed }}
    </p>
  </section>
</template>
