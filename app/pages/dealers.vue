<script setup lang="ts">
import { ORIGIN_FILTERS, passesOrigin, readOrigin, type OriginFilter } from '#shared/countries'
import type { DealerProfile } from '#shared/protocol'
import type { SuggestResult } from '~~/worker/dealers/suggest'
import type {
  Dealer,
  DealerReason,
  DealerWithReasons,
  GradingRecord,
  RoundProgress,
  RoundSummary,
  TasteFacet,
} from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'
import SheetFrame from '~/components/SheetFrame.vue'

const h = useDealerMessages()
const m = useMessages()
useSeoMeta({
  title: () => h.value.title,
  description: () => h.value.description,
})

const { call } = useFidelityWorker()
const { alerts, isWatched, toggle, load: loadWatchlist } = useWatchlist()

/*
 * The sleeves for the shelf sample — whatever is already stored, and nothing
 * more. `fetch: false` is the point: a picture beside a shop is worth having
 * and not worth a request, so a record without a cover on hand shows none.
 */
const { coverFor, request: requestCovers } = useCovers()

/*
 * What the watcher found, by shop.
 *
 * It runs on every app start and reports "37 more than last time" per watched
 * shop. Until now that arrived as a banner at the top of the screen; the row
 * is where somebody would act on it.
 */
const moved = computed(
  () => new Map(alerts.value.map((alert) => [alert.dealer, alert.newListings])),
)
const {
  state: push,
  busy: pushBusy,
  refresh: refreshPush,
  enable: enablePush,
  disable: disablePush,
} = usePush()
const route = useRoute()

const dealers = shallowRef<DealerWithReasons[]>([])

/**
 * Until the first answer comes back, the shape rather than a sentence (M31.10).
 *
 * The list reads out of IndexedDB, so this is a few dozen milliseconds on a
 * desktop and noticeably more on a phone that has just woken up. Four grey
 * rows in the shape of the real ones say "in a moment" without the page
 * jumping when they are replaced — a loading sentence gets swapped for a list
 * of a different height, and everything below it moves.
 */
const loading = ref(true)

/*
 * "Only from Germany / the EU" (M20 #2), on the chips. A view, in the
 * address; the block list in the preferences stays the hard rule. Your
 * country comes from the preferences, the same field the postage uses.
 */
const home = ref('')
const router = useRouter()
const origin = computed(() => readOrigin(route.query.from))
function originBy(key: OriginFilter) {
  void router.replace({ query: { ...route.query, from: key === 'any' ? undefined : key } })
}
const shown = computed(() =>
  dealers.value.filter((dealer) => passesOrigin(dealer.shipsFrom, origin.value, home.value)),
)
/*
 * A name to type, and a list that does not arrive all at once.
 *
 * Reported on 0.73: with many entries the shops were "one huge wall of
 * buttons". Three things fix that and only one of them is the row itself —
 * the other two are that a long list can be searched and that it stops
 * somewhere. Twelve is about a screen; the rest is one tap away.
 */
const query = ref('')
const STEP = 12
const room = ref(STEP)

/**
 * How the list is ordered, and the two groups it falls into (M31.10).
 *
 * Hit rate is the default and the only ordering that answers "where next" —
 * but somebody tidying up looks for *last dug*, and somebody comparing postage
 * for *where from*. Four orderings, one row above the list.
 *
 * The groups are the mental model rather than a filter: the shops you watch,
 * bought from or entered yourself are *yours*; the ones a dig or a friends
 * list brought in are the rest. Ranked inside each, so the ordering above
 * still decides.
 */
const SORTS = ['rate', 'recent', 'size', 'name'] as const
const sort = ref<(typeof SORTS)[number]>('rate')

const MINE: DealerReason[] = ['watched', 'order', 'manual', 'basket']
const isMine = (dealer: DealerWithReasons) =>
  dealer.reasons.some((reason) => MINE.includes(reason))

const matching = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return shown.value
  return shown.value.filter((dealer) =>
    `${dealer.displayName} ${dealer.username}`.toLowerCase().includes(needle),
  )
})

/** The worker already ranks by hit rate, so that one is the list as it came. */
const ordered = computed(() => {
  const rows = [...matching.value]
  if (sort.value === 'recent')
    return rows.sort((a, b) => (b.lastScannedAt ?? 0) - (a.lastScannedAt ?? 0))
  if (sort.value === 'size') return rows.sort((a, b) => b.numForSale - a.numForSale)
  if (sort.value === 'name')
    return rows.sort((a, b) =>
      (a.displayName || a.username).localeCompare(b.displayName || b.username),
    )
  return rows
})

/*
 * The open shop is always in the list, even past the cut.
 *
 * Otherwise a link straight to a shop that ranks fortieth draws its profile
 * under a list in which nothing is marked — and the screen looks like it is
 * showing somebody else's shop.
 */
const listed = computed(() => {
  const head = ordered.value.slice(0, room.value)
  const open = ordered.value.find((dealer) => dealer.username === selected.value)
  return open && !head.includes(open) ? [...head, open] : head
})

const rest = computed(() => matching.value.length - listed.value.length)

/**
 * Two groups, and only where both have something in them.
 *
 * A single heading over the whole list is a heading that says nothing.
 */
const groups = computed(() => {
  const mine = listed.value.filter(isMine)
  const others = listed.value.filter((dealer) => !isMine(dealer))
  if (mine.length === 0 || others.length === 0) return [{ key: null, rows: listed.value }]
  return [
    { key: 'mine' as const, rows: mine },
    { key: 'rest' as const, rows: others },
  ]
})

/** One scale for every bar in the list — see DealerRow.vue. */
const peak = computed(() =>
  Math.max(0, ...matching.value.map((dealer) => dealer.affinity ?? 0)),
)

