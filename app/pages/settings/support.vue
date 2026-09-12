<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()

useSeoMeta({ title: () => st.value.support.title })
</script>

<template>
  <SettingsPage :title="st.support.title" :lead="st.support.lead">
    <!--
      The LightMe pattern (docs/17 §6.3): several yearly plans that all unlock
      the same comfort — you choose what the support is worth to you, not what
      you get — and tips below that unlock nothing. Nothing is charged during
      the beta; the list stands so the whole path can be walked.
    -->
    <section class="flex flex-col gap-3">
      <h2 class="text-fid-md font-medium text-fid-text">{{ st.supportPanel.plansTitle }}</h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ st.supportPanel.plansLead }}</p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="plan in st.supportPanel.plans"
          :key="plan.tier"
          class="grid grid-cols-[1fr_auto] items-baseline gap-x-4 rounded-fid-sm border border-fid-border px-4 py-3"
        >
          <span class="flex min-w-0 flex-col">
            <span class="text-fid-base font-medium text-fid-text">{{ plan.name }}</span>
            <span class="text-fid-sm text-fid-text-muted">{{ plan.line }}</span>
          </span>
          <span class="fid-num text-fid-sm text-fid-text">{{ plan.price }}</span>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-fid-md font-medium text-fid-text">{{ st.supportPanel.tipsTitle }}</h2>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ st.supportPanel.tipsLead }}</p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="tip in st.supportPanel.tips"
          :key="tip.name"
          class="grid grid-cols-[1fr_auto] items-baseline gap-x-4 rounded-fid-sm border border-fid-border px-4 py-3"
        >
          <span class="text-fid-sm text-fid-text">{{ tip.name }}</span>
          <span class="fid-num text-fid-sm text-fid-text">{{ tip.price }}</span>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4">
      <p class="text-fid-sm text-fid-text">{{ st.supportPanel.beta }}</p>
      <p class="text-fid-sm text-fid-text-muted">
        {{ st.supportPanel.howToGet }}
        <NuxtLink
          class="fid-action text-fid-accent underline underline-offset-4"
          to="/settings/access"
          >{{ st.supportPanel.toAccess }}</NuxtLink
        >
      </p>
    </section>
  </SettingsPage>
</template>
