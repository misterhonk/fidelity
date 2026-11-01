<script setup lang="ts">
/**
 * "Data provided by Discogs", beside the data (docs/09 §1.2).
 *
 * The API terms ask for the notice *next to* what the API returned, linked to
 * the discogs.com page that shows it — the footer's homepage link alone does
 * not meet that. Small and muted on purpose: it is a condition of the licence,
 * not a call to action. No `nofollow`, which the terms rule out.
 */
defineProps<{ to: string }>()
const m = useMessages()
</script>

<template>
  <a
    :href="to"
    target="_blank"
    rel="noopener"
    class="text-fid-xs text-fid-text-muted underline underline-offset-4 hover:text-fid-text"
    >{{ m.nav.attribution }}</a
  >
</template>
