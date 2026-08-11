<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.search.title })
</script>

<template>
  <SettingsPage :title="m.settings.search.title" :lead="m.settings.search.lead">
    <!--
      Both halves of "what a dig looks at": which listings survive, and which
      shops get scanned in the first place. They were on opposite ends of a long
      page and are the same decision.
    -->
    <SettingsCard
      anchor="filter"
      :title="m.settings.search.filter.title"
      :description="m.settings.search.filter.about"
    >
      <MatchPreferences />
    </SettingsCard>

    <SettingsCard
      anchor="dealers"
      :title="m.settings.search.dealers.title"
      :description="m.settings.search.dealers.about"
    >
      <FriendImportToggle />
    </SettingsCard>
  </SettingsPage>
</template>
