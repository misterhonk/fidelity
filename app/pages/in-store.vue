<script setup lang="ts">
import { looksLikeBarcode } from '~~/worker/identify'
import type { DigWithMatches } from '#shared/protocol'
import type {
  ShelfHit,
  ShelfResult,
  Identified,
  Match,
  PressingFamily,
  Stand,
} from '#shared/types'
import { reasonFor } from '~/i18n/reason'
import { pressingText, stampText } from '~/i18n/pressing'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const m = useMessages()
useSeoMeta({
  title: () => m.value.inStore.title,
  description: () => m.value.inStore.description,
})

const { call } = useFidelityWorker()
const { online } = useOnline()
const { verdicts, judge, failure: judgeFailure, load: loadFeedback } = useFeedback()
const { contains, toggle, failure: basketFailure, load: loadBasket } = useBasket()

const route = useRoute()
const router = useRouter()

/*
 * A record fair (M19 #4).
 *
 * The scans happen at home in the morning; the fair is several stands in one
 * afternoon. So this screen offers every shop scanned in the last day — one
 * list per stand, or all of them as one list with the stand named on each
 * row. Which one is in the address (`?stand=`), so a reload in a basement
 * with no signal lands where you were. With one shop scanned there is no
 * choice to make and nothing extra on the screen.
 */
const stands = shallowRef<Stand[]>([])
// Shallow: the in-store screen judges records too, and a proxy cannot
// cross postMessage. Same reason as the dig screen.
const results = shallowRef<DigWithMatches[]>([])
const loading = ref(true)
const query = ref('')

const chosen = computed(() => {
  const value = route.query.stand
  return typeof value === 'string' ? value : ''
})
const fair = computed(() => stands.value.length > 1)
const allMode = computed(() => fair.value && chosen.value === 'all')

/** Which stands are on the screen: all of them, the one asked for, or the newest. */
const showing = computed<Stand[]>(() => {
  if (stands.value.length === 0) return []
  if (allMode.value) return stands.value
  const asked = stands.value.find((stand) => stand.digId === chosen.value)
  return [asked ?? stands.value[0]!]
})

function choose(stand: string) {
  // replace, not push: picking a stand is not a navigation step.
  void router.replace({ query: { ...route.query, stand } })
}

async function loadShown() {
  if (stands.value.length === 0) {
    // No stand in the last day: the newest dig there is, as this screen always did.
    const latest = await call('dig.latest', undefined)
    results.value = latest ? [latest] : []
    return
  }
  const loaded = await Promise.all(
    showing.value.map((stand) => call('dig.get', { digId: stand.digId })),
  )
  results.value = loaded.filter((entry): entry is DigWithMatches => entry !== null)
}

const single = computed(() => (results.value.length === 1 ? results.value[0]! : null))

/** The stand a row belongs to, for the list that shows several. */
function shopOf(match: Match): string {
  const stand = stands.value.find((entry) => entry.digId === match.digId)
  return (
    stand?.displayName ?? results.value.find((r) => r.dig.id === match.digId)?.dig.dealer ?? ''
  )
}

/** The digs on screen that stopped halfway — named, because there may be several. */
const interrupted = computed(() =>
  results.value.filter((r) => r.dig.status !== 'done' && r.dig.status !== 'expired'),
)

/*
 * Scanning the record in your hand (M13).
 *
 * The same screen, a third way into the search field: type, or hold the camera
 * up to it. What the barcode yields is **not** shown as an answer but put in
 * as a search term — the answer is below anyway, and it comes from the local
 * database.
 */
const error = ref<unknown>(null)
const scan = useBarcodeScan()
const video = useTemplateRef<HTMLVideoElement>('video')
const scanning = ref(false)
const identified = shallowRef<Identified | null>(null)
const identifying = ref(false)

const canScan = barcodeSupported()

async function openCamera() {
  scanning.value = true
  identified.value = null
  await nextTick()
  if (video.value) await scan.start(video.value, (code) => void lookUp(code))
}

