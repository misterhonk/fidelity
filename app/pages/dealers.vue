<script setup lang="ts">
import type { DealerProfile } from '#shared/protocol'
import { STARTER_SHOPS } from '#shared/starter-shops'
import type { SuggestResult } from '~~/worker/dealers/suggest'
import type {
  Dealer,
  DealerWithReasons,
  GradingRecord,
  RoundProgress,
  RoundSummary,
} from '#shared/types'

import { useDealerMessages } from '~/i18n/dealers'

/**
 * The shops screen (M34.4): the page holds the data and the address; four
 * components draw it — the round, the list, the open shop, the foot.
 *
 * One message fetches everything the screen needs before it can draw
 * (`dealer.overview`); the open shop's profile is a second, the hub's
 * suggestions a third that arrives when it arrives and is cancelled when
 * the screen goes.
 */
const h = useDealerMessages()
useSeoMeta({
  title: () => h.value.title,
  description: () => h.value.description,
})

const { call } = useFidelityWorker()
const { alerts, isWatched, toggle, load: loadWatchlist } = useWatchlist()
const {
  state: push,
  busy: pushBusy,
  refresh: refreshPush,
  enable: enablePush,
  disable: disablePush,
} = usePush()
const route = useRoute()
const router = useRouter()

/* The watcher's "+n" per shop — what moved since the last look. */
const moved = computed(
  () => new Map(alerts.value.map((alert) => [alert.dealer, alert.newListings])),
)

const dealers = shallowRef<DealerWithReasons[]>([])
const hidden = shallowRef<Dealer[]>([])
const home = ref('')
const loading = ref(true)
const error = ref<unknown>(null)

const plan = ref<{
  shops: number
  reachable: number
  neverDug: number
  requests: number
} | null>(null)
const lastRound = shallowRef<RoundSummary | null>(null)
const round = ref<RoundProgress | null>(null)
const roundBusy = ref(false)

/* The open shop — through the address, so a reload and a shared link both land here. */
const selected = computed(() => {
  const wanted = route.query.shop
  return typeof wanted === 'string' && wanted ? wanted : null
})
const profile = ref<DealerProfile | null>(null)
const grading = ref<GradingRecord | null>(null)

const list = useShopList(dealers, home, selected)

const PHONE = '(max-width: 1023px)'
const narrow = ref(import.meta.client ? window.matchMedia(PHONE).matches : false)

/** Everything the screen needs, in one message. */
async function refresh() {
  const view = await call('dealer.overview', undefined)
  dealers.value = view.dealers
  hidden.value = view.hidden
  home.value = view.home
  plan.value = view.plan
  lastRound.value = view.lastRound
  return view
}

async function load() {
  let view
  try {
    view = await refresh()
  } finally {
    loading.value = false
  }

  const known = (name: unknown) =>
    typeof name === 'string' && dealers.value.some((dealer) => dealer.username === name)
      ? name
      : null
  const asked = known(route.query.shop) ?? known(route.query.dealer)
  const first = dealers.value[0]
  if (asked) await select(asked)
  else if (first && !narrow.value) await select(first.username)

  if (view.running) void attachRound(view.running)
}

/* --- the round ------------------------------------------------------------ */

let watchingRound: ReturnType<typeof setInterval> | null = null

function attachRound(live: RoundProgress) {
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
    await refresh()
  }, 1500)
}

function detachRound() {
  if (watchingRound !== null) clearInterval(watchingRound)
  watchingRound = null
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
    await refresh()
  } catch (cause) {
    error.value = cause
    lastRound.value = await call('round.last', undefined)
  } finally {
    roundBusy.value = false
    round.value = null
  }
}

async function watchToggle(username: string) {
  await toggle(username)
  await refresh()
}

/* --- the hub's suggestions, after the read, cancelled with the screen ------- */

const suggested = shallowRef<SuggestResult | null>(null)
const suggesting = ref(false)
const suggestion = new AbortController()

async function loadSuggestions() {
  if (suggesting.value) return
  suggesting.value = true
  try {
    suggested.value = await call('shops.suggest', undefined, { signal: suggestion.signal })
  } catch {
    // Rule 8: a hub that will not answer is not an error on a screen that
    // works without one. The section simply does not appear.
  } finally {
    suggesting.value = false
  }
}

/* --- adding ----------------------------------------------------------------- */

const adding = ref(false)
const starterBusy = ref<string | null>(null)

/** The starter shops this device does not have yet — none once the list has begun. */
const starters = computed(() => {
  if (dealers.value.length > 0) return []
  const known = new Set(hidden.value.map((dealer) => dealer.username.toLowerCase()))
  return STARTER_SHOPS.filter((shop) => !known.has(shop.username.toLowerCase()))
})

async function addByHand(name: string) {
  if (adding.value) return
  adding.value = true
  error.value = null
  try {
    dealers.value = await call('dealer.add', { dealer: name })
    await select(name)
  } catch (cause) {
    error.value = cause
  } finally {
    adding.value = false
  }
}

async function addStarter(username: string) {
  if (starterBusy.value) return
  starterBusy.value = username
  error.value = null
  try {
    dealers.value = await call('dealer.add', { dealer: username })
    await select(username)
  } catch (cause) {
    error.value = cause
  } finally {
    starterBusy.value = null
  }
}

