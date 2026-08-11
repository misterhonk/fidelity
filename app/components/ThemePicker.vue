<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()
const { preference, resolved, themes } = useTheme()
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="sr-only">{{ st.appearance.theme.title }}</legend>

    <div class="flex gap-1 self-start rounded-fid-md border border-fid-border p-1">
      <label
        v-for="key in themes"
        :key="key"
        class="cursor-pointer rounded-fid-sm px-4 py-2 text-fid-sm transition-colors"
        :class="
          preference === key
            ? 'bg-fid-surface-raised font-medium text-fid-text'
            : 'text-fid-text-muted hover:text-fid-text'
        "
      >
        <input v-model="preference" type="radio" name="theme" :value="key" class="sr-only" />
        {{ st.appearance.theme[key].label }}
      </label>
    </div>

    <p class="text-fid-xs text-fid-text-muted">
      {{ st.appearance.theme[preference].about }}
      <!--
        "System" alone does not say what it currently means, and it is the one
        option whose result you cannot work out by reading it.
      -->
      <template v-if="preference === 'system'">
        {{ st.appearance.theme.following(resolved) }}
      </template>
    </p>
  </fieldset>
</template>
