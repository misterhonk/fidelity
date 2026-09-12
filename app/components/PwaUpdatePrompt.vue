<script setup lang="ts">
const m = useMessages()

/**
 * The other half of `registerType: 'prompt'`.
 *
 * A new service worker waits until the user says so. Activating it silently
 * would reload the page mid-dig and throw away four minutes of scanning, so
 * the answer here is allowed to be "later" — the banner simply goes away and
 * the update lands on the next visit.
 */
const { $pwa } = useNuxtApp()
const { call } = useFidelityWorker()
const router = useRouter()

/*
 * Quiet by default (M24, docs/17 §8.4): a new version loads by itself the
 * next time the app moves between two screens, unless a dig is running —
 * that is four minutes of somebody's rate limit, and it waits. The banner
 * below is only for the case the dig outlasts the patience, when the person
 * should decide. `updateServiceWorker()` reloads the page, which is what a
 * navigation is anyway.
 */
const waitingSince = ref<number | null>(null)
const ask = ref(false)

async function consider() {
  if (!$pwa?.needRefresh) return
  waitingSince.value ??= Date.now()
  const running = await call('dig.running', undefined).catch(() => null)
  const step = updateStep({
    needRefresh: true,
    digRunning: running !== null,
    waitingSince: waitingSince.value,
    now: Date.now(),
  })
  if (step === 'apply') await $pwa.updateServiceWorker()
  else if (step === 'ask') ask.value = true
}

watch(
  () => $pwa?.needRefresh,
  (waiting) => {
    if (waiting) void consider()
  },
)
router.afterEach(() => void consider())
</script>

<template>
  <div
    v-if="$pwa?.needRefresh && ask"
    role="status"
    class="fid-page flex flex-wrap items-center gap-3 border-b border-fid-border bg-fid-surface-raised py-3 text-fid-sm text-fid-text"
  >
    <p class="grow">{{ m.notice.update.title }}</p>
    <button
      type="button"
      class="rounded-fid-sm border border-fid-border px-3 py-2"
      @click="$pwa.cancelPrompt()"
    >
      {{ m.notice.update.later }}
    </button>
    <button
      type="button"
      class="fid-fill rounded-fid-sm bg-fid-accent-fill px-3 py-2 font-medium text-fid-on-accent"
      @click="$pwa.updateServiceWorker()"
    >
      {{ m.notice.update.reload }}
    </button>
  </div>
</template>
