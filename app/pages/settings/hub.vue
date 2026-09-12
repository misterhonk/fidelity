<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.hub.title })
</script>

<template>
  <SettingsPage :title="st.hub.title" :lead="st.hub.lead">
    <HubSettings />
    <!--
      The catalogue lives under the hub, not beside it: the same kind of
      optional helper, the same field, the same button — one page for
      "what runs somewhere else and helps".
    -->
    <h2 class="mt-6 text-fid-md font-medium text-fid-text">{{ st.hub.catalogue }}</h2>
    <CatalogueSettings />
  </SettingsPage>
</template>
