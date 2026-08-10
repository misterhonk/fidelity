<script setup lang="ts">
import type { MarkedOverview, MarkedRecord } from '#shared/types'

// How long ago you said yes. A shortlist is also a record of hesitation.
import { since } from '~/utils/when'

useSeoMeta({
  title: 'Gemerkt',
  description: 'Die Platten, zu denen du ja gesagt hast – auch wenn der Dig längst weg ist.',
})

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const overview = shallowRef<MarkedOverview | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

/**
 * Fresh prices, held here and nowhere else.
 *
 * They are marketplace numbers: allowed on screen for six hours, never on
 * disk (CLAUDE.md rule 4). A reload throws them away, which is exactly right —
 * the next reload would not know how old they were.
 */
const prices = ref<
  Record<number, { price: number | null; currency: string | null; condition: string | null }>
>({})

const checking = ref(false)
const progress = ref<{ done: number; total: number } | null>(null)
const checkResult = ref<string | null>(null)

/*
 * Into the basket, weeks later.
 *
 * Without this the shortlist is a dead end: the dig it came from was pruned
 * long ago, so there is nothing left to add from. One shop at a time, because
 * a basket is one shipment — the worker enforces that anyway, and saying it
 * here beats letting somebody discover it by losing a basket.
 */
const { refresh: refreshBasket } = useBasket()
const moving = ref<string | null>(null)
/** Whose result this is — otherwise one message appears under every shop. */
const moveResult = ref<{ dealer: string; text: string } | null>(null)

/** For the screen-reader labels — the row's own text, or its id when it has none. */
function label(record: MarkedRecord): string {
  const written = [record.artist, record.title].filter(Boolean).join(' – ')
  return written || `Release ${record.releaseId}`
}

/*
 * Both of these change a stored verdict rather than writing a new one. The
 * signal snapshot is the reason the store exists at all (docs/03 §7), and a
 * fresh row would throw it away — the record was judged with the reasons it
 * had at the time, and that is what makes the whole store analysable later.
 */
async function mark(record: MarkedRecord, verdict: 'bought') {
  error.value = null
  try {
    overview.value = await call('feedback.verdict', { listingId: record.listingId, verdict })
  } catch (cause) {
    error.value = cause
  }
}

async function forget(record: MarkedRecord) {
  error.value = null
  try {
    overview.value = await call('feedback.forget', { listingId: record.listingId })
  } catch (cause) {
    error.value = cause
  }
}

async function intoBasket(group: { dealer: string | null; records: MarkedRecord[] }) {
  if (moving.value) return

  const open = group.records
    .filter((record) => !record.soldAt)
    .map((record) => record.listingId)
  if (open.length === 0) return

  moving.value = group.dealer ?? ''
  moveResult.value = null
  error.value = null

  try {
    const result = await call(
      'basket.fromMarked',
      { listingIds: open },
      {
        onProgress: (update) => {
          progress.value = update
        },
      },
    )
    await refreshBasket()
    await load()

    moveResult.value = {
      dealer: group.dealer ?? '',
      text:
        result.sold === 0
          ? `${number.format(result.added)} im Korb.`
          : `${number.format(result.added)} im Korb, ${number.format(result.sold)} war schon weg.`,
    }
  } catch (cause) {
    error.value = cause
  } finally {
    moving.value = null
    progress.value = null
  }
}

async function load() {
  overview.value = await call('feedback.marked', undefined)
}

onMounted(async () => {
  try {
    await load()
  } finally {
    loading.value = false
  }
})

const number = new Intl.NumberFormat('de-DE')
const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
}

