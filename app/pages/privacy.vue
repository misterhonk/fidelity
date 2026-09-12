<script setup lang="ts">
import { useLegalMessages } from '~/i18n/legal'

const l = useLegalMessages()

useSeoMeta({
  title: () => l.value.privacy.title,
  description: () => l.value.privacy.description,
})
</script>

<template>
  <AppPage narrow>
    <NuxtLink
      class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
      to="/"
    >
      {{ l.back }}
    </NuxtLink>

    <PageHeader :title="l.privacy.title" />

    <!--
        docs/09 §3: there is no server of ours, so there is little to declare —
        and the honest version of that is a short page, not a long one that
        pretends otherwise. Short is not the same as incomplete, though: every
        place data can go gets a heading here, including the four that only
        exist once somebody switches them on.
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
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.audio }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.audioBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.hub }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.hubBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.catalogue }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.catalogueBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.access }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.accessBody }}</p>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-fid-base font-medium text-fid-text">{{ l.privacy.hosting }}</h2>
      <p class="text-fid-base text-fid-text-muted">{{ l.privacy.hostingBody }}</p>
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
        <NuxtLink class="underline underline-offset-4" to="/legal">{{
          l.privacy.legalNotice
        }}</NuxtLink
        >.
      </p>
    </section>
  </AppPage>
</template>
