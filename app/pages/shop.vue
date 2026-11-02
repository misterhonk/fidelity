<script setup lang="ts">
import type {
  DigPreflight,
  DigWithMatches,
  EnrichProgress,
  RefreshProgress,
  RunningHorizon,
  ScanProgress,
} from '#shared/protocol'
import { STARTER_SHOPS } from '#shared/starter-shops'
import type {
  Dealer,
  Dig,
  DigComparison,
  DigVisit,
  LandedContext,
  SharedFind,
} from '#shared/types'

import { useDigMessages } from '~/i18n/dig'
import { reasonFor } from '~/i18n/reason'

const d = useDigMessages()

useSeoMeta({
  title: () => d.value.title,
  description: () => d.value.description,
})

const { call, stop } = useFidelityWorker()
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
 * Sharing (#249). The worker packs the list; it travels in the link's `#`
 * fragment, with no hub and no price (`app/utils/share-link.ts`).
 */
const sharing = ref(false)
const shareLink = ref<{
  url: string
  matches: number
  total: number
  top: SharedFind | null
} | null>(null)
const shareCopied = ref(false)
/** A share sheet on this device, or only the clipboard: the button says which. */
const canSend = ref(false)

async function share() {
  if (sharing.value || !result.value) return
  sharing.value = true
  shareCopied.value = false
  error.value = null

  try {
    const made = await call('share.create', { digId: result.value.dig.id })
    // The picture on screen shows the old link's top find, not this one's.
    if (cardUrl.value) URL.revokeObjectURL(cardUrl.value)
    cardUrl.value = null
    shareLink.value = {
      url: sharedUrl(made.data),
      matches: made.matches,
      total: result.value.matches.length,
      top: made.top,
    }
  } catch (cause) {
    error.value = cause
  } finally {
    sharing.value = false
  }
}

async function sendShare() {
  if (!shareLink.value) return
  shareCopied.value = (await handOver(shareLink.value.url)) === 'copied'
}

/** The card where no share sheet takes files: on screen, to be saved by hand. */
const cardUrl = ref<string | null>(null)

/*
 * The top find as a picture (#250). The picture carries the Discogs notice as
 * text; the links — the list and the listing the notice belongs to — ride in
 * the share text, since a picture cannot hold one.
 *
 * Drawn as soon as the link exists, not on the click: WebKit only lets
 * `navigator.share` run straight off the tap, and awaiting `toBlob` first
 * spends that permission.
 */
const card = shallowRef<{ file: File; text: string } | null>(null)

watch(shareLink, async (link) => {
  card.value = null
  const top = link?.top
  if (!link || !top) return
  const reason = reasonFor(top.signals)
  const credit = m.value.nav.attribution
  const file = await shareCardFile(top, { reason, credit, brand: 'Sleeveside' })
  if (!file || shareLink.value !== link) return
  card.value = {
    file,
    text: `${reason}\n${link.url}\n${credit}: ${listingPage(top.listingId)}`,
  }
})

async function shareCard() {
  if (!card.value) return
  const { file, text } = card.value
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
    }
  }
  if (cardUrl.value) URL.revokeObjectURL(cardUrl.value)
  cardUrl.value = URL.createObjectURL(file)
}
onBeforeUnmount(() => cardUrl.value && URL.revokeObjectURL(cardUrl.value))

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
/**
 * The shops and their visits (M36): the history grouped by shop, the newest
 * full dig first and what has happened since. It was a flat row of the last
 * five digs, chips without a bond between them.
 */
const visits = shallowRef<DigVisit[]>([])

async function loadHistory() {
  visits.value = await call('dig.visits', undefined)
}

/** Every kept dig, for anything that still counts runs rather than visits. */
const history = computed(() => visits.value.flatMap((visit) => visit.runs))

/**
 * An earlier dig, opened: what has happened at this shop since it ran. New
 * finds off the check-ins after it, and the finds a later full dig no
 * longer saw. Null while the open dig is the shop's newest run.
 */
const sinceThis = computed(() => {
  const dig = result.value?.dig
  if (!dig) return null
  const visit = visits.value.find((v) => v.dealer === dig.dealer)
  if (!visit) return null
  const newer = visit.runs.filter((run) => run.id > dig.id)
  if (newer.length === 0) return null
  return {
    newFinds: newer
      .filter((run) => run.kind === 'new')
      .reduce((n, run) => n + run.matchCount, 0),
    gone: result.value?.matches.filter((match) => match.goneAt).length ?? 0,
    looked: newer.some((run) => run.kind !== 'new'),
    latest: visit.runs[0]!,
  }
})

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

/**
 * This full dig against the one before it (M36.5): what is new, what is
 * gone, what is still there. Loaded with the dig, null where there is no
 * earlier full dig of the shop to stand against.
 */
