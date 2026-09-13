<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.library.title })
</script>

<template>
  <SettingsPage :title="st.library.title" :lead="st.library.lead">
    <!--
      Three steps of the same thing, in the order they happen: fetch the
      collection, unfold it, fetch the names behind it. Each is useful alone and
      each one makes the next one better, which is why they share a page.
    -->
    <SettingsCard anchor="library" :title="st.library.fetch.title">
      <LibrarySync />
    </SettingsCard>

    <SettingsCard
      anchor="horizon"
      :title="st.library.horizon.title"
      :description="st.library.horizon.about"
    >
      <HorizonBuild />
    </SettingsCard>

    <SettingsCard
      anchor="credits"
      :title="st.library.credits.title"
      :description="st.library.credits.about"
    >
      <CreditHarvest />
    </SettingsCard>

    <!--
      And the fourth: the bands you own nothing by (M29).

      Here, with the other three, because it is the same subject from the other
      end — what the engine is allowed to match against. It feeds the horizon
      two cards up, which is why the card says so.
    -->
    <SettingsCard
      anchor="radar"
      :title="st.library.radar.title"
      :description="st.library.radar.about"
    >
      <FollowedArtists />
    </SettingsCard>
  </SettingsPage>
</template>
