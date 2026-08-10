<script setup lang="ts">
useSeoMeta({ title: 'Sammlung' })
</script>

<template>
  <SettingsPage
    title="Sammlung"
    lead="Was Fidelity von Discogs weiß. Grundlage für alles Weitere."
  >
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
