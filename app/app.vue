<script setup lang="ts">
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · Fidelity` : 'Fidelity'),
  htmlAttrs: { lang: 'de' },
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