const comparison = shallowRef<DigComparison | null>(null)
watch(
  () => result.value?.dig.id ?? null,
  async (digId) => {
    comparison.value = null
    if (!digId) return
    const answer = await call('dig.compare', { digId })
    if (result.value?.dig.id === digId) comparison.value = answer
  },
  { immediate: true },
)

/** The three lists of the comparison, in the order somebody reads them. */
const GONE = 'gone' as const
const comparisonParts = computed(() => {
  const c = comparison.value
  if (!c) return []
  return [
    { key: 'fresh' as const, rows: c.fresh },
    { key: GONE, rows: c.gone ?? [] },
    { key: 'kept' as const, rows: c.kept },
  ]
})
const busy = ref(false)

/**
 * Which view of a dig with a result is up (#223).
 *
 * The finds open the page. The field, the shops and the tools of this dig sit
 * under "Shop", the earlier runs under "Visits" — one tap away, and out of the
 * way of the first find on a phone. Another dig on screen opens on its finds.
 */
type Segment = 'finds' | 'shop' | 'visits'
const segment = ref<Segment>('finds')
const segments = computed(() =>
  (['finds', 'shop', 'visits'] as const).map((key) => ({ key, label: d.value.segments[key] })),
)
watch(
  () => result.value?.dig.id,
  () => (segment.value = 'finds'),
)

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
  canSend.value = typeof navigator.share === 'function'

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
    // The field it filled in is under Shop (#313). After the tick, because a
    // new result sends the segments back to Finds on that same tick.
    await nextTick()
    segment.value = 'shop'
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

  void growAfterDig()
}

/**
 * Artists and credits, once the first dig is through (#214).
 *
 * They used to be two setup steps of their own: minutes each, before
 * somebody had seen a single find. Now they start here, in the background,
 * when there is a list on screen to look at. Not awaited, and not tied to this
 * page: the calls live in the worker and run on after the page is left. The
 * build expands only what is not expanded yet, so a later dig resumes an
 * interrupted one and otherwise costs nothing. The worker's one lane keeps
 * rule 3.
 */
async function growAfterDig() {
  try {
    const [horizon, running] = await Promise.all([
      call('horizon.status', undefined),
      call('horizon.running', undefined),
    ])
    if (running) return
    if (horizon.expanded < horizon.entities) await call('horizon.build', undefined)
    if (await call('credits.running', undefined)) return
    const credits = await call('credits.status', undefined)
    // Fifty a dig, about a minute: bounded (rule 2), and each later dig
    // resumes where the last stopped.
    if (credits.harvested < credits.favourites) await call('credits.harvest', { limit: 50 })
  } catch {
    // Both can be finished in the settings; a failure here stops nothing else.
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
    await interrupted(cause)
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
    await interrupted(cause)
  } finally {
    busy.value = false
    progress.value = null
    scanningDealer.value = null
  }
}

/**
 * A run that ended early — failed, or stopped on purpose.
 *
 * Either way it is usually resumable, so the offer is asked for again rather
 * than a stale one left on screen. A Stop is not an error (#216): what it
 * leaves is the finds so far and the offer to carry on.
 */
async function interrupted(cause: unknown) {
  if (isCancelled(cause)) result.value = await call('dig.latest', undefined)
  else error.value = cause
  resumable.value = await call('dig.resumable', undefined)
}

/** Stops the scan, whichever screen started it. The offer to resume follows. */
function stopDig() {
  stop('dig.run', 'dig.resume')
}

/** Share of a pass, for the bars that count done against total. */
const shareOf = (p: { done: number; total: number }) =>
  p.total > 0 ? Math.round((p.done / p.total) * 100) : 0

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

/**
 * The wall (#223): the four best, faced out the way a shop hangs its best
 * records. The worker's shortlist holds five; the fifth reads on in the list,
 * and four is what two rows of a phone hold.
 */
const wall = computed(() => result.value?.topFive.slice(0, 4) ?? [])

/** Everything the wall did not already show. */
const rest = computed(() => {
  if (!result.value) return []
  const shown = new Set(wall.value.map((match) => match.listingId))
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

  // Only where the finds are on screen: under Shop or Visits, j opening a find is a surprise (#313).
  if (event.key !== 'j' || sheet.open.value || event.shiftKey || segment.value !== 'finds')
    return
  const first = wall.value[0] ?? view.visible.value[0]
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
    ...wall.value.map((match) => match.listingId),
    ...view.visible.value.map((match) => match.listingId),
  ]
  sheet.setOrder({ digId: found.dig.id, ids })
})
onBeforeUnmount(() => sheet.setOrder(null))

/*
 * Asked again when a price on it runs out: the worker hands out nothing past
 * its six hours, so the reload is what takes the price off the screen.
 */
const { now: clock } = useDeadline(
  () => result.value?.showUntil,
  async () => {
    const shown = result.value
    if (!shown || scanningDealer.value) return
    const again = await call('dig.get', { digId: shown.dig.id })
    if (result.value?.dig.id === shown.dig.id) result.value = again
  },
)

