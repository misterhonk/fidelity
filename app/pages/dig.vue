<script setup lang="ts">
import type {
  DigPreflight,
  DigWithMatches,
  EnrichProgress,
  RefreshProgress,
  RunningHorizon,
  ScanProgress,
} from '#shared/protocol'
import type { Dealer, Dig, LandedContext } from '#shared/types'

import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

useSeoMeta({
  title: () => d.value.title,
  description: () => d.value.description,
})

const { call } = useFidelityWorker()
const { online, noteFailure } = useOnline()
const { failure: judgeFailure, load: loadFeedback } = useFeedback()
const { failure: basketFailure, load: loadBasket, ids: basketIds } = useBasket()
const route = useRoute()
const router = useRouter()
const m = useMessages()

const dealer = ref('')
const preflight = ref<DigPreflight | null>(null)
const progress = ref<ScanProgress | null>(null)
/** The shop under the bar — this page's own scan, or one it found running when it opened. */
const scanningDealer = ref<string | null>(null)
const enriching = ref<EnrichProgress | null>(null)
const gaps = ref<{ expanded: number; requests: number; titles: string[] } | null>(null)
/*
 * Sharing.
 *
 * The key comes from the worker and goes into the `#` fragment of the link —
 * the one part of an address no browser sends to a server, and what the hub's
 * inability to read the contents rests on. So it is assembled here and nowhere
 * else.
 */
const hubUrl = ref<string | null>(null)
const sharing = ref(false)
const shareLink = ref<{ url: string; matches: number; total: number; until: number } | null>(
  null,
)
const shareCopied = ref(false)

async function share() {
  if (sharing.value || !result.value) return
  sharing.value = true
  shareCopied.value = false
  error.value = null

  try {
    const made = await call('share.create', { digId: result.value.dig.id })
    const base = `${location.origin}${location.pathname.replace(/\/dig\/?$/, '')}`
    shareLink.value = {
      url: `${base}/shared?id=${made.id}#k=${made.key}`,
      matches: made.matches,
      total: result.value.matches.length,
      until: made.expiresAt,
    }
  } catch (cause) {
    error.value = cause
  } finally {
    sharing.value = false
  }
}

async function copyShare() {
  if (!shareLink.value) return
  try {
    await navigator.clipboard.writeText(shareLink.value.url)
    shareCopied.value = true
  } catch {
    // With no clipboard the link stays in the field and can be taken by hand.
    // An error here would be louder than the problem.
  }
}

const refreshing = ref<RefreshProgress | null>(null)
const refreshed = ref<{ refreshed: number; sold: number; gone: number } | null>(null)

/**
 * Re-reads each match's own listing (docs/02).
 *
 * One request per match instead of a whole rescan: nineteen matches are
 * twenty-three seconds rather than four minutes. The cost is stated before it
 * is spent, as everywhere else that spends the rate limit.
 */
async function refresh() {
  const dig = result.value?.dig
  if (!dig || busy.value) return

  busy.value = true
  error.value = null
  refreshed.value = null

  try {
    const outcome = await call(
      'dig.refresh',
      { digId: dig.id },
      { onProgress: (p) => (refreshing.value = p) },
    )
    refreshed.value = outcome
    result.value = await call('dig.get', { digId: dig.id })
  } catch (cause) {
    noteFailure()
    error.value = cause
  } finally {
    busy.value = false
    refreshing.value = null
  }
}
const history = shallowRef<Dig[]>([])

async function loadHistory() {
  history.value = await call('dig.list', undefined)
}

/** Switching digs is a navigation, so it goes through the URL and back works. */
async function showDig(digId: string) {
  await router.replace({ query: { ...route.query, id: digId } })
  result.value = await call('dig.get', { digId })
}
/*
 * Shallow, and not only for the reason CLAUDE.md gives.
 *
 * A deep `ref` proxies every match, every signal and every piece of evidence —
 * thousands of objects Vue has no reason to track, since the whole result is
 * only ever replaced wholesale. That is the documented rule.
 *
 * The sharper reason is that a proxy cannot cross `postMessage`: structured
 * clone rejects them outright. Handing a match from a deep ref back to the
 * worker threw DataCloneError, and because the verdict buttons apply
 * optimistically, the button lit up and the verdict was silently never saved.
 */
const result = shallowRef<DigWithMatches | null>(null)
const busy = ref(false)

/**
 * The shops already known, so a dig starts with a click.
 *
 * Watched first, then by hit rate — the ordering that answers "wo als
 * next?" rather than listing them alphabetically, which answers nothing.
 */
const knownDealers = shallowRef<Dealer[]>([])

async function loadDealers() {
  const all = await call('dealer.list', undefined)
  knownDealers.value = [...all].sort(
    (a, b) =>
      Number(Boolean(b.watching)) - Number(Boolean(a.watching)) ||
      (b.affinity ?? -1) - (a.affinity ?? -1),
  )
}

/** Clicking a shop fills the field and checks it — one action, not two. */
function pick(username: string) {
  dealer.value = username
  void check()
}

/**
 * Dig the shop on screen again — the question a result left open.
 *
 * Asked on 2026-09-14 in front of a six-hour-old dig: "how do I dig a dealer
 * again?" The way existed — find the shop among the chips at the top, click
 * it, wait for the check — and nothing on the result said so. This is that
 * same path with the looking-for-it removed: it fills the field and checks,
 * so what comes back is the usual choice between the whole shop, only what is
 * new, and the deep run. Never a dig that starts by itself: a scan costs
 * somebody's rate limit, and the screen that spends it asks first.
 */
