<script setup lang="ts">
import type { PasteProgress } from '#shared/protocol'

/**
 * Der Weg aus dem Discogs-Warenkorb hierher.
 *
 * Discogs does not expose a cart over its API — `/marketplace/cart` answers
 * 404 where an endpoint that merely wants a token answers 401 — so Fidelity
 * cannot read what is already sitting over there, and no arrangement of code
 * changes that. What it can do is take the links.
 *
 * Which turns out to be the useful half anyway: once the records are here,
 * they carry the postage ladder, the marginal cost and the fill-up
 * suggestions that Discogs only shows *after* somebody has committed.
 */
const { call } = useFidelityWorker()
const { refresh } = useBasket()

const input = ref('')
const busy = ref(false)
const progress = ref<PasteProgress | null>(null)
const outcome = ref<string | null>(null)
const error = ref<unknown>(null)

/** What the button will cost, counted before it is pressed as everywhere else. */
const count = computed(
  () => (input.value.match(/\/sell\/item\/\d+|^\s*\d{7,}\s*$/gm) ?? []).length,
)

async function paste() {
  if (busy.value || count.value === 0) return

  busy.value = true
  error.value = null
  outcome.value = null

  try {
    const result = await call(
      'basket.paste',
      { input: input.value },
      { onProgress: (p) => (progress.value = p) },
    )
    await refresh()
    input.value = ''

    const parts = [`${result.added} übernommen`]
    if (result.sold > 0) parts.push(`${result.sold} schon verkauft`)
    if (result.unknown > 0) parts.push(`${result.unknown} nicht gefunden`)
    if (result.dealers.length > 1) parts.push(`${result.dealers.length} Läden`)
    outcome.value = `${parts.join(' · ')}.`
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
    progress.value = null
  }
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-5">
    <div class="flex flex-col gap-1">
      <h2 class="text-fid-base font-medium text-fid-text">Aus dem Discogs-Warenkorb</h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">
        Discogs gibt seinen Warenkorb nicht über die Schnittstelle heraus. Kopier die Links der
        Angebote hier herein – Fidelity holt sie und legt jedes in den Korb des Ladens, der es
        verkauft. Danach rechnet der Versand mit.
      </p>
    </div>

    <ErrorNote v-if="error" :cause="error" />

    <label class="flex flex-col gap-2">
      <span class="sr-only">Angebotslinks</span>
      <textarea
        v-model="input"
        rows="3"
        spellcheck="false"
        placeholder="https://www.discogs.com/sell/item/1260275694"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
    </label>

    <p v-if="busy" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      Hole …
      <template v-if="progress">
        <span class="fid-num">{{ progress.done }}</span> von
        <span class="fid-num">{{ progress.total }}</span>
      </template>
    </p>
    <p v-else-if="outcome" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ outcome }}
    </p>

    <button
      type="button"
      :disabled="busy || count === 0"
      class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      @click="paste"
    >
      Übernehmen<template v-if="count > 0">
        <span class="fid-num"> ({{ count }})</span></template
      >
    </button>
  </section>
</template>
