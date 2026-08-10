<script setup lang="ts">
import type {
  DigPreflight,
  DigWithMatches,
  EnrichProgress,
  RefreshProgress,
  ScanProgress,
} from '#shared/protocol'
import type { Dealer, Dig } from '#shared/types'

useSeoMeta({
  title: 'Graben',
  description: 'Einen Discogs-Händler scannen und eine bewertete Fundliste bekommen.',
})

const { call } = useFidelityWorker()
const { online, noteFailure } = useOnline()
const { failure: judgeFailure, load: loadFeedback } = useFeedback()
const { failure: basketFailure, load: loadBasket } = useBasket()
const route = useRoute()
const router = useRouter()

const dealer = ref('')
const preflight = ref<DigPreflight | null>(null)
const progress = ref<ScanProgress | null>(null)
const enriching = ref<EnrichProgress | null>(null)
const gaps = ref<{ expanded: number; requests: number; titles: string[] } | null>(null)
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
 * Nächstes?" rather than listing them alphabetically, which answers nothing.
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
const error = ref<unknown>(null)
const resumable = ref<Dig | null>(null)

onMounted(async () => {
  // An interrupted dig is offered before anything else: the work is already
  // paid for in requests, and throwing it away to start over would spend the
  // rate limit twice.
  resumable.value = await call('dig.resumable', undefined)
  await Promise.all([loadFeedback(), loadBasket(), loadHistory(), loadDealers()])

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

const number = new Intl.NumberFormat('de-DE')

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

async function check() {
  if (!dealer.value.trim() || busy.value) return
  busy.value = true
  error.value = null
  preflight.value = null

  try {
    preflight.value = await call('dig.preflight', { dealer: dealer.value.trim() })
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
  }
}

async function start() {
  if (!preflight.value || busy.value) return
  busy.value = true
  error.value = null
  result.value = null
  progress.value = null
  gaps.value = null

  try {
    const done = await call(
      'dig.run',
      { dealer: preflight.value.dealer },
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
  }
}

/** Determinate progress with real numbers — never a bare spinner. */
const percent = computed(() => {
  const p = progress.value
  if (!p || p.reachable === 0) return 0
  return Math.min(100, Math.round((p.scanned / p.reachable) * 100))
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

// The filter bar acts on the long list only. The shortlist is the answer to
// "was soll ich mir ansehen" and stays put — filtering it would leave you
// looking at the top five of a subset, which is a different question.
const view = useDigView(rest)

const expired = computed(() => {
  const dig = result.value?.dig
  return dig ? Date.now() > dig.expiresAt : false
})
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-[80rem] flex-col gap-8 px-6 py-16">
    <!--
      The working surface. A dig is a list somebody reads for minutes, and a
      wider one shows more of it at once — which is the whole reason to sit at
      a desk for this. The prose blocks inside keep their own width.
    -->
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Graben</h1>
    </div>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="check">
      <div class="flex min-w-64 grow flex-col gap-2">
        <label class="text-fid-sm font-medium text-fid-text" for="dealer">Händlername</label>
        <input
          id="dealer"
          v-model="dealer"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="z. B. juno_records"
          class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || !online || dealer.trim().length === 0"
        class="rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      >
        Prüfen
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
    <nav v-if="knownDealers.length > 0" aria-label="Deine Läden" class="flex flex-wrap gap-2">
      <button
        v-for="known in knownDealers"
        :key="known.username"
        type="button"
        class="fid-action rounded-fid-sm border px-3 py-1.5 text-fid-sm transition-colors"
        :class="
          known.watching
            ? 'border-fid-accent/40 text-fid-text'
            : 'border-fid-border text-fid-text-muted hover:text-fid-text'
        "
        @click="pick(known.username)"
      >
        {{ known.displayName || known.username }}
        <span v-if="known.affinity !== null" class="fid-num ml-1.5 text-fid-xs opacity-70">
          {{ known.affinity.toFixed(1) }}
        </span>
      </button>
    </nav>

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
      Kein Netz – ein neuer Dig geht gerade nicht. Der letzte steht unten und ist vollständig.
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
        Ein Dig bei <span class="font-medium">{{ resumable.dealer }}</span> wurde unterbrochen –
        <span class="fid-num">{{ number.format(resumable.listingsScanned) }}</span> von
        <span class="fid-num">{{ number.format(resumable.listingsTotal) }}</span> waren durch.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
        @click="resume"
      >
        Dig fortsetzen
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
        <span class="font-medium">{{ preflight.displayName }}</span> hat
        <span class="fid-num">{{ number.format(preflight.numForSale) }}</span> Listings.
      </p>
      <p v-if="preflight.truncated" class="text-fid-sm text-fid-sig-gap">
        Die API gibt davon höchstens
        <span class="fid-num">{{ number.format(preflight.reachable) }}</span> heraus – das sind
        {{ Math.round((preflight.reachable / preflight.numForSale) * 100) }} %. Vollständig geht
        nicht, und das sagen wir lieber vorher.
      </p>
      <p class="text-fid-sm text-fid-text-muted">
        Dauer etwa
        {{ Math.ceil((preflight.reachable / 100) * 1.2) }} Sekunden bei einem Request pro 1,2
        Sekunden.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990 disabled:opacity-50"
        @click="start"
      >
        Dig starten
      </button>
    </section>

    <section v-if="progress" class="flex flex-col gap-2" aria-live="polite">
      <div class="h-2 w-full overflow-hidden rounded-full bg-fid-inset">
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <p class="text-fid-sm text-fid-text-muted">
        <span class="fid-num">{{ number.format(progress.scanned) }}</span> von
        <span class="fid-num">{{ number.format(progress.reachable) }}</span> ·
        <span class="fid-num">{{ progress.matches }}</span> Treffer
        <template v-if="eta"> · noch ca. {{ eta }}</template>
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
          class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
          :style="{
            width: `${enriching.total > 0 ? Math.round((enriching.done / enriching.total) * 100) : 0}%`,
          }"
        />
      </div>
      <p class="text-fid-sm text-fid-text-muted">
        Stile und Marktpreise werden nachgeschlagen –
        <span class="fid-num">{{ enriching.done }}</span> von
        <span class="fid-num">{{ enriching.total }}</span>
        (<span class="fid-num">{{ enriching.requests }}</span> Abfragen)
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
      Der Horizont kennt jetzt
      <span class="fid-num">{{ gaps.expanded }}</span>
      {{ gaps.expanded === 1 ? 'Album' : 'Alben' }} mehr in allen Pressungen<template
        v-if="gaps.titles.length"
        >: {{ gaps.titles.join(', ') }}</template
      >. Beim nächsten Dig zählt das mit.
    </p>

    <!--
      Which dig is on screen, and the others. Five are kept (docs/03 §5) and
      until now only the newest could be opened.
    -->
    <nav v-if="history.length > 1" aria-label="Frühere Digs" class="flex flex-wrap gap-2">
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
        {{ entry.dealer }}
        <span class="fid-num text-fid-xs text-fid-text-muted">{{ entry.matchCount }}</span>
      </button>
    </nav>

    <section v-if="result" class="flex flex-col gap-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-fid-xl font-bold text-fid-text">
          {{ result.matches.length }} Treffer bei {{ result.dig.dealer }}
        </h2>
        <p class="text-fid-sm text-fid-text-muted">
          <span class="fid-num">{{ number.format(result.dig.listingsScanned) }}</span> von
          <span class="fid-num">{{ number.format(result.dig.listingsTotal) }}</span> gescannt
          ({{ Math.round(result.dig.coverage * 100) }} %)<template v-if="result.folded > 0">
            · <span class="fid-num">{{ result.folded }}</span> weitere Exemplare
            zusammengefasst</template
          >
        </p>
      </div>

      <!-- The ToS deadline, enforced in the UI and not only in the cleanup job. -->
      <section
        v-if="expired"
        role="status"
        class="flex flex-col gap-2 rounded-fid-sm border border-fid-border p-3"
      >
        <p class="text-fid-sm text-fid-text-muted">
          Älter als sechs Stunden – Preise und Zustände dürfen nicht mehr angezeigt werden. Die
          Treffer und ihre Begründungen bleiben.
        </p>
        <!--
          The way out that is not a four-minute rescan: each match's own
          listing, one request apiece.
        -->
        <button
          type="button"
          :disabled="busy || !online"
          class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 text-fid-sm font-medium text-fid-n-990 disabled:opacity-50"
          @click="refresh"
        >
          Preise auffrischen
          <span class="fid-num">({{ result.matches.length }})</span>
        </button>
        <p class="text-fid-xs text-fid-text-muted">
          <span class="fid-num">{{ result.matches.length }}</span> Abfragen, also rund
          {{ Math.ceil((result.matches.length * 1.2) / 60) || 1 }} Minute. Findet nichts Neues –
          nur das wieder, was dieser Dig schon gefunden hat.
        </p>
      </section>

      <div v-if="refreshing" class="flex flex-col gap-1" aria-live="polite">
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-fid-inset">
          <div
            class="h-full rounded-full bg-fid-accent transition-[width] duration-300"
            :style="{
              width: `${refreshing.total > 0 ? Math.round((refreshing.done / refreshing.total) * 100) : 0}%`,
            }"
          />
        </div>
        <p class="text-fid-sm text-fid-text-muted">
          <span class="fid-num">{{ refreshing.done }}</span> von
          <span class="fid-num">{{ refreshing.total }}</span> nachgesehen<template
            v-if="refreshing.sold > 0"
            >, <span class="fid-num">{{ refreshing.sold }}</span> schon verkauft</template
          >
        </p>
      </div>

      <p v-if="refreshed" role="status" class="text-fid-sm text-fid-text-muted">
        <span class="fid-num text-fid-text">{{ refreshed.refreshed }}</span> wieder
        aktuell<template v-if="refreshed.sold > 0"
          >, <span class="fid-num">{{ refreshed.sold }}</span> inzwischen verkauft</template
        ><template v-if="refreshed.gone > 0"
          >, <span class="fid-num">{{ refreshed.gone }}</span> nicht mehr auffindbar</template
        >.
      </p>

      <p v-if="result.matches.length === 0" class="text-fid-base text-fid-text-muted">
        Bei diesem Händler nichts für dich. Das ist ein Ergebnis, kein Fehler.
      </p>

      <template v-else>
        <!--
          The shortlist first, one record per artist. Three records by the same
          name are a finding, but they are not five different reasons to look.
        -->
        <section class="flex flex-col gap-3" aria-labelledby="top-five">
          <h3 id="top-five" class="text-fid-sm uppercase tracking-[0.2em] text-fid-text-muted">
            Top Five
          </h3>
          <p
            v-if="result.topFive[0] && result.topFive[0].score >= 85"
            class="text-fid-sm text-fid-text-muted"
          >
            <span class="text-fid-text">Side One, Track One:</span>
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
            Alle Treffer
          </h3>

          <DigFilters
            :available="view.available.value"
            :active="view.active.value"
            :sort="view.sort.value"
            :density="view.density.value"
            :query="view.query.value"
            :shown="view.visible.value.length"
            :total="rest.length"
            @toggle-signal="view.toggleSignal"
            @set-sort="view.setSort"
            @set-density="view.setDensity"
            @set-query="view.setQuery"
            @clear="view.clear"
          />

          <p v-if="view.visible.value.length === 0" class="text-fid-sm text-fid-text-muted">
            Nichts passt zu dieser Auswahl.
          </p>

          <MatchList v-else :matches="view.visible.value" :density="view.density.value" />
        </section>
      </template>
    </section>
  </main>
</template>
