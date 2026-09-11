<script setup lang="ts">
import type { YearReview } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'
import { useLanguage } from '~/composables/useMessages'

/*
 * A year on the shelf (M19 #8).
 *
 * What arrived, where it came from, who shaped it, what Fidelity had to do
 * with it — the figures a catalogue app sells as a subscription, read off
 * the device from CC0 fields. The year is in the address, so a look back can
 * be shared as a link and reloaded where it was.
 */
const c = useCollectionMessages()
useSeoMeta({
  title: () => c.value.review.title,
  description: () => c.value.review.description,
})

const { call } = useFidelityWorker()
const route = useRoute()
const router = useRouter()

const review = shallowRef<YearReview | null>(null)
const ready = ref(false)
const error = ref<unknown>(null)

const wanted = computed(() => {
  const year = Number(route.query.year)
  return Number.isInteger(year) && year > 0 ? year : null
})

async function load() {
  try {
    review.value = await call('collection.review', { year: wanted.value })
  } catch (cause) {
    error.value = cause
  } finally {
    ready.value = true
  }
}

onMounted(load)
watch(wanted, load)

function choose(year: number) {
  void router.replace({ query: { ...route.query, year: String(year) } })
}

/** Against the year before — only where the shelf has one to compare with. */
const compare = computed(() => {
  const r = review.value
  if (!r) return null
  if (r.years.includes(r.year - 1)) {
    const diff = r.added - r.addedBefore
    if (diff > 0) return c.value.review.more(count(diff), r.year - 1)
    if (diff < 0) return c.value.review.fewer(count(-diff), r.year - 1)
    return c.value.review.same(r.year - 1)
  }
  return r.year === r.years[r.years.length - 1] ? c.value.review.firstYear : null
})

/** Short month names in the language of the app; the ref keeps them following it. */
const { current: language } = useLanguage()
const months = computed(() => (language.value, shortMonths()))

const peak = computed(() => {
  const r = review.value
  if (!r) return { index: 0, n: 0 }
  let index = 0
  r.byMonth.forEach((n, month) => {
    if (n > r.byMonth[index]!) index = month
  })
  return { index, n: r.byMonth[index]! }
})

const named = (record: { artist: string; title: string }) =>
  `${record.artist} – ${record.title}`
</script>

