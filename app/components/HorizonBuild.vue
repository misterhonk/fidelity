<script setup lang="ts">
import type { HorizonProgress, HorizonStatus } from '#shared/protocol'
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

const { call } = useFidelityWorker()

const status = ref<HorizonStatus | null>(null)
const progress = ref<HorizonProgress | null>(null)
const running = ref(false)
const error = ref<unknown>(null)

async function refresh() {
  status.value = await call('horizon.status', undefined)
}

const stale = ref(0)

/**
 * A build that was already running when this panel opened.
 *
 * The same attachment the dig screen grew on 2026-09-12, for the same report
 * one screen later: "the horizon build is aborted as soon as I leave the tab,
 * and I cannot see why". Nothing was aborted. The run lives in the worker and
 * survives the page; the bar lived in this component's `ref` and went with it,
 * so coming back showed an idle panel with an enabled button over a run that
 * was still going — and pressing it started a second one beside the first.
 *
 * Not the progress stream itself: that belongs to the call that started the
 * build, and it may have been made by a copy of this component that no longer
 * exists. The worker is asked instead, every second and a half.
 */
let watching: ReturnType<typeof setInterval> | null = null

async function attach(): Promise<boolean> {
  const live = await call('horizon.running', undefined)
  // Only the deliberate build. The daily refresh and the pass after a dig are
  // twenty requests apiece and have never claimed this bar.
  if (!live || live.job !== 'build') return false

  running.value = true
  progress.value = live.progress

  watching ??= setInterval(async () => {
    const now = await call('horizon.running', undefined)
    if (now && now.job === 'build') {
      progress.value = now.progress
      return
    }
    detach()
    running.value = false
    progress.value = null
    await refresh()
  }, 1500)

  return true
}

function detach() {
  if (watching !== null) clearInterval(watching)
  watching = null
}

onBeforeUnmount(detach)

onMounted(async () => {
  await refresh()

  // A build already in flight holds the only lane there is (rule 3). Queueing
  // a day's revalidation behind it would add twenty requests to a wait that is
  // already minutes long, and the build is the thing somebody is watching.
  if (await attach()) return

  /*
   * The staggered revalidation (docs/11 §3).
   *
   * Runs on opening rather than on a schedule: there is no server to schedule
   * anything, and a visit is exactly when spending somebody's rate limit is
   * least in the way. It takes a day's worth — about twenty requests, oldest
   * first — and refuses to run twice in one day however often the app is
   * opened. Entities that were never expanded stay out of it; those belong to
   * the deliberate build below.
   */
  try {
    const result = await call('horizon.revalidate', undefined)
    stale.value = result.stale
    if (result.expanded > 0) await refresh()
  } catch {
    // A stale horizon is still a horizon.
  }
})

async function build() {
  if (running.value) return
  running.value = true
  error.value = null

  try {
    await call('horizon.build', undefined, { onProgress: (p) => (progress.value = p) })
    await refresh()
  } catch (cause) {
    error.value = cause
    // Whatever was expanded before the interruption is kept; refreshing shows
    // how far it got.
    await refresh()
  } finally {
    running.value = false
    progress.value = null
  }
}

const percent = computed(() => {
  const p = progress.value
  if (!p || p.total === 0) return 0
  return Math.round((p.done / p.total) * 100)
})

const eta = computed(() => {
  const ms = progress.value?.etaMs
  if (ms === undefined) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})

const staleNote = computed(() =>
  stale.value > 0 ? st.value.library.horizon.stale(stale.value) : null,
)

const complete = computed(
  () => status.value !== null && status.value.expanded >= status.value.entities,
)

/**
 * When it last went through to the end, or that it never has.
 *
 * `horizonBuiltAt` is written only by a run that reached the last entity — a
 * partial run deliberately leaves it alone (worker/horizon/build.ts), which is
 * what makes this sentence worth anything.
 */
const built = computed(() => {
  const at = status.value?.builtAt ?? null
  if (at !== null) return st.value.library.horizon.lastBuilt(dayTime(at))
  return status.value && status.value.expanded > 0 ? st.value.library.horizon.neverBuilt : null
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <!--
      "Entities" and "release ids" are words from the inside.

      A collector has artists and labels, and records — not entities and ids.
      The numbers are the same numbers; only the labels changed.
    -->
    <dl v-if="status" class="grid grid-cols-2 gap-x-6 gap-y-2 text-fid-sm">
      <dt class="text-fid-text-muted">{{ st.library.horizon.entities }}</dt>
      <dd class="fid-num text-fid-text">
        {{ st.library.horizon.ofTotal(status.expanded, status.entities) }}
      </dd>
      <dt class="text-fid-text-muted">{{ st.library.horizon.knownRecords }}</dt>
      <dd class="fid-num text-fid-text">{{ count(status.releaseIds) }}</dd>
    </dl>

    <!--
      Time, not requests.

      This said "another 240 requests, so about 5 minutes" — the number somebody
      actually plans around is the second one, and the first is a unit from
      inside the machine. What is left is what it costs, and that stopping is
      safe.
    -->
    <p v-if="!complete && status && !running" class="text-fid-sm text-fid-text-muted">
      {{ st.library.horizon.remaining(Math.ceil((status.estimatedRequests * 1.2) / 60)) }}
    </p>

    <p v-if="staleNote && !running" class="text-fid-sm text-fid-text-muted">
      {{ staleNote }}
    </p>

    <!--
      Asked for by name: "last successful horizon build on … at …". The two
      numbers above say how much exists and nothing said whether a run ever
      finished — a horizon at 312 of 690 looks the same an hour after it stopped
      and two months after.
    -->
    <p v-if="built && !running" class="text-fid-sm text-fid-text-muted">{{ built }}</p>

    <!--
      Shown from the moment the run is known, not from its first report.

      A build attached to on opening has no progress for a second and a half,
      and a panel that showed nothing at all in that window would be the same
      empty screen this whole change is against.
    -->
    <div v-if="progress || running" class="flex flex-col gap-2" aria-live="polite">
      <div class="h-2 w-full overflow-hidden rounded-full bg-fid-inset">
        <div
          class="h-full rounded-full bg-fid-accent transition-[width] duration-[var(--fid-motion-layout)]"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <p v-if="progress" class="text-fid-sm text-fid-text-muted">
        {{ st.library.horizon.ofTotal(progress.done, progress.total) }}
        <template v-if="progress.current"> · {{ progress.current }}</template>
        · <span class="fid-num">{{ count(progress.releaseIds) }}</span>
        {{ st.library.horizon.records }}
        <template v-if="eta"> · {{ st.library.horizon.eta(eta) }}</template>
      </p>
      <!-- Because the opposite was being read into a bar that vanished. -->
      <p class="text-fid-sm text-fid-text-muted">{{ st.library.horizon.keepsRunning }}</p>
    </div>

    <ErrorNote v-if="error" :cause="error" />

    <button
      type="button"
      :disabled="running"
      class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
      @click="build"
    >
      {{ complete ? st.library.horizon.refresh : st.library.horizon.build }}
    </button>
  </section>
</template>
