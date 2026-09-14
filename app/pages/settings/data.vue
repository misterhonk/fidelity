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

    <!--
      Here and not under "appearance": an audio preview is not a question of
      how things look but the one place where, on request, something leaves
      this device (ADR-012). On the page called "take with you or get rid of",
      it stands in the right spot.
    -->
    <AudioPreviewToggle />
  </SettingsPage>
</template>