// A new search, order or origin starts from the top again.
watch([query, origin, sort], () => (room.value = STEP))

/** The shops somebody asked never to see again — listed at the foot, so they can come back. */
const hidden = shallowRef<Dealer[]>([])
/*
 * Which shop is open — in the address, not only in memory (M30).
 *
 * A reload used to open whichever shop ranked highest rather than the one
 * somebody was reading, and the screen could not be linked to at all. The dig
 * screen has carried its `?id=` since M3 for exactly this reason; found again
 * here when a test asserted straight through a reload and failed against a
 * screen showing a different shop.
 */
const selected = computed(() => {
  const wanted = route.query.shop
  return typeof wanted === 'string' && wanted ? wanted : null
})
const profile = ref<DealerProfile | null>(null)

/**
 * How honestly this shop grades — out of your own purchases (M14).
 *
 * Costs no request: the number is in this device's `feedback` store. Loaded
 * separately from the profile, because it has nothing to do with Discogs — the
 * profile comes from the server, this from your own past.
 */
const grading = ref<GradingRecord | null>(null)
const error = ref<unknown>(null)

/*
 * The round: every watched shop, asked what is new (worker/dealers/round.ts).
 *
 * Reported as a question against 0.70.1: "do I understand this right — the app
 * remembers the shops I entered, so I can build a kind of favourite-shop list
 * and scan it weekly for new items?" Almost. Watching asked `num_for_sale` and
 * said "something moved here"; finding out what meant tapping each shop and
 * starting a dig by hand.
 *
 * Not weekly and not by itself: there is no server and a browser does not run
 * while it is closed (ADR-007). A button is the honest version of "weekly" —
 * it runs when somebody is there to read the answer.
 */
const plan = ref<{
  shops: number
  reachable: number
  neverDug: number
  requests: number
} | null>(null)
const round = ref<RoundProgress | null>(null)
const lastRound = shallowRef<RoundSummary | null>(null)
const roundBusy = ref(false)

/** Roughly one request every 1.2 s, which is what the pacer enforces. */
const roundMinutes = computed(() =>
  plan.value ? Math.max(1, Math.ceil((plan.value.requests * 1.2) / 60)) : 0,
)

const roundPercent = computed(() => {
  const p = round.value
  if (!p || p.total === 0) return 0
  return Math.round((p.done / p.total) * 100)
})

async function loadRound() {
  plan.value = await call('round.plan', undefined)
  lastRound.value = await call('round.last', undefined)
}

/**
 * A round that was already walking when this page opened.
 *
 * The third screen to grow this, after the dig and the horizon panel, and for
 * the same reason: the run lives in the worker and outlives the page, so a
 * page that left in the middle of one has to be able to find its way back.
 */
let watchingRound: ReturnType<typeof setInterval> | null = null

async function attachRound(): Promise<boolean> {
  const live = await call('round.running', undefined)
  if (!live) return false

  roundBusy.value = true
  round.value = live

  watchingRound ??= setInterval(async () => {
    const now = await call('round.running', undefined)
    if (now) {
      round.value = now
      return
    }
    detachRound()
    roundBusy.value = false
    round.value = null
    await loadRound()
    await load()
  }, 1500)

  return true
}

function detachRound() {
  if (watchingRound !== null) clearInterval(watchingRound)
  watchingRound = null
}

onBeforeUnmount(detachRound)

/**
 * Watching a shop changes what the round would walk, so the plan is re-read.
 *
 * Without this the section above only appeared after a reload: somebody
 * watches their first shop, nothing happens on screen, and the feature they
 * were told about is invisible until they navigate away and back.
 */
async function watchToggle(username: string) {
  await toggle(username)
  await loadRound()
}

/*
 * Shops other people have dug (ADR-014).
 *
 * This list has always been a log of what this device happened to try, and
 * Discogs offers nothing to widen it — no "which shops sell this sort of
 * record", no list of good sellers. What there is: other devices, digging
 * other shops, and a hub that already passes on what one learned.
 *
 * The ranking happens in the worker against the taste profile. The hub never
 * sees a collection and never carries a price.
 */
const suggested = shallowRef<SuggestResult | null>(null)
const suggesting = ref(false)

/*
 * A shop entered by hand (M30).
 *
 * "I want to enter dealers myself, so they are there for future digs." Until
 * now a shop reached this list by being dug or by being imported from a
 * discovery run — so somebody who knows where they want to look before they
 * have looked had nowhere to put it.
 *
 * The same parser the dig field uses reads a name or a pasted shop address,
 * and it is what disables the button: a typo must not reach the list, where it
 * would be offered on two screens and walked by every round.
 */
const typed = ref('')
const adding = ref(false)
const typedName = computed(() => dealerFromInput(typed.value))

async function addByHand() {
  const name = typedName.value
  if (!name || adding.value) return

  adding.value = true
  error.value = null

  try {
    dealers.value = await call('dealer.add', { dealer: name })
    typed.value = ''
    await select(name)
  } catch (cause) {
    error.value = cause
  } finally {
    adding.value = false
  }
}

/** The reasons for one shop, out of the list the worker already handed over. */
async function loadSuggestions() {
  if (suggesting.value) return
  suggesting.value = true
  try {
    suggested.value = await call('shops.suggest', undefined)
  } catch {
    // Rule 8: a hub that will not answer is not an error on a screen that
    // works without one. The section simply does not appear.
  } finally {
    suggesting.value = false
  }
}

