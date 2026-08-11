<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.help.title })
</script>

<template>
  <SettingsPage :title="st.help.title" :lead="st.help.lead">
    <!--
      Open, not folded away.

      A page somebody opened *because* they have a question should not make
      them guess which of eleven closed boxes holds it. It is a manual, and a
      manual is read by scanning.
    -->
    <div class="flex flex-col gap-8">
      <section v-for="chapter in st.chapters" :key="chapter.title" class="flex flex-col gap-2">
        <h2 class="text-fid-base font-medium text-fid-text">{{ chapter.title }}</h2>
        <p
          v-for="(paragraph, index) in chapter.body"
          :key="index"
          class="max-w-prose text-fid-sm text-fid-text-muted"
        >
          {{ paragraph }}
        </p>
      </section>

      <section class="flex flex-col gap-2 border-t border-fid-border pt-6">
        <h2 class="text-fid-base font-medium text-fid-text">{{ st.closing.title }}</h2>
        <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ st.closing.body }}</p>
        <p class="text-fid-xs text-fid-text-muted">{{ st.closing.disclaimer }}</p>
      </section>
    </div>
  </SettingsPage>
</template>