function again() {
  if (!result.value) return
  pick(result.value.dig.dealer)
  window.scrollTo({ top: 0 })
}
const error = ref<unknown>(null)
const resumable = ref<Dig | null>(null)

onMounted(async () => {
  // Only to show or leave out the share button. Without a hub there is
  // nowhere a find list could live.
  void call('preferences.get', undefined).then((prefs) => (hubUrl.value = prefs.hubUrl))

  // An interrupted dig is offered before anything else: the work is already
  // paid for in requests, and throwing it away to start over would spend the
  // rate limit twice.
  resumable.value = await call('dig.resumable', undefined)
  await Promise.all([loadFeedback(), loadBasket(), loadHistory(), loadDealers()])
  void attach()

  /*
   * ?id= opens a particular dig.
   *
   * The command palette has been offering every stored dig since M3 and every
   * one of them landed on the newest — `dig.get` existed in the protocol and
   * nothing called it. Five digs are kept; four of them were unreachable.
   */
  const wantedDig = route.query.id
  result.value =
    typeof wantedDig === 'string' && wantedDig
      ? await call('dig.get', { digId: wantedDig })
      : await call('dig.latest', undefined)

  // ?dealer= comes from the watchlist banner. Filled in and checked, never
  // started: a scan is two minutes of somebody's rate limit and a link should
  // not be able to spend it.
  const wanted = route.query.dealer
  if (typeof wanted === 'string' && wanted.trim()) {
    dealer.value = wanted.trim()
    await check()
  }
})

/**
 * A scan that was running before this page opened.
 *
 * Leaving the page does not stop a scan — the call lives in the worker until
 * it is done — and until 2026-09-12 a page opened afterwards knew nothing of
 * it: it offered the start button, and the button answered "a scan is
 * already running" without saying which. Now the page attaches: the bar and
 * the shop's name come from the worker every second and a half, the buttons
 * wait, and when the scan is through the result appears as if this page
 * had started it. Not the progress stream itself — that belongs to the call
 * that started the scan, and it may have been on a page that is gone.
 */
let attached: ReturnType<typeof setInterval> | null = null

async function attach() {
  const live = await call('dig.running', undefined)
  if (!live || busy.value) return

  busy.value = true
  scanningDealer.value = live.dealer
  progress.value = live.progress

  attached = setInterval(async () => {
    const now = await call('dig.running', undefined)
    if (now) {
      scanningDealer.value = now.dealer
      progress.value = now.progress
      return
    }
    detach()
    busy.value = false
    progress.value = null
    scanningDealer.value = null
    resumable.value = await call('dig.resumable', undefined)
    result.value = await call('dig.latest', undefined)
  }, 1500)
}

function detach() {
  if (attached !== null) clearInterval(attached)
  attached = null
}

onBeforeUnmount(detach)

/**
 * The enrichment pass, after the scan.
 *
 * Two lookups over each of the best fifty matches — styles for S7, market
 * price and copies for S10 and S11 — because none of those are reachable in
 * bulk. About a hundred requests and two minutes, and only for records that
 * already earned their place. It is allowed to fail: a dig with unenriched
 * matches is still a dig, so a failure here only stops the phase.
 */
async function finish(dig: Dig) {
  // The list goes on screen before the style pass starts. Those matches are
  // already complete; making somebody wait another minute for a refinement
  // would be the worse trade.
  progress.value = null
  result.value = await call('dig.latest', undefined)
  /*
   * The offer to start is taken down once the dig is done (2026-09-12): the
   * box with "Start the dig" above a finished list read as "it did not run".
   * Check is one tap away for the next one, and it names the shop again.
   */
  preflight.value = null

  try {
    await call('dig.enrich', { digId: dig.id }, { onProgress: (p) => (enriching.value = p) })
    result.value = await call('dig.latest', undefined)
  } catch {
    // Deliberately silent. A dig with unenriched matches is still a dig.
  } finally {
    enriching.value = null
  }

  // Stage two of the master/release two-step: the pressings this dig showed
  // were missing. At most eight requests, and permanent — the horizon gets
  // better with every dig, which is the design and not a workaround.
  try {
    const filled = await call('horizon.fillGaps', undefined)
    if (filled.expanded > 0) gaps.value = filled
  } catch {
    // A gap that stays a gap is the state we were already in.
  }
}

/**
 * The dealer, whether typed as a name or pasted as an address.
 *
 * Nobody carries a Discogs username around; what they have is the page they
 * are standing on. `null` when the field holds something that is neither —
 * which is also what disables the button, so a release link cannot be sent off
 * as if it were a shop (app/utils/dealer-input.ts).
 */
const dealerName = computed(() => dealerFromInput(dealer.value))

