<script setup lang="ts">
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · Fidelity` : 'Fidelity'),
  htmlAttrs: { lang: 'de' },
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  ],
})

/**
 * ⌘K, or Ctrl+K away from a Mac.
 *
 * The palette itself is a Lazy component behind `v-if`, so its code and the
 * three worker queries it makes land in their own chunk and cost nothing until
 * somebody actually presses the shortcut. The first paint budget is 120 kB and
 * a search box nobody has opened yet does not belong in it.
 */
const paletteOpen = ref(false)

function onKeydown(event: KeyboardEvent) {
  if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
  <PwaUpdatePrompt />
  <LazyCommandPalette v-if="paletteOpen" @close="paletteOpen = false" />
</template>
