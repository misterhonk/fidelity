<script setup lang="ts">
import type {
  CollectionGaps,
  CollectionValue,
  TasteComparison,
  TasteFacet,
  TasteProfile,
  ValuePoint,
} from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
const m = useMessages()
useSeoMeta({
  title: () => c.value.title,
  description: () => c.value.map.description,
})

const { call } = useFidelityWorker()

const gaps = ref<CollectionGaps | null>(null)

const profile = ref<TasteProfile | null>(null)
const value = ref<CollectionValue | null>(null)
/** Discogs' estimate, day by day — the line under the number (M19 #3). */
const history = shallowRef<ValuePoint[]>([])
const ready = ref(false)
const error = ref<unknown>(null)

/** The catalogue's side of the map (M21.6): null without one, and nothing changes. */
const compared = ref<TasteComparison | null>(null)

onMounted(async () => {
  try {
    profile.value = await call('taste.profile', undefined)
  } catch (cause) {
    error.value = cause
  } finally {
    ready.value = true
  }
  void call('taste.compared', undefined)
    .then((result) => (compared.value = result))
    .catch(() => undefined)
  try {
    gaps.value = await call('collection.gaps', undefined)
    value.value = await call('collection.value', undefined)
    history.value = await call('collection.valueHistory', undefined)
  } catch (cause) {
    error.value = cause
  }
})

