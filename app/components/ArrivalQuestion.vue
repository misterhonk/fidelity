<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'

/**
 * „Ist sie angekommen?" — eine Platte, drei Knöpfe (M14).
 *
 * **Ohne diese Zeile sammelt sich nie etwas an.** Die Ehrlichkeitsquote eines
 * Ladens braucht fünf beurteilte Käufe, und niemand geht von selbst auf
 * „Gemerkt → Gekauft", um eine Frage zu beantworten, die er dort nicht
 * vermutet. Gefragt wird deshalb da, wo man ohnehin hinsieht.
 *
 * Immer nur **eine** Platte. Eine Liste offener Fragen auf der Startseite ist
 * eine Hausaufgabe; eine Frage mit drei Knöpfen ist eine Sekunde. Ist sie
 * beantwortet, rückt die nächste nach — und wenn keine mehr wartet,
 * verschwindet der Kasten, statt als leeres Feld stehen zu bleiben.
 *
 * Die Zeitgrenze („frühestens zehn Tage nach dem Kauf") sitzt im Worker, nicht
 * hier: wann eine Frage fällig ist, ist eine Entscheidung über die Daten.
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

/** Der Text der Platte, oder ihre Nummer — erfunden wird hier nichts. */
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
        Der Rest ist erreichbar, wird hier aber nicht aufgezählt: die Kaufliste
        ist der Ort für alle offenen Fragen, diese Zeile für die nächste.
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
      Die Frage trägt die Gruppe, nicht der einzelne Knopf.

      Drei Knöpfe mit demselben `aria-label` hätten drei Mal denselben Namen
      und wären für eine Vorlesesoftware nicht zu unterscheiden. Der Name eines
      Knopfes ist seine Antwort; die Frage steht einmal darüber.
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
