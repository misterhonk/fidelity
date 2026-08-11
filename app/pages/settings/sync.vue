<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.sync.title })
</script>

<template>
  <SettingsPage :title="st.sync.title" :lead="st.sync.lead">
    <VaultSettings />
  </SettingsPage>
</template>
