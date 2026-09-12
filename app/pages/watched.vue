<script setup lang="ts">
import type { CheckProgress, WatchedCheck } from '~~/worker/watched/check'
import type { WatchedRelease } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * Watched records (M11).
 *
 * Two directions out of one mechanism, and the second is the reason for the
 * whole thing: **when a record you own jumps in value.** Discogs does not tell
 * you, and anyone wanting to sell otherwise learns about the rise by chance.
 *
 * What the screen **cannot** do and does not claim to: say *who* has the
 * record. There is no endpoint that lists the offers for a release id
 * (`docs/02`) — so a price stands here and not a shop.
 */
const c = useCollectionMessages()
const m = useMessages()

useSeoMeta({
  title: () => c.value.watched.title,
  description: () => c.value.watched.lead,
})

const { call } = useFidelityWorker()
const { online } = useOnline()

const rows = shallowRef<WatchedRelease[]>([])
const loading = ref(true)
const busy = ref(false)
const progress = ref<CheckProgress | null>(null)
const outcome = ref<WatchedCheck | null>(null)
const error = ref<unknown>(null)

onMounted(async () => {
  try {
    rows.value = await call('watched.list', undefined)
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }
})

/**
 * Checking — with the cost visible.
 *
 * One request per record that is due, at a pace of 1.2 s. With fifty records
 * that is a minute, and it says so on the button rather than somebody finding
 * out while they wait.
 */
async function check() {
  if (busy.value) return
  busy.value = true
  outcome.value = null
  error.value = null
  try {
    outcome.value = await call('watched.check', {}, { onProgress: (p) => (progress.value = p) })
    rows.value = await call('watched.list', undefined)
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
    progress.value = null
  }
}

async function drop(releaseId: number) {
  await call('watched.remove', { releaseId })
  rows.value = rows.value.filter((row) => row.releaseId !== releaseId)
}

/** The last measured price, or the statement that there is none right now. */
function price(row: WatchedRelease): string {
  const last = row.points.at(-1)
  if (!last) return c.value.watched.notYet
  if (last.lowestPrice === null) return c.value.watched.noneForSale
  return money(last.lowestPrice, last.currency) ?? c.value.watched.noPrice
}

/**
 * The span across the history, as a sentence.
 *
 * No chart: a curve through four points is a claim about a trend that four
 * points cannot carry. Two numbers and a period say the same thing more
 * honestly — and in this app bars are `<div>`s, not a library (CLAUDE.md).
 */
function span(row: WatchedRelease): string | null {
  const first = row.points[0]
  const last = row.points.at(-1)
  if (!first || !last || first === last) return null
  if (first.lowestPrice === null || last.lowestPrice === null) return null

  const von = money(first.lowestPrice, first.currency)
  const bis = money(last.lowestPrice, last.currency)
  if (!von || !bis) return null

  return c.value.watched.span(von, bis, since(first.at))
}
</script>

<template>
  <AppPage narrow>
    <PageHeader :title="c.title" :heading="c.watched.title" :lead="c.watched.lead">
      <template #tabs><CollectionTabs /></template>
    </PageHeader>

    <ErrorNote v-if="error" :cause="error" />
    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ m.common.loading }}</p>

    <section v-else-if="rows.length === 0" class="flex flex-col gap-3">
      <p class="text-fid-base text-fid-text-muted">{{ c.watched.empty }}</p>
      <NuxtLink
        to="/shelf"
        class="fid-action self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        {{ c.watched.toShelf }}
      </NuxtLink>
    </section>

    <template v-else>
      <div class="flex flex-col gap-2">
        <button
          type="button"
          :disabled="busy || !online"
          class="fid-action flex min-h-11 items-center gap-2 self-start rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-40"
          @click="check"
        >
          {{ busy ? c.watched.checking : c.watched.check }}
        </button>
        <!--
            What it costs, before it runs. One request per record at a pace of
            1.2 s — that is a number somebody should know before tapping.
          -->
        <p class="text-fid-xs text-fid-text-muted">
          {{ c.watched.cost(rows.length, Math.ceil((rows.length * 1.2) / 60) || 1) }}
        </p>

        <div v-if="progress" class="flex flex-col gap-1" aria-live="polite">
          <p class="text-fid-xs text-fid-text-muted">
            {{ m.common.ofTotal(count(progress.done), count(progress.total)) }}
          </p>
        </div>
      </div>

      <section v-if="outcome" role="status" class="flex flex-col gap-2">
        <p v-if="outcome.news.length === 0" class="text-fid-sm text-fid-text-muted">
          {{ c.watched.nothingNew }}
        </p>
        <p
          v-for="item in outcome.news"
          :key="item.releaseId"
          class="rounded-fid-sm border border-fid-accent-fill px-3 py-2 text-fid-sm text-fid-text"
        >
          <span class="font-medium">{{ item.artist }} – {{ item.title }}</span>
          {{ ' ' }}
          <template v-if="item.news.kind === 'rose'">
            {{
              c.watched.rose(
                money(item.news.from, item.news.currency) ?? String(item.news.from),
                money(item.news.to, item.news.currency) ?? String(item.news.to),
                String(item.news.percent),
              )
            }}
          </template>
          <template v-else-if="item.news.kind === 'fell'">
            {{
              c.watched.fell(money(item.news.to, item.news.currency) ?? String(item.news.to))
            }}
          </template>
          <template v-else-if="item.news.kind === 'appeared'">
            {{ c.watched.appeared(count(item.news.numForSale)) }}
          </template>
          <template v-else-if="item.news.kind === 'gone'">
            {{ c.watched.gone(item.news.dealer, count(item.news.from), count(item.news.to)) }}
          </template>
          <template v-else>
            {{ c.watched.fewer(count(item.news.from), count(item.news.to)) }}
          </template>
        </p>
      </section>

      <ul class="flex flex-col gap-2">
        <li
          v-for="row in rows"
          :key="row.releaseId"
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-fid-md border border-fid-border p-3"
        >
          <div class="flex min-w-0 flex-col gap-1">
            <p class="text-fid-base text-fid-text">{{ row.artist }} – {{ row.title }}</p>
            <p class="text-fid-xs text-fid-text-muted">
              {{ row.kind === 'shelf' ? c.watched.fromShelf : c.watched.fromWantlist }}
              <template v-if="span(row)"> · {{ span(row) }}</template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <p class="fid-num text-fid-base text-fid-text">{{ price(row) }}</p>
            <button
              type="button"
              class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-xs text-fid-text-muted"
              :aria-label="c.watched.drop(`${row.artist} – ${row.title}`)"
              @click="drop(row.releaseId)"
            >
              {{ c.watched.dropShort }}
            </button>
          </div>
        </li>
      </ul>

      <!--
          The API's limit, said rather than passed over.
          "Who is selling release X?" cannot be answered (`docs/02`), so this
          screen names a price and not a shop. Anyone not knowing that takes it
          for a gap in the app.
        -->
      <p class="text-fid-xs text-fid-text-muted">{{ c.watched.noShops }}</p>
    </template>
  </AppPage>
</template>
