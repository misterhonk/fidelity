<script setup lang="ts">
import type { Preferences } from '#shared/types'

const m = useMessages()

const { call } = useFidelityWorker()

const prefs = ref<Preferences | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  prefs.value = await call('preferences.get', undefined)
})

async function set(importFriends: boolean) {
  error.value = null
  try {
    prefs.value = await call('preferences.set', { importFriends })
  } catch (cause) {
    error.value = cause
  }
}
</script>

<template>
  <section v-if="prefs" class="flex flex-col gap-3">
    <ErrorNote v-if="error" :cause="error" />

    <p class="text-fid-sm text-fid-text-muted">{{ m.settings.search.dealers.ordersAlways }}</p>

    <label class="flex items-start gap-3">
      <input
        :checked="prefs.importFriends"
        type="checkbox"
        class="mt-1 size-4"
        @change="set(($event.target as HTMLInputElement).checked)"
      />
      <span class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text">{{ m.settings.search.dealers.friends }}</span>
        <span class="text-fid-xs text-fid-text-muted">
          {{ m.settings.search.dealers.friendsOff }}
        </span>
      </span>
    </label>

    <!--
      The one place in the app that knowingly uses an undocumented endpoint.
      Somebody switching it on is entitled to know that, and to know what
      happens the day it stops working — which is nothing (ADR-009).
    -->
    <WhyNote :label="m.settings.search.dealers.whyLabel">
      {{ m.settings.search.dealers.why }}
      <span class="font-fid-mono">/users/…/friends</span>
      {{ m.settings.search.dealers.whyAfter }}
    </WhyNote>
  </section>
</template>
