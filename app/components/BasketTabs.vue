<script setup lang="ts">
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
  { to: '/korb', label: 'Der Korb' },
  { to: '/gemerkt', label: 'Gemerkt' },
] as const
</script>

<template>
  <nav
    aria-label="Kaufen"
    class="flex gap-1 self-stretch rounded-fid-sm border border-fid-border p-1 @xl:self-start"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="min-h-9 flex-1 rounded-fid-sm px-3 py-1.5 text-center text-fid-sm transition-colors @xl:flex-none @xl:px-6"
      :class="
        route.path === tab.to
          ? 'bg-fid-accent/15 text-fid-text'
          : 'text-fid-text-muted hover:text-fid-text'
      "
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