async function startRound() {
  if (roundBusy.value) return
  roundBusy.value = true
  error.value = null
  round.value = null

  try {
    lastRound.value = await call('round.run', undefined, {
      onProgress: (progress) => (round.value = progress),
    })
    // The shops moved: new scan dates, new hit rates, a new order.
    await Promise.all([load(), loadRound()])
  } catch (cause) {
    error.value = cause
    lastRound.value = await call('round.last', undefined)
  } finally {
    roundBusy.value = false
    round.value = null
  }
}

async function load() {
  try {
    dealers.value = await call('dealer.list', undefined)
  } finally {
    loading.value = false
  }
  hidden.value = await call('dealer.hidden', undefined)
  home.value = (await call('preferences.get', undefined)).shipsToCountry
  const first = dealers.value[0]
  /*
   * ?dealer= comes from the start page.
   * Every shop tile there shows a hit rate and a stock size and led nowhere;
   * the heading led here and landed on whichever shop sorted first. A name in
   * the query picks the one somebody actually tapped — and an unknown one
   * falls through to the default rather than showing an empty profile.
   */
  const known = (name: unknown) =>
    typeof name === 'string' && dealers.value.some((dealer) => dealer.username === name)
      ? name
      : null

  /*
   * `?shop=` first: that is this screen's own address and survives a reload.
   * `?dealer=` comes from the start page and means the same thing — kept
   * rather than renamed, because links to it exist.
   */
  const asked = known(route.query.shop) ?? known(route.query.dealer)

  /*
   * A shop somebody asked for opens; the first one only opens where it can
   * stand beside the list.
   *
   * On a wide screen the second column would otherwise be empty, and an empty
   * half of a screen is the app saying "there is nothing here" about its own
   * best shop. On a phone the profile is a sheet over the list (M31.14), and
   * opening one before anybody has tapped anything means arriving at a screen
   * whose first act is to cover itself up.
   */
  if (asked) await select(asked)
  else if (first && !narrow.value) await select(first.username)
}

onMounted(async () => {
  try {
    await load()
    await loadWatchlist()
    await loadRound()
    void attachRound()
    /*
     * Not awaited, and last. It talks to a hub, which is somebody's own
     * machine — two seconds at worst (rule 8), and the list of shops above
     * must not wait for it.
     */
    void loadSuggestions()
  } catch (cause) {
    error.value = cause
  }

  /*
   * Deliberately last and deliberately not awaited: it asks the hub whether
   * push is possible at all, and a hub that is slow must not hold up the list
   * of shops. Asking, not prompting — the permission dialog only ever comes
   * from the button.
   */
  void refreshPush()
})

/**
 * On a phone the open shop is a sheet, not a place further down (M31.14).
 *
 * From `lg` up the profile sits beside the list and needs nothing: that is the
 * master–detail shape of every mail client. Stacked under a dozen rows it was
 * three screens down, and tapping a shop looked like nothing had happened —
 * which the scroll-into-view of 2026-09-14 papered over rather than solved,
 * because the list then scrolled away under you and coming back meant finding
 * your row again.
 *
 * A sheet answers both: it opens over the list, it is the whole screen, and
 * closing it puts you back exactly where you tapped. The same drawer the
 * record sheets use, with the same focus trap and the same Escape.
 *
 * 1023 px is Tailwind's `lg` minus one — the same boundary the grid above
 * uses, said twice because a media query cannot read a class.
 */
const PHONE = '(max-width: 1023px)'

/*
 * Read at setup rather than on mount, because `load()` asks it before either
 * `onMounted` has run — and the answer decides whether the first shop opens
 * by itself. `ssr: false` means this code only ever runs in a browser, and
 * the guard is for the prerender of the shell.
 */
const narrow = ref(import.meta.client ? window.matchMedia(PHONE).matches : false)

onMounted(() => {
  const phone = window.matchMedia(PHONE)
  narrow.value = phone.matches
  const follow = (event: MediaQueryListEvent) => (narrow.value = event.matches)
  phone.addEventListener('change', follow)
  onBeforeUnmount(() => phone.removeEventListener('change', follow))
})

/** Closing the sheet closes the shop — and the address goes with it. */
async function close() {
  profile.value = null
  grading.value = null
  await router.replace({ query: { ...route.query, shop: undefined } })
}

async function select(username: string) {
  // Through the address, so a reload and a shared link both land here.
  if (selected.value !== username) {
    await router.replace({ query: { ...route.query, shop: username } })
  }
  grading.value = null
  error.value = null
  try {
    const answer = await call('dealer.profile', { dealer: username })
    profile.value = answer
    if (answer) {
      void requestCovers(
        answer.shelf.map((record) => record.releaseId),
        { fetch: false },
      )
    }
    grading.value = await call('grading.forDealer', { dealer: username })
  } catch (cause) {
    error.value = cause
    return
  }

  /*
   * The list above learns about the sign, once it has been fetched.
   *
   * Opening a shop starts the backfill of its logo the first time
   * (worker/handlers.ts) — starts, since 2026-09-13, and no longer waits for
   * it: the profile is a screen, the logo is decoration on it. So the sign
   * is not in the answer yet. The list is asked again a moment later, from
   * this device and for no request, and the row in the nav above gets its
   * picture without a page load — the one place where the picture is
   * actually worth having, because that is the list somebody scans.
   */
  const fetched = profile.value?.dealer
  if (!fetched) return
  if (fetched.avatarUrl !== undefined) {
    dealers.value = dealers.value.map((dealer) =>
      dealer.username === username ? { ...dealer, avatarUrl: fetched.avatarUrl } : dealer,
    )
    return
  }
  setTimeout(() => {
    void call('dealer.list', undefined).then((list) => {
      if (selected.value === username) dealers.value = list
    })
  }, 4_000)
}

