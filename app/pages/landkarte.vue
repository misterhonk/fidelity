<script setup lang="ts">
import type { TasteFacet, TasteProfile } from '#shared/types'

useSeoMeta({
  title: 'Deine Landkarte',
  description: 'Was deine Sammlung über deinen Geschmack verrät.',
})

const { call } = useFidelityWorker()

const profile = ref<TasteProfile | null>(null)
const ready = ref(false)

onMounted(async () => {
  try {
    profile.value = await call('taste.profile', undefined)
  } finally {
    ready.value = true
  }
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
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="text-fid-2xl font-bold text-fid-text">Deine Landkarte</h1>
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
    <p v-if="profile" class="max-w-prose text-fid-xs text-fid-text-muted">
      Noch ohne Lift: Wie sehr ein Label oder Künstler gegenüber dem Durchschnitt
      überrepräsentiert ist, lässt sich erst sagen, wenn der Horizont in M2 weiß, wie viele
      Releases es dort insgesamt gibt. Bis dahin zählt hier nur, was in deiner Sammlung steht.
    </p>
  </main>
</template>
