<script setup lang="ts">
import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()

const route = useRoute()
const bar = useTemplateRef<HTMLElement>('bar')

/*
 * Bringing the current tab into view.
 *
 * Without it you land on "places" and see a bar that starts at "shelf" — the
 * tab you are standing on is off the edge. A screen whose own tab cannot be
 * seen reads as a screen with no tabs.
 */
onMounted(() => {
  bar.value
    ?.querySelector('[data-current]')
    ?.scrollIntoView({ block: 'nearest', inline: 'center' })
})

/**
 * Three views of one subject: the records, what they say about you, and the
 * ones still missing. Giving each its own top-level entry would have made
 * seven where five already fill a phone.
 *
 * Full width on a phone, content width from a tablet up. A segmented control
 * stretched across 1680 pixels is three enormous buttons with nothing in them
 * — it stops reading as a switch and starts reading as a header.
 */
const TABS = [
  { to: '/shelf', key: 'shelf', icon: 'regal' },
  { to: '/map', key: 'map', icon: 'map' },
  { to: '/wantlist', key: 'wantlist', icon: 'wantlist' },
  /*
   * And the fourth: the same collection, from the market's direction.
   *
   * Here and not in the main bar — five entries is the limit there. "Watched"
   * is not an area of its own but one more view of what you have and what you
   * are after.
   */
  { to: '/watched', key: 'watched', icon: 'eye' },
  { to: '/places', key: 'places', icon: 'map-pin' },
] as const
</script>

<template>
  <!--
    Icon above text, everywhere.

    Measured 2026-09-11: five tabs side by side need 435 px in a 343 px bar and
    overflow. Stacked they are 341 — the icon drops out of the width, and the
    same change that made the buttons in the stack legible makes the room here.

    **No more `@xl:` variants.** Those are container queries, and of the five
    pages carrying this bar only three have an `@container` — so the same bar
    looked different from page to page with nothing anywhere explaining it.
    Looked up on 2026-09-11, not assumed. What should depend on width now hangs
    off the window (`md:`); what should be the same everywhere hangs off
    nothing.

    `overflow-x-auto` stays in reserve for a language with longer words, and
    `scrollIntoView` makes sure the tab you are standing on is then visible.
  -->
  <nav
    ref="bar"
    :aria-label="c.tabs.label"
    class="flex gap-1 self-stretch overflow-x-auto rounded-fid-sm border border-fid-border p-1 md:self-start md:overflow-visible"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :data-current="route.path === tab.to ? 'true' : undefined"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="flex min-h-11 flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-fid-sm px-3 py-2 text-center text-fid-xs whitespace-nowrap transition-colors md:px-6"
      :class="
        route.path === tab.to
          ? 'bg-fid-accent/15 text-fid-text'
          : 'text-fid-text-muted hover:text-fid-text'
      "
    >
      <FidIcon :name="tab.icon" :size="16" />
      {{ c.tabs[tab.key] }}
    </NuxtLink>
  </nav>
</template>
