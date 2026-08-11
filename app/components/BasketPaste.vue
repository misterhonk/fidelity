<script setup lang="ts">
import type { PasteProgress } from '#shared/protocol'

import { useBasketMessages } from '~/i18n/basket'

const b = useBasketMessages()
const m = useMessages()
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

/**
 * What the button will cost, counted before it is pressed as everywhere else.
 *
 * Named `count`, which shadows the shared number formatter of the same name for
 * the whole file. Harmless until somebody reaches for the formatter here and
 * gets a ComputedRef instead — which is exactly what happened on 2026-08-11,
 * and what `pnpm typecheck` caught in the same minute.
 */
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

    const words = b.value.paste
    const parts = [words.took(result.added)]
    if (result.sold > 0) parts.push(words.sold(result.sold))
    if (result.unknown > 0) parts.push(words.unknown(result.unknown))
    if (result.dealers.length > 1) parts.push(words.acrossShops(result.dealers.length))
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
      <h2 class="text-fid-base font-medium text-fid-text">{{ b.paste.title }}</h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ b.paste.about }}</p>
    </div>

    <ErrorNote v-if="error" :cause="error" />

    <label class="flex flex-col gap-2">
      <span class="sr-only">{{ b.paste.label }}</span>
      <textarea
        v-model="input"
        rows="3"
        spellcheck="false"
        placeholder="https://www.discogs.com/sell/item/1260275694"
        class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
      />
    </label>

    <p v-if="busy" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ b.paste.fetching }}
      <template v-if="progress">
        {{ m.common.ofTotal(progress.done, progress.total) }}
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
      {{ b.paste.take
      }}<template v-if="count > 0">
        <span class="fid-num"> ({{ count }})</span></template
      >
    </button>
  </section>
</template>
