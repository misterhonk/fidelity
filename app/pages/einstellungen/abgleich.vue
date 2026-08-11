<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.sync.title })
</script>

<template>
  <SettingsPage :title="m.settings.sync.title" :lead="m.settings.sync.lead">
    <VaultSettings />
  </SettingsPage>
</template>
