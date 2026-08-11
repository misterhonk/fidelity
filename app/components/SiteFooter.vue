<script setup lang="ts">
const { version, commit } = useRuntimeConfig().public
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
        <NuxtLink class="underline underline-offset-4" to="/privacy">Datenschutz</NuxtLink>
        <NuxtLink class="underline underline-offset-4" to="/legal">Impressum</NuxtLink>
        <!--
          The commit next to the version, because the version alone cannot
          answer "is this the build I just deployed". It only moves when a
          release is cut, and a service worker can serve an older shell for as
          long as somebody keeps tapping "Later".
        -->
        <span class="fid-num">
          v{{ version }}<template v-if="commit"> · {{ commit }}</template>
        </span>
      </p>
    </div>
  </footer>
</template>
