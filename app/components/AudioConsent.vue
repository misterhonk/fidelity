<script setup lang="ts">
/**
 * The audio preview's consent, where the clips are (ADR-012, amended 2026-09-20).
 *
 * The switch lived under Settings → Your data, and nobody looking at a record
 * with clips on it found it there: the sheet said "switch the preview on" in
 * eight-point grey and sent you three screens away. The decision is small and
 * it is made here, so it is asked here — what happens, in three sentences,
 * and one button. The links to YouTube stay above it either way.
 *
 * Nothing loads before the button, and nothing loads after it until a clip is
 * tapped: the button only throws the same switch the settings throw.
 */
const m = useMessages()
const { call } = useFidelityWorker()

defineProps<{
  /** One line and a button, for the stack; the sheet has room for the reasons. */
  compact?: boolean
}>()

const emit = defineEmits<{ allowed: [] }>()

const busy = ref(false)
const error = ref<unknown>(null)

async function allow() {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    await call('preferences.set', { audioPreview: true })
    emit('allowed')
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-fid-sm border border-fid-border p-3">
    <ErrorNote v-if="error" :cause="error" />
    <p class="text-fid-sm text-fid-text">{{ m.listen.consent.lead }}</p>
    <p v-if="!compact" class="max-w-prose text-fid-xs text-fid-text-muted">
      {{ m.listen.consent.what }}
    </p>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        :disabled="busy"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-accent-fill px-4 text-fid-sm text-fid-accent disabled:opacity-50"
        @click="allow"
      >
        {{ m.listen.consent.yes }}
      </button>
      <NuxtLink
        to="/settings/search#listen"
        class="fid-action text-fid-xs text-fid-text-muted underline underline-offset-4 hover:text-fid-text"
      >
        {{ compact ? m.listen.consent.what : m.listen.consent.settings }}
      </NuxtLink>
    </div>
  </div>
</template>