/**
 * "Never show this one again", and its undoing.
 *
 * The worker answers with both lists, so the shop moves from one to the other
 * in the same breath. Hiding the shop that is open closes its profile and
 * opens the next one — a profile of a shop that is no longer on the list would
 * be the screen contradicting itself.
 */
async function setHidden(username: string, hide: boolean) {
  error.value = null
  try {
    const lists = await call('dealer.hide', { dealer: username, hidden: hide })
    dealers.value = lists.visible
    hidden.value = lists.hidden
  } catch (cause) {
    error.value = cause
    return
  }

  if (hide && selected.value === username) {
    profile.value = null
    grading.value = null
    const next = dealers.value[0]
    // The address goes with it: a hidden shop must not stay in the link.
    if (next) await select(next.username)
    else await router.replace({ query: { ...route.query, shop: undefined } })
  } else if (!hide) {
    await select(username)
  }
}

/** Distributions come back as name → count; the bars want facets. */
function facets(dist: Record<string, number>, limit: number): TasteFacet[] {
  return (
    Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      // A dealer's shelf has no lift and no weight: those describe how a
      // collection leans, and this is somebody else's stock.
      .map(([name, n]) => ({ name, n, weight: n, lift: null }))
  )
}

/**
 * Which bar is currently open.
 *
 * One only, not several: two open lists side by side are two questions at
 * once, and the second pushes the first off the screen anyway.
 */
const browsing = ref<{ title: string; label?: string; decade?: number } | null>(null)

/**
 * `"1990s"` back into `1990`.
 *
 * The fingerprint writes the decade as a word, because there it sits on a bar;
 * it is stored as a number, because that is what gets searched. The reverse
 * belongs here and not in both.
 */
const decadeOf = (name: string) => Number.parseInt(name, 10)

const labels = computed(() => facets(profile.value?.dealer.fingerprint?.labelDist ?? {}, 12))
const decades = computed(() =>
  facets(profile.value?.dealer.fingerprint?.decadeDist ?? {}, 8).sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
)

/**
 * The one sentence the screen exists for. Deliberately refuses to say anything
 * comparative until a second shop has been scanned — one data point is not a
 * ranking, and pretending otherwise would be the same invented baseline the
 * affinity factor already declines to make up.
 */
const verdict = computed(() => {
  const p = profile.value
  if (!p) return null

  const rate = decimal(p.rate)
  if (p.factor === null) {
    return h.value.rateAlone(rate)
  }

  const factor = decimal(p.factor, 2)
  if (p.factor >= 1.5) return h.value.rateAbove(rate, factor)
  if (p.factor >= 0.8) return h.value.rateSame(rate)
  return h.value.rateBelow(rate, factor)
})

const pricePosition = computed(() => {
  const factor = profile.value?.priceFactor
  if (factor === null || factor === undefined) return null
  if (factor >= 1.25) return h.value.priceHigh
  if (factor <= 0.8) return h.value.priceLow
  return h.value.priceMiddle
})

const scanned = computed(() => {
  const at = profile.value?.dealer.lastScannedAt
  return at ? day(new Date(at)) : null
})
</script>

