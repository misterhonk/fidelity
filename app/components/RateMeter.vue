<script setup lang="ts">
import { REQUEST_PURPOSES, type RateLedger } from '#shared/types'

/**
 * What this device has asked Discogs for, and what it was spared (M31.9).
 *
 * **Not a fuel gauge.** Discogs' limit is sixty requests a *minute* per
 * address — a tempo, not a stock. Nothing runs out and there is no daily
 * quota, so an "X of Y remaining" would invite exactly the wrong question.
 * What stands here is a pulse: one tick per second of the last minute, filled
 * where a request went out.
 *
 * And it is this app's own count, never Discogs': `x-discogs-ratelimit-*` is
 * not exposed to JavaScript and a 429 arrives without CORS headers (docs/02).
 * Which turns out to be the more useful number, because it can be split by
 * what caused it — and by whether it cost a slot at all. A tick the catalogue
 * or the hub answered is drawn hollow: those two are why the line stays quiet,
 * and until now nobody could see them working.
 *
 * Quiet at rest. With nothing asked in the last minute this is a hairline and
 * no number — a display that says "0" all day is a display nobody reads.
 */
const m = useMessages()
const { call } = useFidelityWorker()

const now = ref(Date.now())
const data = shallowRef<RateLedger | null>(null)

/** One tick per second of the last minute. */
const SECONDS = 60

const pulse = computed(() => {
  const rows = data.value?.minute ?? []
  const from = now.value - SECONDS * 1000
  const ticks = Array.from({ length: SECONDS }, () => 0)

  for (const row of rows) {
    const index = Math.floor((row.at - from) / 1000)
    if (index < 0 || index >= SECONDS) continue
    // 2 beats 1: a second that carried both shows as spent, because a slot
    // was taken in it.
    ticks[index] = Math.max(ticks[index] ?? 0, row.free ? 1 : 2)
  }
  return ticks
})

const busy = computed(() => (data.value?.minute.length ?? 0) > 0)
const spentThisMinute = computed(
  () => data.value?.minute.filter((row) => !row.free).length ?? 0,
)

/** Only the purposes that actually happened — an empty row says nothing. */
const rows = computed(() => {
  const found = data.value
  if (!found) return []
  return REQUEST_PURPOSES.map((purpose) => ({
    purpose,
    spent: found.spent[purpose],
    saved: found.saved[purpose],
  })).filter((row) => row.spent > 0 || row.saved > 0)
})

/** Roughly what the saved ones would have cost in waiting, at this pace. */
const savedMinutes = computed(() => {
  const found = data.value
  if (!found || found.savedTotal === 0) return 0
  return Math.max(1, Math.round(found.savedTotal / Math.max(1, found.ceiling)))
})

async function refresh() {
  try {
    data.value = await call('limit.now', undefined)
    now.value = Date.now()
  } catch {
    // The worker not answering is not something this corner of the screen
    // reports. It simply stays as it was.
  }
}

/*
 * Five seconds, and only while somebody is looking.
 *
 * The worker answers from memory, so this is cheap — but a timer that runs in
 * a hidden tab is a timer that wakes a phone for nothing.
 */
let timer: ReturnType<typeof setInterval> | null = null

function start() {
  if (timer !== null) return
  void refresh()
  timer = setInterval(() => void refresh(), 5000)
}

function stop() {
  if (timer === null) return
  clearInterval(timer)
  timer = null
}

function follow() {
  if (document.visibilityState === 'visible') start()
  else stop()
}

onMounted(() => {
  follow()
  document.addEventListener('visibilitychange', follow)
})

onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', follow)
})
</script>

<template>
  <details v-if="data" class="group relative">
    <summary
      class="fid-action flex cursor-pointer list-none items-center gap-2 rounded-fid-sm px-2 text-fid-text-muted transition-colors hover:text-fid-text"
      :class="busy ? 'fid-tonal' : ''"
      :aria-label="m.limit.spoken(spentThisMinute, data.ceiling)"
      :title="m.limit.spoken(spentThisMinute, data.ceiling)"
    >
      <!--
        The pulse. Aria-hidden because the summary above already says the same
        thing in words — two readings of one fact is one too many.
      -->
      <span class="flex h-3 items-end gap-px" aria-hidden="true">
        <span
          v-for="(tick, second) in pulse"
          :key="second"
          class="block w-px rounded-full"
          :class="[
            tick === 2 ? 'bg-fid-accent' : tick === 1 ? 'bg-fid-sig-catalog' : 'bg-fid-field',
            tick === 0 ? 'h-px' : 'h-3',
          ]"
        />
      </span>
      <span v-if="busy" class="fid-num text-fid-xs">{{ spentThisMinute }}</span>
    </summary>

    <div
      class="absolute right-0 z-30 mt-2 flex w-80 flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-4 shadow-fid-elev-2"
    >
      <p class="fid-plate text-fid-text-muted">{{ m.limit.session }}</p>

      <dl class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1 text-fid-sm">
        <template v-for="row in rows" :key="row.purpose">
          <dt class="min-w-0 truncate text-fid-text-muted">
            {{ m.limit.purposes[row.purpose] }}
          </dt>
          <dd class="fid-num text-right text-fid-text">{{ row.spent }}</dd>
          <dd class="fid-num text-right text-fid-sig-catalog">
            {{ row.saved > 0 ? `+${row.saved}` : '' }}
          </dd>
        </template>
      </dl>

      <p v-if="data.savedTotal > 0" class="text-fid-sm text-fid-sig-catalog">
        {{ m.limit.saved(count(data.savedTotal), savedMinutes) }}
      </p>

      <p class="text-fid-xs text-fid-text-muted">{{ m.limit.ceiling(data.ceiling) }}</p>
      <p class="text-fid-xs text-fid-text-muted">{{ m.limit.ours }}</p>
    </div>
  </details>
</template>

<style scoped>
/* Safari puts a disclosure triangle here that no other browser does. */
summary::-webkit-details-marker {
  display: none;
}
</style>
