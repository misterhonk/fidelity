<script setup lang="ts">
const { preference, resolved, themes } = useTheme()

const current = computed(() => themes.find((theme) => theme.key === preference.value))

/*
 * "System" alone does not say what it currently means, and that is the one
 * option whose result you cannot see by reading it.
 */
const followed = computed(() => (resolved.value === 'dark' ? 'gerade dunkel' : 'gerade hell'))
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="sr-only">Thema</legend>

    <div class="flex gap-1 self-start rounded-fid-md border border-fid-border p-1">
      <label
        v-for="theme in themes"
        :key="theme.key"
        class="cursor-pointer rounded-fid-sm px-4 py-2 text-fid-sm transition-colors"
        :class="
          preference === theme.key
            ? 'bg-fid-surface-raised font-medium text-fid-text'
            : 'text-fid-text-muted hover:text-fid-text'
        "
      >
        <input
          v-model="preference"
          type="radio"
          name="theme"
          :value="theme.key"
          class="sr-only"
        />
        {{ theme.label }}
      </label>
    </div>

    <p class="text-fid-xs text-fid-text-muted">
      {{ current?.about }}
      <template v-if="preference === 'system'"> Auf diesem Gerät {{ followed }}.</template>
    </p>
  </fieldset>
</template>