const expired = computed(() => {
  const dig = result.value?.dig
  return dig ? clock.value > dig.expiresAt : false
})

/**
 * How many seconds Discogs has asked us to wait, while a scan is running.
 *
 * Read from the worker's own ledger every three seconds and only while
 * something is scanning: it is a number in memory, so it costs nothing, and
 * outside a scan the pulse beside the settings already carries it.
 */
const waitingFor = ref<number | null>(null)

/**
 * How many requests actually went out in the last minute, while scanning.
 *
 * A scan with a token runs at fifty a minute. When this number collapses and
 * Discogs has *not* asked for a pause, something on this side is holding the
 * clock — and the usual something is the browser: a tab in the background has
 * its timers throttled, and the pacer is built out of timers. A four-minute
 * dig then takes an hour, which from the outside is a dig that "hangs".
 *
 * Reported as exactly that on 2026-09-14. The line says the measurement and
 * names the likely cause; it does not claim to know which tab somebody is
 * looking at.
 */
const perMinute = ref<number | null>(null)
/** Below this, with nothing waiting on Discogs, the lane is not ours. */
const SLOW_LANE = 8

const crawling = computed(
  () =>
    scanningDealer.value !== null &&
    waitingFor.value === null &&
    perMinute.value !== null &&
    perMinute.value < SLOW_LANE,
)

let throttleTimer: ReturnType<typeof setInterval> | null = null
/** Nothing is said about a pace before there has been a minute to measure. */
let scanningSince = 0

watch(
  () => progress.value !== null || scanningDealer.value !== null,
  (running) => {
    if (throttleTimer !== null) {
      clearInterval(throttleTimer)
      throttleTimer = null
    }
    waitingFor.value = null
    perMinute.value = null
    if (!running) return
    scanningSince = Date.now()

    const look = async () => {
      try {
        const now = await call('limit.now', undefined)
        const left = now.waitingUntil === null ? null : now.waitingUntil - Date.now()
        waitingFor.value = left !== null && left > 0 ? Math.ceil(left / 1000) : null
        perMinute.value =
          Date.now() - scanningSince < 70_000
            ? null
            : now.minute.filter((row) => !row.free).length
      } catch {
        // The worker not answering is not something this line reports.
      }
    }
    void look()
    throttleTimer = setInterval(() => void look(), 3000)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (throttleTimer !== null) clearInterval(throttleTimer)
})

/** The phone stays awake while a scan runs (#198). */
useWakeLock(() => progress.value !== null || scanningDealer.value !== null)

/**
 * A shop whose stock has not moved since the last dig (M32.4).
 *
 * Both numbers are already here: the current one from the preflight's own
 * `/users/{u}`, the old one off the shop's row. Only where there *was* a last
 * dig — "0 of 0" on a shop nobody has walked is not the same statement.
 */
