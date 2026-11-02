<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.advanced.title })
</script>

<template>
  <SettingsPage :title="st.advanced.title" :lead="st.advanced.lead">
    <!--
      What runs somewhere else and helps: the hub, and the catalogue under it —
      the same kind of optional helper, the same field, the same button. Nothing
      in the app needs either (CLAUDE.md, rule 8), so they sit apart from the
      settings everybody touches.
    -->
    <section id="hub" class="flex scroll-mt-20 flex-col gap-3">
      <h2 class="text-fid-md font-medium text-fid-text">{{ st.hub.title }}</h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ st.hub.lead }}</p>
      <HubSettings />
    </section>

    <section id="catalogue" class="flex scroll-mt-20 flex-col gap-3">
      <h2 class="mt-6 text-fid-md font-medium text-fid-text">{{ st.hub.catalogue }}</h2>
      <CatalogueSettings />
    </section>
  </SettingsPage>
</template>
