<script setup lang="ts">
/**
 * The sleeve, spread out behind the head of a sheet (M26.2, M31.19).
 *
 * Not read off the pixels: `i.discogs.com` sends no CORS header (docs/02), so
 * a canvas that drew the cover would be tainted and refuse to say what it saw.
 * A blurred copy of the same cached picture does the job without asking — a
 * Saville sleeve tints the sheet blue, a Blue Note one orange — and nothing
 * leaves the device or is fetched twice.
 *
 * The plinth over it is not decoration either: a bright sleeve takes the
 * contrast out from under the type, and the head is the one place where the
 * words have to be the loudest thing on the screen.
 */
defineProps<{ src: string }>()
</script>

<template>
  <img
    :src="src"
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    class="absolute inset-0 size-full scale-150 object-cover opacity-45 blur-3xl"
  />
  <div class="absolute inset-0 bg-linear-to-b from-fid-surface/25 to-fid-surface" />
</template>
