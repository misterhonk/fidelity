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
      title="Wonach gesucht wird"
      description="Was gar nicht erst auftaucht, und was nur weiter unten landet."
    >
      <MatchPreferences />
    </SettingsCard>

    <SettingsCard
      anchor="dealers"
      title="Woher die Läden kommen"
      description="Welche Quellen der Import lesen darf."
    >
      <FriendImportToggle />
    </SettingsCard>
  </SettingsPage>
</template>
