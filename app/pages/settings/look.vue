<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

/*
 * `useSeoMeta` is not reactive to a plain string, so the title is a getter —
 * otherwise the browser tab keeps the language the page was opened in after a
 * switch, which is the one place the old language would still be visible.
 */
useSeoMeta({ title: () => st.value.appearance.title })
</script>

<template>
  <SettingsPage :title="st.appearance.title">
    <!--
      No cards here. One page, one concern — a box around each part would be
      chrome saying what the heading already says.
    -->
    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">
        {{ st.appearance.language.title }}
      </h2>
      <LanguagePicker />
    </section>

    <hr class="border-fid-border" />

    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ st.appearance.theme.title }}</h2>
      <ThemePicker />
    </section>

    <hr class="border-fid-border" />

    <!--
      The audio preview's switch (ADR-012). It stood beside the search filters
      until #229; how a record sounds sits closer to how the screen looks than
      to what a dig looks for.
    -->
    <section id="listen" class="flex scroll-mt-20 flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ st.audio.title }}</h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ st.audio.lead }}</p>
      <AudioPreviewToggle />
    </section>
  </SettingsPage>
</template>
