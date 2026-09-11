<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'

/**
 * Eine Discogs-Bestellung einlesen (M14).
 *
 * **Warum die Nummer eingetippt wird, und warum das keine Schlamperei ist.**
 * `GET /marketplace/orders` ist die Verkäuferseite — für jemanden, der nur
 * kauft, antwortet sie für immer mit `items: 0` (am 2026-09-11 zweimal
 * gemessen, `docs/02`). Eine einzelne Bestellung ist ihrem Käufer dagegen
 * zugänglich. Es gibt also keinen Weg von „ich bin Käufer" zu „hier sind meine
 * Bestellnummern", und der Text sagt das, statt es wie eine fehlende Bequem-
 * lichkeit aussehen zu lassen.
 *
 * **Was es spart:** drei Platten in einer Bestellung sind sonst drei Haken bei
 * „gekauft", von Hand, nachdem der Dig längst weggeräumt ist.
 */

const b = useBasketMessages()
const { call } = useFidelityWorker()

const emit = defineEmits<{ imported: [] }>()

const nummer = ref('')
const laeuft = ref(false)
const fehler = ref<unknown>(null)
const form = ref<string | null>(null)
const ergebnis = ref<{ text: string; dazu: string | null } | null>(null)

async function lesen() {
  if (laeuft.value || !nummer.value.trim()) return

  laeuft.value = true
  fehler.value = null
  form.value = null
  ergebnis.value = null

  try {
    const antwort = await call('orders.import', { orderId: nummer.value })

    if (!antwort.ok) {
      // Eine verunglückte Nummer ist kein Fehler, sondern ein Vertipper — und
      // sie hat keine Anfrage gekostet. Also auch keine Fehlermeldung.
      form.value = b.value.saved.order.badShape
      return
    }

    const anzahl = antwort.records.length
    if (anzahl === 0) {
      ergebnis.value = { text: b.value.saved.order.nothing, dazu: null }
      return
    }

    ergebnis.value = {
      text: antwort.dealer
        ? b.value.saved.order.done(anzahl, antwort.dealer)
        : b.value.saved.order.doneNoDealer(anzahl),
      /*
       * „Davon hattest du schon" nur, wenn es zutrifft. Eine Zeile, die immer
       * dasteht und meistens null sagt, liest niemand zweimal.
       */
      dazu: antwort.enriched > 0 ? b.value.saved.order.already(antwort.enriched) : null,
    }
    nummer.value = ''
    emit('imported')
  } catch (cause) {
    fehler.value = cause
  } finally {
    laeuft.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4">
    <h2 class="text-fid-base font-medium text-fid-text">{{ b.saved.order.title }}</h2>

    <form class="flex flex-wrap items-center gap-2" @submit.prevent="lesen()">
      <label class="sr-only" for="order-id">{{ b.saved.order.label }}</label>
      <input
        id="order-id"
        v-model="nummer"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        :placeholder="b.saved.order.hint"
        class="fid-num min-w-0 grow rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
      />
      <button
        type="submit"
        class="fid-action min-h-11 shrink-0 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-40"
        :disabled="laeuft || nummer.trim().length === 0"
      >
        {{ laeuft ? b.saved.order.reading : b.saved.order.submit }}
      </button>
    </form>

    <p v-if="form" class="text-fid-sm text-fid-text-muted" aria-live="polite">{{ form }}</p>

    <p v-else-if="ergebnis" class="text-fid-sm text-fid-text" aria-live="polite">
      {{ ergebnis.text }}
      <template v-if="ergebnis.dazu"> {{ ergebnis.dazu }}</template>
    </p>

    <ErrorNote v-if="fehler" :cause="fehler" />

    <WhyNote :label="b.saved.order.whyLabel">{{ b.saved.order.why }}</WhyNote>
  </section>
</template>
