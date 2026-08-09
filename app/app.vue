<script setup lang="ts">
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · Fidelity` : 'Fidelity'),
  htmlAttrs: { lang: 'de' },
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  ],
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
  <PwaUpdatePrompt />
</template>
