<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.data.title })
</script>

<template>
  <SettingsPage :title="st.data.title" :lead="st.data.lead">
    <DataControls />

    <!--
      Hier und nicht unter „Darstellung": eine Hörprobe ist keine Frage des
      Aussehens, sondern die eine Stelle, an der auf Wunsch etwas dieses Gerät
      verlässt (ADR-012). Auf der Seite, die „mitnehmen oder loswerden" heißt,
      steht sie am richtigen Ort.
    -->
    <AudioPreviewToggle />
  </SettingsPage>
</template>
