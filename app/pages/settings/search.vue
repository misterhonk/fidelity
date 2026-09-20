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
      <!--
        The search itself, beside its switch (M34.1). It stood at the foot of
        the shops screen; measured on 2026-09-11 the orders side finds shops
        that bought from *you*, so it is the friends half that finds anything,
        and that half is a setting.
      -->
      <DealerDiscovery :with-friends="false" />
    </SettingsCard>

    <!--
      The audio preview's switch (ADR-012), beside the "listen at" picker it
      belongs with. It stood under "Your data" until 2026-09-20 — the one
      place somebody looking at a record with clips on it would never look.
    -->
    <SettingsCard anchor="listen" :title="st.audio.title" :description="st.audio.lead">
      <AudioPreviewToggle />
    </SettingsCard>
  </SettingsPage>
</template>
