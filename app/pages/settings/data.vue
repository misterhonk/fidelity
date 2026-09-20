<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()
const m = useMessages()

useSeoMeta({ title: () => st.value.data.title })
</script>

<template>
  <SettingsPage :title="st.data.title" :lead="st.data.lead">
    <DataControls />

    <!--
      What this device has asked Discogs for (M31.12).

      The header carries a pulse on a desktop and nothing on a phone — there is
      no room in that bar. Here the same numbers stand open and full width, on
      the page that is already about what this device holds and spends.
    -->
    <section class="flex flex-col gap-3">
      <h2 class="text-fid-base font-medium text-fid-text">{{ m.limit.title }}</h2>
      <RateMeter card />
    </section>
  </SettingsPage>
</template>
