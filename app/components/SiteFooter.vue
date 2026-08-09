<script setup lang="ts">
const version = useRuntimeConfig().public.version
</script>

<template>
  <!--
    The attribution Discogs prescribes word for word (docs/09 §1.2). Both
    notices are mandatory and neither is paraphrased here — the wording is the
    licence condition, not a suggestion.

    The "Data provided by Discogs" link must not carry rel="nofollow", which is
    also spelled out. `noopener` is fine and is about window.opener, not about
    link equity.
  -->
  <footer class="mt-auto border-t border-fid-border">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-6">
      <p class="text-fid-xs text-fid-text-muted">
        <a
          class="underline underline-offset-4"
          href="https://www.discogs.com/"
          target="_blank"
          rel="noopener"
        >
          Data provided by Discogs
        </a>
      </p>

      <p class="text-fid-xs text-fid-text-muted">
        This application uses Discogs' API but is not affiliated with, sponsored or endorsed by
        Discogs. "Discogs" is a trademark of Zink Media, LLC.
      </p>

      <p class="flex flex-wrap gap-x-4 gap-y-1 text-fid-xs text-fid-text-muted">
        <NuxtLink class="underline underline-offset-4" to="/datenschutz">Datenschutz</NuxtLink>
        <NuxtLink class="underline underline-offset-4" to="/impressum">Impressum</NuxtLink>
        <span class="fid-num">v{{ version }}</span>
      </p>
    </div>
  </footer>
</template>
