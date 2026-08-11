<script setup lang="ts">
import { describeFormat } from '#shared/format'

import type { DemoProgress, DemoResult } from '~~/worker/demo'

const m = useMessages()
const { current: language } = useLanguage()

/**
 * Showing Fidelity before anybody hands over a key.
 *
 * One record goes in, and what that shop has beside it comes out — scored and
 * reasoned by the same engine a real dig uses. Nothing here is a mock-up; the
 * worker runs `evaluate` and `buildReason` over a collection of one
 * (worker/demo.ts).
 *
 * **They are records, so it demonstrates records.** This screen was a paragraph,
 * a form and three lines of text, on an app whose subject is sleeves — so the
 * covers now carry it and the words fit underneath. The pictures are frozen
 * into `demo-seeds.ts` rather than fetched, because nothing may run on load:
 * opening a page must not spend somebody's rate limit, and a first screen that
 * can fail while it is being read is worse than one that waits to be asked.
 */
const { call } = useFidelityWorker()
const { coverFor, request: requestCovers } = useCovers()

const seeds = seedsForToday()
const url = ref('')
const running = ref(false)
const progress = ref<DemoProgress | null>(null)
const result = shallowRef<DemoResult | null>(null)
const error = ref<unknown>(null)

/** Reads a listing id out of whatever somebody pasted. */
const pastedId = computed(() => {
  const match = url.value.match(/\/sell\/item\/(\d+)/) ?? url.value.trim().match(/^(\d{7,})$/)
  return match ? Number(match[1]) : null
})

async function run(listingId: number) {
  if (running.value) return

  running.value = true
  error.value = null
  result.value = null
  progress.value = null

  try {
    result.value = await call(
      'demo.run',
      { listingIds: [listingId] },
      { onProgress: (step) => (progress.value = step) },
    )

    /*
     * Die Cover kommen nach der Liste, nicht vor ihr.
     *
     * The marketplace hands back listings without images (worker/covers.ts has
     * the measurement), so each of these is a request of its own — five more
     * on top of seven, at the token-less pace of one every 2,4 s. Awaited
     * before the results appeared, that would be twelve seconds of nothing
     * after the work was already done. Started after, the list is on screen
     * while the sleeves fill in behind it.
     */
    void requestCovers(shown.value.map((find) => find.releaseId))
  } catch (cause) {
    error.value = cause
  } finally {
    running.value = false
    progress.value = null
  }
}

/** What the progress means, in words rather than a bar with no scale. */
const status = computed(() => {
  const step = progress.value
  if (!step) return m.value.demo.moment
  if (step.step === 'seeds') return m.value.demo.fetching
  if (step.step === 'shop')
    return `Lese das Sortiment – Seite ${step.done + 1} von ${step.total}`
  return m.value.demo.comparing
})

/**
 * Wie weit der Lauf ist, als Anteil von 0 bis 1.
 *
 * Weighted rather than counted, because the three phases are not the same
 * size: fetching the seed is two requests, reading the shop is five, and the
 * comparison itself is instant. A bar that gave each a third would sit at 33 %
 * through the whole long part and then jump — which is worse than no bar,
 * because it teaches you not to trust it.
 */
const share = computed(() => {
  const step = progress.value
  if (!step) return 0
  if (step.step === 'seeds') return 0.25 * (step.total ? step.done / step.total : 0)
  if (step.step === 'shop') return 0.25 + 0.7 * (step.total ? step.done / step.total : 0)
  return 1
})

/** The five worth showing. A demo is an argument, not a result list. */
const shown = computed(() => result.value?.finds.slice(0, 5) ?? [])

/** `12" Single`, `CD Album` — what it physically is, in two words. */
function shapeOf(format: string | null) {
  const { medium, kind, size } = describeFormat(format)
  return [size ?? medium, kind].filter(Boolean).join(' ')
}
</script>

