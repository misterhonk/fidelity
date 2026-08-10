<script setup lang="ts">
import type { Preferences } from '#shared/types'

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

    <p class="text-fid-sm text-fid-text-muted">
      Bestellungen werden immer gelesen – das sind die Läden, bei denen du gekauft hast.
    </p>

    <label class="flex items-start gap-3">
      <input
        :checked="prefs.importFriends"
        type="checkbox"
        class="mt-1 size-4"
        @change="set(($event.target as HTMLInputElement).checked)"
      />
      <span class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text">Auch die Discogs-Freundesliste lesen</span>
        <span class="text-fid-xs text-fid-text-muted">
          Aus, solange du es nicht einschaltest.
        </span>
      </span>
    </label>

    <!--
      The one place in the app that knowingly uses an undocumented endpoint.
      Somebody switching it on is entitled to know that, and to know what
      happens the day it stops working — which is nothing (ADR-009).
    -->
    <WhyNote label="Warum das eine Ausnahme ist">
      Diese App benutzt sonst ausschließlich dokumentierte Discogs-Endpunkte.
      <span class="font-fid-mono">/users/…/friends</span> ist keiner – er funktioniert, steht
      aber in keiner Dokumentation und kann ohne Ankündigung verschwinden. Passiert das,
      verliert der Import eine Quelle und sonst nichts. Deshalb: aus, bis du zustimmst.
    </WhyNote>
  </section>
</template>