const unmoved = computed(() => {
  const found = preflight.value
  return (
    found !== null &&
    found.since !== null &&
    found.hadForSale !== null &&
    found.hadForSale === found.numForSale
  )
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
  // A basis line that cannot be read is left out, not thrown at nobody (#313).
  horizon.value = await call('horizon.status', undefined).catch(() => null)
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

/**
 * Under 50 records the scores run low whatever the shop holds (#222): there is
 * little in the collection for a find to resemble. Said once, above the list,
 * so a column of footnotes reads as the collection's size and not the shop's.
 */
const SMALL_COLLECTION = 50
const collectionSize = ref<number | null>(null)

watchEffect(async () => {
  if (!result.value || collectionSize.value !== null) return
  const library = await call('library.summary', undefined).catch(() => null)
  // Only a collection that has been read through once (#313): before the first
  // sync, or during it, nought is "not counted yet", not "small".
  if (library && library.collectionSyncedAt !== null) collectionSize.value = library.collection
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
    <!-- Without a result the question is the screen: the promise, the field, the shops. -->
    <PageHeader v-if="!result" :title="d.title" :lead="d.lead" />

    <!--
      With one, the shop's head (#223): its finds, how much of it was read, and
      until when its prices may stand on this screen (rule 4). Compact, so the
      first find stands above the fold on a phone; the field, the shops and the
      earlier runs fold into the segments below it.
    -->
    <header v-if="result" class="flex flex-col gap-1 max-md:pt-[env(safe-area-inset-top,0px)]">
      <h1 class="fid-display text-fid-xl leading-tight font-bold text-fid-text">
        {{ d.hits(result.matches.length, result.dig.dealer) }}
      </h1>
      <div class="flex flex-wrap items-baseline gap-x-4">
        <p class="text-fid-sm text-fid-text-muted">
          <template v-if="kind !== 'full'">
            {{ d.newListings(count(result.dig.listingsTotal), result.dig.listingsTotal === 1) }}
          </template>
          <template v-else>
            <!--
                Distinct listings, not rows read (M32.6).

                A shop walked from both ends hands the middle back twice, so
                `listingsScanned` counts to 20.000 on a shop that holds 19.864 —
                and the line said "20.000 von 19.864 gescannt (100 %)", which is
                a number nobody can make sense of. `uniqueSeen` is the numerator
                `coverage` is already built from; the two now agree. Older digs
                have no `uniqueSeen` and keep the old number rather than none.
              -->
            {{
              d.scanned(
                count(result.dig.uniqueSeen ?? result.dig.listingsScanned),
                count(result.dig.listingsTotal),
                Math.round(result.dig.coverage * 100),
              )
            }}
          </template>
          <template v-if="result.folded > 0"> · {{ d.folded(result.folded) }}</template>
          ·
          <span
            data-testid="freshness"
            class="fid-num"
            :class="expired ? 'text-fid-sig-gap-text' : undefined"
            >{{ expired ? d.freshGone : d.freshUntil(clockTime(result.dig.expiresAt)) }}</span
          >
        </p>
        <!--
          The way out of an expired dig that is not a four-minute rescan: each
          match's own listing, one request apiece. What it costs is said in
          the sentence below rather than hidden in a title, because a minute
          of somebody's rate limit is not a detail.
        -->
        <button
          v-if="expired && result.matches.length > 0"
          type="button"
          :disabled="busy || !online"
          class="fid-action fid-plate min-h-9 text-fid-text transition-colors hover:text-fid-accent disabled:opacity-50"
          @click="refresh"
        >
          <!--
            The count hangs on a margin, not on a space. `fid-plate` letters
            are tracked 0.12em apart, so a word space is no wider than the gap
            inside a word and the plate read "REFRESH THE PRICES(17)". The
            filter chips carry their number the same way.
          -->
          {{ d.refreshPrices }}<span class="fid-num ml-1">({{ result.matches.length }})</span>
        </button>
      </div>
      <!--
        An earlier dig, opened (M36): what has happened at this shop since.
        The finds and their reasons are still here; the prices are not, and
        the head says what the later visits saw.
      -->
      <p v-if="sinceThis" class="fid-num text-fid-sm text-fid-text-muted">
        {{ d.visits.sinceThis(sinceThis.newFinds, sinceThis.looked ? sinceThis.gone : null) }}
        <button
          type="button"
          class="fid-action underline underline-offset-4 hover:text-fid-text"
          @click="showDig(sinceThis.latest.id)"
        >
          {{ d.visits.latest }}
        </button>
      </p>
    </header>

    <!--
      The ToS deadline, enforced in the UI and not only in the cleanup job —
      and as a sentence since M33 #3.

      It was a bordered box holding a notice, a button and a cost line — a
      frame round a thing that is not a choice but a fact about this dig.
      The button is a plate beside the freshness clock, and what it costs stands
      here beside the fact, still said out loud: a minute of somebody's rate
      limit is not a detail to hide in a title.

      `role="status"` stays. The sentence appears when a dig ages past six
      hours while somebody is looking at it, and that is exactly the kind of
      change a screen reader should be told about.

      And only where there were prices to lose. A dig that found nothing
      showed this notice and a button offering to refresh nought prices —
      three controls that could do nothing, dressed as a result. Reported on
      2026-09-14 with exactly that screen in front of it.
    -->
    <p
      v-if="result && expired && result.matches.length > 0"
      role="status"
      class="max-w-prose text-fid-sm text-fid-text-muted"
    >
      {{ d.expired }}
      {{
        d.refreshCost(result.matches.length, Math.ceil((result.matches.length * 1.2) / 60) || 1)
      }}
    </p>

    <div v-if="refreshing" class="flex flex-col gap-1">
      <div
        role="progressbar"
        :aria-label="d.checked(count(refreshing.done), count(refreshing.total))"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="shareOf(refreshing)"
        class="h-1.5 w-full overflow-hidden rounded-full bg-fid-inset"
      >
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
          :style="{ width: `${shareOf(refreshing)}%` }"
        />
      </div>
      <JobMilestone :label="d.refreshPrices" :percent="shareOf(refreshing)" />
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

    <PlateTabs
      v-if="result"
      :label="d.segments.label"
      :options="segments"
      :value="segment"
      @select="segment = $event as Segment"
    />

    <div v-if="!result || segment === 'shop'" class="flex flex-col gap-8">
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
      <!--
        Shops to start with, while there are none of one's own (2026-10-21).

        The empty dig screen was a text field and nothing else: "which shop?"
        is the first question a stranger has, and the five starters stood on
        the shops screen, which a first dig does not pass.
      -->
      <section v-if="knownDealers.length === 0" class="flex flex-col gap-2">
        <h2 id="starter-shops" class="text-fid-xs font-medium text-fid-text-muted">
          {{ d.starters }}
        </h2>
        <nav aria-labelledby="starter-shops" class="flex flex-wrap gap-2">
          <button
            v-for="starter in STARTER_SHOPS"
            :key="starter.username"
            type="button"
            class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
            @click="pick(starter.username)"
          >
            {{ starter.displayName }}
            <span class="ml-1.5 text-fid-xs opacity-70">{{ starter.shipsFrom }}</span>
          </button>
        </nav>
        <p class="text-fid-xs text-fid-text-muted">{{ d.startersNote }}</p>
      </section>

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
              :title="d.perThousand(decimal(known.affinity))"
              :aria-label="d.perThousand(decimal(known.affinity))"
            >
              {{ decimal(known.affinity) }}
            </span>
          </button>
        </nav>
      </section>

      <template v-if="result">
        <!--
        One head, one line of things to do (M33 #3).

        Above the finds stood four separate calls — "dig again", a bordered
        box offering to refresh prices, a bordered accent link into the stack,
        and a share button — each in its own shape and its own volume, before
        the first record. Reported on 2026-09-16 as exactly that: four calls
        and then, eventually, a shop.

        They are one row of plates now, in the order somebody asks for them:
        look again, look differently, repair the prices, pass it on. No fills,
        no frames, no box round any of them. The sentences that used to be
        stacked between them — what this was matched against, what the six
        hours did — stand under the row as sentences, which is what they are.

        Since #223 the row lives under "Shop": the price refresh moved up to
        the freshness clock it answers, and the stack to the head of the wall.

        And no icons. M34.1 put an icon beside every word on the shops screen
        and that rule holds where it was made, on buttons with frames; a plate
        is a word, and one glyph among three plates read as a mistake rather
        than as a system.
      -->
        <nav class="flex flex-wrap items-center gap-x-5 gap-y-1" :aria-label="d.actions">
          <button
            type="button"
            :disabled="busy || !online"
            class="fid-action fid-plate min-h-9 text-fid-text transition-colors hover:text-fid-accent disabled:opacity-50"
            @click="again()"
          >
            {{ d.again(result.dig.dealer) }}
          </button>

          <!--
            Sharing needs no hub since #249: the list travels in the link.
            After six hours it goes: its listings may have sold (rule 4).
          -->
          <button
            v-if="!expired"
            type="button"
            :disabled="sharing || !online"
            class="fid-action fid-plate min-h-9 text-fid-text transition-colors hover:text-fid-accent disabled:opacity-50"
            @click="share"
          >
            {{ sharing ? d.shareBusy : d.share }}
          </button>
        </nav>

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
          What the share produced, and only then: a link, how long it lives, and
          what it hands over. The trigger is a plate in the row above; this is
          the answer, and it appears where an answer belongs.
        -->
        <div
          v-if="!expired && shareLink"
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
              @click="sendShare"
            >
              {{ shareCopied ? d.shareCopied : canSend ? d.shareSend : d.shareCopy }}
            </button>
          </div>
          <p class="text-fid-xs text-fid-text-muted">{{ d.shareTells }}</p>
          <button
            v-if="card"
            type="button"
            class="fid-action self-start rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
            @click="shareCard"
          >
            {{ d.shareCard }}
          </button>
          <!-- A blob: URL of the card drawn here, never a Discogs image (#250). -->
          <img
            v-if="cardUrl"
            :src="cardUrl"
            :alt="d.shareCardAlt"
            width="1080"
            height="1080"
            class="h-auto w-full max-w-80 rounded-fid-sm border border-fid-border"
          />
        </div>

        <CreditExplorer v-if="result.matches.length > 0" :dig-id="result.dig.id" />
      </template>
    </div>

    <div v-if="result ? segment === 'visits' : history.length > 0" class="flex flex-col gap-8">
      <!--
        Visits (M36): the history as the shops' story. One line per shop —
        the newest full dig, what has happened since — and the runs in a
        fold. It was a flat row of the last five digs; Martin's screen on
        2026-09-20 showed five chips for one shop, three of them the same
        empty minute.
      -->
      <section v-if="history.length > 0" class="flex flex-col gap-2">
        <h2 id="visits" class="text-fid-xs font-medium text-fid-text-muted">
          {{ d.visits.title }}
        </h2>
        <ul aria-labelledby="visits" class="flex flex-col gap-1">
          <li
            v-for="visit in visits"
            :key="visit.dealer"
            class="rounded-fid-sm border border-fid-border px-3 py-2"
          >
            <details :open="visit.runs.some((run) => run.id === result?.dig.id) || undefined">
              <summary
                class="fid-action flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <span
                  class="text-fid-sm"
                  :class="
                    visit.runs.some((run) => run.id === result?.dig.id)
                      ? 'text-fid-accent'
                      : 'text-fid-text'
                  "
                  >{{ visit.displayName }}</span
                >
                <span v-if="visit.full" class="fid-num text-fid-xs text-fid-text-muted">
                  {{ d.visits.full(dayTime(visit.full.startedAt), visit.full.matchCount)
                  }}<template v-if="visit.since.length || visit.quietChecks">
                    ·
                    {{
                      d.visits.since(visit.since.length, visit.newFinds, visit.quietChecks)
                    }}</template
                  >
                </span>
                <span v-else class="fid-num text-fid-xs text-fid-text-muted">
                  {{ d.visits.onlyChecked(visit.since.length, visit.newFinds) }}
                </span>
              </summary>
              <ol class="mt-2 flex flex-col border-l border-fid-border pl-3">
                <li
                  v-for="run in visit.runs"
                  :key="run.id"
                  class="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1"
                >
                  <span class="fid-num text-fid-xs text-fid-text-muted">{{
                    dayTime(run.startedAt)
                  }}</span>
                  <span
                    class="text-fid-xs"
                    :class="run.id === result?.dig.id ? 'text-fid-accent' : 'text-fid-text'"
                  >
                    {{ d.visits.run(run.kind, run.matchCount, run.listingsTotal) }}
                  </span>
                  <span v-if="run.gone" class="fid-num text-fid-xs text-fid-text-muted">
                    {{ d.visits.gone(run.gone, run.matchCount) }}
                  </span>
                  <button
                    v-if="run.id !== result?.dig.id"
                    type="button"
                    class="fid-action text-fid-xs text-fid-text-muted underline underline-offset-4 hover:text-fid-text"
                    @click="showDig(run.id)"
                  >
                    {{ d.visits.open }}
                  </button>
                  <span v-else class="fid-plate text-fid-text-muted">{{
                    d.visits.current
                  }}</span>
                </li>
                <li
                  v-if="visit.quietChecks > 0 && visit.checkedAt"
                  class="flex flex-wrap items-baseline gap-x-3 py-1"
                >
                  <span class="fid-num text-fid-xs text-fid-text-muted">{{
                    dayTime(visit.checkedAt)
                  }}</span>
                  <span class="text-fid-xs text-fid-text-muted">{{
                    d.visits.quiet(visit.quietChecks)
                  }}</span>
                </li>
              </ol>
            </details>
          </li>
        </ul>
      </section>

      <!--
        Two visits side by side (M36.5). Folded: it is a comparison, not
        the list, and somebody who came for the finds reads on.
      -->
      <section
        v-if="result && comparison"
        class="flex flex-col gap-3"
        aria-labelledby="compare"
      >
        <details>
          <summary
            id="compare"
            class="fid-action cursor-pointer list-none text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted"
          >
            {{
              d.compare.summary(
                dayTime(comparison.earlier.startedAt),
                comparison.fresh.length,
                comparison.gone?.length ?? null,
                comparison.kept.length,
              )
            }}
          </summary>
          <div class="mt-3 flex flex-col gap-4">
            <DiscogsCredit :to="sellerPage(result.dig.dealer)" class="self-start" />
            <div v-for="part in comparisonParts" :key="part.key" class="flex flex-col gap-1">
              <h3 class="fid-plate text-fid-text-muted">
                {{ d.compare.heading(part.key, part.rows.length) }}
              </h3>
              <p
                v-if="part.key === GONE && comparison.gone === null"
                class="text-fid-xs text-fid-text-muted"
              >
                {{ d.compare.goneUnknown }}
              </p>
              <p v-else-if="part.rows.length === 0" class="text-fid-xs text-fid-text-muted">
                {{ d.compare.none }}
              </p>
              <ul v-else class="flex flex-col">
                <li v-for="match in part.rows.slice(0, 30)" :key="match.listingId">
                  <MatchRow :match="match" />
                </li>
              </ul>
              <p v-if="part.rows.length > 30" class="fid-num text-fid-xs text-fid-text-muted">
                {{ d.compare.more(part.rows.length - 30) }}
              </p>
            </div>
          </div>
        </details>
      </section>
    </div>

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
    <p v-if="!online" role="status" class="text-fid-sm text-fid-sig-gap-text">
      {{ d.offline }}
    </p>

    <!--
      The queue, named.

      One lane to Discogs, first come first served (rule 3) — so a dig started
      while the horizon is being built waits for it. Reported as "now, after 10
      minutes, the app starts scanning my first shop. A bit illogical": the
      order was right and nothing said so, which is what made it look wrong.
      No live region: its counter moves every 1.2 s, and the build announces
      its own tenths where it runs (#216).
    -->
    <p
      v-if="lane"
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
      <FidButton :disabled="busy" class="self-start" @click="resume">
        {{ d.resume }}
      </FidButton>
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
      <p v-if="preflight.truncated" class="text-fid-sm text-fid-sig-gap-text">
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
      <!--
        The dig you do not have to run (M32.4).

        The preflight asks Discogs how many this shop has for sale, and the
        shop's row has held the number from the last dig all along — so this
        line costs nothing and is the only answer on the screen that saves the
        *whole* four minutes rather than shortening them.

        A reason to skip, never a refusal to run: a shop that sold one record
        and listed another is "unchanged" by a count, and somebody who knows
        that about their own shop should still be able to press the button.
      -->
      <p
        v-if="unmoved"
        class="max-w-prose rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
      >
        {{ d.incremental.unmoved(count(preflight.numForSale)) }}
      </p>

      <div v-if="preflight.since" class="flex flex-col gap-2">
        <p class="max-w-prose text-fid-sm text-fid-text-muted">
          {{ d.incremental.known(Math.ceil(((preflight.reachable / 100) * 1.2) / 60)) }}
        </p>
        <FidButton
          :disabled="busy"
          class="self-start"
          :variant="resumable ? 'secondary' : 'primary'"
          @click="start('neu')"
        >
          {{ d.incremental.fetch }}
        </FidButton>
      </div>

      <!--
        Filled only when it is *the* thing to do.

        An interrupted dig outranks a new one — those pages are already paid
        for in requests — and so does "nur das Neue" on a shop that has one.
        The full dig steps back to the secondary tier in both cases, so the screen has
        one accent and it points at the right button.
      -->
      <FidButton
        :disabled="busy"
        class="self-start"
        :variant="resumable || preflight.since ? 'secondary' : 'primary'"
        @click="start('normal')"
      >
        {{ preflight.since ? d.startAgain : d.start }}
      </FidButton>

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

    <section v-if="progress || scanningDealer" class="flex flex-col gap-2">
      <!-- Which shop, first. A bar without a name is a bar somebody has to guess at. -->
      <p v-if="scanningDealer" class="text-fid-sm font-medium text-fid-text">
        {{ d.scanning(scanningDealer) }}
      </p>
      <!--
        Discogs has told us to wait (M32.5).

        A browser never sees the 429 — it comes through Cloudflare without CORS
        headers, so `fetch()` simply rejects — and the client's answer is to
        sleep out the window and try again. From the outside that is a bar that
        stops moving, which reads as "broken" rather than "waiting": reported
        on 2026-09-14 as a large shop that "cannot be dug". It can; it was
        waiting, and nothing on the screen said so.

        Polled only while a scan is running, and only out of the worker's own
        memory — no request, and no line at all when nothing is waiting.

        Not a live region: the seconds count down every three, and a screen
        reader would read each of them out (#216).
      -->
      <p
        v-if="waitingFor !== null"
        class="max-w-prose rounded-fid-sm border border-fid-sig-gap/40 bg-fid-sig-gap/10 px-3 py-2 text-fid-sm text-fid-text"
      >
        {{ d.throttled(waitingFor) }}
      </p>

      <!--
        The lane is not ours (M32.7).

        Fifty a minute is the pace with a token; when what actually goes out
        collapses and Discogs has not asked for a pause, something on this side
        is holding the clock. The usual something is the browser: a tab in the
        background has its timers throttled, and the pacer is built out of
        timers — a four-minute dig then takes an hour, which from the outside
        is a dig that "hangs".

        The line says what was measured and names the likely cause. It does not
        claim to know which tab somebody is looking at.
      -->
      <p
        v-else-if="crawling"
        class="max-w-prose rounded-fid-sm border border-fid-sig-gap/40 bg-fid-sig-gap/10 px-3 py-2 text-fid-sm text-fid-text"
      >
        {{ d.slowLane(perMinute ?? 0) }}
      </p>

      <div v-if="progress" class="flex items-center gap-3">
        <div
          role="progressbar"
          :aria-label="d.scanning(scanningDealer ?? '')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="percent"
          class="h-2 grow overflow-hidden rounded-full bg-fid-inset"
        >
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
      <JobMilestone
        v-if="progress"
        :label="d.scanning(scanningDealer ?? '')"
        :percent="percent"
      />
      <button
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        @click="stopDig"
      >
        {{ m.common.stop }}
      </button>
    </section>

    <!--
      The pass runs while the matches are already readable. It says what it is
      spending, because a hundred requests is two minutes of somebody's rate
      limit and that should never happen behind their back.
    -->
    <section
      v-if="enriching"
      class="flex flex-wrap items-center gap-3 rounded-fid-sm border border-fid-border px-3 py-2"
    >
      <div
        role="progressbar"
        :aria-label="
          d.enriching(count(enriching.done), count(enriching.total), count(enriching.requests))
        "
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="shareOf(enriching)"
        class="h-1 w-24 overflow-hidden rounded-full bg-fid-inset"
      >
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
          :style="{ width: `${shareOf(enriching)}%` }"
        />
      </div>
      <p class="fid-num text-fid-sm text-fid-text-muted">
        {{
          d.enriching(count(enriching.done), count(enriching.total), count(enriching.requests))
        }}
      </p>
      <JobMilestone
        :label="d.scanning(result?.dig.dealer ?? '')"
        :percent="shareOf(enriching)"
      />
      <button
        type="button"
        class="rounded-fid-sm border border-fid-border px-3 py-1 text-fid-sm text-fid-text"
        @click="stop('dig.enrich')"
      >
        {{ m.common.stop }}
      </button>
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

    <section v-if="result && segment === 'finds'" class="flex flex-col gap-4">
      <!--
        No acquittal without a basis.
        Without a horizon, "there is nothing here for you" is not information
        about the shop but about us — and it belongs said that way, together
        with the route to where it can be fixed.
      -->
      <p
        v-if="result.matches.length === 0 && noHorizon"
        class="text-fid-base text-fid-sig-gap-text"
      >
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
          <FidButton
            v-if="kind !== 'full'"
            variant="secondary"
            :disabled="busy || !online"
            @click="again()"
          >
            {{ d.empty.wholeShop }}
          </FidButton>
          <NuxtLink
            :to="`/shops?shop=${encodeURIComponent(result.dig.dealer)}`"
            class="fid-action inline-flex items-center gap-2 rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
          >
            <FidIcon name="eye" :size="14" aria-hidden="true" />
            {{ d.empty.watchIt }}
          </NuxtLink>
        </div>
      </template>

      <template v-else>
        <!--
          The wall first (#223): the four best, one record per artist. Three
          records by the same name are a finding, but they are not four
          different reasons to look.
        -->
        <section class="flex flex-col gap-3" aria-labelledby="the-wall">
          <div class="flex flex-wrap items-baseline justify-between gap-x-5">
            <h2
              id="the-wall"
              class="text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted"
            >
              {{ d.wall }}
            </h2>
            <!--
              The same finds, one after another.

              No sixth entry in the navigation bar: on a phone five is already
              the limit. The stack is a second **view** of this list, so it
              stands where the list stands — and not somewhere you would have
              to go looking.
            -->
            <NuxtLink
              v-if="result.matches.length > 0"
              :to="{ path: '/stack' }"
              class="fid-action fid-plate min-h-9 text-fid-text transition-colors hover:text-fid-accent"
            >
              {{ d.stack.title }}
            </NuxtLink>
          </div>
          <!-- The score explained once for the wall, not on each card (#222). -->
          <WhyNote :label="d.match.scoreWhat" class="self-start">
            {{ d.match.scoreHow }}
          </WhyNote>
          <!-- Four cards, two abreast once there is room for two. -->
          <ul class="grid gap-3 @4xl:grid-cols-2">
            <li
              v-for="match in wall"
              :key="match.listingId"
              :data-listing="match.listingId"
              :aria-current="match.listingId === sheet.open.value?.listingId || undefined"
              class="fid-cascade rounded-fid-md aria-[current=true]:ring-2 aria-[current=true]:ring-fid-accent"
            >
              <MatchCard :match="match" />
            </li>
          </ul>
        </section>

        <section
          v-if="rest.length > 0"
          class="flex flex-col gap-3"
          aria-labelledby="all-matches"
        >
          <h2
            id="all-matches"
            class="text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted"
          >
            {{ d.allFindsHeading }}
          </h2>
          <!--
            Once for the list, linked to the shop's page that shows these
            listings: a credit on each of four hundred 34 px rows would be the
            noisiest thing on the screen. Each card and each sheet carries its own.
          -->
          <DiscogsCredit :to="sellerPage(result.dig.dealer)" class="self-start" />

          <DigFilters
            :available="view.available.value"
            :active="view.active.value"
            :sizes="view.sizesAvailable.value"
            :sized="view.sizes.value"
            :sort="view.sort.value"
            :direction="view.direction.value"
            :density="view.density.value"
            :query="view.query.value"
            :shown="view.visible.value.length"
            :total="rest.length"
            :landed-known="view.landedKnown.value"
            :up-to="view.upTo.value"
            @toggle-signal="view.toggleSignal"
            @toggle-size="view.toggleSize"
            @set-sort="view.setSort"
            @set-density="view.setDensity"
            @set-query="view.setQuery"
            @set-up-to="view.setUpTo"
            @clear="view.clear"
          />

          <p v-if="view.visible.value.length === 0" class="text-fid-sm text-fid-text-muted">
            {{ d.filters.nothingMatches }}
          </p>

          <MatchList
            v-else
            :matches="view.visible.value"
            :density="view.density.value"
            :sort="view.sort.value"
            :direction="view.direction.value"
            @set-sort="view.setSort"
          />
        </section>
      </template>

      <!--
        Under the finds, not above them: on a phone the first find comes first
        (#223). Outside the branches above, so a dig with no finds still says why.
      -->
      <p
        v-if="collectionSize !== null && collectionSize < SMALL_COLLECTION"
        data-testid="small-collection"
        class="max-w-prose text-fid-sm text-fid-text-muted"
      >
        {{ d.smallCollection }}
      </p>
    </section>
  </AppPage>
</template>
