<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'

/**
 * "Did it arrive?" — one record, three buttons (M14).
 *
 * **Without this line nothing ever accumulates.** A shop's honesty rate needs
 * five judged purchases, and nobody goes to "saved → bought" of their own
 * accord to answer a question they do not expect to find there. So the asking
 * happens where people are already looking.
 *
 * Always **one** record. A list of open questions on the start page is
 * homework; one question with three buttons is a second. Once it is answered
 * the next moves up — and when none is left the box disappears rather than
 * standing there as an empty field.
 *
 * The time bound ("ten days after the purchase at the earliest") sits in the
 * worker, not here: when a question is due is a decision about the data.
 */

const b = useBasketMessages()
const { call } = useFidelityWorker()

type Open = Awaited<ReturnType<typeof load>>[number]

async function load() {
  return call('grading.awaiting', undefined)
}

const open = shallowRef<Open[]>([])
const busy = ref(false)

onMounted(async () => {
  open.value = await load()
})

const asking = computed(() => open.value[0] ?? null)

/** The record's text, or its number — nothing is invented here. */
function label(record: Open): string {
  const written = [record.artist, record.title].filter(Boolean).join(' – ')
  return written || b.value.saved.release(record.listingId)
}

async function answer(record: Open, how: 'as-described' | 'better' | 'worse') {
  if (busy.value) return
  busy.value = true
  try {
    await call('grading.record', { listingId: record.listingId, arrived: how })
    open.value = await load()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section
    v-if="asking"
    class="flex flex-col gap-2 rounded-fid-md border border-fid-border bg-fid-surface p-4"
    aria-labelledby="arrival-question"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="arrival-question" class="text-fid-base font-medium text-fid-text">
        {{ b.saved.arrival.nudge }}
      </h2>
      <!--
        The rest is reachable but not listed here: the purchase list is the
        place for every open question, this line for the next one.
      -->
      <NuxtLink
        v-if="open.length > 1"
        to="/saved"
        class="fid-num shrink-0 text-fid-sm text-fid-text-muted underline underline-offset-4"
      >
        {{ b.saved.arrival.more(count(open.length - 1)) }}
      </NuxtLink>
    </div>

    <p class="min-w-0 truncate text-fid-sm text-fid-text">
      {{ label(asking) }}
      <template v-if="asking.dealer">
        <span class="text-fid-text-muted"> · {{ asking.dealer }}</span>
      </template>
    </p>

    <!--
      The group carries the question, not the individual button.

      Three buttons with the same `aria-label` would have the same name three
      times over and be indistinguishable to a screen reader. A button's name
      is its answer; the question stands once above them.
    -->
    <div
      role="group"
      :aria-label="b.saved.arrival.askFor(label(asking))"
      class="flex flex-wrap items-center gap-2"
    >
      <button
        v-for="how in ['as-described', 'better', 'worse'] as const"
        :key="how"
        type="button"
        class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        :disabled="busy"
        @click="answer(asking, how)"
      >
        {{
          how === 'as-described'
            ? b.saved.arrival.asDescribed
            : how === 'better'
              ? b.saved.arrival.better
              : b.saved.arrival.worse
        }}
      </button>
    </div>
  </section>
</template>
