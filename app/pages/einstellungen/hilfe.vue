<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.help.title })
</script>

<template>
  <SettingsPage :title="st.help.title" :lead="st.help.lead">
    <!--
      Open, not folded away.

      A page somebody opened *because* they have a question should not make
      them guess which of eleven closed boxes holds it. It is a manual, and a
      manual is read by scanning.
    -->
    <div class="flex flex-col gap-8">
      <section v-for="chapter in st.chapters" :key="chapter.title" class="flex flex-col gap-2">
        <h2 class="text-fid-base font-medium text-fid-text">{{ chapter.title }}</h2>
        <p
          v-for="(paragraph, index) in chapter.body"
          :key="index"
          class="max-w-prose text-fid-sm text-fid-text-muted"
        >
          {{ paragraph }}
        </p>
      </section>

      <section class="flex flex-col gap-2 border-t border-fid-border pt-6">
        <h2 class="text-fid-base font-medium text-fid-text">Noch eine Frage offen?</h2>
        <p class="max-w-prose text-fid-sm text-fid-text-muted">
          Fidelity ist quelloffen einsehbar – wie es rechnet, steht im Code, und warum es so
          rechnet, in den Unterlagen daneben. Wer genauer wissen will, wie eine Punktzahl
          zustande kommt, findet das dort vollständig aufgeschrieben.
        </p>
        <p class="text-fid-xs text-fid-text-muted">
          Diese Anwendung nutzt die Discogs-API, steht aber in keiner Verbindung zu Discogs.
        </p>
      </section>
    </div>
  </SettingsPage>
</template>
