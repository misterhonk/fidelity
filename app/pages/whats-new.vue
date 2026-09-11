<script setup lang="ts">
import { bloecke } from '~/utils/release-notes'

/**
 * Was in dieser Ausgabe neu ist — in der App, nicht auf GitHub.
 *
 * **Gezeigt wird der handgeschriebene Vorspann und sonst nichts.** Die
 * `CHANGELOG.md` ist 47 kB groß und zu drei Vierteln für das Repository
 * geschrieben; „fix(deploy): die Hub-Prüfung hat nichts geprüft" sagt jemandem,
 * der die App benutzt, genau nichts. Der Vorspann jeder Ausgabe entsteht von
 * Hand im Release-PR und ist ein bis zwei Kilobyte — der wird zur Bauzeit
 * herausgeschnitten (`nuxt.config.ts`) und liegt als Zeichenkette bei.
 *
 * Ein Test hält fest, dass die laufende Version einen Vorspann hat. Ein
 * Release ohne ein Wort an die Leute macht damit den PR rot, solange man es
 * noch schreiben kann.
 */

const m = useMessages()
const { version, releaseNotes } = useRuntimeConfig().public

useSeoMeta({ title: () => m.value.news.title })

const teile = computed(() => bloecke(String(releaseNotes ?? '')))

/**
 * Bis wann die Notizen deutsch sind.
 *
 * Sie stammen aus den Commits dieses Projekts und waren nie für einen
 * Bildschirm gedacht. Seit sie einer sind, fallen sie unter ADR-010 und werden
 * englisch geschrieben — der Hinweis verschwindet damit von selbst, statt zu
 * einer Zeile zu werden, die irgendwann nicht mehr stimmt.
 */
const DEUTSCH_BIS = [0, 26, 0]

const nochDeutsch = computed(() => {
  const jetzt = String(version).split('.').map(Number)
  for (const [i, grenze] of DEUTSCH_BIS.entries()) {
    const teil = jetzt[i] ?? 0
    if (teil !== grenze) return teil < grenze
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

      <p v-if="teile.length === 0" class="text-fid-base text-fid-text-muted">
        {{ m.news.none }}
      </p>

      <div v-else class="flex flex-col gap-4">
        <template v-for="(block, i) in teile" :key="i">
          <p
            class="max-w-prose text-fid-base text-fid-text"
            :class="block.art === 'punkt' ? 'border-l-2 border-fid-border pl-4' : ''"
          >
            <template v-for="(stueck, j) in block.stuecke" :key="j">
              <strong v-if="stueck.art === 'stark'" class="font-medium">{{
                stueck.text
              }}</strong>
              <code v-else-if="stueck.art === 'code'" class="fid-num text-fid-sm">{{
                stueck.text
              }}</code>
              <a
                v-else-if="stueck.art === 'link'"
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
