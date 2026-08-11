<script setup lang="ts">
import { useLegalMessages } from '~/i18n/legal'

const l = useLegalMessages()
const m = useMessages()

useSeoMeta({ title: () => l.value.legal.title, description: () => l.value.legal.description })
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
    <NuxtLink
      class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
      to="/"
    >
      {{ l.back }}
    </NuxtLink>

    <h1 class="fid-display text-fid-xl font-bold text-fid-text">{{ l.legal.title }}</h1>

    <p class="text-fid-base text-fid-text-muted">{{ l.legal.perStatute }}</p>

    <address class="flex flex-col gap-1 text-fid-base text-fid-text not-italic">
      <span>Martin Melcher</span>
      <a
        class="fid-action text-fid-accent underline underline-offset-4"
        href="https://github.com/misterhonk"
        target="_blank"
        rel="noopener noreferrer"
      >
        github.com/misterhonk
      </a>
    </address>

    <!-- Why no postal address is here: `app/i18n/legal.ts` says it. -->
    <p class="text-fid-sm text-fid-text-muted">
      {{ l.legal.about }}
    </p>

    <p class="text-fid-sm text-fid-text-muted">
      {{ m.nav.disclaimer }}
    </p>
  </main>
</template>
