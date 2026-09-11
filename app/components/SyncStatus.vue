<script setup lang="ts">
import { since } from '~/utils/when'

const m = useMessages()

/**
 * How current everything is — in one place, with one button.
 *
 * Fidelity refreshes four different things and each button lived somewhere
 * else: the library sync under Settings → Sync, the horizon under Settings →
 * Collection, the watchlist nowhere at all, the market data in each basket.
 * Nothing was wrong with any of them individually; together they added up to an
 * app whose data quietly aged and never said so.
 *
 * The keeper handles all three cheap ones on its own now (worker/keeper.ts).
 * This says when that last happened and gives it a handle — because "it happens
 * by itself" is only trustworthy when you can watch it having happened.
 */
const props = defineProps<{ collectionSyncedAt: number | null }>()
const emit = defineEmits<{ refreshed: [] }>()

/**
 * `busy` ist der Keeper selbst, `pressed` der Knopf.
 *
 * Zwei Zustände, weil es zwei Anlässe sind: der Keeper läuft beim Öffnen und
 * alle zwanzig Minuten von allein, der Knopf ist eine Bitte. Vorher gab es nur
 * den zweiten — der erste lief stumm, und genau das war die Lücke.
 */
const { last, busy, tick } = useKeeper()
const pressed = ref(false)

/**
 * Hat dieser Lauf schon einen Schritt gemeldet?
 *
 * „Sieht nach …" gehört vor die erste Meldung — der Worker lädt sein Modul,
 * und ein Knopf, der nichts tut, ist schlimmer als eine Zeile Geduld. Danach
 * gehört es nicht mehr hin: gemessen am 2026-09-11 rahmte es die benannten
 * Schritte auf beiden Seiten ein, und das hintere las sich, als finge der Lauf
 * von vorne an.
 */
const gemeldet = ref(false)
watch(busy, (job) => {
  if (job !== null) gemeldet.value = true
})

async function refreshAll() {
  if (pressed.value) return
  pressed.value = true
  gemeldet.value = false
  try {
    await tick({ force: true })
    emit('refreshed')
  } finally {
    pressed.value = false
  }
}

/**
 * What just happened, in one sentence — or how old the state is.
 *
 * A run that changed nothing says so rather than staying silent: "nothing new"
 * is an answer, and a button that appears to do nothing is worse than one that
 * reports a boring result.
 */
const note = computed(() => {
  const words = m.value.freshness

  /*
   * Was gerade läuft, schlägt jede Vergangenheitsform.
   *
   * Und der Schritt wird benannt: „wird aktualisiert" allein ist eine
   * Beschwichtigung, „Sammlung und Wantlist" ist eine Auskunft.
   */
  if (busy.value) return `${words.updating} — ${words.job[busy.value]} …`
  if (pressed.value && !gemeldet.value) return words.looking

  const result = last.value
  if (result?.did.length) {
    const parts: string[] = []
    if (result.stored > 0) parts.push(words.added(result.stored))
    if (result.alerts > 0) parts.push(words.alerts(result.alerts))
    if (parts.length > 0) return parts.join(' · ')
    return words.nothingNew
  }

  const at = props.collectionSyncedAt
  return at ? words.asOf(since(at)) : m.value.common.nothingYet
})
</script>

<template>
  <!--
    Ein `<div>` und kein `<p>` mehr.

    `<p>` nimmt nur Phrasing Content, und `WhyNote` ist ein `<details>`. Der
    Browser schließt den Absatz dann von selbst und hebt das `<details>`
    heraus — die Zeile zerfällt in zwei Blöcke, und zwar nur im gerenderten
    Dokument, nicht im Quelltext. Gemerkt am 2026-09-11 beim Einbau.
  -->
  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-fid-xs text-fid-text-muted">
    <span aria-live="polite">{{ note }}</span>
    <button
      type="button"
      :disabled="pressed || busy !== null"
      class="fid-action underline underline-offset-4 disabled:opacity-50"
      @click="refreshAll"
    >
      {{ m.freshness.refreshAll }}
    </button>
    <WhyNote :label="m.freshness.whyLabel">{{ m.freshness.why }}</WhyNote>
  </div>
</template>
