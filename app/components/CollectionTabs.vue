<script setup lang="ts">
import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()

const route = useRoute()

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
  { to: '/regal', key: 'shelf', icon: 'regal' },
  { to: '/landkarte', key: 'map', icon: 'map' },
  { to: '/wantlist', key: 'wantlist', icon: 'wantlist' },
] as const
</script>

<template>
  <nav
    :aria-label="c.tabs.label"
    class="flex gap-1 self-stretch rounded-fid-sm border border-fid-border p-1 @xl:self-start"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-fid-sm px-3 py-2 text-center text-fid-sm transition-colors @xl:flex-none @xl:px-6"
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
