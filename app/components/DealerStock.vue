<script setup lang="ts">
import type { StockRow } from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'
import { since } from '~/utils/when'

/**
 * Was ein Laden auf einem Label — oder aus einem Jahrzehnt — wirklich hat.
 *
 * Die Balken darüber zählten das schon immer und führten nirgendwohin. Der
 * interessante Fall ist gerade der, in dem die Fundliste nichts sagen kann:
 * ein Label, von dem man noch keine Platte besitzt, erzeugt per Definition
 * keinen Treffer — und ist trotzdem womöglich genau das, wonach man sucht.
 *
 * **Portionsweise.** Ein großer Laden hat zwanzigtausend Zeilen; hier kommen
 * fünfzig, und der Rest erst, wenn jemand danach fragt.
 */
const h = useDealerMessages()
const { call } = useFidelityWorker()

const props = defineProps<{
  dealer: string
  /** Genau die Schreibweise aus dem Balken. */
  label?: string | null
  decade?: number | null
  /** Was in der Überschrift steht — „Kompakt" oder „1990er". */
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

// Nie mutiert, immer ersetzt: eine Seite kommt am Stück (CLAUDE.md).
const rows = shallowRef<StockRow[]>([])
const total = ref(0)
const scannedAt = ref<number | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

async function fetchPage(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await call('dealer.stock', {
      dealer: props.dealer,
      label: props.label ?? null,
      decade: props.decade ?? null,
      offset: rows.value.length,
    })
    rows.value = [...rows.value, ...page.rows]
    total.value = page.total
    scannedAt.value = page.scannedAt
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }
}

onMounted(fetchPage)

const more = computed(() => rows.value.length < total.value)
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-4"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 class="text-fid-base font-medium text-fid-text">{{ title }}</h3>
      <button
        type="button"
        class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="emit('close')"
      >
        {{ h.stock.close }}
      </button>
    </div>

    <ErrorNote v-if="error" :cause="error" />

    <!--
      Kein frischer Dig heißt nicht „der Laden führt das nicht".
      Das Sortiment ist ein Marktplatzdatum und lebt sechs Stunden (Regel 4);
      danach ist es gelöscht. Die beiden Fälle auseinanderzuhalten ist der
      Unterschied zwischen einer Auskunft und einer Falschaussage.
    -->
    <p v-else-if="!loading && scannedAt === null" class="text-fid-sm text-fid-sig-gap">
      {{ h.stock.needsDig }}
    </p>

    <template v-else>
      <p class="fid-num text-fid-xs text-fid-text-muted">
        {{ h.stock.counted(count(rows.length), count(total)) }}
        <template v-if="scannedAt"> · {{ since(scannedAt) }}</template>
      </p>

      <ul class="flex flex-col gap-1">
        <li
          v-for="row in rows"
          :key="row.listingId"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-fid-border/50 pb-1 text-fid-sm last:border-0"
        >
          <OutwardLink
            class="min-w-0 grow"
            tone="inherit"
            :to="`https://www.discogs.com/sell/item/${row.listingId}`"
          >
            {{ row.artist }}<template v-if="row.artist && row.title"> – </template
            >{{ row.title }}
          </OutwardLink>

          <span class="fid-num shrink-0 text-fid-xs text-fid-text-muted">
            <template v-if="row.year">{{ row.year }} · </template>
            <template v-if="row.condition">{{ row.condition }} · </template>
            {{ money(row.price, row.currency) }}
          </span>
        </li>
      </ul>

      <button
        v-if="more"
        type="button"
        :disabled="loading"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="fetchPage()"
      >
        {{ loading ? h.stock.loading : h.stock.more(count(total - rows.length)) }}
      </button>
    </template>
  </section>
</template>
