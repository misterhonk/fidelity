<script setup lang="ts">
/**
 * The other half of `registerType: 'prompt'`.
 *
 * A new service worker waits until the user says so. Activating it silently
 * would reload the page mid-dig and throw away four minutes of scanning, so
 * the answer here is allowed to be "later" — the banner simply goes away and
 * the update lands on the next visit.
 */
const { $pwa } = useNuxtApp()
</script>

<template>
  <div
    v-if="$pwa?.needRefresh"
    role="status"
    class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-fid-md border border-fid-border bg-fid-surface-raised px-4 py-3 text-fid-sm text-fid-text shadow-fid-elev-2"
  >
    <p class="grow">Eine neue Version steht bereit.</p>
    <button
      type="button"
      class="rounded-fid-sm border border-fid-border px-3 py-2"
      @click="$pwa.cancelPrompt()"
    >
      Später
    </button>
    <button
      type="button"
      class="rounded-fid-sm bg-fid-accent px-3 py-2 font-medium text-fid-n-990"
      @click="$pwa.updateServiceWorker()"
    >
      Neu laden
    </button>
  </div>
</template>