/* --- the open shop ---------------------------------------------------------- */

async function close() {
  profile.value = null
  grading.value = null
  await router.replace({ query: { ...route.query, shop: undefined } })
}

async function select(username: string) {
  if (selected.value !== username) {
    await router.replace({ query: { ...route.query, shop: username } })
  }
  grading.value = null
  error.value = null
  try {
    const answer = await call('dealer.profile', { dealer: username })
    profile.value = answer
    grading.value = await call('grading.forDealer', { dealer: username })
  } catch (cause) {
    error.value = cause
    return
  }

  /*
   * The sign, when it arrives. The profile fetches it once for shops from
   * before; the list learns it on the next read, which is a moment later.
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
    void call('dealer.list', undefined).then((rows) => {
      if (selected.value === username) dealers.value = rows
    })
  }, 4_000)
}

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

/* The way back from "hide": one line, pinned where the eye is. */
const lastHidden = ref<{ username: string; name: string } | null>(null)

async function hideShop(username: string, name: string) {
  await setHidden(username, true)
  if (!error.value) lastHidden.value = { username, name }
}

async function undoHide() {
  const was = lastHidden.value
  if (!was) return
  lastHidden.value = null
  await setHidden(was.username, false)
}

/* --- j, k, and the sheet's arrows ------------------------------------------- */

function step(delta: number) {
  const rows = list.ordered
  if (rows.length === 0) return
  const at = list.position < 0 ? (delta > 0 ? -1 : rows.length) : list.position
  const next = rows[Math.min(rows.length - 1, Math.max(0, at + delta))]
  if (next && next.username !== selected.value) void select(next.username)
}

function onKey(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'j') step(1)
  else if (event.key === 'k') step(-1)
}

/* --- lifecycle --------------------------------------------------------------- */

onMounted(async () => {
  const phone = window.matchMedia(PHONE)
  narrow.value = phone.matches
  const follow = (event: MediaQueryListEvent) => (narrow.value = event.matches)
  phone.addEventListener('change', follow)
  window.addEventListener('keydown', onKey)
  onBeforeUnmount(() => {
    phone.removeEventListener('change', follow)
    window.removeEventListener('keydown', onKey)
  })

  try {
    await load()
    await loadWatchlist()
    // The hub, after the screen is drawn — and never in the way of it.
    void loadSuggestions()
  } catch (cause) {
    error.value = cause
  }
  void refreshPush()
})

onBeforeUnmount(() => {
  detachRound()
  suggestion.abort()
})
</script>

<template>
  <AppPage>
    <PageHeader :title="h.title" :lead="h.lead" />

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
      <!-- Only where there is something to walk: a device with no watched shop gets nothing here. -->
      <ShopRound
        v-if="plan && plan.shops > 0"
        :plan="plan"
        :round="round"
        :last-round="lastRound"
        :busy="roundBusy"
        @start="startRound"
      />

      <!--
        The list and the open shop, side by side where there is room
        (M31.14): the master–detail shape of every mail client, for the same
        reason — many things, one of them open.
      -->
      <div class="grid gap-8 lg:grid-cols-[26rem_1fr] lg:items-start xl:grid-cols-[30rem_1fr]">
        <ShopList
          :list="list"
          :home="home"
          :selected="selected"
          :moved="moved"
          @open="select"
          @query="list.query = $event"
          @sort="list.sort = $event"
        />

        <!-- On a desk, before anything is open: a plate, not a blank. -->
        <p v-if="!profile && !narrow" class="fid-plate hidden text-fid-text-muted lg:block">
          {{ h.pick }}
        </p>

        <ShopProfile
          v-if="profile"
          :profile="profile"
          :grading="grading"
          :narrow="narrow"
          :position="list.position"
          :total="list.ordered.length"
          :watched="isWatched(profile.dealer.username)"
          :moved="moved.get(profile.dealer.username) ?? 0"
          :push="push"
          :push-busy="pushBusy"
          @close="close()"
          @step="step"
          @watch="watchToggle(profile.dealer.username)"
          @hide="
            hideShop(
              profile.dealer.username,
              profile.dealer.displayName || profile.dealer.username,
            )
          "
          @enable-push="enablePush()"
          @disable-push="disablePush()"
        />
      </div>
    </template>

    <ShopFoot
      :hidden="hidden"
      :suggested="suggested"
      :suggesting="suggesting"
      :adding="adding"
      :starters="starters"
      :starter-busy="starterBusy"
      @add="addByHand"
      @restore="setHidden($event, false)"
      @starter="addStarter"
    />

    <!-- The way back, pinned where the eye is. -->
    <p
      v-if="lastHidden"
      role="status"
      class="fixed bottom-4 left-4 z-30 flex flex-wrap items-center gap-3 rounded-fid-sm border border-fid-border bg-fid-surface px-4 py-2 text-fid-sm text-fid-text shadow-lg"
    >
      {{ h.hiddenLine(lastHidden.name) }}
      <button
        type="button"
        class="fid-action min-h-11 text-fid-sm text-fid-accent underline underline-offset-4"
        @click="undoHide"
      >
        {{ h.undo }}
      </button>
    </p>
  </AppPage>
</template>
