<script setup lang="ts">
import { blocks } from '~/utils/release-notes'

/**
 * What is new in this release — in the app, not on GitHub.
 *
 * **What is shown is the hand-written lead and nothing else.** `CHANGELOG.md`
 * is 47 kB and three quarters of it is written for the repository;
 * "fix(deploy): the hub check checked nothing" says precisely nothing to
 * somebody using the app. Each release's lead is written by hand in the
 * release PR and is one or two kilobytes — it is cut out at build time
 * (`nuxt.config.ts`) and sits here as a string.
 *
 * A test holds that the running version has a lead. A release with not one
 * word to anybody therefore turns the PR red while it can still be written.
 */

const m = useMessages()
const { version, releaseNotes } = useRuntimeConfig().public

useSeoMeta({ title: () => m.value.news.title })

const parts = computed(() => blocks(String(releaseNotes ?? '')))

/**
 * Up to which release the notes are in German.
 *
 * They come from this project's commits and were never meant for a screen.
 * Since they are one, they fall under ADR-010 and are written in English — so
 * the note disappears of its own accord instead of becoming a line that stops
 * being true.
 */
const DEUTSCH_BIS = [0, 26, 0]

const nochDeutsch = computed(() => {
  const jetzt = String(version).split('.').map(Number)
  for (const [i, grenze] of DEUTSCH_BIS.entries()) {
    const part = jetzt[i] ?? 0
    if (part !== grenze) return part < grenze
  }
  return true
})
</script>

<template>
  <main class="fid-page py-10">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header class="flex flex-col gap-2">
        <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ m.news.title }}</h1>
        <p class="fid-num text-fid-sm text-fid-text-muted">{{ m.news.inVersion(version) }}</p>
      </header>

      <p v-if="parts.length === 0" class="text-fid-base text-fid-text-muted">
        {{ m.news.none }}
      </p>

      <div v-else class="flex flex-col gap-4">
        <template v-for="(block, i) in parts" :key="i">
          <p
            class="max-w-prose text-fid-base text-fid-text"
            :class="block.kind === 'bullet' ? 'border-l-2 border-fid-border pl-4' : ''"
          >
            <template v-for="(stueck, j) in block.pieces" :key="j">
              <strong v-if="stueck.kind === 'strong'" class="font-medium">{{
                stueck.text
              }}</strong>
              <code v-else-if="stueck.kind === 'code'" class="fid-num text-fid-sm">{{
                stueck.text
              }}</code>
              <a
                v-else-if="stueck.kind === 'link'"
                :href="stueck.href"
                target="_blank"
                rel="noopener noreferrer"
                class="fid-action text-fid-accent underline underline-offset-4"
                >{{ stueck.text }}</a
              >
              <template v-else>{{ stueck.text }}</template>
            </template>
          </p>
        </template>
      </div>

      <p v-if="nochDeutsch" class="max-w-prose text-fid-xs text-fid-text-muted">
        {{ m.news.german }}
      </p>

      <p class="text-fid-sm">
        <a
          :href="m.news.fullHref"
          target="_blank"
          rel="noopener noreferrer"
          class="fid-action text-fid-accent underline underline-offset-4"
          >{{ m.news.full }}</a
        >
      </p>
    </div>
  </main>
</template>
