<script setup lang="ts">
/**
 * The browser's own chrome has to move with the theme.
 *
 * The manifest names one `theme_color` and cannot name two, so an installed
 * app kept a black status bar over a white screen. This overrides it at
 * runtime with whichever end of the neutral ramp is actually on screen —
 * including when somebody picks light while the OS is dark, which a
 * `prefers-color-scheme` media attribute on the tag could not follow.
 */
const { resolved } = useTheme()
const themeColor = computed(() => THEME_COLORS[resolved.value])

useHead({
  titleTemplate: (title?: string) => (title ? `${title} · Fidelity` : 'Fidelity'),
  htmlAttrs: { lang: 'de' },
  meta: [{ name: 'theme-color', content: themeColor }],
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

// The sheet lives here rather than on the dig page: the shortlist and the long
// list both open it, and only ever one at a time.
const sheet = useReleaseSheet()

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
  <!--
    The bottom padding belongs on the shell, not on each page: the nav bar is
    fixed on phones and the footer sits outside <main>, so padding the pages
    left the attribution — which is a licence condition — hidden behind it.
  -->
  <div class="flex min-h-dvh flex-col max-md:pb-28">
    <AppNav />
    <NuxtPage />
    <SiteFooter />
  </div>
  <PwaUpdatePrompt />
  <LazyCommandPalette v-if="paletteOpen" @close="paletteOpen = false" />
  <LazyReleaseSheet
    v-if="sheet.open.value"
    :key="sheet.open.value.listingId"
    :dig-id="sheet.open.value.digId"
    :listing-id="sheet.open.value.listingId"
    @close="sheet.hide()"
  />
</template>
