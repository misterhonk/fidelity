<script setup lang="ts">
const route = useRoute()

/**
 * Two halves of one question.
 *
 * "Sammlung" in the main navigation covers both what you have and what you are
 * hunting — they are the same subject seen from either side, and giving the
 * wantlist its own top-level tab would have made six where five already fill a
 * phone. A segmented control inside the section is the standard answer.
 */
const TABS = [
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
