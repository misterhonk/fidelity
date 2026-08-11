<script setup lang="ts">
const m = useMessages()

/*
 * `useSeoMeta` is not reactive to a plain string, so the title is a getter —
 * otherwise the browser tab keeps the language the page was opened in after a
 * switch, which is the one place the old language would still be visible.
 */
useSeoMeta({ title: () => m.value.appearance.title })
</script>

<template>
  <SettingsPage :title="m.appearance.title">
    <!--
      No cards here. One page, one concern — a box around each part would be
      chrome saying what the heading already says.
    -->
    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ m.appearance.language.title }}</h2>
      <LanguagePicker />
    </section>

    <hr class="border-fid-border" />

    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ m.appearance.theme.title }}</h2>
      <ThemePicker />
    </section>

    <hr class="border-fid-border" />

    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ m.appearance.type.title }}</h2>
      <p class="text-fid-sm text-fid-text-muted">{{ m.appearance.type.about }}</p>
      <TypesetPicker />
    </section>
  </SettingsPage>
</template>
