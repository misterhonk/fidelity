<script setup lang="ts">
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
import { useCollectionMessages } from '~/i18n/collection'
import {
  drainLookups,
  lookupKind,
  queueLookup,
  readQueue,
  type QueuedLookup,
} from '~/utils/lookup'

const d = useDigMessages()
const c = useCollectionMessages()
const addMode = useAddMode()

const m = useMessages()
useSeoMeta({
  title: () => m.value.inStore.title,
  description: () => m.value.inStore.description,
})

const { call } = useFidelityWorker()

/*
 * Dark by default (#225): a shop is dim and a white screen glares across the
 * racks. A theme picked in the settings still wins.
 */
const { preference, resolved: theme } = useTheme()
const dim = computed(() => preference.value === 'system')
useHead({
  htmlAttrs: {
    'data-dim': computed(() => dim.value || undefined),
  },
  // The status bar of an installed app goes dark with the screen (app.vue sets it otherwise).
  meta: [
    {
      name: 'theme-color',
      content: computed(() => THEME_COLORS[dim.value ? 'dark' : theme.value]),
    },
  ],
})
/** Flipping crates, the screen stays on (#198). */
useWakeLock(() => true)
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

// Where `BarcodeDetector` is missing, the first tap loads a reader (ADR-018).
const canScan = cameraSupported()

async function openCamera() {
  scanning.value = true
  identified.value = null
  await nextTick()
  if (video.value)
    await scan.start(video.value, (code) => {
      // The digits read stand in the field: a misread is visible, and fixable.
      typed.value = code
      void identify(code)
    })
  if (scan.failure.value) scanning.value = false
}

function closeCamera() {
  scan.stop()
  scanning.value = false
}

/**
 * Typed rather than scanned — and one field takes all of it (#225).
 *
 * A barcode, a catalogue or run-out number, or an artist and a title:
 * `lookupKind` tells them apart. A name is searched as it is typed; a number
 * is looked up on Discogs. Two fields side by side would be two decisions
 * nobody wants to make while holding a record.
 */
const typed = ref('')
const kind = computed(() => lookupKind(typed.value))

// A barcode is not a name: it would only empty the list while it is typed.
watch(typed, (text) => (query.value = lookupKind(text) === 'barcode' ? '' : text))

function ask(entry: QueuedLookup): Promise<Identified> {
  return entry.kind === 'barcode'
    ? call('identify.barcode', { barcode: entry.code })
    : call('identify.runout', { runout: entry.code })
}

function show(found: Identified) {
  identified.value = found
  /*
   * The first candidate fills the search — not because it is the right one
   * but because it is the best starting point. The list shows that there are
   * several.
   */
  const first = found.candidates[0]
  if (first) query.value = first.title
  void readOnlyCandidate(found)
}

/*
 * No signal is not a dead end (#225). A code read in a basement is kept on
 * this device and looked up once the browser is back online.
 */
const QUEUE_KEY = 'fidelity:in-store-queue'
const queued = ref<QueuedLookup[]>([])
const resolved = shallowRef<{ entry: QueuedLookup; result: Identified }[]>([])

function keep(queue: QueuedLookup[]) {
  queued.value = queue
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Private mode, or storage refused: the queue still lasts this visit.
  }
}

async function identify(text: string) {
  scanning.value = false
  const sort = lookupKind(text)
  if (sort === null || sort === 'text') return
  const entry: QueuedLookup = { code: text.trim(), kind: sort }
  if (!online.value) return keep(queueLookup(queued.value, entry))

  identifying.value = true
  identified.value = null
  error.value = null
  try {
    show(await ask(entry))
  } catch (cause) {
    // shortcut: only a browser that says offline queues; a basement router with no uplink shows the error.
    if (online.value) error.value = cause
    else keep(queueLookup(queued.value, entry))
  } finally {
    identifying.value = false
  }
}

let draining = false

/** One drain at a time: the reconnect and a mount can both ask for one. */
async function resolveQueued() {
  if (draining || queued.value.length === 0) return
  draining = true
  try {
    const { done, failed } = await drainLookups(queued.value, ask, () => online.value)
    // From the queue as it is now: a code kept while this ran is not lost.
    const gone = new Set([...done, ...failed].map((entry) => entry.entry.code))
    keep(queued.value.filter((entry) => !gone.has(entry.code)))
    // A code that failed with signal will not do better later: say why, and drop it.
    if (failed[0]) error.value = failed[0].cause
    resolved.value = [...resolved.value, ...done]
  } finally {
    draining = false
  }
}

watch(online, (now) => {
  if (now) void resolveQueued()
})

