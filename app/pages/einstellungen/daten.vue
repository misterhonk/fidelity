<script setup lang="ts">
const m = useMessages()

useSeoMeta({ title: () => m.value.settings.data.title })
</script>

<template>
  <SettingsPage :title="m.settings.data.title" :lead="m.settings.data.lead">
    <DataControls />
  </SettingsPage>
</template>
