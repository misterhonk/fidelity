<script setup lang="ts">
import type { WantlistOverview } from '#shared/types'

useSeoMeta({
  title: 'Wantlist',
  description: 'Was du suchst – und wo es zuletzt aufgetaucht ist.',
})

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const overview = shallowRef<WantlistOverview | null>(null)
const loading = ref(true)
const query = ref('')

onMounted(async () => {
  try {
    overview.value = await call('collection.wantlist', undefined)
  } finally {
    loading.value = false
  }
})

const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })

const records = computed(() => {
  const all = overview.value?.records ?? []
  const needle = query.value.trim().toLowerCase()
  if (!needle) return all

  const words = needle.split(/\s+/).filter(Boolean)
  return all.filter((record) => {
    const haystack = `${record.artist} ${record.title}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
})

/** How long it has been on the list, which is the thing that stings. */
function waiting(addedAt: string): string | null {
  const added = Date.parse(addedAt)
  if (!Number.isFinite(added)) return null

  const days = Math.floor((Date.now() - added) / 86_400_000)
  // "seit 0 Tagen" is arithmetic, not German.
  if (days === 0) return 'heute notiert'
  if (days === 1) return 'seit gestern'
  if (days < 31) return `seit ${days} Tagen`
  const months = Math.floor(days / 30)
  if (months < 24) return `seit ${months} Monaten`
  return `seit ${Math.floor(months / 12)} Jahren`
}
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[80rem] flex-col gap-6 px-6 py-10">
    <header class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">Sammlung</h1>
      <CollectionTabs />
    </header>

    <p v-if="loading" class="text-fid-base text-fid-text-muted">Wird geladen …</p>

    <p v-else-if="!overview || overview.total === 0" class="text-fid-base text-fid-text-muted">
      Deine Wantlist ist leer – oder noch nicht synchronisiert. Sie trägt die zwei stärksten
      Signale überhaupt.
    </p>

    <template v-else>
      <p class="text-fid-base text-fid-text-muted">
        <span class="fid-num text-fid-text">{{ number.format(overview.total) }}</span> Platten
        gesucht. Von
        <span class="fid-num text-fid-text">{{ number.format(overview.withPressings) }}</span>
        kennt der Horizont alle Pressungen – bei denen erkennt ein Dig auch eine andere Ausgabe
        als die eingetragene.
        <template v-if="overview.seenRecently > 0">
          <span class="fid-num text-fid-text">{{ overview.seenRecently }}</span> sind in den
          letzten dreißig Tagen bei einem Händler aufgetaucht.
        </template>
      </p>

      <input
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Künstler oder Titel"
        aria-label="Wantlist durchsuchen"
        class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
      />

      <p v-if="records.length === 0" class="text-fid-sm text-fid-text-muted">
        Nichts mit diesem Namen auf der Liste.
      </p>

      <!--
        Longest wanted first. A wantlist is a queue of disappointments, and the
        record that has been on it for four years is the one worth being
        reminded about.
      -->
      <ul v-else class="grid gap-2 @4xl:grid-cols-2">
        <li
          v-for="record in records"
          :key="record.releaseId"
          class="flex flex-col gap-1 rounded-fid-md border border-fid-border px-4 py-3"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-x-3">
            <a
              class="text-fid-base text-fid-text underline-offset-4 hover:underline"
              :href="`https://www.discogs.com/release/${record.releaseId}`"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ record.artist }} – {{ record.title }}
            </a>
            <span class="text-fid-xs text-fid-text-muted">
              <template v-if="record.year > 0"
                ><span class="fid-num">{{ record.year }}</span> · </template
              >{{ waiting(record.addedAt) }}
            </span>
          </div>

          <p class="flex flex-wrap items-baseline gap-x-3 text-fid-sm text-fid-text-muted">
            <!--
              The pressing count is what makes a wantlist entry actionable: one
              of 160 turns up far more often than the only pressing there is.
            -->
            <span v-if="record.pressings !== null">
              <span class="fid-num text-fid-text">{{ number.format(record.pressings) }}</span>
              {{ record.pressings === 1 ? 'Pressung' : 'Pressungen' }} bekannt
            </span>
            <span v-else-if="record.masterId > 0" class="text-fid-sig-gap">
              Pressungen noch nicht ausgeklappt
            </span>
            <span v-else>
              Kein Master bei Discogs – nur genau diese Pressung ist erkennbar
            </span>

            <!--
              Seen by master, so a different pressing still counts.

              And it links to a new dig at that shop, because "gesehen bei X"
              with nothing to click is a fact the reader then has to act on by
              hand — the shop that had it once is the best guess anybody has
              about where it turns up again.
            -->
            <NuxtLink
              v-if="record.lastSeen"
              :to="`/dig?dealer=${encodeURIComponent(record.lastSeen.dealer)}`"
              class="fid-action text-fid-sig-wantlist underline-offset-4 hover:underline"
            >
              zuletzt bei
              <span class="text-fid-text">{{ record.lastSeen.dealer }}</span>
              am {{ date.format(record.lastSeen.at) }}
            </NuxtLink>
          </p>
        </li>
      </ul>
    </template>
  </main>
</template>
