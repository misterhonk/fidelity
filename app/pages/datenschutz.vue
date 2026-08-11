<script setup lang="ts">
import { useLegalMessages } from '~/i18n/legal'

const l = useLegalMessages()

useSeoMeta({
  title: () => l.value.privacy.title,
  description: () => l.value.privacy.description,
})
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
    <NuxtLink
      class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
      to="/"
    >
      {{ l.back }}
    </NuxtLink>

    <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ l.privacy.title }}</h1>

    <!--
      docs/09 §3: there is no server, so there is almost nothing to declare.
      The honest version of that is a short page, not a long one that pretends
      otherwise.
    -->
    <p class="text-fid-base text-fid-text">{{ l.privacy.lead }}</p>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.onDevice }}</h2>
      <ul class="flex list-disc flex-col gap-1 pl-5 text-fid-base text-fid-text-muted">
        <li v-for="item in l.privacy.items" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.connections }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.connectionsBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.marketplace }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.marketplaceBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.deleting }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.deletingBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.responsible }}</h2>
      <p class="text-fid-base text-fid-text-muted">
        {{ l.privacy.seeLegal }}
        <NuxtLink class="underline underline-offset-4" to="/impressum">{{
          l.privacy.legalNotice
        }}</NuxtLink
        >.
      </p>
    </section>
  </main>
</template>
