<script setup lang="ts">
const m = useMessages()
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
  <footer class="fid-page mt-auto border-t border-fid-border py-6">
    <div class="flex w-full max-w-3xl flex-col gap-2">
      <p class="text-fid-xs text-fid-text-muted">
        <a
          class="underline underline-offset-4"
          href="https://www.discogs.com/"
          target="_blank"
          rel="noopener"
        >
          {{ m.nav.attribution }}
        </a>
      </p>

      <p class="text-fid-xs text-fid-text-muted">
        {{ m.nav.disclaimer }}
      </p>

      <p class="flex flex-wrap gap-x-4 gap-y-1 text-fid-xs text-fid-text-muted">
        <NuxtLink class="underline underline-offset-4" to="/privacy">{{
          m.nav.privacy
        }}</NuxtLink>
        <NuxtLink class="underline underline-offset-4" to="/legal">{{ m.nav.legal }}</NuxtLink>
        <!--
          What this is beside the others (docs/15). In the footer because that
          is where a link from somebody else's "best vinyl apps" post lands a
          reader who wants the short version, and where a member finds it again.
        -->
        <NuxtLink class="underline underline-offset-4" to="/compared">{{
          m.nav.compared
        }}</NuxtLink>
        <!--
          The commit next to the version, because the version alone cannot
          answer "is this the build I just deployed". It only moves when a
          release is cut, and a service worker can serve an older shell for as
          long as somebody keeps tapping "Later".
        -->
        <!--
          The version leads to what it means.

          It stood here as dead text: a number that tells nobody what has
          changed. The commit beside it stays dead — that one answers "is this
          the build I just deployed", and there is no page for that.
        -->
        <span class="fid-num">
          <NuxtLink class="underline underline-offset-4" to="/whats-new">
            v{{ version }}
          </NuxtLink>
          <template v-if="commit"> · {{ commit }}</template>
        </span>
      </p>
    </div>
  </footer>
</template>
