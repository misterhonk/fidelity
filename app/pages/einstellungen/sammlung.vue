<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.library.title })
</script>

<template>
  <SettingsPage :title="m.settings.library.title" :lead="m.settings.library.lead">
    <!--
      Three steps of the same thing, in the order they happen: fetch the
      collection, unfold it, fetch the names behind it. Each is useful alone and
      each one makes the next one better, which is why they share a page.
    -->
    <SettingsCard anchor="library" :title="m.settings.library.fetch.title">
      <LibrarySync />
    </SettingsCard>

    <SettingsCard
      anchor="horizon"
      :title="m.settings.library.horizon.title"
      :description="m.settings.library.horizon.about"
    >
      <HorizonBuild />
    </SettingsCard>

    <SettingsCard
      anchor="credits"
      :title="m.settings.library.credits.title"
      :description="m.settings.library.credits.about"
    >
      <CreditHarvest />
    </SettingsCard>
  </SettingsPage>
</template>
