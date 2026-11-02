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
  // The bar's own scroll, not `scrollIntoView`: Chromium moves the Tab
  // starting point to the element it scrolls to, and the first Tab on the
  // screen then skipped the skip link and the nav (#227).
  const tab = bar.value?.querySelector('[data-current]')
  if (!bar.value || !tab) return
  const outer = bar.value.getBoundingClientRect()
  const inner = tab.getBoundingClientRect()
  bar.value.scrollLeft += inner.left - outer.left - (outer.width - inner.width) / 2
})

/**
 * Shelf · Wantlist · Places · Insights (#228): what you have, what you are
 * after, where it stands, and what it says. Giving each its own top-level
 * entry would have made seven where five already fill a phone.
 *
 * Full width on a phone, content width from a tablet up. A segmented control
 * stretched across 1680 pixels is four enormous buttons with nothing in them
 * — it stops reading as a switch and starts reading as a header.
 */
const TABS = [
  { to: '/collection', key: 'shelf', icon: 'shelf' },
  { to: '/wantlist', key: 'wantlist', icon: 'wantlist' },
  { to: '/places', key: 'places', icon: 'map-pin' },
  /** The map and the year, one tab with two views — both read the collection back to you. */
  { to: '/insights', key: 'insights', icon: 'map' },
] as const

/** Insights holds two views; the second row switches between them. */
const VIEWS = [
  { to: '/insights', key: 'map' },
  { to: '/insights/year', key: 'review' },
] as const

const isCurrent = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
const inInsights = computed(() => isCurrent('/insights'))
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
    scrolling the bar on mount makes sure the tab you are standing on is then visible.
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
      :data-current="isCurrent(tab.to) ? 'true' : undefined"
      :aria-current="isCurrent(tab.to) ? 'page' : undefined"
      class="fid-plate -mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 py-2 whitespace-nowrap transition-colors"
      :class="
        isCurrent(tab.to)
          ? 'border-fid-accent text-fid-text'
          : 'border-transparent text-fid-text-muted hover:text-fid-text'
      "
    >
      <FidIcon :name="tab.icon" :size="14" />
      {{ c.tabs[tab.key] }}
    </NuxtLink>
    <!--
      Watched is a filter, not a place (#228): the shelf and the wantlist, cut
      down to the records whose price is being followed. A chip at the end of
      the bar rather than a fifth tab, pressed while you look through it.
    -->
    <NuxtLink
      to="/watched"
      :data-current="route.path === '/watched' ? 'true' : undefined"
      :aria-current="route.path === '/watched' ? 'page' : undefined"
      class="fid-plate my-1 ml-auto flex min-h-9 shrink-0 items-center gap-2 self-center rounded-full border px-3 whitespace-nowrap transition-colors"
      :class="
        route.path === '/watched'
          ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
          : 'border-fid-border text-fid-text-muted hover:text-fid-text'
      "
    >
      <FidIcon name="eye" :size="14" />
      {{ c.tabs.watched }}
    </NuxtLink>
  </nav>
  <nav
    v-if="inInsights"
    :aria-label="c.tabs.insights"
    class="flex gap-5 self-stretch md:self-start"
  >
    <NuxtLink
      v-for="view in VIEWS"
      :key="view.to"
      :to="view.to"
      :aria-current="route.path === view.to ? 'page' : undefined"
      class="fid-plate flex min-h-11 items-center underline-offset-8 transition-colors"
      :class="
        route.path === view.to
          ? 'text-fid-text underline decoration-fid-accent decoration-2'
          : 'text-fid-text-muted hover:text-fid-text'
      "
    >
      {{ c.tabs[view.key] }}
    </NuxtLink>
  </nav>
</template>
