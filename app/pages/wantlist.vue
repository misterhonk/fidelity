<script setup lang="ts">
import type { WantedRecord, WantlistOverview } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
useSeoMeta({
  title: 'Wantlist',
  description: 'Was du suchst – und wo es zuletzt aufgetaucht ist.',
})

const { call } = useFidelityWorker()

// Replaced wholesale, never mutated — Vue has no reason to proxy every row.
const overview = shallowRef<WantlistOverview | null>(null)
const loading = ref(true)
const query = ref('')

const route = useRoute()

onMounted(async () => {
  try {
    overview.value = await call('collection.wantlist', undefined)
  } finally {
    loading.value = false
  }

  /*
   * Scroll to the row somebody came for, once it exists.
   *
   * The browser handles `#want-123` on its own only if the element is in the
   * document when the address arrives — and here it never is: the list comes
   * out of IndexedDB a moment later. Coming from a cover on the start screen
   * therefore landed at the top of twenty-three records, which reads as "that
   * tap did nothing" (seen 2026-08-13).
   */
  if (!route.hash) return
  await nextTick()
  document.querySelector(route.hash)?.scrollIntoView({ block: 'start' })
})

/*
 * The note, edited where it is read.
 *
 * No separate screen and no edit mode: a wantlist note is one line, and the
 * moment it is worth writing is the moment you are looking at the record it
 * belongs to. Written on blur rather than on every keystroke — the outbox
 * collapses repeats anyway, but a request per letter would be absurd.
 */
async function note(record: WantedRecord, text: string) {
  if (text === record.note) return
  await call('wantlist.note', { releaseId: record.releaseId, note: text, want: record.want })
  overview.value = await call('collection.wantlist', undefined)
}

async function drop(releaseId: number) {
  if (!(await call('wantlist.remove', { releaseId }))) return
  // Re-read rather than splice: the overview carries counts that a removed
  // row changes, and a list whose header disagrees with its body is worse
  // than one that takes a moment.
  overview.value = await call('collection.wantlist', undefined)
}

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

/**
 * How long it has been on the list, which is the thing that stings.
 *
 * Written out here rather than left to `Intl.RelativeTimeFormat` because the
 * unit is the point: "since 2019" says something "6 years ago" does not, and
 * a wantlist is read for exactly that sting.
 */