async function check() {
  const name = dealerName.value
  if (!name || busy.value) return

  /*
   * The field then shows what was understood.
   *
   * Somebody who pasted a forty-character address gets the shop's name back in
   * its place — which is the only way to tell "it read the link" from "it is
   * about to ask Discogs for something absurd".
   */
  dealer.value = name

  busy.value = true
  error.value = null
  preflight.value = null

  try {
    preflight.value = await call('dig.preflight', { dealer: name })
  } catch (cause) {
    noteFailure()
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function resume() {
  const dig = resumable.value
  if (!dig || busy.value) return
  busy.value = true
  error.value = null
  result.value = null

  scanningDealer.value = dig.dealer

  try {
    const done = await call(
      'dig.resume',
      { digId: dig.id },
      { onProgress: (p) => (progress.value = p) },
    )
    resumable.value = null
    await finish(done)
  } catch (cause) {
    error.value = cause
    resumable.value = await call('dig.resumable', undefined)
  } finally {
    busy.value = false
    progress.value = null
    scanningDealer.value = null
  }
}

async function start(depth: 'normal' | 'deep' | 'neu' = 'normal') {
  if (!preflight.value || busy.value) return
  busy.value = true
  error.value = null
  result.value = null
  progress.value = null
  gaps.value = null
  scanningDealer.value = preflight.value.dealer

  try {
    const done = await call(
      'dig.run',
      { dealer: preflight.value.dealer, depth },
      { onProgress: (p) => (progress.value = p) },
    )
    resumable.value = null
    await finish(done)
  } catch (cause) {
    error.value = cause
    // A failed run usually means an interrupted one, so ask again what can be
    // continued rather than leaving a stale offer on screen.
    resumable.value = await call('dig.resumable', undefined)
  } finally {
    busy.value = false
    progress.value = null
    scanningDealer.value = null
  }
}

/**
 * Determinate progress with real numbers — never a bare spinner.
 *
 * Against distinct listings, not rows. A shop walked from both ends returns
 * its middle twice, and a deep scan walks the same record in up to thirteen
 * orderings — a bar built on rows would sail past 100 % and mean nothing.
 */
const percent = computed(() => {
  const p = progress.value
  if (!p || p.reachable === 0) return 0
  return Math.min(100, Math.round((p.unique / p.reachable) * 100))
})

const eta = computed(() => {
  const ms = progress.value?.etaMs ?? null
  if (ms === null) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})

/** Everything the shortlist did not already show. */
const rest = computed(() => {
  if (!result.value) return []
  const shown = new Set(result.value.topFive.map((match) => match.listingId))
  return result.value.matches.filter((match) => !shown.has(match.listingId))
})

/*
 * What a record costs with its postage — the shop's tiers and basket count.
 *
 * Asked once per shop and again whenever the basket changes, because the
 * postage a record adds depends on how many are already going in the parcel.
 * Provided down to every card and row rather than passed through the list,
 * and handed to the view for the sort and the ceiling. Null until it arrives;
 * the list simply shows no number until then.
 */
const landed = shallowRef<LandedContext | null>(null)
provideLanded(landed)

watch(
  [() => result.value?.dig.dealer ?? null, basketIds],
  async ([shop]) => {
    if (!shop) {
      landed.value = null
      return
    }
    try {
      const context = await call('basket.landed', { dealer: shop })
      // The dealer may have changed while the worker was answering.
      if (result.value?.dig.dealer === shop) landed.value = context
    } catch {
      // Nothing to say about postage is a state the list already handles.
      landed.value = null
    }
  },
  { immediate: true },
)

// The filter bar acts on the long list only. The shortlist is the answer to
// "was soll ich mir ansehen" and stays put — filtering it would leave you
// looking at the top five of a subset, which is a different question.
const view = useDigView(rest, landed)

/*
 * The reading order of this screen, handed to the sheet (M31.13).
 *
 * The shortlist first and then the long list as it actually stands — filtered,
 * sorted, and cut off where the reader cut it off — so the arrows in the sheet
 * step through what the eye would step through. It is set while this page is
 * on screen and cleared when it leaves, because an order without its list is
 * a set of arrows pointing at records nobody can see.
 */
const sheet = useReleaseSheet()

/*
 * The list, from the keyboard (M31.24).
 *
 * `j` and `k` walk the finds the way every mail client and issue tracker
 * walks a list, and `/` jumps into the filter — the two gestures somebody who
 * spends an evening in a list of two hundred already has in their fingers.
 *
 * Inside an open sheet the same two keys are handled there, against the same
 * order; this is only for the case where nothing is open yet, so `j` means
 * "start at the top" rather than nothing at all. The guard is the same one as
 * everywhere: not while somebody is typing, not with a modifier held.
 */
function onListKey(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const on = document.activeElement
  if (
    on instanceof HTMLElement &&
    (on.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(on.tagName))
  )
    return

  if (event.key === '/') {
    event.preventDefault()
    document.getElementById('dig-search')?.focus()
    return
  }

  if (event.key !== 'j' || sheet.open.value || event.shiftKey) return
  const first = result.value?.topFive[0] ?? view.visible.value[0]
  if (!first) return
  event.preventDefault()
  sheet.show(first.digId, first.listingId)
}

onMounted(() => document.addEventListener('keydown', onListKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onListKey))

watchEffect(() => {
  const found = result.value
  if (!found) return sheet.setOrder(null)
  const ids = [
    ...found.topFive.map((match) => match.listingId),
    ...view.visible.value.map((match) => match.listingId),
  ]
  sheet.setOrder({ digId: found.dig.id, ids })
})
onBeforeUnmount(() => sheet.setOrder(null))

const expired = computed(() => {
  const dig = result.value?.dig
  return dig ? Date.now() > dig.expiresAt : false
})

/** What this dig is entitled to say — see `digKind`. */
const kind = computed(() => (result.value ? digKind(result.value.dig) : 'full'))

/*
 * Whether the engine had anything to judge at all.
 *
 * "Nothing here for you at this dealer. That is a result, not a fault." is an
 * acquittal, and without a horizon it cannot be sustained: the engine then
 * knows only the exact release ids of your own records — no other pressing, no
 * same artist, no same label. On 2026-08-13 that exact sentence stood there
 * after 2,863 records had been looked through, while the horizon consisted of
 * a single entry, and sent us hours in the wrong direction.
 *
 * Asked for every dig since 2026-09-13, not only for an empty one. The
 * narrow version answered the acquittal and nothing else, so the one case the
 * screen could speak to was the one where the answer was "there was nothing to
 * match against" — and a list of twenty finds still stood there with no basis
 * named. `basis` below is the other half of the same question. It costs no
 * request either way: the status is a count over what is already on the
 * device.
 */
const horizon = ref<Awaited<ReturnType<typeof call<'horizon.status'>>> | null>(null)

watchEffect(async () => {
  if (!result.value || horizon.value) return
  horizon.value = await call('horizon.status', undefined)
})

/**
 * What this dig was held against — said out loud, on every dig.
 *
 * Reported on 2026-09-13, after a first dig came back with nothing: "now I do
 * not know whether my horizon was used or not." Nothing on the screen could
 * have said. A nought and a list of twenty are equally unreadable without the
 * basis they were found against.
 *
 * Read after the dig rather than recorded during it. The numbers move by the
 * handful — `horizon.fillGaps` runs seconds later and adds a few masters —
 * and a second field on every dig row to be exact about that would be paid for
 * by every dig for ever.
 */
const basis = computed(() => {
  const h = horizon.value
  if (!h || h.expanded === 0) return null
  return d.value.basis(count(h.releaseIds), h.expanded, h.entities)
})

/** Something is in the horizon, but not all of it — with the way to the rest. */
const horizonPartial = computed(
  () => horizon.value !== null && horizon.value.expanded < horizon.value.entities,
)

/**
 * A horizon build holding the only lane there is.
 *
 * Rule 3: one request at a time, 1.200 ms apart, first come first served. A
 * build is a few hundred of them, so a dig started while one runs sits in the
 * queue until it is through — reported as "now, after 10 minutes, the app
 * starts scanning my first shop. A bit illogical." It is not illogical, but
 * nothing on this screen said it, and the wait looked like a fault.
 *
 * Module state in the worker, so asking costs a `postMessage` and no I/O.
 */
const lane = ref<RunningHorizon | null>(null)
let laneTimer: ReturnType<typeof setInterval> | null = null

async function readLane() {
  try {
    const live = await call('horizon.running', undefined)
    // Only the deliberate build. The daily refresh and the pass after a dig are
    // twenty lookups apiece — half a minute is not a wait worth a box.
    lane.value = live?.job === 'build' ? live : null
  } catch {
    // Not knowing is the state this screen was in before. It is not an error
    // worth a box of its own.
  }
}

onMounted(() => {
  void readLane()
  laneTimer = setInterval(() => void readLane(), 3000)
})

onBeforeUnmount(() => {
  if (laneTimer !== null) clearInterval(laneTimer)
  laneTimer = null
})

/**
 * Nothing expanded, although there is something to expand.
 *
 * Not `builtAt === null`: a horizon whose chunks have expired is no more of a
 * basis — and with a date from back then would look like one.
 */
const noHorizon = computed(
  () => horizon.value !== null && horizon.value.entities > 0 && horizon.value.expanded === 0,
)
</script>

<template>
  <AppPage>
    <!--
      The working surface. A dig is a list somebody reads for minutes, and a
      wider one shows more of it at once — which is the whole reason to sit at
      a desk for this. The prose blocks inside keep their own width.
    -->
    <!-- The promise of the screen, until the screen keeps it. -->
    <PageHeader :title="d.title" :lead="result ? undefined : d.lead" />

    <!--
      The head of the screen steps aside once there is something to read.

      A dig is a list somebody reads for minutes, and everything above it —
      the field, the shops, the earlier runs — is the question, already
      answered. On a phone that was four blocks and most of a screen before
      the first find; the disclosure puts them one tap away and nothing else
      changes. Without a result it is a plain block and always open, because
      then the question *is* the screen.
    -->
    <component :is="result ? 'details' : 'div'" :class="result ? '' : 'flex flex-col gap-8'">
      <!--
        A chip, not a field. Full width with a magnifier in it, this read as a
        search box somebody was meant to type in — which is the one thing it
        is not.
      -->
      <summary
        v-if="result"
        class="fid-action inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
      >
        <FidIcon name="store" :size="16" aria-hidden="true" />
        {{ d.another }}
      </summary>

      <div :class="result ? 'flex flex-col gap-8 pt-6' : 'contents'">
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="check">
          <div class="flex min-w-64 grow flex-col gap-2">
            <label class="text-fid-sm font-medium text-fid-text" for="dealer">
              {{ d.dealer }}
            </label>
            <input
              id="dealer"
              v-model="dealer"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="d.dealerPlaceholder"
              class="fid-field px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            />
          </div>
          <button
            type="submit"
            :disabled="busy || !online || dealerName === null"
            class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
          >
            {{ d.check }}
          </button>
        </form>

        <!--
        The shops you already know, to click instead of type.
      
        Every dig writes its dealer down, and until now that list only existed to
        be read on another screen. Nobody remembers whether it was 430AM_Studio
        or 430am-studio, and getting it wrong costs a request and a wrong answer.
        Watched shops first: those are the ones somebody said out loud they care
        about.
      -->
        <!--
        And a heading, because two rows of chips on one screen looked alike.

        Asked outright on 2026-09-14: "what are the buttons of the earlier digs
        for?" The shops you can dig and the digs you have run were both a
        `flex-wrap` of bordered buttons with a name and a number in them, and the
        only thing telling them apart was an `aria-label` — which is to say,
        nothing at all for anybody looking at the screen.
      -->
        <section v-if="knownDealers.length > 0" class="flex flex-col gap-2">
          <h2 id="your-shops" class="text-fid-xs font-medium text-fid-text-muted">
            {{ d.yourShops }}
          </h2>
          <nav aria-labelledby="your-shops" class="flex flex-wrap gap-2">
            <button
              v-for="known in knownDealers"
              :key="known.username"
              type="button"
              class="fid-action rounded-fid-sm border px-3 py-2 text-fid-sm transition-colors"
              :class="
                known.watching
                  ? 'border-fid-accent/40 text-fid-text'
                  : 'border-fid-border text-fid-text-muted hover:text-fid-text'
              "
              @click="pick(known.username)"
            >
              {{ known.displayName || known.username }}
              <!--
            The hit rate, and what it is a rate *of*.
            It was a bare "13.0" beside a shop's name — a number with no unit,
            which somebody either ignores or misreads as a rating out of five.
          -->
              <span
                v-if="known.affinity !== null"
                class="fid-num ml-1.5 text-fid-xs opacity-70"
                :title="d.perThousand(known.affinity.toFixed(1))"
                :aria-label="d.perThousand(known.affinity.toFixed(1))"
              >
                {{ known.affinity.toFixed(1) }}
              </span>
            </button>
          </nav>
        </section>

        <section v-if="history.length > 1" class="flex flex-col gap-2">
          <h2 id="earlier-digs" class="text-fid-xs font-medium text-fid-text-muted">
            {{ d.earlierDigs }}
          </h2>
          <nav aria-labelledby="earlier-digs" class="flex flex-wrap gap-2">
            <button
              v-for="entry in history"
              :key="entry.id"
              type="button"
              :aria-current="result?.dig.id === entry.id ? 'true' : undefined"
              class="min-h-9 rounded-fid-sm border px-3 py-1 text-fid-sm transition-colors"
              :class="
                result?.dig.id === entry.id
                  ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                  : 'border-fid-border text-fid-text-muted hover:text-fid-text'
              "
              @click="showDig(entry.id)"
            >
              <!--
            Name, time, kind, match count.

            Until 2026-09-11 only the name and the number stood here — so three
            runs of the same shop on the same day were three identical buttons.
            Reported with exactly that picture: "fatplastics 0" three times over.

            The time of day belongs there and not only the date: two of the three
            were half an hour apart. `dayTime` says in its own comment what it is
            for — "for things that happen more than once a day".

            And the kind, because a zero on "only what is new" means something
            different from a zero after a full run: nothing new has arrived
            against nothing here for you. `digKind` already carries that
            distinction in two other places.
          -->
              <span class="flex flex-col items-start gap-1">
                <span class="flex flex-wrap items-baseline gap-x-2">
                  {{ entry.dealer }}
                  <span class="fid-num text-fid-xs text-fid-text-muted">{{
                    entry.matchCount
                  }}</span>
                </span>
                <span class="fid-num text-fid-xs text-fid-text-muted">
                  {{ dayTime(entry.startedAt) }}
                  <template v-if="digKind(entry) !== 'full'">
                    · {{ d.incremental.short }}</template
                  >
                </span>
              </span>
            </button>
          </nav>
        </section>
      </div>
    </component>

    <ErrorNote v-if="error" :cause="error" />
    <!--
      A verdict or a basket click that did not survive the trip to the worker.
      Both are applied optimistically and both roll back, so without this the
      button would simply spring back with no explanation.
    -->
    <ErrorNote v-if="judgeFailure" :cause="judgeFailure" />
    <ErrorNote v-else-if="basketFailure" :cause="basketFailure" />

    <!--
      Offline the last dig is still fully readable — it is on this device. Only
      the parts that need Discogs are gone, and the screen says which.
    -->
    <p v-if="!online" role="status" class="text-fid-sm text-fid-sig-gap">
      {{ d.offline }}
    </p>

    <!--
      The queue, named.

      One lane to Discogs, first come first served (rule 3) — so a dig started
      while the horizon is being built waits for it. Reported as "now, after 10
      minutes, the app starts scanning my first shop. A bit illogical": the
      order was right and nothing said so, which is what made it look wrong.
    -->
    <p
      v-if="lane"
      role="status"
      class="max-w-prose rounded-fid-sm border border-fid-border p-3 text-fid-sm text-fid-text-muted"
    >
      {{ d.lane }}
      <template v-if="lane.progress">
        <span class="fid-num">
          {{ m.common.ofTotal(count(lane.progress.done), count(lane.progress.total)) }}
        </span>
      </template>
      <NuxtLink to="/settings/collection" class="text-fid-accent underline underline-offset-4">
        {{ d.laneWatch }}
      </NuxtLink>
    </p>

    <!--
      An interrupted run is picked up, not restarted. Those pages already cost
      requests, and the rate limit is the only genuinely scarce resource here.
    -->
    <section
      v-if="resumable && !progress && !enriching"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
    >
      <p class="text-fid-base text-fid-text">
        {{
          d.interrupted(
            resumable.dealer,
            count(resumable.listingsScanned),
            count(resumable.listingsTotal),
          )
        }}
      </p>
      <button
        type="button"
        :disabled="busy"
        class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 font-medium text-fid-on-accent disabled:opacity-50"
        @click="resume"
      >
        {{ d.resume }}
      </button>
    </section>

    <!--
      Coverage is stated before the scan, not discovered at page 101. Discogs
      hands out at most 10.000 listings per sort order, so 20.000 in total.
    -->
    <section
      v-if="preflight && !progress && !enriching"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
    >
      <p class="text-fid-base text-fid-text">
        <span class="font-medium">{{ preflight.displayName }}</span>
        {{ d.listings(count(preflight.numForSale)) }}
      </p>
      <p v-if="preflight.truncated" class="text-fid-sm text-fid-sig-gap">
        {{
          d.truncated(
            count(preflight.reachable),
            Math.round((preflight.reachable / preflight.numForSale) * 100),
          )
        }}
      </p>
      <p class="text-fid-sm text-fid-text-muted">
        {{ d.takesAbout(Math.ceil(((preflight.reachable / 100) * 1.2) / 60)) }}
      </p>
      <!--
        Only what is new, where there is such a thing.

        A shop already dug once carries the date of its newest listing, so a
        visit can walk newest-first and stop at the first record it has seen
        before — one page instead of two hundred. That makes it the right
        default for a shop somebody checks every week, which is why it takes
        the accent and the full dig steps back to an outline.
      -->
      <div v-if="preflight.since" class="flex flex-col gap-2">
        <p class="max-w-prose text-fid-sm text-fid-text-muted">
          {{ d.incremental.known(Math.ceil(((preflight.reachable / 100) * 1.2) / 60)) }}
        </p>
        <button
          type="button"
          :disabled="busy"
          class="self-start rounded-fid-sm px-4 py-2 font-medium disabled:opacity-50"
          :class="
            resumable
              ? 'border border-fid-border text-fid-text'
              : 'fid-fill bg-fid-accent-fill text-fid-on-accent'
          "
          @click="start('neu')"
        >
          {{ d.incremental.fetch }}
        </button>
      </div>

      <!--
        Filled only when it is *the* thing to do.

        An interrupted dig outranks a new one — those pages are already paid
        for in requests — and so does "nur das Neue" on a shop that has one.
        The full dig steps back to an outline in both cases, so the screen has
        one accent and it points at the right button.
      -->
      <button
        type="button"
        :disabled="busy"
        class="self-start rounded-fid-sm px-4 py-2 font-medium disabled:opacity-50"
        :class="
          resumable || preflight.since
            ? 'border border-fid-border text-fid-text'
            : 'fid-fill bg-fid-accent-fill text-fid-on-accent'
        "
        @click="start('normal')"
      >
        {{ preflight.since ? d.startAgain : d.start }}
      </button>

      <!--
        The deep scan, offered only where it can do something.

        Below 20.000 the ordinary two passes already return the whole shop, and
        thirteen more orderings would spend a thousand requests re-reading it.
        Above that they are the only way past the wall — each sort key puts
        different records in the first 10.000.

        The accent stays on the ordinary button: this is the deliberate,
        expensive choice, and it should look like one.
      -->
      <div
        v-if="preflight.deepRequests !== null"
        class="flex flex-col gap-2 border-t border-fid-border pt-3"
      >
        <p class="max-w-prose text-fid-sm text-fid-text-muted">
          {{ d.deep.about(Math.ceil((preflight.deepRequests * 1.2) / 60)) }}
        </p>
        <button
          type="button"
          :disabled="busy"
          class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
          @click="start('deep')"
        >
          {{ d.deep.start }}
        </button>
      </div>
    </section>

    <section v-if="progress || scanningDealer" class="flex flex-col gap-2" aria-live="polite">
      <!-- Which shop, first. A bar without a name is a bar somebody has to guess at. -->
      <p v-if="scanningDealer" class="text-fid-sm font-medium text-fid-text">
        {{ d.scanning(scanningDealer) }}
      </p>
      <div v-if="progress" class="flex items-center gap-3">
        <div class="h-2 grow overflow-hidden rounded-full bg-fid-inset">
          <div
            class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
            :style="{ width: `${percent}%` }"
          />
        </div>
        <!--
          The pulse, beside the bar, and only where the bar above the page has
          none (M31.9): the header strip is hidden on a phone, and a scan is
          exactly the moment somebody wonders what this is costing. On a desk
          it would be the same reading twice on one screen.
        -->
        <RateMeter class="shrink-0 md:hidden" />
      </div>
      <!--
        Distinct listings, because that is the number that means something.
        The pass is named too: on a deep scan somebody watching a bar crawl for
        twenty minutes deserves to know it is on the fourth of thirteen
        orderings and not stuck.
      -->
      <p v-if="progress" class="text-fid-sm text-fid-text-muted">
        {{ m.common.ofTotal(count(progress.unique), count(progress.reachable)) }} ·
        {{ d.matchCount(count(progress.matches)) }}
        <template v-if="progress.passCount > 1">
          · {{ progress.pass }}
          <span class="fid-num">({{ progress.passIndex + 1 }}/{{ progress.passCount }})</span>
        </template>
        <template v-if="eta"> {{ m.common.etaLeft(eta) }}</template>
      </p>
    </section>

    <!--
      The pass runs while the matches are already readable. It says what it is
      spending, because a hundred requests is two minutes of somebody's rate
      limit and that should never happen behind their back.
    -->
    <section
      v-if="enriching"
      class="flex items-center gap-3 rounded-fid-sm border border-fid-border px-3 py-2"
      aria-live="polite"
    >
      <div class="h-1 w-24 overflow-hidden rounded-full bg-fid-inset">
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
          :style="{
            width: `${enriching.total > 0 ? Math.round((enriching.done / enriching.total) * 100) : 0}%`,
          }"
        />
      </div>
      <p class="fid-num text-fid-sm text-fid-text-muted">
        {{
          d.enriching(count(enriching.done), count(enriching.total), count(enriching.requests))
        }}
      </p>
    </section>

    <!--
      What this dig taught the horizon. Worth saying out loud: it explains why
      the same shop can turn up more next time.
    -->
    <p
      v-if="gaps"
      role="status"
      class="rounded-fid-sm border border-fid-border p-3 text-fid-sm text-fid-text-muted"
    >
      {{ d.horizonLearned(gaps.expanded)
      }}<template v-if="gaps.titles.length">: {{ gaps.titles.join(', ') }}</template
      >. {{ d.horizonCounts }}
    </p>

    <!--
      Which dig is on screen, and the others. Five are kept (docs/03 §5) and
      until now only the newest could be opened.
    -->
    <section v-if="result" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-fid-xl font-bold text-fid-text">
          {{ d.hits(result.matches.length, result.dig.dealer) }}
        </h2>
        <p class="text-fid-sm text-fid-text-muted">
          <template v-if="kind !== 'full'">
            {{ d.newListings(count(result.dig.listingsTotal), result.dig.listingsTotal === 1) }}
          </template>
          <template v-else>
            {{
              d.scanned(
                count(result.dig.listingsScanned),
                count(result.dig.listingsTotal),
                Math.round(result.dig.coverage * 100),
              )
            }}
          </template>
          <template v-if="result.folded > 0"> · {{ d.folded(result.folded) }}</template>
        </p>
      </div>

      <button
        type="button"
        :disabled="busy || !online"
        class="fid-action self-start text-fid-sm text-fid-accent underline underline-offset-4 disabled:opacity-50"
        @click="again()"
      >
        {{ d.again(result.dig.dealer) }}
      </button>

      <!--
        What it was held against. On every dig, not only the empty ones.

        "Now I do not know whether my horizon was used or not" — and the
        screen had no way to say. A nought and a list of twenty are equally
        unreadable without the basis they were found against.
      -->
      <p v-if="basis" class="max-w-prose text-fid-sm text-fid-text-muted">
        {{ basis }}
        <NuxtLink
          v-if="horizonPartial"
          to="/settings/collection"
          class="text-fid-accent underline underline-offset-4"
        >
          {{ d.basisMore }}
        </NuxtLink>
      </p>

      <!--
        The same finds, one after another.

        No sixth entry in the navigation bar: on a phone five is already the
        limit. The stack is a second **view** of this list, so it stands where
        the list stands — and not somewhere you would have to go looking.
      -->
      <NuxtLink
        v-if="result.matches.length > 0"
        :to="{ path: '/stack' }"
        class="fid-action inline-flex items-center gap-2 self-start rounded-fid-sm border border-fid-accent px-5 py-3 text-fid-base font-medium text-fid-accent"
      >
        <FidIcon name="layers" :size="18" aria-hidden="true" />
        {{ d.stack.title }}
      </NuxtLink>

      <!--
        Sharing, and only where it is possible.
        Without a hub there is nowhere a find list could live — then a sentence
        stands here instead of a button that does nothing. After six hours the
        button disappears altogether: what may no longer be shown may not be
        passed on either (rule 4).
      -->
      <div v-if="!expired" class="flex flex-col gap-2">
        <button
          v-if="hubUrl"
          type="button"
          :disabled="sharing || !online"
          class="inline-flex items-center gap-2 self-start rounded-fid-sm border border-fid-border px-5 py-3 text-fid-base text-fid-text disabled:opacity-50"
          @click="share"
        >
          <FidIcon name="share-2" :size="18" aria-hidden="true" />
          {{ sharing ? d.shareBusy : d.share }}
        </button>
        <p v-else class="text-fid-sm text-fid-text-muted">{{ d.shareNeedsHub }}</p>

        <div
          v-if="shareLink"
          class="flex flex-col gap-2 rounded-fid-sm border border-fid-border p-3"
        >
          <p class="text-fid-sm text-fid-text">
            {{ d.shareReady(shareLink.matches, shareLink.total) }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <input
              :value="shareLink.url"
              readonly
              :aria-label="d.share"
              class="min-w-0 grow fid-field px-3 py-2 font-fid-mono text-fid-xs text-fid-text"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="fid-action shrink-0 rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
              @click="copyShare"
            >
              {{ shareCopied ? d.shareCopied : d.shareCopy }}
            </button>
          </div>
          <p class="text-fid-xs text-fid-text-muted">
            {{ d.shareGone(dayTime(shareLink.until)) }}
          </p>
          <p class="text-fid-xs text-fid-text-muted">{{ d.shareTells }}</p>
        </div>
      </div>

      <!-- The ToS deadline, enforced in the UI and not only in the cleanup job. -->
      <!--
        And only where there were prices to lose.

        A dig that found nothing showed the six-hour notice and a button
        offering to refresh nought prices — three controls that could do
        nothing, dressed as a result. Reported on 2026-09-14 with exactly that
        screen in front of it.
      -->
      <section
        v-if="expired && result.matches.length > 0"
        role="status"
        class="flex flex-col gap-2 rounded-fid-sm border border-fid-border p-3"
      >
        <p class="text-fid-sm text-fid-text-muted">{{ d.expired }}</p>
        <!--
          The way out that is not a four-minute rescan: each match's own
          listing, one request apiece.
        -->
        <!--
          Outlined, though it was filled. Refreshing prices is a repair on
          data that is already there, and it sits below a start button that is
          the actual purpose of the screen — two filled accents at once and
          neither of them means "do this".
        -->
        <button
          type="button"
          :disabled="busy || !online"
          class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
          @click="refresh"
        >
          {{ d.refreshPrices }}
          <span class="fid-num">({{ result.matches.length }})</span>
        </button>
        <p class="text-fid-xs text-fid-text-muted">
          {{
            d.refreshCost(
              result.matches.length,
              Math.ceil((result.matches.length * 1.2) / 60) || 1,
            )
          }}
        </p>
      </section>

      <div v-if="refreshing" class="flex flex-col gap-1" aria-live="polite">
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-fid-inset">
          <div
            class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
            :style="{
              width: `${refreshing.total > 0 ? Math.round((refreshing.done / refreshing.total) * 100) : 0}%`,
            }"
          />
        </div>
        <p class="fid-num text-fid-sm text-fid-text-muted">
          {{ d.checked(count(refreshing.done), count(refreshing.total))
          }}<template v-if="refreshing.sold > 0"
            >, {{ d.alreadySold(count(refreshing.sold)) }}</template
          >
        </p>
      </div>

      <p v-if="refreshed" role="status" class="fid-num text-fid-sm text-fid-text-muted">
        {{ d.refreshed(count(refreshed.refreshed))
        }}<template v-if="refreshed.sold > 0"
          >, {{ d.refreshedSold(count(refreshed.sold)) }}</template
        ><template v-if="refreshed.gone > 0"
          >, {{ d.refreshedGone(count(refreshed.gone)) }}</template
        >.
      </p>

      <!--
        No acquittal without a basis.
        Without a horizon, "there is nothing here for you" is not information
        about the shop but about us — and it belongs said that way, together
        with the route to where it can be fixed.
      -->
      <p v-if="result.matches.length === 0 && noHorizon" class="text-fid-base text-fid-sig-gap">
        {{ d.empty.noHorizon }}
        <NuxtLink
          to="/settings/collection"
          class="text-fid-accent underline underline-offset-4"
        >
          {{ d.empty.buildIt }}
        </NuxtLink>
      </p>

      <!-- Three different sentences, and why, in `app/i18n/dig.ts`. -->
      <template v-else-if="result.matches.length === 0">
        <p class="text-fid-base text-fid-text-muted">
          {{
            kind === 'incremental-empty'
              ? d.empty['incremental-empty'](result.dig.dealer)
              : d.empty[kind]
          }}
        </p>

        <!--
          And the two handles that help when nothing was found.

          No result is an answer, not a broken one — but the screen used to
          answer it with a stack that has no cards and a button offering to
          refresh nought prices. This is what is actually left to do: read the
          whole shop rather than only what is new, or put it on the round so it
          gets asked without anybody starting a dig.
        -->
        <div class="flex flex-wrap items-center gap-3">
          <button
            v-if="kind !== 'full'"
            type="button"
            :disabled="busy || !online"
            class="fid-action fid-tonal rounded-fid-sm px-4 py-2 text-fid-sm font-medium disabled:opacity-50"
            @click="again()"
          >
            {{ d.empty.wholeShop }}
          </button>
          <NuxtLink
            :to="`/dealers?shop=${encodeURIComponent(result.dig.dealer)}`"
            class="fid-action inline-flex items-center gap-2 rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
          >
            <FidIcon name="eye" :size="14" aria-hidden="true" />
            {{ d.empty.watchIt }}
          </NuxtLink>
        </div>
      </template>

      <template v-else>
        <!--
          The shortlist first, one record per artist. Three records by the same
          name are a finding, but they are not five different reasons to look.
        -->
        <section class="flex flex-col gap-3" aria-labelledby="top-five">
          <h3 id="top-five" class="text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted">
            {{ d.topFive }}
          </h3>
          <p
            v-if="result.topFive[0] && result.topFive[0].score >= 85"
            class="text-fid-sm text-fid-text-muted"
          >
            <span class="text-fid-text">{{ d.sideOne }}</span>
            {{ result.topFive[0].artist }} – {{ result.topFive[0].title }}
          </p>
          <!-- Five cards, two abreast once there is room for two. -->
          <ul class="grid gap-3 @4xl:grid-cols-2">
            <li v-for="match in result.topFive" :key="match.listingId">
              <MatchCard :match="match" />
            </li>
          </ul>
        </section>

        <CreditExplorer :dig-id="result.dig.id" />

        <section
          v-if="rest.length > 0"
          class="flex flex-col gap-3"
          aria-labelledby="all-matches"
        >
          <h3
            id="all-matches"
            class="text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted"
          >
            {{ d.allFindsHeading }}
          </h3>

          <DigFilters
            :available="view.available.value"
            :active="view.active.value"
            :sort="view.sort.value"
            :density="view.density.value"
            :query="view.query.value"
            :shown="view.visible.value.length"
            :total="rest.length"
            :landed-known="view.landedKnown.value"
            :up-to="view.upTo.value"
            @toggle-signal="view.toggleSignal"
            @set-sort="view.setSort"
            @set-density="view.setDensity"
            @set-query="view.setQuery"
            @set-up-to="view.setUpTo"
            @clear="view.clear"
          />

          <p v-if="view.visible.value.length === 0" class="text-fid-sm text-fid-text-muted">
            {{ d.filters.nothingMatches }}
          </p>

          <MatchList v-else :matches="view.visible.value" :density="view.density.value" />
        </section>
      </template>
    </section>
  </AppPage>
</template>