function closeCamera() {
  scan.stop()
  scanning.value = false
}

/**
 * Typed rather than scanned — and it takes both.
 *
 * Digits only is a barcode, anything else a run-out number. Two fields side by
 * side would be two decisions nobody wants to make while holding a record.
 */
const typed = ref('')

async function lookUpTyped() {
  const text = typed.value.trim()
  if (!text) return

  identifying.value = true
  identified.value = null
  try {
    identified.value = looksLikeBarcode(text)
      ? await call('identify.barcode', { barcode: text })
      : await call('identify.runout', { runout: text })

    const first = identified.value.candidates[0]
    if (first) query.value = first.title
    void readOnlyCandidate(identified.value)
  } catch (cause) {
    error.value = cause
  } finally {
    identifying.value = false
  }
}

/*
 * Which pressing this is (M19 #7).
 *
 * The candidates are the pressings that share the code — eight for one
 * barcode, measured. Picking the one in your hand reads it against the
 * album's whole family: stated reissue, the album's first year, which
 * pressings carry it. Two requests, for one record, on a tap; a run-out that
 * returns exactly one candidate needs no tap.
 */
const family = shallowRef<PressingFamily | null>(null)
const familyFor = ref<number | null>(null)
const familyMissing = ref(false)
const reading = ref(false)

async function readPressing(releaseId: number) {
  if (familyFor.value === releaseId && (family.value || familyMissing.value)) return
  familyFor.value = releaseId
  family.value = null
  familyMissing.value = false
  reading.value = true
  try {
    family.value = await call('pressing.family', { releaseId })
    familyMissing.value = family.value === null
  } catch {
    familyMissing.value = true
  } finally {
    reading.value = false
  }
}

function readOnlyCandidate(found: Identified) {
  family.value = null
  familyFor.value = null
  familyMissing.value = false
  const only = found.candidates.length === 1 ? found.candidates[0] : undefined
  if (only) return readPressing(only.releaseId)
}

const ownedIds = computed(() => new Set(identified.value?.owned.map((o) => o.releaseId) ?? []))

async function lookUp(barcode: string) {
  scanning.value = false
  identifying.value = true
  try {
    const found = await call('identify.barcode', { barcode })
    identified.value = found
    /*
     * The first candidate fills the search field — not because it is the right
     * one but because it is the best starting point. The list below shows that
     * there are several.
     */
    const first = found.candidates[0]
    if (first) query.value = first.title
    void readOnlyCandidate(found)
  } catch (cause) {
    error.value = cause
  } finally {
    identifying.value = false
  }
}

onMounted(async () => {
  try {
    stands.value = await call('dig.stands', undefined)
    await Promise.all([loadShown(), loadFeedback(), loadBasket()])
  } finally {
    loading.value = false
  }
})

watch(chosen, () => void loadShown())

/**
 * Everything, by score, with the shortlist folded in.
 *
 * No filter bar, no density switch, no sorting. Standing in a shop holding a
 * record you want one question answered — is this one of mine — and every
 * control between you and that answer is in the way.
 */
const matches = computed(() => {
  const all = results.value.flatMap((entry) => entry.matches)
  // Several stands as one list: by score, the way each list already is.
  if (results.value.length > 1) all.sort((a, b) => b.score - a.score)
  const needle = query.value.trim()
  return needle ? all.filter((match) => textMatches(match, needle)) : all
})

/*
 * "Habe ich die schon?"
 *
 * The question this screen says it exists for — and until now it could only
 * answer it about records the last dig happened to find, which is one online
 * dealer's stock and never the crate in front of you.
 *
 * The collection and the wantlist have been on this device since M1. No
 * request, no network, no rate limit, which is the whole point: record shops
 * are basements and basements have no signal.
 */
const shelf = shallowRef<ShelfResult | null>(null)

