<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.data.title })
</script>

<template>
  <SettingsPage :title="st.data.title" :lead="st.data.lead">
    <DataControls />

    <!--
      Here and not under "appearance": an audio preview is not a question of
      how things look but the one place where, on request, something leaves
      this device (ADR-012). On the page called "take with you or get rid of",
      it stands in the right spot.
    -->
    <AudioPreviewToggle />
  </SettingsPage>
</template>
