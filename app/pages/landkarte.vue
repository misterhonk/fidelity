<script setup lang="ts">
import type { CollectionGaps, TasteFacet, TasteProfile } from '#shared/types'

useSeoMeta({
  title: 'Deine Landkarte',
  description: 'Was deine Sammlung über deinen Geschmack verrät.',
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

const number = new Intl.NumberFormat('de-DE')
const lift = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="text-fid-2xl font-bold text-fid-text">Deine Landkarte</h1>
      <CollectionTabs />
      <p v-if="profile" class="text-fid-base text-fid-text-muted">
        <span class="fid-num">{{ profile.releaseCount }}</span> Platten. Was daraus über deinen
        Geschmack ablesbar ist.
      </p>
    </div>

    <p v-if="ready && !profile" class="text-fid-base text-fid-text-muted">
      Noch kein Profil – synchronisiere zuerst deine Sammlung auf der
      <NuxtLink class="text-fid-accent underline underline-offset-4" to="/">Startseite</NuxtLink
      >.
    </p>

    <div v-else-if="profile" class="grid gap-10 sm:grid-cols-2">
      <FacetBars title="Künstler" signal="artist" :facets="top(profile.artists, 12)" />
      <FacetBars title="Labels" signal="label" :facets="top(profile.labels, 12)" />
      <FacetBars title="Stile" signal="style" :facets="top(profile.styles, 12)" />
      <FacetBars title="Genres" signal="catalog" :facets="top(profile.genres, 8)" />
      <FacetBars
        title="Dekaden"
        signal="gap"
        :facets="decades"
        empty="Keine Jahresangaben in der Sammlung."
      />
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
    <template v-if="gaps?.built">
      <section
        v-if="gaps.artists.length > 0"
        class="flex flex-col gap-3 border-t border-fid-border pt-6"
        aria-labelledby="shelf-gaps"
      >
        <div class="flex flex-col gap-1">
          <h2 id="shelf-gaps" class="text-fid-lg font-medium text-fid-text">
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
          <WhyNote label="Was die Zahl rechts bedeutet">
            Discogs führt unter einem Namen alles: Alben, Singles, Remixe, Beiträge zu Samplern.
            Die Zahl ist deshalb kein Sammelziel, sondern eine Auskunft darüber, wie
            wahrscheinlich ein Dig noch etwas von ihnen zutage fördert.
          </WhyNote>
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
                <span class="fid-num">{{ number.format(artist.total) }}</span> Einträgen
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
          <h2 id="label-standing" class="text-fid-lg font-medium text-fid-text">
            Welche Labels du wirklich sammelst
          </h2>
          <WhyNote label="Wie der Lift gerechnet wird">
            Er vergleicht deinen Anteil an einem Label mit dem, was bei zufälliger Auswahl aus
            deinen Labels zu erwarten wäre. Verglichen wird gegen deine eigenen Labels – was der
            Gesamtkatalog von Discogs hergibt, kann ein Browser nicht sehen.
          </WhyNote>
        </div>

        <dl class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1.5">
          <template v-for="label in gaps.labels" :key="label.entityId">
            <dt class="min-w-0 truncate text-fid-sm text-fid-text">{{ label.name }}</dt>
            <dd class="fid-num text-right text-fid-sm text-fid-text-muted">
              {{ label.owned }} / {{ number.format(label.catalogueSize) }}
            </dd>
            <dd
              class="fid-num text-right text-fid-sm"
              :class="(label.lift ?? 0) >= 2 ? 'text-fid-sig-label' : 'text-fid-text-muted'"
            >
              <template v-if="label.lift">{{ lift.format(label.lift) }}×</template>
              <template v-else>–</template>
            </dd>
          </template>
        </dl>
      </section>
    </template>

    <p v-else-if="gaps" class="max-w-prose text-fid-xs text-fid-text-muted">
      Lücken und Label-Lift brauchen den Horizont. Sobald der gebaut ist, steht hier, wie viel
      dir bei welchem Künstler noch fehlt.
    </p>
  </main>
</template>
