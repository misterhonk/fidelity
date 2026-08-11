<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.search.title })
</script>

<template>
  <SettingsPage :title="st.search.title" :lead="st.search.lead">
    <!--
      Both halves of "what a dig looks at": which listings survive, and which
      shops get scanned in the first place. They were on opposite ends of a long
      page and are the same decision.
    -->
    <SettingsCard
      anchor="filter"
      :title="st.search.filter.title"
      :description="st.search.filter.about"
    >
      <MatchPreferences />
    </SettingsCard>

    <SettingsCard
      anchor="dealers"
      :title="st.search.dealers.title"
      :description="st.search.dealers.about"
    >
      <FriendImportToggle />
    </SettingsCard>
  </SettingsPage>
</template>