/** Strongest first; ties alphabetically so the order never jitters. */
function top(
  facets: Record<string, TasteFacet> | undefined,
  limit: number,
  lift?: Record<string, number>,
): TasteFacet[] {
  return Object.entries(facets ?? {})
    .sort(([, a], [, b]) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(([key, facet]) => withLift(key, facet, lift))
}

/** The catalogue's lift on a facet, where the comparison has one. */
function withLift(key: string, facet: TasteFacet, lift?: Record<string, number>): TasteFacet {
  const value = lift?.[key]
  return value === undefined ? facet : { ...facet, lift: value }
}

/** Decades read as a timeline, so they stay in chronological order. */
const decades = computed(() =>
  Object.entries(profile.value?.decades ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([key, facet]) => withLift(key, facet, compared.value?.decades)),
)
</script>

<template>
  <main class="@container fid-page flex flex-col gap-10 py-16">
    <!--
      Wide, because this screen is five bar charts and two rankings — data, not
      reading. The prose inside stays narrow: a sentence that runs 1400 pixels
      is unreadable however much room there is.
    -->
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.title }}</h1>
      <CollectionTabs />
      <ErrorNote v-if="error" :cause="error" />
      <p v-if="profile" class="max-w-prose text-fid-base text-fid-text-muted">
        {{ c.map.lead(count(profile.releaseCount)) }}
      </p>
      <!--
        Discogs' estimate, with the day it was fetched.

        Built from what other people are asking, not from what anything sold
        for, and the three numbers are usually a factor of six apart — which
        is the useful part. A single figure would read as an appraisal; the
        spread reads as what it is. The date is not decoration: a number like
        this with nothing beside it gets remembered as a fact.
      -->
      <p v-if="value" class="text-fid-sm text-fid-text-muted">
        <span class="fid-num text-fid-text">{{ value.median }}</span>
        {{ c.map.worth(value.minimum, value.maximum, day(value.fetchedAt)) }}
      </p>
    </div>

    <p v-if="ready && !profile" class="text-fid-base text-fid-text-muted">
      {{ c.map.noProfile }}
      <NuxtLink class="text-fid-accent underline underline-offset-4" to="/">{{
        c.map.startPage
      }}</NuxtLink
      >.
    </p>

    <!--
      Five facets. Two abreast on a tablet, all five in a row on a monitor —
      which is the point of the screen: your taste at a glance rather than in
      five scrolls.
    -->
    <div
      v-else-if="profile"
      class="grid gap-x-8 gap-y-10 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-5"
    >
      <FacetBars :title="c.map.artists" signal="artist" :facets="top(profile.artists, 12)" />
      <FacetBars :title="c.map.labels" signal="label" :facets="top(profile.labels, 12)" />
      <FacetBars
        :title="c.map.styles"
        signal="style"
        :facets="top(profile.styles, 12, compared?.styles)"
      />
      <FacetBars
        :title="c.map.genres"
        signal="catalog"
        :facets="top(profile.genres, 8, compared?.genres)"
      />
      <FacetBars :title="c.map.decades" signal="gap" :facets="decades" :empty="c.map.noYears" />
    </div>

    <!--
      What the × means, said once under the bars (M21.6). Only with a
      catalogue: without one there is no denominator, and the bars stand as
      they always did.
    -->
    <p v-if="profile && compared" class="max-w-prose text-fid-sm text-fid-text-muted">
      {{ c.map.compared(compared.build) }}
    </p>

    <!--
      The estimate over time (M19 #3). Only once there is a second day: a
      chart of one point is a dot, and the sentence above it already says
      what the dot is. Not gated on the profile — the days were kept whether
      or not the taste has been computed yet, and a kept number belongs on
      the screen.
    -->
    <section
      v-if="history.length > 1"
      class="flex max-w-3xl flex-col gap-3 border-t border-fid-border pt-6"
      aria-labelledby="value-history"
    >
      <div class="flex flex-col gap-1">
        <h2 id="value-history" class="text-fid-base font-medium text-fid-text">
          {{ c.map.history.title }}
        </h2>
        <p class="text-fid-sm text-fid-text-muted">{{ c.map.history.about }}</p>
      </div>
      <ValueHistory :points="history" />
    </section>

    <!--
      Said plainly rather than left as a silently missing bar: the number that
      would separate "you own a lot of Warner" from "you collect Ohr on
      purpose" needs a denominator the app cannot reach yet.
    -->
    <!--
      What the counts above cannot say on their own.

      "Cocoon Recordings 6" is six of something — and six of four hundred is a
      different fact from five of a hundred and fifty. Both answers were
      already in the horizon; nothing had surfaced them.
    -->
    <div v-if="gaps?.built" class="grid gap-8 @5xl:grid-cols-2">
      <section
        v-if="gaps.artists.length > 0"
        class="flex flex-col gap-3 border-t border-fid-border pt-6"
        aria-labelledby="shelf-gaps"
      >
        <div class="flex flex-col gap-1">
          <h2 id="shelf-gaps" class="text-fid-base font-medium text-fid-text">
            {{ c.howMuchLeft }}
          </h2>
          <!--
            Deliberately not "wie weit du durch bist".
            `/artists/{id}/releases` lists everything filed under a name —
            albums, singles, remixes, compilation appearances — so 252 Robag
            Wruhme entries are not a discography of 252 albums, and a progress
            bar towards them would be a goal nobody has.

            What the number honestly says: how likely a dig is to turn up
            something of theirs you do not have.
          -->
          <WhyNote :label="c.map.artistsWhyLabel">{{ c.map.artistsWhy }} </WhyNote>
        </div>

        <ul class="flex flex-col gap-2">
          <li
            v-for="artist in gaps.artists"
            :key="artist.entityId"
            class="flex flex-col gap-1 rounded-fid-sm border border-fid-border px-3 py-2"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <span class="text-fid-base text-fid-text">{{ artist.name }}</span>
              <span class="text-fid-sm text-fid-text-muted">
                {{ m.common.ofTotal(count(artist.owned), c.map.entries(count(artist.total))) }}
                <template v-if="artist.from > 0">
                  {{ c.map.yoursFrom }} <span class="fid-num">{{ artist.from }}</span
                  ><template v-if="artist.to !== artist.from">
                    {{ m.common.to }} <span class="fid-num">{{ artist.to }}</span></template
                  >
                </template>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="gaps.labels.length > 0"
        class="flex flex-col gap-3 border-t border-fid-border pt-6"
        aria-labelledby="label-standing"
      >
        <div class="flex flex-col gap-1">
          <h2 id="label-standing" class="text-fid-base font-medium text-fid-text">
            {{ c.whichLabels }}
          </h2>
          <WhyNote :label="c.map.labelsWhyLabel">{{ c.map.labelsWhy }}</WhyNote>
        </div>

        <dl class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-2">
          <template v-for="label in gaps.labels" :key="label.entityId">
            <dt class="min-w-0 truncate text-fid-sm text-fid-text">{{ label.name }}</dt>
            <dd class="fid-num text-right text-fid-sm text-fid-text-muted">
              {{ label.owned }} / {{ count(label.catalogueSize) }}
            </dd>
            <dd
              class="fid-num text-right text-fid-sm"
              :class="(label.lift ?? 0) >= 2 ? 'text-fid-sig-label' : 'text-fid-text-muted'"
            >
              <template v-if="label.lift">{{ decimal(label.lift) }}×</template>
              <template v-else>–</template>
            </dd>
          </template>
        </dl>
      </section>
    </div>

    <p v-else-if="gaps" class="max-w-prose text-fid-xs text-fid-text-muted">
      {{ c.map.needsHorizon }}
    </p>
  </main>
</template>