function waiting(addedAt: string): string | null {
  const added = Date.parse(addedAt)
  if (!Number.isFinite(added)) return null

  const days = Math.floor((Date.now() - added) / 86_400_000)
  const w = c.value.wantlist.waiting
  // Zero days is arithmetic, not a length of time.
  if (days === 0) return w.today
  if (days === 1) return w.yesterday
  if (days < 31) return w.days(count(days))
  const months = Math.floor(days / 30)
  if (months < 24) return w.months(count(months))
  return w.years(count(Math.floor(months / 12)))
}
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[80rem] flex-col gap-6 px-6 py-10">
    <header class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ c.title }}</h1>
      <CollectionTabs />
    </header>

    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ c.loading }}</p>

    <p v-else-if="!overview || overview.total === 0" class="text-fid-base text-fid-text-muted">
      {{ c.wantlist.empty }}
    </p>

    <template v-else>
      <p class="text-fid-base text-fid-text-muted">
        {{ c.wantlist.lead(count(overview.total), count(overview.withPressings)) }}
        <template v-if="overview.seenRecently > 0">
          {{ c.wantlist.seenRecently(count(overview.seenRecently)) }}
        </template>
      </p>

      <input
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        :placeholder="c.wantlist.search"
        :aria-label="c.wantlist.searchLabel"
        class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
      />

      <p v-if="records.length === 0" class="text-fid-sm text-fid-text-muted">
        {{ c.map.nothingByName }}
      </p>

      <!--
        Longest wanted first. A wantlist is a queue of disappointments, and the
        record that has been on it for four years is the one worth being
        reminded about.
      -->
      <ul v-else class="grid gap-2 @4xl:grid-cols-2">
        <!--
          Jede Zeile ist adressierbar, und dafür gibt es einen Grund.

          A cover on the start screen is a record, not a category — tapping it
          and landing at the top of a list of twenty-three is being told "look
          for it yourself". The anchor lands on the row, `scroll-mt` keeps it
          out from under the sticky nav, and `:target` says which one for a
          moment, because a page that jumps without saying where is a page that
          looks like it did nothing.
        -->
        <li
          v-for="record in records"
          :id="`want-${record.releaseId}`"
          :key="record.releaseId"
          class="fid-want flex scroll-mt-24 gap-4 rounded-fid-md border border-fid-border p-3"
        >
          <!--
            The sleeve, which was in the store all along.

            Both sizes arrive with every wantlist sync and never left the
            worker, so the one screen carrying the two strongest signals in
            the engine was also the only one made of text. A wantlist is a
            list of records somebody is looking for — and looking for a record
            is done by eye long before it is done by name.

            Lazy and never fetched by hand: i.discogs.com has a budget of its
            own, roughly thirty a minute (docs/02).
          -->
          <img
            v-if="record.thumbUrl || record.coverUrl"
            :src="record.thumbUrl || record.coverUrl"
            :srcset="
              record.coverUrl && record.thumbUrl
                ? `${record.thumbUrl} 150w, ${record.coverUrl} 600w`
                : undefined
            "
            sizes="80px"
            alt=""
            loading="lazy"
            decoding="async"
            width="80"
            height="80"
            class="size-20 shrink-0 rounded-fid-cover bg-fid-inset object-cover"
          />
          <span
            v-else
            class="flex size-20 shrink-0 items-center justify-center rounded-fid-cover bg-fid-inset text-center text-fid-xs text-fid-text-muted"
          >
            {{ c.noCover }}
          </span>

          <div class="flex min-w-0 grow flex-col gap-1">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <a
                class="line-clamp-2 min-w-0 text-fid-base text-fid-text underline-offset-4 hover:underline"
                :href="`https://www.discogs.com/release/${record.releaseId}`"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ record.artist }} – {{ record.title }}
              </a>
              <span class="flex items-center gap-3 text-fid-xs text-fid-text-muted">
                <span>
                  <template v-if="record.year > 0"
                    ><span class="fid-num">{{ record.year }}</span> · </template
                  >{{ waiting(record.addedAt) }}
                </span>
                <!--
                Wanting something is allowed to stop.
                A wantlist that only ever grows stops being a list of what you
                are looking for and becomes a record of everything you once
                considered — and then nobody reads it. No confirmation here:
                unlike the collection, a want costs nothing to add back.
              -->
                <button
                  type="button"
                  class="fid-lift min-h-11 shrink-0 rounded-fid-sm border border-fid-field px-3 text-fid-xs text-fid-text-muted transition-colors hover:text-fid-text"
                  :aria-label="c.wantlist.drop(record.artist, record.title)"
                  @click="drop(record.releaseId)"
                >
                  {{ c.wantlist.dropShort }}
                </button>
              </span>
            </div>

            <p class="flex flex-wrap items-baseline gap-x-3 text-fid-sm text-fid-text-muted">
              <!--
              The pressing count is what makes a wantlist entry actionable: one
              of 160 turns up far more often than the only pressing there is.
            -->
              <span v-if="record.pressings !== null">
                {{ c.wantlist.pressings(count(record.pressings), record.pressings === 1) }}
              </span>
              <span v-else-if="record.masterId > 0" class="text-fid-sig-gap">
                {{ c.wantlist.notExpanded }}
              </span>
              <span v-else>
                {{ c.wantlist.noMaster }}
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
                {{ c.lastSeenAt }}
                <span class="text-fid-text">{{ record.lastSeen.dealer }}</span>
                {{ c.onDay(day(record.lastSeen.at)) }}
              </NuxtLink>
            </p>

            <!--
              Which pressing will do, in your own words.

              The most useful line on the screen and the last to arrive: a dig
              that does not know "only the German press" offers you the wrong
              one with a straight face. Discogs has carried this all along.

              Drawn without a border until it is wanted. Twenty-three empty
              boxes down a page shout for attention none of them has earned —
              a note is an invitation, not a form field, and the placeholder
              is enough of one.
            -->
            <input
              :value="record.note"
              type="text"
              :placeholder="c.wantlist.notePlaceholder"
              :aria-label="c.wantlist.noteLabel(record.artist, record.title)"
              class="-mx-2 min-h-11 w-[calc(100%+1rem)] rounded-fid-sm border border-transparent bg-transparent px-2 text-fid-sm text-fid-text transition-colors placeholder:text-fid-text-muted hover:border-fid-field focus:border-fid-field focus:bg-fid-surface"
              @change="note(record, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
/*
 * Nur ein Moment, dann ist es wieder eine Zeile wie jede andere.
 *
 * Der Sprung allein sagt nichts: wer von der Startseite kommt, sieht eine
 * Liste und weiß nicht, welche davon gemeint war. Der Rahmen sagt es und
 * verschwindet, statt eine Auswahl zu behaupten, die es nicht gibt.
 *
 * `prefers-reduced-motion` schaltet die Animation ab und lässt die Betonung
 * stehen — die Information darf nicht am Bewegungswunsch hängen.
 */
.fid-want:target {
  border-color: var(--color-fid-accent);
  animation: fid-want-found 2.4s ease-out forwards;
}

@keyframes fid-want-found {
  from {
    border-color: var(--color-fid-accent);
  }
  to {
    border-color: var(--color-fid-border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fid-want:target {
    animation: none;
  }
}
</style>
