<script setup lang="ts">
import type { ValuePoint } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * Discogs' estimate, day by day, as a line (M19 #3).
 *
 * Drawn by hand as SVG — no chart library, the same rule as the bars beside
 * it (docs/12 §2). The middle estimate is the line; the lowest and highest
 * are the band around it, because a single figure reads as an appraisal and
 * the spread reads as what it is. Days are placed by date, not by index, so a
 * fortnight with no sync shows as a fortnight and not as one step.
 *
 * Only the days all three numbers could be read are drawn. A day the string
 * could not be parsed is left out rather than drawn at zero.
 */
const c = useCollectionMessages()
const props = defineProps<{ points: ValuePoint[] }>()

const W = 640
const H = 180
const PAD = { top: 8, right: 8, bottom: 8, left: 8 }

type Drawn = { x: number; lo: number; mid: number; hi: number; point: ValuePoint }

const usable = computed(() =>
  props.points.filter(
    (p) => p.minimumCents !== null && p.medianCents !== null && p.maximumCents !== null,
  ),
)

const drawn = computed<Drawn[]>(() => {
  const rows = usable.value
  if (rows.length < 2) return []

  const t0 = Date.parse(rows[0]!.day)
  const t1 = Date.parse(rows.at(-1)!.day)
  const span = Math.max(1, t1 - t0)
  const lo = Math.min(...rows.map((p) => p.minimumCents!))
  const hi = Math.max(...rows.map((p) => p.maximumCents!))
  const range = Math.max(1, hi - lo)

  const x = (day: string) =>
    PAD.left + ((Date.parse(day) - t0) / span) * (W - PAD.left - PAD.right)
  const y = (cents: number) => PAD.top + (1 - (cents - lo) / range) * (H - PAD.top - PAD.bottom)

  return rows.map((point) => ({
    x: x(point.day),
    lo: y(point.minimumCents!),
    mid: y(point.medianCents!),
    hi: y(point.maximumCents!),
    point,
  }))
})

const band = computed(() => {
  const d = drawn.value
  if (d.length === 0) return ''
  const top = d.map((p) => `${p.x.toFixed(1)},${p.hi.toFixed(1)}`)
  const bottom = [...d].reverse().map((p) => `${p.x.toFixed(1)},${p.lo.toFixed(1)}`)
  return [...top, ...bottom].join(' ')
})

const line = computed(() =>
  drawn.value.map((p) => `${p.x.toFixed(1)},${p.mid.toFixed(1)}`).join(' '),
)

const last = computed(() => drawn.value.at(-1) ?? null)
const first = computed(() => drawn.value[0] ?? null)

/** The axis, in words: the lowest and the highest the band reaches. */
const floor = computed(() => {
  const rows = usable.value
  if (rows.length < 2) return null
  const lo = Math.min(...rows.map((p) => p.minimumCents!))
  return money(lo / 100, rows.at(-1)!.currency)
})
const ceiling = computed(() => {
  const rows = usable.value
  if (rows.length < 2) return null
  const hi = Math.max(...rows.map((p) => p.maximumCents!))
  return money(hi / 100, rows.at(-1)!.currency)
})

const summary = computed(() => {
  const a = first.value
  const b = last.value
  if (!a || !b) return ''
  return c.value.map.history.summary(
    a.point.median,
    day(a.point.fetchedAt),
    b.point.median,
    day(b.point.fetchedAt),
  )
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="drawn.length === 0" class="text-fid-sm text-fid-text-muted">
      {{ c.map.history.onePoint }}
    </p>

    <template v-else>
      <div class="flex items-baseline justify-between gap-4 text-fid-xs text-fid-text-muted">
        <span class="fid-num">{{ ceiling }}</span>
        <span class="fid-num text-fid-sm text-fid-text">
          {{ c.map.history.now(last!.point.median) }}
        </span>
      </div>

      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="h-44 w-full"
        preserveAspectRatio="none"
        role="img"
        :aria-label="summary"
      >
        <!-- The band: lowest to highest. -->
        <polygon :points="band" fill="var(--fid-accent)" fill-opacity="0.14" />
        <!-- The line: the middle estimate. -->
        <polyline
          :points="line"
          fill="none"
          stroke="var(--fid-accent)"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
        <circle
          :cx="last!.x"
          :cy="last!.mid"
          r="4"
          fill="var(--fid-accent)"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <div class="flex items-baseline justify-between gap-4 text-fid-xs text-fid-text-muted">
        <span class="fid-num">{{ floor }}</span>
        <span class="fid-num"
          >{{ day(first!.point.fetchedAt) }} – {{ day(last!.point.fetchedAt) }}</span
        >
      </div>
    </template>
  </div>
</template>
