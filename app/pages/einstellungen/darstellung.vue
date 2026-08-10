<script setup lang="ts">
useSeoMeta({ title: 'Darstellung' })
</script>

<template>
  <SettingsPage title="Darstellung">
    <!--
      No cards here. One page, one concern — a box around each half would be
      chrome saying what the heading already says.
    -->
    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">Thema</h2>
      <ThemePicker />
    </section>

    <hr class="border-fid-border" />

    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">Schrift</h2>
      <p class="text-fid-sm text-fid-text-muted">
        Drei Sätze. Umschalten und einmal durch die Listen gehen.
      </p>
      <TypesetPicker />
    </section>
  </SettingsPage>
</template>
