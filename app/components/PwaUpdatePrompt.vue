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
    class="mx-auto flex w-full max-w-[80rem] flex-wrap items-center gap-3 border-b border-fid-border bg-fid-surface-raised px-6 py-3 text-fid-sm text-fid-text"
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
