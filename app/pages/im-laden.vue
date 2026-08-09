<script setup lang="ts">
import type { DigWithMatches } from '#shared/protocol'

useSeoMeta({
  title: 'Im Laden',
  description: 'Die Fundliste für die Hand am Plattenfach – offline, große Ziele.',
})

const { call } = useFidelityWorker()
const { online } = useOnline()
const { verdicts, judge, load: loadFeedback } = useFeedback()
const { contains, toggle, load: loadBasket } = useBasket()

// Shallow: the in-store screen judges records too, and a proxy cannot
// cross postMessage. Same reason as the dig screen.
const result = shallowRef<DigWithMatches | null>(null)
const loading = ref(true)
const query = ref('')

onMounted(async () => {
  try {
    result.value = await call('dig.latest', undefined)
    await Promise.all([loadFeedback(), loadBasket()])
  } finally {
    loading.value = false
  }
})

/**
 * Everything, by score, with the shortlist folded in.
 *
 * No filter bar, no density switch, no sorting. Standing in a shop holding a
 * record you want one question answered — is this one of mine — and every
 * control between you and that answer is in the way.
 */
const matches = computed(() => {
  const all = result.value?.matches ?? []
  const needle = query.value.trim()
  return needle ? all.filter((match) => textMatches(match, needle)) : all
})

const expired = computed(() => {
  const dig = result.value?.dig
  return dig ? Date.now() > dig.expiresAt : false
})

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
    <!--
      The in-store screen (docs/05 §3 row 9).

      Built for a phone in one hand and a record in the other: 56 px rows, one
      column, nothing that needs precision. It reads only from IndexedDB, so it
      is complete without a network — which is the point, because record shops
      are basements.
    -->
    <div class="flex items-baseline justify-between gap-3">
      <h1 class="text-fid-xl font-bold text-fid-text">Im Laden</h1>
      <NuxtLink class="text-fid-sm text-fid-text-muted underline underline-offset-4" to="/">
        Zurück
      </NuxtLink>
    </div>

    <p v-if="loading" class="text-fid-base text-fid-text-muted">Wird geladen …</p>

    <p v-else-if="!result" class="text-fid-base text-fid-text-muted">
      Noch kein Dig da. Scanne einen Händler, bevor du losgehst – hier drin geht es dann auch
      ohne Empfang.
    </p>

    <template v-else>
      <p class="text-fid-sm text-fid-text-muted">
        {{ result.dig.dealer }} ·
        <span class="fid-num">{{ result.matches.length }}</span> Treffer<template
          v-if="!online"
        >
          · offline, alles aus dem Gerät</template
        >
      </p>

      <p v-if="expired" role="status" class="text-fid-sm text-fid-sig-gap">
        Älter als sechs Stunden – Preise und Zustände dürfen nicht mehr angezeigt werden. Die
        Treffer und ihre Begründungen stehen weiter.
      </p>

      <!-- Big enough to hit while walking. -->
      <input
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Künstler oder Titel"
        aria-label="Treffer durchsuchen"
        class="rounded-fid-md border border-fid-border bg-fid-surface px-4 py-3 text-fid-base text-fid-text"
      />

      <p v-if="matches.length === 0" class="text-fid-base text-fid-text-muted">
        Nichts dabei mit diesem Namen.
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="match in matches"
          :key="match.listingId"
          class="flex min-h-14 items-center gap-3 rounded-fid-md border border-fid-border px-3 py-2"
        >
          <span
            class="fid-num w-10 shrink-0 text-center text-fid-lg font-bold text-fid-text"
            :aria-label="`Barry Score ${match.score} von 100`"
          >
            {{ match.score }}
          </span>

          <!--
            The title gets the full width and the price moves under it. Holding
            a record in a shop, the one question is whether this is one of
            yours, and "Portishea…" does not answer it.
          -->
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate text-fid-base text-fid-text">
              {{ match.artist }} – {{ match.title }}
            </span>
            <span class="flex items-baseline gap-2">
              <span
                v-if="money(match.price, match.currency)"
                class="fid-num shrink-0 text-fid-sm text-fid-text-muted"
              >
                {{ money(match.price, match.currency) }}
              </span>
              <span class="truncate text-fid-xs text-fid-text-muted">{{ match.reason }}</span>
            </span>
          </span>

          <!--
            Two targets, both 44 px, both one-handed: is it for me, and did I
            take it. Everything else belongs on a desk.
          -->
          <button
            type="button"
            :aria-pressed="contains(match.listingId)"
            :aria-label="contains(match.listingId) ? 'Aus dem Korb nehmen' : 'In den Korb'"
            class="size-11 shrink-0 rounded-fid-sm border text-fid-lg"
            :class="
              contains(match.listingId)
                ? 'border-fid-accent bg-fid-accent/15'
                : 'border-fid-border text-fid-text-muted'
            "
            @click="toggle(match.digId, match.listingId)"
          >
            <span aria-hidden="true">🛒</span>
          </button>

          <button
            type="button"
            :aria-pressed="verdicts[match.listingId] === 'wrong'"
            aria-label="Danebengegriffen"
            class="size-11 shrink-0 rounded-fid-sm border text-fid-lg"
            :class="
              verdicts[match.listingId] === 'wrong'
                ? 'border-fid-accent bg-fid-accent/15'
                : 'border-fid-border text-fid-text-muted'
            "
            @click="judge(match, 'wrong')"
          >
            <span aria-hidden="true">👎</span>
          </button>
        </li>
      </ul>
    </template>
  </main>
</template>
