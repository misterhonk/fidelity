<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.hub.title })
</script>

<template>
  <SettingsPage :title="st.hub.title" :lead="st.hub.lead">
    <HubSettings />
  </SettingsPage>
</template>
