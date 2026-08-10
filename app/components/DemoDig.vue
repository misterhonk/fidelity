<script setup lang="ts">
import type { DemoProgress, DemoResult } from '~~/worker/demo'

/**
 * Fidelity vorführen, bevor jemand einen Schlüssel hergibt.
 *
 * One or two records go in, and what that shop has beside them comes out —
 * scored and reasoned by the same engine a real dig uses. Nothing here is a
 * mock-up; the worker runs `evaluate` and `buildReason` over a collection of
 * one (worker/demo.ts).
 *
 * Costs about nine requests and twenty seconds, and says so before spending
 * them. Nothing runs on load: opening a page must not spend somebody's rate
 * limit, and a first screen that can fail while it is being read is worse than
 * one that waits to be asked.
 */
const { call } = useFidelityWorker()

const seeds = seedsForToday()
const url = ref('')
const running = ref(false)
const progress = ref<DemoProgress | null>(null)
const result = shallowRef<DemoResult | null>(null)
const error = ref<unknown>(null)

/** Reads a listing id out of whatever somebody pasted. */
const pastedId = computed(() => {
  const match = url.value.match(/\/sell\/item\/(\d+)/) ?? url.value.trim().match(/^(\d{7,})$/)
  return match ? Number(match[1]) : null
})

async function run(listingId: number) {
  if (running.value) return

  running.value = true
  error.value = null
  result.value = null
  progress.value = null

  try {
    result.value = await call(
      'demo.run',
      { listingIds: [listingId] },
      { onProgress: (step) => (progress.value = step) },
    )
  } catch (cause) {
    error.value = cause
  } finally {
    running.value = false
    progress.value = null
  }
}

/** What the progress means, in words rather than a bar with no scale. */
const status = computed(() => {
  const step = progress.value
  if (!step) return 'Einen Moment …'
  if (step.step === 'seeds') return 'Hole die Platte …'
  if (step.step === 'shop')
    return `Lese das Sortiment – Seite ${step.done + 1} von ${step.total}`
  return 'Vergleiche …'
})

/** The five worth showing. A demo is an argument, not a result list. */
const shown = computed(() => result.value?.finds.slice(0, 5) ?? [])
</script>

<template>
  <section class="flex flex-col gap-5">
    <div class="flex flex-col gap-2">
      <h2 class="text-fid-xl font-bold text-fid-text">Erst ausprobieren</h2>
      <p class="max-w-prose text-fid-base text-fid-text-muted">
        Nenn eine Platte aus einem Discogs-Laden, und Fidelity sagt dir, was derselbe Laden
        sonst noch hat, das dazu passt. Ohne Anmeldung, ohne Token.
      </p>
    </div>

    <ErrorNote v-if="error" :cause="error" :signed-in="false" />

    <!--
      Der eigene Link zuerst — wer eine Platte im Sinn hat, soll nicht erst
      durch eine fremde Auswahl scrollen.
    -->
    <form class="flex flex-col gap-2" @submit.prevent="pastedId && run(pastedId)">
      <label class="text-fid-sm font-medium text-fid-text" for="demo-url">
        Ein Angebot von Discogs
      </label>
      <div class="flex flex-wrap gap-2">
        <input
          id="demo-url"
          v-model="url"
          type="url"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://www.discogs.com/sell/item/…"
          class="min-w-0 grow rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
        <button
          type="submit"
          :disabled="running || pastedId === null"
          class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        >
          Ansehen
        </button>
      </div>
    </form>

    <!--
      Und für alle anderen: drei Platten, die sich täglich weiterdrehen. Jede
      ist geprüft — der Laden führt nachweislich Nachbarn, sonst wäre die
      Vorführung leer.
    -->
    <div class="flex flex-col gap-2">
      <p class="text-fid-sm text-fid-text-muted">Oder fang mit einer von diesen an:</p>
      <ul class="flex flex-col gap-2">
        <li v-for="seed in seeds" :key="seed.listingId">
          <button
            type="button"
            :disabled="running"
            class="flex w-full flex-col gap-1 rounded-fid-md border border-fid-border p-3 text-left transition-colors hover:border-fid-text-muted disabled:opacity-50"
            @click="run(seed.listingId)"
          >
            <span class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-fid-base text-fid-text">
                {{ seed.artist }} – {{ seed.title }}
              </span>
              <span class="fid-num text-fid-xs text-fid-text-muted">
                {{ seed.label }} · {{ seed.year }}
              </span>
            </span>
            <span class="text-fid-xs text-fid-text-muted">
              {{ seed.promise }} · bei {{ seed.dealer }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!--
      Der Preis wird genannt, bevor er ausgegeben wird — wie überall sonst in
      dieser App, wo ein Knopf das Anfragebudget kostet.
    -->
    <p v-if="running" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ status }}
    </p>
    <p v-else class="text-fid-xs text-fid-text-muted">
      Kostet rund neun Anfragen und zwanzig Sekunden. Ohne Token erlaubt Discogs 25 Anfragen pro
      Minute, deshalb geht es gemächlich zu.
    </p>

    <!-- Das Ergebnis. -->
    <section v-if="result" class="flex flex-col gap-3" aria-live="polite">
      <div class="flex flex-col gap-1">
        <h3 class="text-fid-base font-medium text-fid-text">
          Bei {{ result.dealer }} passt dazu:
        </h3>
        <p class="text-fid-sm text-fid-text-muted">
          Gelesen wurden
          <span class="fid-num">{{ number.format(result.scanned) }}</span> der
          <span class="fid-num">{{ number.format(result.listingsTotal) }}</span> Angebote – die
          neuesten. Ein richtiger Dig liest den ganzen Laden.
        </p>
      </div>

      <p v-if="shown.length === 0" class="max-w-prose text-fid-base text-fid-text-muted">
        In diesem Ausschnitt lag nichts, das dazu passt. Das kommt vor: eine Platte allein ist
        ein dünner Anhaltspunkt, und gelesen wurde nur ein Teil des Ladens. Mit deiner Sammlung
        sieht das anders aus.
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="find in shown"
          :key="find.listingId"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-fid-md border border-fid-border p-3"
        >
          <span class="fid-num text-fid-base font-medium text-fid-text">{{ find.score }}</span>
          <span class="min-w-0 grow text-fid-sm text-fid-text">
            {{ find.artist }} – {{ find.title }}
          </span>
          <a
            class="fid-num text-fid-sm text-fid-text-muted underline underline-offset-4"
            :href="`https://www.discogs.com/sell/item/${find.listingId}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ money(find.price, find.currency) ?? 'ansehen' }}
          </a>
          <span class="w-full text-fid-sm text-fid-text-muted">{{ find.reason }}</span>
        </li>
      </ul>

      <!--
        Was die Vorführung nicht kann, und warum. Ohne diesen Satz sieht
        Fidelity dünner aus, als es ist.
      -->
      <p class="max-w-prose text-fid-xs text-fid-text-muted">
        Das war eine Platte als Anhaltspunkt. Wantlist-Treffer, Produzenten und andere
        Pressungen braucht es deine Sammlung dafür – die stärksten Signale fehlen hier also.
      </p>
    </section>
  </section>
</template>
