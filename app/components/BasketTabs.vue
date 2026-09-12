<script setup lang="ts">
import { useBasketMessages } from '~/i18n/basket'

const b = useBasketMessages()

const route = useRoute()

/**
 * Two halves of buying.
 *
 * The basket is one shop, right now, with postage worked out. The shortlist is
 * every shop, over months, with nothing worked out yet — the records you said
 * yes to and have not bought. Same section of the app, different time horizon,
 * so the same segmented control the collection already uses (docs/05 §3).
 */
const TABS = [
  { to: '/basket', key: 'basket' },
  { to: '/saved', key: 'saved' },
] as const
</script>

<template>
  <!-- The same line the collection tabs draw (M26.1): plate labels, one underlined. -->
  <nav
    :aria-label="b.tabs.label"
    class="flex gap-5 self-stretch border-b border-fid-border md:gap-8 md:self-start"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="fid-plate -mb-px flex min-h-11 shrink-0 items-center border-b-2 py-2 whitespace-nowrap transition-colors"
      :class="
        route.path === tab.to
          ? 'border-fid-accent text-fid-text'
          : 'border-transparent text-fid-text-muted hover:text-fid-text'
      "
    >
      {{ b.tabs[tab.key] }}
    </NuxtLink>
  </nav>
</template>
