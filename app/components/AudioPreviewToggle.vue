<script setup lang="ts">
import type { Preferences } from '#shared/types'
import { useSettingsMessages } from '~/i18n/settings'

/**
 * Der Schalter für die Hörprobe (ADR-012).
 *
 * Dieselbe Form wie `FriendImportToggle`, und aus demselben Grund: beides sind
 * benannte Ausnahmen von einer Regel, die die App sich selbst gegeben hat.
 * Eine Ausnahme, die man nicht sieht und nicht abwählen kann, ist keine
 * Ausnahme, sondern eine Hintertür.
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
      Was tatsächlich passiert, beim Namen genannt — und was *nicht*: die
      Sammlung geht nirgendwohin. Ohne diesen Unterschied klingt die Ausnahme
      größer, als sie ist, und wer sie abwählt, tut es aus dem falschen Grund.
    -->
    <WhyNote :label="st.audio.whyLabel">
      {{ st.audio.why }}
    </WhyNote>
  </section>
</template>
