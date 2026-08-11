<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.library.title })
</script>

<template>
  <SettingsPage :title="m.settings.library.title" :lead="m.settings.library.lead">
    <!--
      Three steps of the same thing, in the order they happen: hole die Sammlung,
      klappe sie auf, hole die Namen dahinter. Each is useful alone and each one
      makes the next one better, which is why they share a page.
    -->
    <SettingsCard anchor="library" title="Sammlung und Wantlist">
      <LibrarySync />
    </SettingsCard>

    <SettingsCard
      anchor="horizon"
      title="Horizont"
      description="Deine Sammlung einmal ausgeklappt. Danach kostet jeder Dig keine zusätzlichen Abfragen."
    >
      <HorizonBuild />
    </SettingsCard>

    <SettingsCard
      anchor="credits"
      title="Credits"
      description="Wer deine Lieblingsplatten gemacht hat – Produzenten, Engineers, Remixer."
    >
      <CreditHarvest />
    </SettingsCard>
  </SettingsPage>
</template>
