<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.access.title })
</script>

<template>
  <SettingsPage :title="st.access.title" :lead="st.access.lead">
    <AccessSettings />
  </SettingsPage>
</template>
