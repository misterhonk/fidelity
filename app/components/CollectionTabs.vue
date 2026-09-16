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
  { to: '/shelf', key: 'shelf', icon: 'shelf' },
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
  /** And a year of it at a time — what arrived, and what it says (M19 #8). */
  { to: '/review', key: 'review', icon: 'calendar' },
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
  <!--
    No frame since M26.1 (docs/05 §3a): the box around the tabs was the most
    conspicuous box in the head of every screen. The bar is now a line, the
    labels are plate, and the one you stand on is underlined in the accent —
    the same grammar as the main bar above it.
  -->
  <nav
    ref="bar"
    :aria-label="c.tabs.label"
    class="flex gap-5 self-stretch overflow-x-auto border-b border-fid-border md:gap-8 md:self-start md:overflow-visible"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :data-current="route.path === tab.to ? 'true' : undefined"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="fid-plate -mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 py-2 whitespace-nowrap transition-colors"
      :class="
        route.path === tab.to
          ? 'border-fid-accent text-fid-text'
          : 'border-transparent text-fid-text-muted hover:text-fid-text'
      "
    >
      <FidIcon :name="tab.icon" :size="14" />
      {{ c.tabs[tab.key] }}
    </NuxtLink>
  </nav>
</template>