<template>
  <main class="@container fid-page flex flex-col gap-10 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.review.title }}</h1>
      <CollectionTabs />
      <ErrorNote v-if="error" :cause="error" />
    </div>

    <p v-if="ready && !review" class="max-w-prose text-fid-base text-fid-text-muted">
      {{ c.review.empty }}
      <NuxtLink class="text-fid-accent underline underline-offset-4" to="/settings/sync">{{
        c.review.settings
      }}</NuxtLink
      >.
    </p>

    <template v-else-if="review">
      <!-- The years as chips, newest first. One is always pressed. -->
      <div
        v-if="review.years.length > 1"
        role="group"
        :aria-label="c.review.yearLabel"
        class="flex flex-wrap gap-2"
      >
        <button
          v-for="year in review.years"
          :key="year"
          type="button"
          class="fid-action fid-num min-h-11 rounded-fid-sm border px-4 text-fid-sm"
          :class="
            year === review.year
              ? 'border-fid-text bg-fid-inset text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="year === review.year"
          @click="choose(year)"
        >
          {{ year }}
        </button>
      </div>

      <div class="flex max-w-prose flex-col gap-2">
        <p class="text-fid-base text-fid-text">
          {{ c.review.lead(c.review.records(review.added), review.year) }}
          <template v-if="compare"> {{ compare }}</template>
        </p>
      </div>

      <!--
        Twelve bars, hand-drawn like everything else here (no chart library,
        CLAUDE.md). The sentence carries what the bars show, for whoever
        cannot see them.
      -->
      <section class="flex max-w-3xl flex-col gap-3" aria-labelledby="review-months">
        <h2 id="review-months" class="text-fid-base font-medium text-fid-text">
          {{ c.review.months }}
        </h2>
        <div
          role="img"
          :aria-label="
            c.review.monthsSummary(c.review.records(peak.n), months[peak.index] ?? '')
          "
        >
          <ol aria-hidden="true" class="grid h-24 grid-cols-12 items-end gap-1">
            <li
              v-for="(n, month) in review.byMonth"
              :key="month"
              class="rounded-t-sm bg-fid-sig-gap/70"
              :style="{
                height: `${peak.n > 0 ? Math.max(n > 0 ? 6 : 2, (n / peak.n) * 100) : 2}%`,
              }"
            />
          </ol>
          <ol aria-hidden="true" class="mt-1 grid grid-cols-12 gap-1">
            <li
              v-for="(name, month) in months"
              :key="month"
              class="truncate text-center text-fid-xs text-fid-text-muted"
            >
              {{ name }}
            </li>
          </ol>
        </div>
        <p class="text-fid-sm text-fid-text-muted">
          {{ c.review.monthsSummary(c.review.records(peak.n), months[peak.index] ?? '') }}
        </p>
      </section>

      <p class="max-w-prose text-fid-base text-fid-text">
        <template v-if="review.newArtists > 0">
          {{ c.review.newArtists(c.review.artistCount(review.newArtists)) }}
          <span class="text-fid-text-muted">
            {{ review.newArtistNames.join(', ') }}
            <template v-if="review.newArtists > review.newArtistNames.length">
              {{ c.review.andMore(count(review.newArtists - review.newArtistNames.length)) }}
            </template>
          </span>
        </template>
        <template v-else>{{ c.review.noNewArtists }}</template>
      </p>

      <div class="grid gap-x-8 gap-y-10 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-5">
        <FacetBars :title="c.review.artists" signal="artist" :facets="review.artists" />
        <FacetBars :title="c.review.labels" signal="label" :facets="review.labels" />
        <FacetBars :title="c.review.styles" signal="style" :facets="review.styles" />
        <FacetBars
          :title="c.review.decades"
          signal="gap"
          :facets="review.decades"
          :empty="c.review.noYears"
        />
        <FacetBars :title="c.review.media" signal="catalog" :facets="review.media" />
      </div>

      <div class="flex max-w-prose flex-col gap-2 text-fid-base text-fid-text">
        <p v-if="review.oldest">
          {{ c.review.oldest(named(review.oldest), review.oldest.year) }}
          <template v-if="review.newest">
            {{ c.review.newest(named(review.newest), review.newest.year) }}</template
          >
        </p>
        <p class="text-fid-text-muted">
          {{
            review.rated > 0
              ? c.review.loved(count(review.loved), count(review.rated))
              : c.review.unrated
          }}
        </p>
      </div>

      <section
        class="flex max-w-prose flex-col gap-2 border-t border-fid-border pt-6"
        aria-labelledby="review-digs"
      >
        <h2 id="review-digs" class="text-fid-base font-medium text-fid-text">
          {{ c.review.digs }}
        </h2>
        <p class="text-fid-base text-fid-text">
          <template v-if="review.digs.runs > 0">
            {{
              c.review.digsLine(
                c.review.runs(review.digs.runs),
                c.review.shops(review.digs.shops),
                c.review.finds(review.digs.finds),
              )
            }}
          </template>
          <template v-else>{{ c.review.noDigs }}</template>
          <template v-if="review.digs.bought > 0">
            {{ c.review.bought(c.review.records(review.digs.bought)) }}</template
          >
        </p>
      </section>

      <section
        v-if="review.people.length > 0"
        class="flex max-w-prose flex-col gap-3 border-t border-fid-border pt-6"
        aria-labelledby="review-people"
      >
        <div class="flex flex-col gap-1">
          <h2 id="review-people" class="text-fid-base font-medium text-fid-text">
            {{ c.review.people }}
          </h2>
          <WhyNote :label="c.review.peopleWhyLabel">{{ c.review.peopleWhy }}</WhyNote>
        </div>
        <dl class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-2">
          <template v-for="person in review.people" :key="person.name">
            <dt class="min-w-0 truncate text-fid-sm text-fid-text">{{ person.name }}</dt>
            <dd class="text-fid-sm text-fid-text-muted">{{ person.role }}</dd>
            <dd class="fid-num text-right text-fid-sm text-fid-text-muted">{{ person.n }}</dd>
          </template>
        </dl>
      </section>
    </template>
  </main>
</template>
