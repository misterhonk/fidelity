<script setup lang="ts">
import type { CollectionGaps, TasteFacet, TasteProfile } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
useSeoMeta({
  title: 'Landkarte',
  description: () => c.value.map.description,
})

const { call } = useFidelityWorker()

const gaps = ref<CollectionGaps | null>(null)

const profile = ref<TasteProfile | null>(null)
const ready = ref(false)

onMounted(async () => {
  try {
    profile.value = await call('taste.profile', undefined)
  } finally {
    ready.value = true
  }
  gaps.value = await call('collection.gaps', undefined)
})

/** Strongest first; ties alphabetically so the order never jitters. */
function top(facets: Record<string, TasteFacet> | undefined, limit: number): TasteFacet[] {
  return Object.values(facets ?? {})
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Decades read as a timeline, so they stay in chronological order. */
const decades = computed(() =>
  Object.entries(profile.value?.decades ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, facet]) => facet),
)
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-6 py-16">
    <!--
      Wide, because this screen is five bar charts and two rankings — data, not
      reading. The prose inside stays narrow: a sentence that runs 1400 pixels
      is unreadable however much room there is.
    -->
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.title }}</h1>
      <CollectionTabs />
      <p v-if="profile" class="max-w-prose text-fid-base text-fid-text-muted">
        {{ c.map.lead(count(profile.releaseCount)) }}
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
      <FacetBars :title="c.map.styles" signal="style" :facets="top(profile.styles, 12)" />
      <FacetBars :title="c.map.genres" signal="catalog" :facets="top(profile.genres, 8)" />
      <FacetBars :title="c.map.decades" signal="gap" :facets="decades" :empty="c.map.noYears" />
    </div>

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
            Wie viel es noch gibt
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
                <span class="fid-num text-fid-text">{{ artist.owned }}</span> von
                {{ c.map.entries(count(artist.total)) }}
                <template v-if="artist.from > 0">
                  · deine von <span class="fid-num">{{ artist.from }}</span
                  ><template v-if="artist.to !== artist.from">
                    bis <span class="fid-num">{{ artist.to }}</span></template
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
            Welche Labels du wirklich sammelst
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
