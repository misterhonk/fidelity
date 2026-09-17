<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'
import { money } from '~/utils/money'

/**
 * Reading a Discogs order (M14).
 *
 * **Why the number is typed in, and why that is not sloppiness.**
 * `GET /marketplace/orders` is the seller side — for somebody who only buys it
 * answers `items: 0` forever (measured twice on 2026-09-11, `docs/02`). A
 * single order, by contrast, is readable by its buyer. So there is no route
 * from "I am the buyer" to "here are my order numbers", and the text says so
 * rather than letting it look like a missing convenience.
 *
 * **What it saves:** three records in one order are otherwise three ticks at
 * "bought", by hand, after the dig has long been cleared away.
 */

const b = useBasketMessages()
const { call } = useFidelityWorker()

const emit = defineEmits<{ imported: [] }>()

const nummer = ref('')
const laeuft = ref(false)
const failure = ref<unknown>(null)
const form = ref<string | null>(null)
const result = ref<{ text: string; dazu: string | null; postage: string | null } | null>(null)

async function read() {
  if (laeuft.value || !nummer.value.trim()) return

  laeuft.value = true
  failure.value = null
  form.value = null
  result.value = null

  try {
    const answer = await call('orders.import', { orderId: nummer.value })

    if (!answer.ok) {
      // A malformed number is not an error but a typo — and it cost no
      // request. So no error message either.
      form.value = b.value.saved.order.badShape
      return
    }

    const count = answer.records.length
    if (count === 0) {
      result.value = { text: b.value.saved.order.nothing, dazu: null, postage: null }
      return
    }

    result.value = {
      text: answer.dealer
        ? b.value.saved.order.done(count, answer.dealer)
        : b.value.saved.order.doneNoDealer(count),
      /*
       * "You already had some of these" only when it is true. A line that
       * always stands there and mostly says zero is read twice by nobody.
       */
      dazu: answer.enriched > 0 ? b.value.saved.order.already(answer.enriched) : null,
      // What the parcel cost to post, now the shop's tier for that count (ADR-017).
      postage: answer.postage
        ? b.value.saved.order.postage(
            answer.postage.records,
            money(answer.postage.value, answer.postage.currency) ?? '',
          )
        : null,
    }
    nummer.value = ''
    emit('imported')
  } catch (cause) {
    failure.value = cause
  } finally {
    laeuft.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4">
    <h2 class="text-fid-base font-medium text-fid-text">{{ b.saved.order.title }}</h2>

    <form class="flex flex-wrap items-center gap-2" @submit.prevent="read()">
      <label class="sr-only" for="order-id">{{ b.saved.order.label }}</label>
      <input
        id="order-id"
        v-model="nummer"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        :placeholder="b.saved.order.hint"
        class="fid-num min-w-0 grow fid-field px-3 py-2 text-fid-sm text-fid-text"
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

    <p v-else-if="result" class="text-fid-sm text-fid-text" aria-live="polite">
      {{ result.text }}
      <template v-if="result.dazu"> {{ result.dazu }}</template>
      <template v-if="result.postage"> {{ result.postage }}</template>
    </p>

    <ErrorNote v-if="failure" :cause="failure" />

    <WhyNote :label="b.saved.order.whyLabel">{{ b.saved.order.why }}</WhyNote>
  </section>
</template>