let shelfToken = 0
watch(query, (value) => {
  const mine = ++shelfToken
  if (value.trim().length < 2) {
    shelf.value = null
    return
  }

  void call('collection.shelf', { query: value }).then((result) => {
    // A slower answer to an older query must not overwrite a newer one.
    if (mine === shelfToken) shelf.value = result
  })
})

/** Nothing anywhere — which in a shop is an answer, not an empty state. */
const nothingAnywhere = computed(
  () =>
    query.value.trim().length >= 2 &&
    matches.value.length === 0 &&
    shelf.value?.hits.length === 0,
)

function formats(hit: ShelfHit): string {
  return hit.formats.slice(0, 2).join(', ')
}

/*
 * How long it has been wanted lives in `~/utils/when`.
 *
 * The same branching stood here a second time — in German, hard-coded, inside
 * an English interface. It survived the ADR-010 translation because
 * `template-text.spec.ts` only looks between the tags, and this sentence came
 * out of the script through `{{ }}`.
 */

const expired = computed(() => results.value.some((entry) => Date.now() > entry.dig.expiresAt))
</script>

<template>
  <main class="fid-page py-6">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <!--
        The in-store screen (docs/05 §3 row 9).

        Built for a phone in one hand and a record in the other: 56 px rows, one
        column, nothing that needs precision. It reads only from IndexedDB, so it
        is complete without a network — which is the point, because record shops
        are basements.
      -->
      <div class="flex items-baseline justify-between gap-3">
        <h1 class="fid-display flex items-center gap-2 text-fid-xl font-bold text-fid-text">
          <FidIcon name="nadel" :size="22" />
          {{ m.inStore.title }}
        </h1>
        <NuxtLink
          class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
          to="/"
        >
          {{ m.inStore.back }}
        </NuxtLink>
      </div>

      <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ m.common.loading }}</p>

      <template v-else>
        <!--
          The stands, where there are several: a chip per shop and one for all
          of them. 44 px each — this is the screen for a hand with a record in
          it. Nothing of it when only one shop was scanned.
        -->
        <div v-if="fair" class="flex flex-col gap-2">
          <p class="text-fid-xs text-fid-text-muted">{{ m.inStore.stands.lead }}</p>
          <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              :aria-pressed="allMode"
              class="fid-action min-h-11 shrink-0 rounded-fid-sm border px-4 text-fid-sm"
              :class="
                allMode
                  ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                  : 'border-fid-border text-fid-text-muted'
              "
              @click="choose('all')"
            >
              {{ m.inStore.stands.all(stands.length) }}
            </button>
            <button
              v-for="stand in stands"
              :key="stand.digId"
              type="button"
              :aria-pressed="!allMode && showing[0]?.digId === stand.digId"
              class="fid-action min-h-11 shrink-0 rounded-fid-sm border px-4 text-fid-sm"
              :class="
                !allMode && showing[0]?.digId === stand.digId
                  ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                  : 'border-fid-border text-fid-text-muted'
              "
              @click="choose(stand.digId)"
            >
              {{ m.inStore.stands.chip(stand.displayName, m.inStore.finds(stand.matches)) }}
            </button>
          </div>
        </div>

        <p v-if="single" class="text-fid-sm text-fid-text-muted">
          {{ single.dig.dealer }} ·
          <span class="fid-num">{{ m.inStore.finds(single.matches.length) }}</span
          ><template v-if="!online"> · {{ m.inStore.offline }}</template>
        </p>
        <p v-else-if="allMode" class="text-fid-sm text-fid-text-muted">
          <span class="fid-num">{{
            m.inStore.stands.line(results.length, m.inStore.finds(matches.length))
          }}</span
          ><template v-if="!online"> · {{ m.inStore.offline }}</template>
        </p>

        <!--
          A dig that was cut short is not a result.
          Standing in a shop is the worst place to be told three records are all
          there is, when the scan behind that number stopped halfway. The dig
          screen says so and offers to finish; this one showed the same matches
          with none of it.

          An expired dig is not a cut-short one. Seen 2026-09-11 in the built
          app: a complete scan, six hours on, read "interrupted — 1,328 of 1,328
          were through", because `expired` is also not `done`. The line below
          this one is the expired dig's; this one is for the scan that stopped.
        -->
        <p
          v-for="entry in interrupted"
          :key="entry.dig.id"
          role="status"
          class="text-fid-sm text-fid-sig-gap"
        >
          {{
            single
              ? m.inStore.interrupted(
                  count(entry.dig.listingsScanned),
                  count(entry.dig.listingsTotal),
                )
              : m.inStore.stands.interrupted(
                  entry.dig.dealer,
                  count(entry.dig.listingsScanned),
                  count(entry.dig.listingsTotal),
                )
          }}
        </p>
        <!--
          No dig is not an empty screen any more. The list of finds needs one;
          "do I have this already?" does not, and that is the question somebody
          actually has standing in a shop.
        -->
        <p v-if="results.length === 0" class="text-fid-sm text-fid-text-muted">
          {{ m.inStore.noDig }}
        </p>

        <p v-if="expired" role="status" class="text-fid-sm text-fid-sig-gap">
          {{ m.inStore.expired }}
        </p>

        <!--
          A verdict or a basket click that did not survive the trip to the
          worker. Both roll back, so without this the button would spring back
          with no explanation — and in a shop, with the record in your hand, that
          is the worst place to be guessing.
        -->
        <ErrorNote v-if="judgeFailure" :cause="judgeFailure" />
        <ErrorNote v-else-if="basketFailure" :cause="basketFailure" />

        <!-- Big enough to hit while walking. -->
        <!--
          The camera, and only where it can read something.
          `BarcodeDetector` is missing in WebKit — on an iPhone a camera button
          would show a picture and recognise nothing. There a sentence stands
          instead, and typing goes into the field below anyway (M13).
        -->
        <div v-if="canScan" class="flex flex-col gap-2">
          <button
            v-if="!scanning"
            type="button"
            :disabled="identifying || !online"
            class="fid-action flex min-h-11 items-center gap-2 self-start rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-40"
            @click="openCamera"
          >
            <FidIcon name="scan" :size="16" aria-hidden="true" />
            {{ identifying ? m.inStore.scanning : m.inStore.scan }}
          </button>

          <div v-show="scanning" class="flex flex-col gap-2">
            <video ref="video" playsinline muted class="w-full rounded-fid-md bg-fid-inset" />
            <button
              type="button"
              class="fid-action min-h-11 self-start rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text"
              @click="closeCamera"
            >
              {{ m.inStore.scanStop }}
            </button>
          </div>

          <p v-if="scan.failure.value === 'denied'" class="text-fid-sm text-fid-sig-scarcity">
            {{ m.inStore.scanDenied }}
          </p>
        </div>
        <p v-else class="text-fid-sm text-fid-text-muted">{{ m.inStore.scanNotHere }}</p>

        <!--
          Typed: barcode or run-out.

          Measured on twelve records on 2026-09-11: ten had a barcode,
          **eleven had a run-out**, none had neither. On club vinyl the
          identifier is in the run-out — and the full string is more precise
          than any barcode (one hit instead of eight).
        -->
        <form class="flex flex-wrap gap-2" @submit.prevent="lookUpTyped">
          <input
            v-model="typed"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.inStore.identifyPlaceholder"
            :aria-label="m.inStore.identifyLabel"
            class="min-w-0 grow rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
          />
          <button
            type="submit"
            :disabled="identifying || !online"
            class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-40"
          >
            {{ identifying ? m.inStore.scanning : m.inStore.identify }}
          </button>
        </form>

        <!--
          What the barcode yielded — as a **list**, not as an answer. Measured
          2026-09-11: eight releases across five countries shared one barcode.
          Showing a single result would be a promise the data does not cover.
        -->
        <section
          v-if="identified"
          class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-3"
        >
          <!--
            The pressing first, then the album (M20 #3): "you have it" and "you
            have another pressing of it" are different answers in a shop, and
            the second used to be "not in your collection".
          -->
          <p class="text-fid-sm text-fid-text">
            {{
              identified.owned.length > 0
                ? m.inStore.scanOwned(count(identified.owned.length))
                : identified.ownedAlbums.length > 0
                  ? m.inStore.scanOwnedAlbum(count(identified.ownedAlbums.length))
                  : identified.wanted.length > 0
                    ? m.inStore.scanWanted
                    : identified.wantedAlbums.length > 0
                      ? m.inStore.scanWantedAlbum
                      : m.inStore.scanNew
            }}
          </p>
          <p v-if="identified.candidates.length > 1" class="text-fid-xs text-fid-text-muted">
            {{ m.inStore.scanPressings(count(identified.candidates.length)) }}
          </p>
          <p
            v-else-if="identified.candidates.length === 0"
            class="text-fid-xs text-fid-text-muted"
          >
            {{ m.inStore.scanNothing }}
          </p>

          <!--
            The pressings themselves, as a list to pick from — which one is in
            your hand is written on its label, not in the code (M19 #7).
          -->
          <template v-if="identified.candidates.length > 0">
            <p v-if="identified.candidates.length > 1" class="text-fid-xs text-fid-text-muted">
              {{ m.inStore.pressing.pick }}
            </p>
            <ul class="flex flex-col gap-1">
              <li v-for="candidate in identified.candidates" :key="candidate.releaseId">
                <button
                  type="button"
                  class="fid-action flex min-h-11 w-full flex-wrap items-baseline gap-x-2 rounded-fid-sm border px-3 py-1 text-left text-fid-sm"
                  :class="
                    familyFor === candidate.releaseId
                      ? 'border-fid-text bg-fid-inset text-fid-text'
                      : 'border-fid-border text-fid-text'
                  "
                  :aria-pressed="familyFor === candidate.releaseId"
                  :disabled="reading || !online"
                  @click="readPressing(candidate.releaseId)"
                >
                  <span v-if="candidate.year" class="fid-num">{{ candidate.year }}</span>
                  <span v-if="candidate.country">{{ candidate.country }}</span>
                  <span v-if="candidate.label" class="text-fid-text-muted">
                    {{
                      candidate.catno
                        ? `${candidate.label} ${candidate.catno}`
                        : candidate.label
                    }}
                  </span>
                  <span v-if="candidate.format" class="text-fid-xs text-fid-text-muted">
                    {{ candidate.format }}
                  </span>
                  <span
                    v-if="ownedIds.has(candidate.releaseId)"
                    class="text-fid-xs text-fid-sig-artist"
                  >
                    {{ m.inStore.pressing.you }}
                  </span>
                </button>
              </li>
            </ul>

            <p v-if="reading" class="text-fid-sm text-fid-text-muted" aria-live="polite">
              {{ m.inStore.pressing.reading }}
            </p>
            <p v-else-if="familyMissing" class="text-fid-sm text-fid-text-muted">
              {{ m.inStore.pressing.noAnswer }}
            </p>

            <!-- The verdict: M7's reading, placed among every pressing of the album. -->
            <div
              v-else-if="family"
              class="flex flex-col gap-2 border-t border-fid-border pt-2"
              data-testid="pressing-family"
            >
              <ul v-if="family.warnings.length" class="flex flex-col gap-1">
                <li
                  v-for="warning in family.warnings"
                  :key="warning.kind + (warning.facts.special ?? '')"
                  class="text-fid-sm"
                  :class="
                    warning.severity === 'high' ? 'text-fid-sig-scarcity' : 'text-fid-sig-gap'
                  "
                >
                  {{ pressingText(warning) }}
                </li>
              </ul>

              <p class="text-fid-sm text-fid-text">
                <template v-if="family.total <= 1 || family.firstYear === null">
                  {{ m.inStore.pressing.onlyItself }}
                </template>
                <template v-else-if="family.amongFirst">
                  {{ m.inStore.pressing.among(count(family.total), family.firstYear) }}
                </template>
                <template v-else>
                  {{ m.inStore.pressing.later(count(family.total), family.firstYear) }}
                </template>
              </p>

              <ul
                v-if="!family.amongFirst && family.first.length"
                class="flex flex-col gap-1"
                :aria-label="m.inStore.pressing.firstOnes"
              >
                <li
                  v-for="sibling in family.first"
                  :key="sibling.releaseId"
                  class="flex flex-wrap items-baseline gap-x-2 text-fid-sm text-fid-text-muted"
                >
                  <span v-if="sibling.country" class="text-fid-text">{{
                    sibling.country
                  }}</span>
                  <span v-if="sibling.label">
                    {{ sibling.catno ? `${sibling.label} ${sibling.catno}` : sibling.label }}
                  </span>
                  <span v-if="sibling.format" class="text-fid-xs">{{ sibling.format }}</span>
                  <span
                    v-if="ownedIds.has(sibling.releaseId)"
                    class="text-fid-xs text-fid-sig-artist"
                  >
                    {{ m.inStore.pressing.you }}
                  </span>
                </li>
              </ul>

              <ul v-if="family.profile.stamps.length" class="flex flex-col gap-1">
                <li
                  v-for="stamp in family.profile.stamps"
                  :key="stamp.key"
                  class="text-fid-sm text-fid-text-muted"
                >
                  <span class="text-fid-text">{{ stampText(stamp).label }}</span> –
                  {{ stampText(stamp).note }}
                </li>
              </ul>

              <!-- Printed verbatim: this is what you compare against the groove. -->
              <ul v-if="family.profile.runouts.length" class="flex flex-col gap-1">
                <li
                  v-for="runout in family.profile.runouts"
                  :key="runout"
                  class="fid-num text-fid-xs text-fid-text-muted"
                >
                  {{ runout }}
                </li>
              </ul>

              <a
                :href="`https://www.discogs.com/release/${family.releaseId}`"
                target="_blank"
                rel="noopener"
                class="fid-action self-start text-fid-sm text-fid-text underline"
              >
                {{ m.inStore.pressing.onDiscogs }}
              </a>
            </div>
          </template>
        </section>

        <input
          v-model="query"
          type="search"
          autocomplete="off"
          spellcheck="false"
          :placeholder="m.inStore.search"
          :aria-label="m.inStore.searchLabel"
          class="rounded-fid-md border border-fid-field bg-fid-surface px-4 py-3 text-fid-base text-fid-text"
        />

        <!--
          Your own shelf first. Standing in a shop the two answers that stop you
          short are "die hast du schon" and "die suchst du seit vier Jahren", and
          both come out of IndexedDB — no request, no signal needed.
        -->
        <ul v-if="shelf && shelf.hits.length > 0" class="flex flex-col gap-2">
          <li
            v-for="hit in shelf.hits"
            :key="`${hit.source}-${hit.releaseId}`"
            class="flex min-h-14 flex-col justify-center gap-1 rounded-fid-md border px-3 py-2"
            :class="
              hit.source === 'wantlist'
                ? 'border-fid-sig-wantlist/50 bg-fid-sig-wantlist/5'
                : 'border-fid-border'
            "
          >
            <span class="flex flex-wrap items-baseline gap-x-2">
              <span
                class="text-fid-sm font-medium"
                :class="
                  hit.source === 'wantlist' ? 'text-fid-sig-wantlist' : 'text-fid-text-muted'
                "
              >
                {{ hit.source === 'wantlist' ? m.inStore.youWant : m.inStore.youOwn }}
              </span>
              <span class="min-w-0 text-fid-base text-fid-text">
                {{ hit.artist }} – {{ hit.title }}
              </span>
            </span>

            <span class="flex flex-wrap gap-x-2 text-fid-xs text-fid-text-muted">
              <span v-if="hit.year > 0" class="fid-num">{{ hit.year }}</span>
              <!--
                The format is the whole answer when you own the record already:
                holding the vinyl of something you have on CD is a buy, not a
                stop.
              -->
              <span v-if="formats(hit)">{{ formats(hit) }}</span>
              <span v-if="hit.rating > 0" class="fid-num">{{ hit.rating }}/5</span>
              <span v-if="waitingFor(hit.waitingDays)">{{ waitingFor(hit.waitingDays) }}</span>
              <!--
                How likely the copy in your hand is the one you meant. One of two
                hundred and forty-seven pressings is a different proposition from
                the only one there is.
              -->
              <span v-if="hit.pressings !== null" class="fid-num">
                {{ m.inStore.pressings(hit.pressings) }}
              </span>
            </span>
          </li>
        </ul>

        <p v-if="nothingAnywhere" class="text-fid-base text-fid-text-muted">
          {{ m.inStore.notInLibrary
          }}<template v-if="results.length > 0"> {{ m.inStore.norLastDig }}</template
          >.
        </p>
        <p
          v-else-if="matches.length === 0 && (!shelf || shelf.hits.length === 0)"
          class="text-fid-base text-fid-text-muted"
        >
          {{ m.inStore.nothingByName }}
        </p>

        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="match in matches"
            :key="match.listingId"
            class="flex min-h-14 items-center gap-3 rounded-fid-md border border-fid-border px-3 py-2"
          >
            <span
              class="fid-num w-10 shrink-0 text-center text-fid-xl font-bold text-fid-text"
              :aria-label="d.match.score(match.score)"
            >
              {{ match.score }}
            </span>

            <!--
              The title gets the full width and the price moves under it. Holding
              a record in a shop, the one question is whether this is one of
              yours, and "Portishea…" does not answer it.
            -->
            <span class="flex min-w-0 grow flex-col">
              <span class="truncate text-fid-base text-fid-text">
                {{ match.artist }} – {{ match.title }}
              </span>
              <span class="flex items-baseline gap-2">
                <!-- Which stand, when the list is all of them. -->
                <span v-if="allMode" class="shrink-0 text-fid-xs text-fid-text">
                  {{ shopOf(match) }}
                </span>
                <span
                  v-if="money(match.price, match.currency)"
                  class="fid-num shrink-0 text-fid-sm text-fid-text-muted"
                >
                  {{ money(match.price, match.currency) }}
                </span>
                <span class="truncate text-fid-xs text-fid-text-muted">{{
                  reasonFor(match.signals)
                }}</span>
              </span>
            </span>

            <!--
              Two targets, both 44 px, both one-handed: is it for me, and did I
              take it. Everything else belongs on a desk.
            -->
            <button
              type="button"
              :aria-pressed="contains(match.listingId)"
              :aria-label="contains(match.listingId) ? d.match.outOfBasket : d.match.inBasket"
              class="size-11 shrink-0 rounded-fid-sm border text-fid-xl"
              :class="
                contains(match.listingId)
                  ? 'border-fid-accent bg-fid-accent/15'
                  : 'border-fid-border text-fid-text-muted'
              "
              @click="toggle(match.digId, match.listingId)"
            >
              <FidIcon name="shopping-cart" :size="20" />
            </button>

            <button
              type="button"
              :aria-pressed="verdicts[match.listingId] === 'wrong'"
              :aria-label="m.inStore.wrong"
              class="size-11 shrink-0 rounded-fid-sm border text-fid-xl"
              :class="
                verdicts[match.listingId] === 'wrong'
                  ? 'border-fid-accent bg-fid-accent/15'
                  : 'border-fid-border text-fid-text-muted'
              "
              @click="judge(match, 'wrong')"
            >
              <FidIcon name="thumbs-down" :size="20" />
            </button>
          </li>
        </ul>
      </template>
    </div>
  </main>
</template>