<template>
  <section class="@container flex flex-col gap-5">
    <div class="flex flex-col gap-1">
      <h2 class="fid-display text-fid-xl font-bold text-fid-text">{{ m.demo.title }}</h2>
      <p class="max-w-prose text-fid-base text-fid-text-muted">{{ m.demo.lead }}</p>
    </div>

    <ErrorNote v-if="error" :cause="error" :signed-in="false" />

    <!--
      The field is at the top, and open.

      Es lag eine Weile zugeklappt unter den Covern — meine Entscheidung, mit
      dem Argument, dass ein Formular vor der ersten Platte alle bremst, die gar
      keinen Link dabeihaben. Zwei Dinge stimmten daran nicht. Ein `summary`
      sieht nicht nach etwas aus, das man anklicken kann, also fand es niemand;
      und wer *mit* einer Platte im Sinn kommt, ist genau der, den diese
      demonstration is supposed to convince — their path must not sit behind a
      liegen.

      fold. Open it costs two lines. That is cheaper than a way in that
      niemand sieht.
    -->
    <form class="flex flex-col gap-2" @submit.prevent="pastedId && run(pastedId)">
      <label class="text-fid-sm font-medium text-fid-text" for="demo-url">
        {{ m.demo.listing }}
      </label>
      <div class="flex flex-wrap gap-2">
        <input
          id="demo-url"
          v-model="url"
          type="url"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://www.discogs.com/sell/item/…"
          class="min-w-0 grow rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
        <button
          type="submit"
          :disabled="running || pastedId === null"
          class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        >
          {{ m.demo.look }}
        </button>
      </div>
    </form>

    <p class="text-fid-sm text-fid-text-muted">{{ m.demo.orOne }}</p>

    <!--
      Four covers, and nothing else.

      This was a list of text buttons on a page about records. The picture is
      the invitation; the artist, the title and one measured line are what fits
      under it without turning the tile back into a paragraph.
    -->
    <ul class="grid grid-cols-2 gap-x-3 gap-y-5 @xl:grid-cols-4">
      <!--
        No fade-in here, unlike in the cover rails.

        `fid-tile` staggers a rail into place, which is right where covers are
        decoration. These are the four things this page asks somebody to do, and
        the fade made the axe run fail one time in four: mid-animation the text
        sits at partial opacity, which is a real contrast of 1.09 against the
        page and not a measurement error. A screen you land on should be
        readable the instant it is there.
      -->
      <li v-for="seed in seeds" :key="seed.listingId" class="min-w-0">
        <button
          type="button"
          :disabled="running"
          class="group flex w-full flex-col gap-2 text-left disabled:opacity-50"
          @click="run(seed.listingId)"
        >
          <span class="relative block">
            <img
              :src="seed.thumbUrl"
              :srcset="`${seed.thumbUrl} 150w, ${seed.coverUrl} 600w`"
              sizes="(min-width: 640px) 240px, 45vw"
              :alt="`${seed.artist} – ${seed.title}`"
              loading="lazy"
              decoding="async"
              class="aspect-square w-full rounded-fid-cover bg-fid-inset object-cover shadow-sm transition-transform duration-200 group-hover:-translate-y-1"
            />

            <!--
              The shop sign, on the cover.

              Every one of these shops has set a real avatar rather than the
              grey default (checked 2026-08-10), so the shop is recognisable
              the way the record is — and a name in small grey type never was.

              Inside the sleeve rather than hanging off its corner: sitting
              outside, the first tile's logo disappeared behind the next tile's
              cover, because a grid item that paints later wins regardless of
              what the one before it wanted. A stamp on the sleeve cannot
              collide with anything.
            -->
            <img
              v-if="DEALER_LOGOS[seed.dealer]"
              :src="DEALER_LOGOS[seed.dealer]"
              :alt="`Laden ${seed.dealer}`"
              loading="lazy"
              decoding="async"
              class="absolute right-1.5 bottom-1.5 size-8 rounded-full ring-2 ring-fid-bg/80 bg-fid-inset object-cover"
            />
          </span>

          <span class="flex min-w-0 flex-col">
            <span class="truncate text-fid-sm font-medium text-fid-text">{{
              seed.artist
            }}</span>
            <span class="truncate text-fid-sm text-fid-text-muted">{{ seed.title }}</span>
            <span class="mt-1 text-fid-xs text-fid-text-muted">{{
              seed.promise[language]
            }}</span>
          </span>
        </button>
      </li>
    </ul>

    <!--
      The cost is stated before it is spent — and while it is, a bar that shows
      how far along it is.

      "Seite 3 von 5" is a fact somebody has to read and convert; a bar is the
      same fact at a glance. Half a minute of nothing moving is the difference
      between a screen that is working and one that is broken, and only one of
      those gets waited out.
    -->
    <div v-if="running" class="flex flex-col gap-2">
      <p class="text-fid-sm text-fid-text-muted" aria-live="polite">{{ status }}</p>
      <div
        class="h-1 w-full overflow-hidden rounded-full bg-fid-inset"
        role="progressbar"
        :aria-label="m.demo.progress"
        :aria-valuenow="Math.round(share * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-500 ease-out"
          :style="{ width: `${Math.max(share * 100, 4)}%` }"
        />
      </div>
    </div>
    <p v-else class="text-fid-xs text-fid-text-muted">Dauert eine knappe Minute.</p>

    <!-- Das Ergebnis, wieder als Cover. -->
    <section v-if="result" class="flex flex-col gap-3" aria-live="polite">
      <h3 class="flex items-center gap-2 text-fid-base font-medium text-fid-text">
        <img
          v-if="DEALER_LOGOS[result.dealer]"
          :src="DEALER_LOGOS[result.dealer]"
          alt=""
          loading="lazy"
          class="size-7 shrink-0 rounded-full bg-fid-inset object-cover"
        />
        {{ m.demo.fitsAt(result.dealer) }}
      </h3>

      <p v-if="shown.length === 0" class="max-w-prose text-fid-base text-fid-text-muted">
        {{ m.demo.nothing }}
      </p>

      <ul v-else class="grid grid-cols-2 gap-x-3 gap-y-5 @lg:grid-cols-3 @3xl:grid-cols-5">
        <li v-for="find in shown" :key="find.listingId" class="flex min-w-0 flex-col gap-2">
          <a
            :href="`https://www.discogs.com/sell/item/${find.listingId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="group relative block"
          >
            <img
              v-if="coverFor(find.releaseId, find.thumbUrl)"
              :src="coverFor(find.releaseId, find.thumbUrl)!.thumbUrl"
              :srcset="
                coverFor(find.releaseId)?.coverUrl
                  ? `${coverFor(find.releaseId)!.thumbUrl} 150w, ${coverFor(find.releaseId)!.coverUrl} 600w`
                  : undefined
              "
              sizes="(min-width: 640px) 200px, 45vw"
              :alt="`${find.artist} – ${find.title}`"
              loading="lazy"
              decoding="async"
              class="aspect-square w-full rounded-fid-cover bg-fid-inset object-cover transition-transform duration-200 group-hover:-translate-y-1"
            />
            <!-- Kein Bild ist der Normalfall, kein Fehler. -->
            <span
              v-else
              class="flex aspect-square w-full items-center justify-center rounded-fid-cover bg-fid-inset text-fid-text-muted"
              aria-hidden="true"
            >
              <FidIcon name="platte" :size="32" />
            </span>

            <span
              class="fid-num absolute top-1.5 right-1.5 rounded-fid-sm bg-fid-n-990/80 px-2 py-1 text-fid-xs font-medium text-fid-n-50"
              :aria-label="m.demo.score(find.score)"
            >
              {{ find.score }}
            </span>
          </a>

          <div class="flex min-w-0 flex-col">
            <span class="truncate text-fid-sm font-medium text-fid-text">{{
              find.artist
            }}</span>
            <span class="truncate text-fid-sm text-fid-text-muted">{{ find.title }}</span>
            <span class="fid-num mt-1 flex flex-wrap gap-x-2 text-fid-xs text-fid-text-muted">
              <span v-if="shapeOf(find.format)">{{ shapeOf(find.format) }}</span>
              <span v-if="money(find.price, find.currency)">
                {{ money(find.price, find.currency) }}
              </span>
            </span>
            <span class="mt-1 text-fid-xs text-fid-text-muted">{{ find.reason }}</span>
          </div>
        </li>
      </ul>

      <p class="fid-num max-w-prose text-fid-xs text-fid-text-muted">
        {{ m.demo.coverage(count(result.scanned), count(result.listingsTotal)) }}
      </p>
    </section>
  </section>
</template>