async function check() {
  if (checking.value) return

  checking.value = true
  checkResult.value = null
  error.value = null

  try {
    const result = await call('feedback.check', undefined, {
      onProgress: (update) => {
        progress.value = update
      },
    })
    prices.value = result.prices
    await load()

    const left = Object.keys(result.prices).length
    checkResult.value =
      result.sold === 0
        ? `Alle ${number.format(left)} noch zu haben.`
        : `${number.format(result.sold)} inzwischen weg, ${number.format(left)} noch da.`
  } catch (cause) {
    error.value = cause
  } finally {
    checking.value = false
    progress.value = null
  }
}
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[80rem] flex-col gap-6 px-6 py-10">
    <header class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Gemerkt</h1>
      <BasketTabs />
    </header>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="loading" class="text-fid-base text-fid-text-muted">Wird geladen …</p>

    <p v-else-if="!overview || overview.total === 0" class="text-fid-base text-fid-text-muted">
      Noch nichts gemerkt. Der Daumen nach oben im Dig legt eine Platte hier ab – und hier
      bleibt sie, auch wenn der Dig längst weg ist.
    </p>

    <template v-else>
      <!--
        The point of the screen, said once: a dig is temporary, this is not.
      -->
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p class="text-fid-base text-fid-text-muted">
          <template v-if="overview.total === 1">Eine Platte</template>
          <template v-else>
            <span class="fid-num text-fid-text">{{ number.format(overview.total) }}</span>
            Platten
          </template>
          vorgemerkt bei
          <!--
            "bei 1 Laden" is arithmetic, not German. A number that reads out
            loud as a word gets written as one.
          -->
          <template v-if="overview.groups.length === 1">einem Laden.</template>
          <template v-else>
            <span class="fid-num text-fid-text">{{ overview.groups.length }}</span> Läden.
          </template>
          Digs werden nach fünf weggeräumt – das hier bleibt.
        </p>

        <!-- The cost named before it is spent, same as everywhere else. -->
        <button
          v-if="overview.stillOpen > 0"
          type="button"
          class="fid-action shrink-0 text-fid-sm text-fid-accent underline underline-offset-4 disabled:opacity-50"
          :disabled="checking"
          @click="check()"
        >
          Noch da?<span class="fid-num"> ({{ overview.stillOpen }})</span>
        </button>
      </div>

      <p v-if="checking" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        Frage nach …
        <template v-if="progress">
          <span class="fid-num">{{ progress.done }}</span> von
          <span class="fid-num">{{ progress.total }}</span>
        </template>
      </p>
      <p v-else-if="checkResult" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ checkResult }}
      </p>

      <!--
        Grouped by shop, biggest group first. Postage is per shipment, so four
        records at one dealer is a different proposition from four at four —
        and that is the decision this screen exists to support.
      -->
      <section
        v-for="group in overview.groups"
        :key="group.dealer ?? 'unbekannt'"
        class="flex flex-col gap-2"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="text-fid-lg font-bold text-fid-text">
            <template v-if="group.dealer">{{ group.dealer }}</template>
            <template v-else>Ohne Laden</template>
            <span class="fid-num ml-2 text-fid-sm font-normal text-fid-text-muted">
              {{ group.records.length }}
            </span>
          </h2>

          <!--
            The whole shop at once, because postage is per shipment and that is
            the only reason to group by shop in the first place. The cost is
            named; the basket holds one shop, so this replaces what is in it.
          -->
          <button
            v-if="group.dealer && group.open > 0"
            type="button"
            class="fid-action shrink-0 text-fid-sm text-fid-accent underline underline-offset-4 disabled:opacity-50"
            :disabled="moving !== null"
            @click="intoBasket(group)"
          >
            <template v-if="moving === group.dealer">
              Hole …
              <template v-if="progress">
                <span class="fid-num">{{ progress.done }}</span
                >/<span class="fid-num">{{ progress.total }}</span>
              </template>
            </template>
            <template v-else>
              In den Korb<span class="fid-num"> ({{ group.open }})</span>
            </template>
          </button>
        </div>

        <p
          v-if="moveResult?.dealer === (group.dealer ?? '') && moving === null"
          class="text-fid-sm text-fid-text-muted"
          aria-live="polite"
        >
          {{ moveResult.text }}
          <NuxtLink to="/korb" class="text-fid-accent underline underline-offset-4">
            Versand rechnen
          </NuxtLink>
        </p>

        <ul class="grid gap-2 @4xl:grid-cols-2">
          <li
            v-for="record in group.records"
            :key="record.listingId"
            class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-fid-md border px-4 py-3"
            :class="record.soldAt ? 'border-fid-border/50' : 'border-fid-border'"
          >
            <a
              class="min-w-0 grow text-fid-base underline-offset-4 hover:underline"
              :class="record.soldAt ? 'text-fid-text-muted line-through' : 'text-fid-text'"
              :href="`https://www.discogs.com/sell/item/${record.listingId}`"
              target="_blank"
              rel="noopener noreferrer"
            >
              <template v-if="record.artist || record.title">
                {{ record.artist }}<template v-if="record.artist && record.title"> – </template
                >{{ record.title }}
              </template>
              <!-- Written before this store kept titles. Says so instead of
                   inventing one; the release id still gets you there. -->
              <template v-else>Release {{ record.releaseId }}</template>
            </a>

            <span v-if="record.soldAt" class="shrink-0 text-fid-xs text-fid-sig-gap">weg</span>
            <!-- Fresh, this second, from the check. Never stored. -->
            <span
              v-else-if="prices[record.listingId]"
              class="fid-num shrink-0 text-fid-sm text-fid-text"
            >
              {{ money(prices[record.listingId]!.price, prices[record.listingId]!.currency) }}
              <span
                v-if="prices[record.listingId]!.condition"
                class="text-fid-xs text-fid-text-muted"
              >
                {{ prices[record.listingId]!.condition }}
              </span>
            </span>

            <span class="shrink-0 text-fid-xs text-fid-text-muted">
              <span class="fid-num">{{ record.score }}</span> · {{ since(record.createdAt) }}
            </span>

            <!--
              Changing your mind, which until now could only be done inside the
              dig — and the dig is the one thing here guaranteed to be gone.
              A shortlist you cannot take anything off is a list that only
              grows, and a list that only grows stops being read.
            -->
            <span class="flex shrink-0 basis-full gap-4 text-fid-xs @sm:basis-auto">
              <button
                v-if="!record.soldAt"
                type="button"
                class="fid-action text-fid-text-muted underline underline-offset-4"
                :aria-label="`${label(record)} als gekauft eintragen`"
                @click="mark(record, 'bought')"
              >
                gekauft
              </button>
              <button
                type="button"
                class="fid-action text-fid-text-muted underline underline-offset-4"
                :aria-label="`${label(record)} von der Merkliste nehmen`"
                @click="forget(record)"
              >
                vergessen
              </button>
            </span>
          </li>
        </ul>
      </section>

      <!--
        What you actually bought. Not a shortlist any more but the same store,
        and the one place in this app that says "das hast du dir geholt".
      -->
      <section
        v-if="overview.bought.length > 0"
        class="flex flex-col gap-2 border-t border-fid-border pt-6"
      >
        <h2 class="text-fid-lg font-bold text-fid-text">Gekauft</h2>
        <ul class="flex flex-col gap-1">
          <li
            v-for="record in overview.bought"
            :key="record.listingId"
            class="flex flex-wrap items-baseline justify-between gap-x-3 text-fid-sm"
          >
            <span class="min-w-0 grow truncate text-fid-text">
              <template v-if="record.artist || record.title">
                {{ record.artist }}<template v-if="record.artist && record.title"> – </template
                >{{ record.title }}
              </template>
              <template v-else>Release {{ record.releaseId }}</template>
            </span>
            <span class="shrink-0 text-fid-xs text-fid-text-muted">
              <template v-if="record.dealer">{{ record.dealer }} · </template>
              {{ date.format(record.createdAt) }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
