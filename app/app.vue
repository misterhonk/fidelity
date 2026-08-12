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

/*
 * `lang` is not decoration. It tells a screen reader which voice to read the
 * page in, and a German sentence read by an English voice is not a slight
 * accent — it is unintelligible. The language plugin sets the attribute on
 * <html> directly before the first paint; this keeps the two from fighting when
 * the switch is used later.
 */
const { current: language } = useLanguage()

/** What the app is called, wherever a name is what is being asked for. */
const NAME = 'Fidelity'

useHead({
  /*
   * The name first, and on the welcome screen the name alone.
   *
   * Not a typographic preference — it is what "Add to Home Screen" reads.
   * iOS takes the document title of the page it is invited from, so a title
   * ending in the app name gave people an icon labelled "Willkommen" and a
   * suffix nobody would recognise. `apple-mobile-web-app-title` in
   * nuxt.config now answers that question outright, and this makes the
   * fallback answer the same thing.
   *
   * The cost is real and accepted: a tab strip of six screens now shares a
   * prefix, and a browser truncating from the right cuts the part that says
   * which screen it is. An app installed under the wrong name is worse than
   * a crowded tab strip.
   */
  titleTemplate: (title?: string) =>
    // The static title in nuxt.config is the bare name, so that an install
    // reading the delivered HTML finds it. Without this it would arrive here
    // like any page title and come back out as "Fidelity · Fidelity".
    !title || title === NAME ? NAME : `${NAME} · ${title}`,
  htmlAttrs: { lang: language },
  meta: [{ name: 'theme-color', content: themeColor }],
  /*
   * Icons und Manifest stehen in nuxt.config, nicht hier.
   *
   * `useHead` läuft beim Hydrieren; „Zum Home-Bildschirm" liest das statische
   * HTML und war deshalb blind dafür. Was ein Installationsvorgang braucht,
   * gehört in `app.head` — was sich zur Laufzeit ändert, hierher.
   */
})

/**
 * ⌘K, or Ctrl+K away from a Mac.
 *
 * The palette itself is a Lazy component behind `v-if`, so its code and the
 * three worker queries it makes land in their own chunk and cost nothing until
 * somebody actually presses the shortcut. The first paint has a budget and
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

/**
 * The keeper runs from the first screen on.
 *
 * Here rather than on the start page, because the person whose collection is a
 * week out of date is exactly the one who opens a bookmark straight to /basket.
 * It does nothing while a tab is hidden and nothing while something somebody
 * started is running (worker/keeper.ts).
 */
const keeper = useKeeper()

/*
 * The service worker is told which language to write a notification in.
 *
 * It cannot find out by itself: the choice lives in `localStorage`, and a
 * worker has none. Immediately and on every change, because a notification
 * arrives at a moment when nothing can be asked any more.
 */
const { tellLanguage } = usePush()
watch(language, (code) => void tellLanguage(code), { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  keeper.start()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  keeper.stop()
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <!--
    The bottom padding belongs on the shell, not on each page: the nav bar is
    fixed on phones and the footer sits outside <main>, so padding the pages
    left the attribution — which is a licence condition — hidden behind it.
  -->
  <!--
    Room for the fixed nav bar, measured rather than guessed.

    A flat `pb-20` was enough in a browser tab and not enough installed: in
    standalone mode the home indicator claims another 34px at the bottom, and
    the attribution — a licence condition — ended up underneath the bar. The
    padding has to carry the same safe-area term the bar's own does.
  -->
  <div class="flex min-h-dvh flex-col max-md:pb-[calc(env(safe-area-inset-bottom)+5rem)]">
    <AppNav />
    <!--
      In the column, not above it.
      It used to float — `fixed bottom-4` — which put it on top of whatever was
      underneath: a match card, the attribution in the footer, and on a phone
      the nav bar itself. "Later" is a valid answer to this notice, so it has
      no business covering the thing somebody is reading. In the flow, under
      the nav, it pushes the page down by its own height and hides nothing.
    -->
    <PwaUpdatePrompt />
    <NuxtPage />
    <SiteFooter />
  </div>
  <LazyCommandPalette v-if="paletteOpen" @close="paletteOpen = false" />
  <LazyReleaseSheet
    v-if="sheet.open.value"
    :key="sheet.open.value.listingId"
    :dig-id="sheet.open.value.digId"
    :listing-id="sheet.open.value.listingId"
    @close="sheet.hide()"
  />
</template>