/** The answer in one sentence, first: the pressing, then the album (M20 #3). */
function verdict(found: Identified): string {
  if (found.owned.length > 0) return m.value.inStore.scanOwned(count(found.owned.length))
  if (found.ownedAlbums.length > 0)
    return m.value.inStore.scanOwnedAlbum(count(found.ownedAlbums.length))
  if (found.wanted.length > 0) return m.value.inStore.scanWanted
  if (found.wantedAlbums.length > 0) return m.value.inStore.scanWantedAlbum
  return m.value.inStore.scanNew
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

onMounted(async () => {
  try {
    queued.value = readQueue(localStorage.getItem(QUEUE_KEY))
  } catch {
    // Nothing kept, nothing lost.
  }
  if (online.value) void resolveQueued()
  try {
    stands.value = await call('dig.stands', undefined)
    await Promise.all([loadShown(), loadFeedback(), loadBasket()])
  } finally {
    loading.value = false
  }
})

watch(chosen, () => void loadShown())

/*
 * ToTop and the toasts float above the tab bar — where this screen's field
 * sits. Raise them over it, by however tall the bar is right now (the camera
 * makes it taller).
 */
const bar = useTemplateRef<HTMLElement>('bar')
/** The bar's height, for the spacer that keeps the list's end out from under it (#313). */
const barHeight = ref(0)
let barSize: ResizeObserver | undefined
watch(bar, (element) => {
  barSize?.disconnect()
  if (!element) return
  barSize = new ResizeObserver(() => {
    barHeight.value = element.offsetHeight
    document.documentElement.style.setProperty(
      '--fid-float-bottom',
      `calc(env(safe-area-inset-bottom) + 5.5rem + ${element.offsetHeight}px)`,
    )
  })
  barSize.observe(element)
})
onBeforeUnmount(() => {
  barSize?.disconnect()
  document.documentElement.style.removeProperty('--fid-float-bottom')
})

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

/**
 * Nothing anywhere — which in a shop is an answer, not an empty state.
 *
 * Not for a catalogue number still in the field: it filters the finds (a
 * catno or "808 State" can match), but that it matches nothing here is no
 * answer before Discogs was asked.
 */
const nothingAnywhere = computed(
  () =>
    kind.value !== 'catno' &&
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

// Asked again when a price runs out (rule 4, useDeadline).
const { now: clock } = useDeadline(
  () => {
    const clocks = results.value.flatMap((entry) => entry.showUntil ?? [])
    return clocks.length > 0 ? Math.min(...clocks) : null
  },
  () => void loadShown(),
)
const expired = computed(() => results.value.some((entry) => clock.value > entry.dig.expiresAt))
</script>

<template>
  <AppPage narrow>
    <!--
        The in-store screen (docs/05 §3 row 9).

        Built for a phone in one hand and a record in the other: 56 px rows, one
        column, nothing that needs precision. It reads only from IndexedDB, so it
        is complete without a network — which is the point, because record shops
        are basements.
      -->
    <PageHeader>
      <template #title>
        <span class="flex items-center gap-2">
          <FidIcon name="stylus" :size="22" />
          {{ m.inStore.title }}
        </span>
      </template>
      <template #aside>
        <NuxtLink
          class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
          to="/"
        >
          {{ m.inStore.back }}
        </NuxtLink>
      </template>
    </PageHeader>

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
        class="text-fid-sm text-fid-sig-gap-text"
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

      <p v-if="expired" role="status" class="text-fid-sm text-fid-sig-gap-text">
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
      <!-- A lookup that failed with signal: typed now, or kept from the basement. -->
      <ErrorNote v-if="error" :cause="error" />

      <!--
          Codes kept without signal, and what they turned out to be once it
          came back (#225). Tapping one shows the whole answer below.
        -->
      <p v-if="queued.length > 0" role="status" class="text-fid-sm text-fid-text-muted">
        {{ m.inStore.queued(queued.length) }}
        <span class="fid-num">{{ queued.map((entry) => entry.code).join(' · ') }}</span>
      </p>
      <section v-if="resolved.length > 0" class="flex flex-col gap-1">
        <p class="text-fid-xs text-fid-text-muted">{{ m.inStore.resolved }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="done in resolved" :key="done.entry.code">
            <button
              type="button"
              class="fid-action flex min-h-11 w-full flex-col rounded-fid-sm border border-fid-border px-3 py-1 text-left"
              @click="show(done.result)"
            >
              <span class="text-fid-sm text-fid-text">{{ verdict(done.result) }}</span>
              <span class="fid-num text-fid-xs text-fid-text-muted">{{ done.entry.code }}</span>
            </button>
          </li>
        </ul>
      </section>

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
        <p class="text-fid-base font-medium text-fid-text">{{ verdict(identified) }}</p>
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
                    candidate.catno ? `${candidate.label} ${candidate.catno}` : candidate.label
                  }}
                </span>
                <span v-if="candidate.format" class="text-fid-xs text-fid-text-muted">
                  {{ candidate.format }}
                </span>
                <span
                  v-if="ownedIds.has(candidate.releaseId)"
                  class="text-fid-xs text-fid-sig-artist-text"
                >
                  {{ m.inStore.pressing.you }}
                </span>
              </button>
            </li>
          </ul>
          <div class="flex flex-wrap items-center gap-4">
            <!-- Bought it: straight into add mode with this answer, no second lookup (#233). -->
            <FidButton
              variant="secondary"
              @click="addMode.open({ found: identified, releaseId: familyFor })"
            >
              {{ c.add.toShelf }}
            </FidButton>
            <DiscogsCredit
              :to="releasePage(familyFor ?? identified.candidates[0]!.releaseId)"
              class="self-start"
            />
          </div>

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
                  warning.severity === 'high'
                    ? 'flex items-center gap-1 text-fid-error'
                    : 'text-fid-sig-gap-text'
                "
              >
                <FidIcon
                  v-if="warning.severity === 'high'"
                  name="circle-alert"
                  :size="14"
                  aria-hidden="true"
                />
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
                <span v-if="sibling.country" class="text-fid-text">{{ sibling.country }}</span>
                <span v-if="sibling.label">
                  {{ sibling.catno ? `${sibling.label} ${sibling.catno}` : sibling.label }}
                </span>
                <span v-if="sibling.format" class="text-fid-xs">{{ sibling.format }}</span>
                <span
                  v-if="ownedIds.has(sibling.releaseId)"
                  class="text-fid-xs text-fid-sig-artist-text"
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
                hit.source === 'wantlist' ? 'text-fid-sig-wantlist-text' : 'text-fid-text-muted'
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
            <DiscogsCredit :to="releasePage(hit.releaseId)" />
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
              <DiscogsCredit :to="listingPage(match.listingId)" class="shrink-0" />
            </span>
            <span class="line-clamp-2 text-fid-xs text-fid-text-muted">{{
              reasonFor(match.signals)
            }}</span>
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

      <!--
          One field, at the bottom, in thumb reach (#225).

          Fixed above the phone's nav bar, so it stays under the thumb however
          short or long the list above it is; sticky on a desk. A barcode, a
          catalogue or run-out number, or a name: the line under it says which
          one it took the input for.

          Measured on twelve records on 2026-09-11: ten had a barcode,
          **eleven had a run-out**, none had neither. On club vinyl the
          identifier is in the run-out — and the full string is more precise
          than any barcode (one hit instead of eight).
        -->
      <!-- What the fixed bar would otherwise cover at the end of the list: as tall as the bar is. -->
      <div
        class="h-32 md:hidden"
        :style="barHeight ? { height: `${barHeight}px` } : undefined"
        aria-hidden="true"
        data-testid="in-store-spacer"
      />
      <div
        ref="bar"
        class="z-10 flex flex-col gap-2 border-t border-fid-border bg-fid-bg/95 px-4 py-3 backdrop-blur max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:sticky md:bottom-0 md:-mx-4"
        data-testid="in-store-field"
      >
        <!--
            The camera, wherever there is one. `BarcodeDetector` reads in
            Chromium; in WebKit the first tap loads zxing-wasm (ADR-018). When
            that cannot load — offline on first use — the sentence stands
            instead, and typing goes into the field anyway (M13). Without
            signal it still reads: the code waits for the lookup.
          -->
        <div v-show="scanning" class="flex flex-col gap-2">
          <video
            ref="video"
            playsinline
            muted
            class="max-h-[40dvh] w-full rounded-fid-md bg-fid-inset object-cover"
          />
          <FidButton variant="secondary" class="self-start" @click="closeCamera">
            {{ m.inStore.scanStop }}
          </FidButton>
        </div>
        <p
          v-if="scan.failure.value === 'denied'"
          class="flex items-start gap-2 text-fid-sm text-fid-error"
        >
          <FidIcon name="circle-alert" :size="16" />
          {{ m.inStore.scanDenied }}
        </p>
        <p
          v-if="!canScan || scan.failure.value === 'unavailable'"
          class="text-fid-sm text-fid-text-muted"
        >
          {{ m.inStore.scanNotHere }}
        </p>

        <form class="flex items-stretch gap-2" @submit.prevent="identify(typed)">
          <input
            v-model="typed"
            type="text"
            autocomplete="off"
            spellcheck="false"
            enterkeyhint="go"
            :placeholder="m.inStore.identifyPlaceholder"
            :aria-label="m.inStore.identifyLabel"
            aria-describedby="in-store-kind"
            class="min-h-14 min-w-0 grow fid-field px-4 text-fid-base text-fid-text"
          />
          <FidButton
            v-if="canScan && scan.failure.value !== 'unavailable'"
            size="lg"
            class="shrink-0"
            :disabled="identifying || scanning"
            @click="openCamera"
          >
            <FidIcon name="scan" :size="20" aria-hidden="true" />
            {{ identifying ? m.inStore.scanning : m.inStore.scan }}
          </FidButton>
        </form>

        <div class="flex min-h-11 items-center justify-between gap-2">
          <p id="in-store-kind" aria-live="polite" class="text-fid-xs text-fid-text-muted">
            {{ kind ? m.inStore.kind[kind] : '' }}
          </p>
          <FidButton
            v-if="kind === 'barcode' || kind === 'catno'"
            variant="secondary"
            class="shrink-0"
            :disabled="identifying"
            @click="identify(typed)"
          >
            {{
              identifying
                ? m.inStore.scanning
                : online
                  ? m.inStore.identify
                  : m.inStore.identifyLater
            }}
          </FidButton>
        </div>
      </div>
    </template>
  </AppPage>
</template>
