<script setup lang="ts">
const route = useRoute()

/**
 * Three views of one subject: the records, what they say about you, and the
 * ones still missing. Giving each its own top-level entry would have made
 * seven where five already fill a phone.
 */
const TABS = [
  { to: '/regal', label: 'Regal' },
  { to: '/landkarte', label: 'Landkarte' },
  { to: '/wantlist', label: 'Wantlist' },
] as const
</script>

<template>
  <nav aria-label="Sammlung" class="flex gap-1 rounded-fid-sm border border-fid-border p-1">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-current="route.path === tab.to ? 'page' : undefined"
      class="min-h-9 flex-1 rounded-fid-sm px-3 py-1.5 text-center text-fid-sm transition-colors"
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
