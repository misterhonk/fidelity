<script setup lang="ts">
import { ORIGIN_FILTERS, passesOrigin, readOrigin, type OriginFilter } from '#shared/countries'
import type { DealerProfile } from '#shared/protocol'
import type { SuggestResult } from '~~/worker/dealers/suggest'
import type {
  Dealer,
  DealerWithReasons,
  GradingRecord,
  RoundProgress,
  RoundSummary,
  TasteFacet,
} from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

const h = useDealerMessages()
const m = useMessages()
useSeoMeta({
  title: () => h.value.title,
  description: () => h.value.description,
})

const { call } = useFidelityWorker()
const { isWatched, toggle, load: loadWatchlist } = useWatchlist()
const {
  state: push,
  busy: pushBusy,
  refresh: refreshPush,
  enable: enablePush,
  disable: disablePush,
} = usePush()
const route = useRoute()

const dealers = shallowRef<DealerWithReasons[]>([])

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

const matching = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return shown.value
  return shown.value.filter((dealer) =>
    `${dealer.displayName} ${dealer.username}`.toLowerCase().includes(needle),
  )
})

/*
 * The open shop is always in the list, even past the cut.
 *
 * Otherwise a link straight to a shop that ranks fortieth draws its profile
 * under a list in which nothing is marked — and the screen looks like it is
 * showing somebody else's shop.
 */
const listed = computed(() => {
  const head = matching.value.slice(0, room.value)
  const open = matching.value.find((dealer) => dealer.username === selected.value)
  return open && !head.includes(open) ? [...head, open] : head
})

const rest = computed(() => matching.value.length - listed.value.length)

/** One scale for every bar in the list — see DealerRow.vue. */
const peak = computed(() =>
  Math.max(0, ...matching.value.map((dealer) => dealer.affinity ?? 0)),
)

// A new search or a new origin starts from the top again.
watch([query, origin], () => (room.value = STEP))

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
  dealers.value = await call('dealer.list', undefined)
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

  if (asked) await select(asked)
  else if (first) await select(first.username)
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
 * Where the open shop is drawn — so a narrow screen can be told to go there.
 *
 * On a wide screen the profile sits beside the list and needs no help. Stacked
 * under a dozen rows it is three screens down, and tapping a shop then looked
 * like nothing had happened.
 */
const profileBox = useTemplateRef<HTMLElement>('profileBox')

async function select(username: string) {
  // Through the address, so a reload and a shared link both land here.
  if (selected.value !== username) {
    await router.replace({ query: { ...route.query, shop: username } })
  }
  grading.value = null
  error.value = null
  try {
    profile.value = await call('dealer.profile', { dealer: username })
    grading.value = await call('grading.forDealer', { dealer: username })
  } catch (cause) {
    error.value = cause
    return
  }

  /*
   * Two columns at `lg`, which is where Tailwind puts it — the same 1024 the
   * class above uses. Wider than that the profile is already on screen and
   * moving the page would be the app taking over the scroll for no reason.
   */
  if (window.matchMedia('(max-width: 1023px)').matches) {
    await nextTick()
    profileBox.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
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

    <p v-if="dealers.length === 0" class="text-fid-base text-fid-text-muted">
      {{ h.none }}
    </p>

    <template v-else>
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

          <ul
            v-else
            class="flex flex-col divide-y divide-fid-border border-y border-fid-border"
            :aria-label="h.scanned"
          >
            <li v-for="dealer in listed" :key="dealer.username">
              <DealerRow
                :dealer="dealer"
                :selected="dealer.username === selected"
                :peak="peak"
                @open="select(dealer.username)"
              />
            </li>
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
        <section
          v-if="profile"
          ref="profileBox"
          class="flex min-w-0 flex-col gap-8 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-1"
        >
          <div class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4">
            <p v-if="profile.dealer.lastScannedAt === null" class="text-fid-base text-fid-text">
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
                    h.grading.rate(`${Math.round(grading.rate * 100)} %`, count(grading.judged))
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
                class="rounded-fid-sm border px-3 py-2 text-fid-sm transition-colors"
                :class="
                  isWatched(profile.dealer.username)
                    ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                    : 'border-fid-border text-fid-text-muted hover:text-fid-text'
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
              <NuxtLink
                :to="`/dig?dealer=${encodeURIComponent(profile.dealer.username)}`"
                class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
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
        </section>
      </div>
    </template>

    <!--
      The hidden ones, at the foot and only when there are any. Outside the
      `v-else` above on purpose: hiding the last shop must not take the one
      place it can be brought back from with it.
    -->
    <!--
      The round: every watched shop, asked what is new since the last visit.

      Under the list rather than over it: the screen's own question is "which
      shop next", and four blocks of tooling used to stand between the heading
      and the answer. Only where there is something to walk — a device with no
      watched shop gets the sentence that says how one becomes watched, not a
      button that would do nothing.
    -->
    <section
      v-if="plan && plan.shops > 0"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
      aria-labelledby="round"
    >
      <h2 id="round" class="text-fid-base font-medium text-fid-text">{{ h.round.title }}</h2>

      <p class="max-w-prose text-fid-sm text-fid-text-muted">
        {{ h.round.about(plan.reachable, roundMinutes) }}
      </p>
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
        class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 font-medium text-fid-on-accent disabled:opacity-50"
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
