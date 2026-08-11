<script setup lang="ts">
/**
 * The sign above the shop.
 *
 * `/users/{name}` carries an `avatar_url` and a full dig fetches that endpoint
 * anyway, so this costs nothing (`worker/dig/scan.ts`). Most shops have set a
 * real one — all four in the demo list had, checked 2026-08-10.
 *
 * Where there is none, initials rather than a silhouette. Discogs' own default
 * is a grey outline of a person, which on a wall of shops turns into a row of
 * identical strangers; two letters at least tell them apart, and a shop with
 * no picture then looks like a shop with no picture instead of a broken one.
 */
const props = withDefaults(
  defineProps<{
    dealer: string
    avatarUrl?: string | null
    /** Pixels. The rest of the box follows. */
    size?: number
  }>(),
  { avatarUrl: null, size: 28 },
)

/**
 * Zwei Buchstaben aus dem Namen.
 *
 * Split on what shop names actually use — `schoenwettermusik`,
 * `430AM_Studio`, `spirax.records` — so the second letter comes from the
 * second word where there is one, rather than always being the second
 * character of the first.
 */
const initials = computed(() => {
  const parts = props.dealer.split(/[\s._-]+/).filter(Boolean)
  const first = parts[0] ?? props.dealer
  const second = parts[1]
  return ((first[0] ?? '') + (second?.[0] ?? first[1] ?? '')).toUpperCase()
})
</script>

<template>
  <img
    v-if="avatarUrl"
    :src="avatarUrl"
    alt=""
    loading="lazy"
    decoding="async"
    :width="size"
    :height="size"
    class="shrink-0 rounded-full bg-fid-inset object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-full bg-fid-inset font-medium text-fid-text-muted"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.4)}px`,
    }"
    aria-hidden="true"
  >
    {{ initials }}
  </span>
</template>
