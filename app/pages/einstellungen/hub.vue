<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.hub.title })
</script>

<template>
  <SettingsPage :title="m.settings.hub.title" :lead="m.settings.hub.lead">
    <HubSettings />
  </SettingsPage>
</template>