<template>
  <AppPage>
    <PageHeader :title="h.title" :lead="h.lead" />

    <!--
      The shops Discogs already knows you deal with — which beats typing a
      username from memory and getting the underscore wrong.
    -->
    <ErrorNote v-if="error" :cause="error" />

    <!-- The shape, while the database is being read. -->
    <ul
      v-if="loading && dealers.length === 0"
      class="flex flex-col divide-y divide-fid-border border-y border-fid-border"
      aria-hidden="true"
    >
      <li v-for="row in 4" :key="row" class="flex items-center gap-3 py-3 pr-2 pl-3">
        <span class="size-8 shrink-0 rounded-fid-sm bg-fid-inset" />
        <span class="flex min-w-0 flex-1 flex-col gap-2">
          <span class="block h-3 w-40 rounded-fid-sm bg-fid-inset" />
          <span class="block h-2 w-56 rounded-fid-sm bg-fid-inset" />
        </span>
        <span class="block h-3 w-8 shrink-0 rounded-fid-sm bg-fid-inset" />
      </li>
    </ul>

    <p v-else-if="dealers.length === 0" class="text-fid-base text-fid-text-muted">
      {{ h.none }}
    </p>

    <template v-else>
      <!--
      The round: every watched shop, asked what is new since the last visit.

      Back above the list, as one line rather than a block (M31.8): it is the
      ritual of this screen and it had ended up at the foot behind a paragraph
      of explanation. The paragraph is still there, one click away — what
      stands here is what it does, how long it takes, and the button.

      Only where there is something to walk: a device with no watched shop
      gets the sentence that says how one becomes watched, not a button that
      would do nothing.
    -->
      <section
        v-if="plan && plan.shops > 0"
        class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
        aria-labelledby="round"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="round" class="text-fid-base font-medium text-fid-text">
            {{ h.round.title }}
          </h2>
          <span class="fid-num text-fid-sm text-fid-text-muted">
            {{ h.round.line(count(plan.shops), roundMinutes) }}
          </span>
        </div>

        <WhyNote>{{ h.round.about(plan.reachable, roundMinutes) }}</WhyNote>
        <!--
        A shop nobody has dug yet has no line to stop at, so "only what is new"
        has nothing to be new since. Said rather than silently skipped.
      -->
        <p v-if="plan.neverDug > 0" class="max-w-prose text-fid-sm text-fid-sig-gap">
          {{ h.round.neverDug(plan.neverDug) }}
        </p>

        <button
          v-if="plan.reachable > 0"
          type="button"
          :disabled="roundBusy"
          class="fid-tonal self-start rounded-fid-sm px-4 py-2 font-medium disabled:opacity-50"
          @click="startRound"
        >
          {{ h.round.start }}
        </button>

        <div v-if="round" class="flex flex-col gap-2" aria-live="polite">
          <div class="h-2 w-full overflow-hidden rounded-full bg-fid-inset">
            <div
              class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
              :style="{ width: `${roundPercent}%` }"
            />
          </div>
          <p class="text-fid-sm text-fid-text-muted">
            {{ m.common.ofTotal(count(round.done), count(round.total)) }}
            <template v-if="round.dealer"> · {{ round.dealer }}</template>
            · {{ h.round.found(round.found) }}
          </p>
          <p class="text-fid-sm text-fid-text-muted">{{ h.round.keepsRunning }}</p>
        </div>

        <!--
        What the last one turned up. Its own record and not a reading over the
        digs, because those do not survive it: five are kept, and a round over
        ten shops prunes the first five before it ends.
      -->
        <div v-if="lastRound && !round" class="flex flex-col gap-2">
          <p class="text-fid-sm text-fid-text-muted">
            {{ h.round.lastAt(dayTime(lastRound.startedAt)) }}
          </p>
          <ul class="flex flex-col gap-1">
            <li
              v-for="stop in lastRound.stops"
              :key="stop.dealer"
              class="flex flex-wrap items-baseline gap-x-2 text-fid-sm"
            >
              <NuxtLink
                v-if="stop.digId && stop.matches > 0"
                :to="{ path: '/dig', query: { id: stop.digId } }"
                class="font-medium text-fid-accent underline underline-offset-4"
              >
                {{ stop.displayName }}
              </NuxtLink>
              <span v-else class="font-medium text-fid-text">{{ stop.displayName }}</span>

              <span v-if="stop.status === 'never-dug'" class="text-fid-text-muted">
                {{ h.round.stopNeverDug }}
              </span>
              <span v-else-if="stop.status === 'failed'" class="text-fid-sig-gap">
                {{ h.round.stopFailed }}
              </span>
              <span v-else-if="stop.matches === 0" class="text-fid-text-muted">
                {{ h.round.stopNothing(count(stop.newListings)) }}
              </span>
              <span v-else class="text-fid-text-muted">
                {{ h.round.stopFound(stop.matches, count(stop.newListings)) }}
                <template v-if="stop.best">
                  — {{ stop.best.artist }} – {{ stop.best.title }}
                </template>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <!--
        The list and the open shop, side by side where there is room.

        Reported on 2026-09-14, and it is a consequence of putting the list
        first: with a dozen shops the profile — and with it "watch", "dig now"
        and "hide" — started three screens below the fold. The shop you just
        tapped was the one thing you could not reach.

        So from `lg` up they are two columns and the profile stays in view
        while the list scrolls past it: the master–detail shape of every mail
        client, for the same reason — many things, one of them open. Below
        that width they stay stacked and `select()` scrolls the profile into
        view, because on a phone "open" has to mean something visible.
      -->
      <div class="grid gap-8 lg:grid-cols-[26rem_1fr] lg:items-start xl:grid-cols-[30rem_1fr]">
        <div class="flex min-w-0 flex-col gap-4">
          <div role="group" :aria-label="h.origin.label" class="flex flex-wrap gap-1">
            <button
              v-for="key in ORIGIN_FILTERS"
              :key="key"
              type="button"
              class="fid-action min-h-11 rounded-fid-sm border px-3 text-fid-xs"
              :class="
                origin === key
                  ? 'border-fid-text bg-fid-inset text-fid-text'
                  : 'border-fid-border text-fid-text-muted hover:text-fid-text'
              "
              :aria-pressed="origin === key"
              @click="originBy(key)"
            >
              {{ key === 'home' ? h.origin.home(home) : h.origin[key] }}
            </button>
          </div>

          <p v-if="shown.length === 0" class="text-fid-sm text-fid-text-muted">
            {{ h.origin.none }}
          </p>

          <!--
          Ranked by hit rate: the only ordering that answers "where first?".

          A list rather than the wrap of bordered buttons this used to be. Forty
          shops in a wrapping grid is a keypad — unscannable, and it hides the
          very ordering that makes the screen worth opening. See DealerRow.vue.
        -->
          <input
            v-if="shown.length > 8"
            v-model="query"
            type="search"
            autocomplete="off"
            spellcheck="false"
            :placeholder="h.find"
            :aria-label="h.find"
            class="fid-field w-full px-3 py-2 text-fid-sm text-fid-text"
          />

          <p v-if="matching.length === 0" class="text-fid-sm text-fid-text-muted">
            {{ h.noMatch }}
          </p>

          <!--
            Four orderings, one row. The default is the only one that answers
            the screen's own question; the other three are for tidying up and
            comparing (M31.10).
          -->
          <label v-else class="flex items-center gap-2 text-fid-xs text-fid-text-muted">
            {{ h.sort.label }}
            <select v-model="sort" class="fid-field px-2 py-1 text-fid-xs text-fid-text">
              <option v-for="key in SORTS" :key="key" :value="key">{{ h.sort[key] }}</option>
            </select>
          </label>

          <!--
            One list, with the group names as items of it.

            Two lists would each need their own name and the screen would lose
            the one region that means "the shops" — which is what every test
            and every screen reader reaches for. A heading between rows is an
            item of the list it divides.
          -->
          <ul
            class="flex flex-col divide-y divide-fid-border border-y border-fid-border"
            :aria-label="h.scanned"
          >
            <template v-for="group in groups" :key="group.key ?? 'all'">
              <li v-if="group.key" class="fid-plate px-3 py-2 text-fid-text-muted">
                {{ h.groups[group.key] }}
              </li>
              <li v-for="dealer in group.rows" :key="dealer.username">
                <DealerRow
                  :dealer="dealer"
                  :selected="dealer.username === selected"
                  :peak="peak"
                  :moved="moved.get(dealer.username) ?? 0"
                  @open="select(dealer.username)"
                />
              </li>
            </template>
          </ul>

          <button
            v-if="rest > 0"
            type="button"
            class="fid-action self-start text-fid-sm text-fid-text-muted underline underline-offset-4 hover:text-fid-text"
            @click="room += STEP"
          >
            {{ h.more(count(rest)) }}
          </button>
        </div>
        <!--
          Beside the list on a desk, over it on a phone (M31.14). One block of
          markup either way: `SheetFrame` renders its children in a slot, and
          a plain `<section>` renders the same children in place.
        -->
        <component
          :is="narrow ? SheetFrame : 'section'"
          v-if="profile"
          v-bind="
            narrow
              ? { label: profile.dealer.displayName || profile.dealer.username }
              : {
                  class:
                    'flex min-w-0 flex-col gap-8 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-1',
                }
          "
          @close="close()"
        >
          <template #title>
            {{ profile.dealer.displayName || profile.dealer.username }}
          </template>
          <div class="flex gap-4 rounded-fid-md border border-fid-border p-4">
            <!--
              The shop's own face, at a size that is a face rather than a
              bullet (M31.8). In the list it is 32 px; here there is room for
              one that can be recognised across the screen.
            -->
            <ShopLogo
              :dealer="profile.dealer.username"
              :avatar-url="profile.dealer.avatarUrl"
              :size="48"
              class="shrink-0"
            />
            <div class="flex min-w-0 grow flex-col gap-3">
              <p
                v-if="profile.dealer.lastScannedAt === null"
                class="text-fid-base text-fid-text"
              >
                {{ h.neverScanned }}
              </p>
              <p v-else class="text-fid-base text-fid-text">{{ verdict }}</p>
              <p class="text-fid-sm text-fid-text-muted">
                {{ h.listings(count(profile.dealer.numForSale)) }}
                <template v-if="profile.dealer.shipsFrom">
                  · {{ h.shipsFrom(profile.dealer.shipsFrom) }}</template
                >
                <template v-if="profile.dealer.ratingCount > 0">
                  ·
                  {{
                    h.rating(
                      `${profile.dealer.sellerRating} %`,
                      count(profile.dealer.ratingCount),
                    )
                  }}
                </template>
                <template v-if="scanned"> · {{ h.lastScanned(scanned) }}</template>
              </p>

              <!--
              And directly below it, the number Discogs does not keep.

              Above the row sits the seller rating: that measures the process —
              shipped quickly, packed properly — and says nothing about whether
              the grade was right. Which is exactly why this row is here and not
              in a section of its own: side by side you read the difference; one
              above the other they would never meet.

              The promised grade is in none of these numbers. What is stored is
              only the comparison (worker/grading.ts).
            -->
              <div v-if="grading && grading.judged > 0" class="flex flex-col gap-1">
                <p class="fid-num text-fid-sm text-fid-text">
                  <template v-if="grading.rate !== null">
                    {{
                      h.grading.rate(
                        `${Math.round(grading.rate * 100)} %`,
                        count(grading.judged),
                      )
                    }}
                  </template>
                  <template v-else>
                    {{ h.grading.tooFew(count(grading.judged), grading.judged === 1) }}
                  </template>
                  <template v-if="grading.worse > 0">
                    {{ h.grading.worse(count(grading.worse), grading.worse === 1) }}
                  </template>
                </p>
                <WhyNote :label="h.grading.whyLabel">{{ h.grading.why }}</WhyNote>
              </div>

              <!--
              Watching costs one request per app start, not a rescan. Worth
              saying, because "beobachten" usually means somebody is polling.
            -->
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  :aria-pressed="isWatched(profile.dealer.username)"
                  class="fid-action rounded-fid-sm px-3 py-2 text-fid-sm transition-colors"
                  :class="
                    isWatched(profile.dealer.username)
                      ? 'fid-tonal'
                      : 'border border-fid-border text-fid-text-muted hover:text-fid-text'
                  "
                  @click="watchToggle(profile.dealer.username)"
                >
                  {{ isWatched(profile.dealer.username) ? h.watching : h.watch }}
                </button>
                <!--
                The shop with the best hit rate sits at the top of this list, and
                until now there was nothing to do about it from here. Ranking
                shops and then making somebody retype the name is the ranking
                doing half its job.
              -->
                <!--
                And this one is filled, because it is the action the screen
                exists for (M31.3). The round above steps back to the middle
                volume: walking every watched shop is the second path, and two
                filled surfaces on one screen mean neither is the answer.
              -->
                <NuxtLink
                  :to="`/dig?dealer=${encodeURIComponent(profile.dealer.username)}`"
                  class="fid-action fid-fill rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent"
                >
                  {{ profile.dealer.lastScannedAt === null ? h.digNow : h.digAgain }}
                </NuxtLink>
                <!--
                And the one that takes something away steps back.
                Three bordered buttons of the same weight, one of which removes
                the shop from every list — read side by side they all look like
                the same kind of offer. A plate action instead: reachable, not
                proposed.
              -->
                <button
                  type="button"
                  class="fid-action fid-plate px-1 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
                  :title="h.hideWhy"
                  @click="setHidden(profile.dealer.username, true)"
                >
                  {{ h.hide }}
                </button>
                <!--
                And the shop itself, at Discogs (M32.3).

                Everything this screen knows about a shop it worked out from
                its inventory — the hit rate, the labels, the price band. What
                it cannot know is what the seller wrote about themselves:
                postage tables in prose, holiday notices, the return policy.
                That page is one tap away now instead of a name to retype.

                `/seller/{u}/profile` rather than `/user/{u}`: the first is the
                shop, the second is the person, and this list is about shops.
                -->
                <OutwardLink
                  tone="inherit"
                  class="text-fid-sm"
                  :to="`https://www.discogs.com/seller/${encodeURIComponent(profile.dealer.username)}/profile`"
                >
                  {{ h.atDiscogs }}
                </OutwardLink>
                <span class="text-fid-xs text-fid-text-muted">{{ h.watchCost }}</span>
              </div>

              <!--
              And the part a browser cannot do alone.
              Only shown for a shop that is actually watched, and only where it
              can work: no hub, no support, or a refusal in the browser settings
              and there is nothing here at all — rather than a switch that would
              promise something nobody can keep (rule 8).
            -->
              <div
                v-if="
                  isWatched(profile.dealer.username) &&
                  push !== 'no-hub' &&
                  push !== 'unsupported' &&
                  push !== 'denied'
                "
                class="flex flex-wrap items-center gap-3"
              >
                <button
                  v-if="push === 'off'"
                  type="button"
                  :disabled="pushBusy"
                  class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text disabled:opacity-60"
                  @click="enablePush()"
                >
                  {{ h.pushOffer }}
                </button>
                <template v-else-if="push === 'on'">
                  <span class="text-fid-sm text-fid-text">{{ h.pushOn }}</span>
                  <button
                    type="button"
                    :disabled="pushBusy"
                    class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4 disabled:opacity-60"
                    @click="disablePush()"
                  >
                    {{ h.pushStop }}
                  </button>
                </template>
                <span class="text-fid-xs text-fid-text-muted">
                  {{ push === 'needs-install' ? h.pushInstall : h.pushWhy }}
                </span>
              </div>
            </div>
          </div>

          <!--
            Coverage is stated, not implied. A fingerprint built from 20.000 of
            36.000 listings describes a bit more than half a shop, and saying so
            is the difference between a statistic and a claim.
          -->
          <p
            v-if="profile.dealer.fingerprint && profile.dealer.fingerprint.coverage < 0.99"
            class="text-fid-sm text-fid-sig-gap"
          >
            {{
              h.coverage(
                count(profile.dealer.fingerprint.sampledItems),
                count(profile.dealer.fingerprint.totalItems),
                Math.round(profile.dealer.fingerprint.coverage * 100),
              )
            }}
          </p>

          <div
            v-if="profile.dealer.fingerprint && profile.dealer.fingerprint.medianPrice > 0"
            class="flex flex-col gap-1"
          >
            <h2 class="text-fid-sm font-medium text-fid-text">{{ h.priceTitle }}</h2>
            <!--
              A median is a bare number and carries no unit.
              This printed it with a hard-coded euro sign, so a shop pricing in
              pounds showed its median as euros — a real number under the wrong
              symbol, which is worse than no number. Inventory prices always come
              back in the seller's currency, so the scan records which one it saw
              and says nothing where a shop mixes them.
            -->
            <p class="text-fid-base text-fid-text">
              <span class="fid-num">{{
                h.median(
                  money(
                    profile.dealer.fingerprint.medianPrice,
                    profile.dealer.fingerprint.priceCurrency,
                  ) ?? count(profile.dealer.fingerprint.medianPrice),
                )
              }}</span>
              <template v-if="!profile.dealer.fingerprint.priceCurrency">
                <span class="text-fid-sm text-fid-text-muted"> {{ h.mixedCurrencies }}</span>
              </template>
              <template v-if="pricePosition"> – {{ pricePosition }}</template>
            </p>
            <WhyNote :label="h.priceWhyLabel">{{ h.priceWhy }}</WhyNote>
          </div>

          <!--
            Four sleeves of your own on the labels this shop carries (M31.4).

            A shop described in numbers is a shop nobody pictures. This is the
            same fact as the bars below it — "stocks Kompakt, Ostgut Ton,
            Dekmantel" — as four records you already own, and it says in half a
            second what the bars say in ten.

            Costs nothing: the covers are asked for with fetching switched off,
            so what is on hand is shown and the rest simply is not.
          -->
          <section v-if="profile.shelf.length > 0" class="flex flex-col gap-3">
            <h2 class="text-fid-sm font-medium text-fid-text">{{ h.shelfSample }}</h2>
            <ul class="flex flex-wrap gap-3">
              <li v-for="record in profile.shelf" :key="record.releaseId">
                <NuxtLink
                  :to="`/shelf?release=${record.releaseId}`"
                  class="fid-cover-button block size-20 overflow-hidden rounded-fid-cover bg-fid-inset"
                  :title="`${record.artist} – ${record.title} · ${record.label}`"
                  :aria-label="`${record.artist} – ${record.title} · ${record.label}`"
                >
                  <img
                    v-if="coverFor(record.releaseId, null)"
                    :src="coverFor(record.releaseId, null)!.thumbUrl"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="150"
                    height="150"
                    class="size-full object-cover"
                  />
                  <span
                    v-else
                    class="flex size-full items-center justify-center text-fid-text-muted"
                    aria-hidden="true"
                  >
                    <FidIcon name="platte" :size="28" />
                  </span>
                </NuxtLink>
              </li>
            </ul>
            <p class="fid-plate text-fid-text-muted">
              {{ profile.shelf.map((record) => record.label).join(' · ') }}
            </p>
          </section>

          <div class="grid gap-8 @md:grid-cols-2 @5xl:grid-cols-3">
            <FacetBars
              :title="h.labelsInStock"
              signal="label"
              :facets="labels"
              :empty="h.noLabels"
              :open="(facet) => (browsing = { title: facet.name, label: facet.name })"
            />
            <FacetBars
              :title="h.decades"
              signal="gap"
              token="label"
              :facets="decades"
              :empty="h.noYears"
              :open="
                (facet) => (browsing = { title: facet.name, decade: decadeOf(facet.name) })
              "
            />
          </div>

          <!--
            What is behind a bar, underneath the bars. No screen of its own and
            no dialog: the number above is the context, and somebody going
            through a row of labels does not want to navigate back after each
            one.
          -->
          <DealerStock
            v-if="browsing"
            :key="browsing.title"
            :dealer="profile.dealer.username"
            :title="browsing.title"
            :label="browsing.label ?? null"
            :decade="browsing.decade ?? null"
            @close="browsing = null"
          />

          <p v-if="profile.dealer.shippingNote" class="text-fid-sm text-fid-text-muted">
            {{ profile.dealer.shippingNote }}
          </p>
        </component>
      </div>
    </template>

    <!--
      The hidden ones, at the foot and only when there are any. Outside the
      `v-else` above on purpose: hiding the last shop must not take the one
      place it can be brought back from with it.
    -->

    <!--
      Shops other people have dug (ADR-014).

      Only where there is something to show: without a hub there is no list,
      and saying so on every device that has none would be a permanent notice
      about a feature nobody asked for.
    -->
    <!--
      Asking the hub takes a moment — up to twenty shops go up before the list
      comes back — and it used to take that moment in silence. A screen that
      shows nothing while it works looks like a screen that is finished.
    -->
    <p
      v-if="suggesting && !suggested"
      role="status"
      class="flex items-center gap-2 text-fid-sm text-fid-text-muted"
    >
      <!--
        Muted, not the accent. The accent means "this is the thing to do", and
        a thing that is happening by itself is not a thing to press — the
        design-restraint test counts it as a second filled action otherwise.
      -->
      <span class="size-2 animate-pulse rounded-full bg-fid-text-muted" aria-hidden="true" />
      {{ h.suggested.busy }}
    </p>

    <section
      v-if="suggested && suggested.shops.length > 0"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
      aria-labelledby="suggested"
    >
      <h2 id="suggested" class="text-fid-base font-medium text-fid-text">
        {{ h.suggested.title }}
      </h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ h.suggested.about }}</p>

      <ul class="flex flex-col gap-2">
        <li
          v-for="shop in suggested.shops"
          :key="shop.username"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-fid-border pb-2 last:border-0"
        >
          <NuxtLink
            :to="{ path: '/dig', query: { dealer: shop.username } }"
            class="fid-action flex items-center gap-2 text-fid-base font-medium text-fid-text"
          >
            <ShopLogo :dealer="shop.username" :avatar-url="shop.avatarUrl" :size="20" />
            {{ shop.displayName }}
          </NuxtLink>

          <!--
            The number, and the labels behind it. A percentage on its own is a
            score somebody has to take on trust; the labels are the reason.
          -->
          <span class="fid-num text-fid-sm text-fid-accent">
            {{ h.suggested.fit(Math.round(shop.fit * 100)) }}
          </span>
          <span v-if="shop.labels.length > 0" class="text-fid-sm text-fid-text-muted">
            {{ shop.labels.join(' · ') }}
          </span>
          <span v-if="shop.shipsFrom" class="text-fid-xs text-fid-text-muted">
            {{ shop.shipsFrom }}
          </span>
        </li>
      </ul>

      <!--
        What the number is a share *of*. A fingerprint from a hundred rows of a
        forty-thousand-record shop describes those hundred, and a screen that
        left that out would be quoting a sample as a catalogue.
      -->
      <p class="max-w-prose text-fid-xs text-fid-text-muted">{{ h.suggested.sample }}</p>
    </section>

    <!--
      A shop entered by hand, above the discovery box.

      Above it deliberately: somebody who already knows the name has the
      shortest path in the app, and the search below is for when they do not.
      Both sit under the list, because adding a shop is what you do *after*
      looking at the ones you have — and on a device with none, the empty line
      above points straight down here.
    -->
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="addByHand">
      <div class="flex min-w-64 grow flex-col gap-2">
        <label class="text-fid-sm font-medium text-fid-text" for="add-shop">
          {{ h.add.label }}
        </label>
        <input
          id="add-shop"
          v-model="typed"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="h.add.placeholder"
          class="fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
      </div>
      <button
        type="submit"
        :disabled="adding || typedName === null"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      >
        {{ adding ? h.add.busy : h.add.submit }}
      </button>
    </form>

    <DealerDiscovery :first-time="dealers.length === 0" @imported="load()" />
    <section
      v-if="hidden.length > 0"
      class="flex flex-col gap-2"
      :aria-label="h.hidden.title(hidden.length)"
    >
      <h2 class="text-fid-sm font-medium text-fid-text-muted">
        {{ h.hidden.title(hidden.length) }}
      </h2>
      <p class="text-fid-xs text-fid-text-muted">{{ h.hideWhy }}</p>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="shop in hidden"
          :key="shop.username"
          class="flex items-center gap-2 rounded-fid-sm border border-fid-border py-1 pr-1 pl-3 text-fid-sm text-fid-text-muted"
        >
          {{ shop.displayName || shop.username }}
          <button
            type="button"
            class="fid-action rounded-fid-sm px-2 py-1 text-fid-xs text-fid-text underline underline-offset-4"
            @click="setHidden(shop.username, false)"
          >
            {{ h.hidden.restore }}
          </button>
        </li>
      </ul>
    </section>
  </AppPage>
</template>
