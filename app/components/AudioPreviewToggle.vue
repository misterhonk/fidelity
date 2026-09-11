<script setup lang="ts">
import type { Preferences } from '#shared/types'
import { useSettingsMessages } from '~/i18n/settings'

/**
 * The switch for the audio preview (ADR-012).
 *
 * The same shape as `FriendImportToggle`, and for the same reason: both are
 * named exceptions to a rule the app set itself. An exception you cannot see
 * and cannot switch off is not an exception but a back door.
 */
const st = useSettingsMessages()

const { call } = useFidelityWorker()

const prefs = ref<Preferences | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  prefs.value = await call('preferences.get', undefined)
})

async function set(audioPreview: boolean) {
  error.value = null
  try {
    prefs.value = await call('preferences.set', { audioPreview })
  } catch (cause) {
    error.value = cause
  }
}
</script>

<template>
  <section v-if="prefs" class="flex flex-col gap-3">
    <ErrorNote v-if="error" :cause="error" />

    <label class="flex items-start gap-3">
      <input
        :checked="prefs.audioPreview"
        type="checkbox"
        class="mt-1 size-4"
        @change="set(($event.target as HTMLInputElement).checked)"
      />
      <span class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text">{{ st.audio.label }}</span>
        <span class="text-fid-xs text-fid-text-muted">
          {{ prefs.audioPreview ? st.audio.on : st.audio.off }}
        </span>
      </span>
    </label>

    <!--
      What actually happens, named — and what does *not*: the collection goes
      nowhere. Without that difference the exception sounds bigger than it is,
      and anyone switching it off does so for the wrong reason.
    -->
    <WhyNote :label="st.audio.whyLabel">
      {{ st.audio.why }}
    </WhyNote>
  </section>
</template>
