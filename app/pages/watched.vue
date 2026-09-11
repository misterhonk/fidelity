<script setup lang="ts">
import type { CheckProgress, WatchedCheck } from '~~/worker/watched/check'
import type { WatchedRelease } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * Beobachtete Platten (M11).
 *
 * Zwei Richtungen aus einem Mechanismus, und die zweite ist der Grund für das
 * Ganze: **wenn die eigene Platte im Wert springt.** Discogs sagt einem das
 * nicht, und wer verkaufen will, erfährt vom Anstieg sonst durch Zufall.
 *
 * Was der Bildschirm **nicht** kann und auch nicht behauptet: sagen, *wer* die
 * Platte hat. Es gibt keinen Endpunkt, der die Angebote zu einer Release-Id
 * auflistet (`docs/02`) — deshalb steht hier ein Preis und kein Laden.
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
 * Nachsehen — und zwar sichtbar, was es kostet.
 *
 * Ein Request je fällige Platte, im Takt von 1,2 s. Bei fünfzig Platten ist
 * das eine Minute, und das steht am Knopf, statt dass jemand es merkt, während
 * er wartet.
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

/** Der letzte gemessene Preis, oder die Aussage, dass es gerade keinen gibt. */
function price(row: WatchedRelease): string {
  const last = row.points.at(-1)
  if (!last) return c.value.watched.notYet
  if (last.lowestPrice === null) return c.value.watched.noneForSale
  return money(last.lowestPrice, last.currency) ?? c.value.watched.noPrice
}

/**
 * Die Spanne über den Verlauf, als Satz.
 *
 * Kein Diagramm: eine Kurve aus vier Punkten ist eine Behauptung über eine
 * Entwicklung, die vier Punkte nicht tragen. Zwei Zahlen und ein Zeitraum
 * sagen dasselbe ehrlicher — und Balken sind in dieser App `<div>`s, nicht
 * eine Bibliothek (CLAUDE.md).
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
  <main class="fid-page py-4">
    <div class="flex w-full max-w-3xl flex-col gap-6">
      <CollectionTabs />

      <header class="flex flex-col gap-2">
        <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.watched.title }}</h1>
        <p class="text-fid-sm text-fid-text-muted">{{ c.watched.lead }}</p>
      </header>

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
            Was es kostet, bevor es läuft. Ein Request je Platte im Takt von
            1,2 s — das ist eine Zahl, die jemand vor dem Tippen kennen soll.
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
          Die Grenze der API, gesagt statt verschwiegen.
          „Wer verkauft Release X?" ist nicht beantwortbar (`docs/02`), also nennt
          dieser Bildschirm einen Preis und keinen Laden. Wer das nicht weiß,
          hält es für eine Lücke in der App.
        -->
        <p class="text-fid-xs text-fid-text-muted">{{ c.watched.noShops }}</p>
      </template>
    </div>
  </main>
</template>
