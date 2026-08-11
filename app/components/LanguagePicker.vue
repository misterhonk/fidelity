<script setup lang="ts">
const m = useMessages()
const { current, apply, languages } = useLanguage()

/*
 * The radio is bound one way and switched by hand rather than through
 * `v-model`.
 *
 * Changing language means fetching a pack, and `v-model` would set the value
 * first and let the words arrive afterwards — a dot that jumps to "Deutsch"
 * over an interface still in English. Waiting for `apply()` means the mark and
 * the words move together, and the wait is a few milliseconds on anything but a
 * first switch over a bad connection.
 */
const entries = Object.entries(languages) as [keyof typeof languages, string][]
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="sr-only">{{ m.appearance.language.legend }}</legend>

    <div class="flex gap-1 self-start rounded-fid-md border border-fid-border p-1">
      <label
        v-for="[code, name] in entries"
        :key="code"
        class="cursor-pointer rounded-fid-sm px-4 py-2 text-fid-sm transition-colors"
        :class="
          current === code
            ? 'bg-fid-surface-raised font-medium text-fid-text'
            : 'text-fid-text-muted hover:text-fid-text'
        "
      >
        <input
          type="radio"
          name="language"
          class="sr-only"
          :value="code"
          :checked="current === code"
          @change="apply(code)"
        />
        <!--
          Each language written in itself, and marked as being in itself, so a
          screen reader says "Deutsch" with a German voice instead of reading it
          as an English word.
        -->
        <span :lang="code">{{ name }}</span>
      </label>
    </div>

    <p class="text-fid-xs text-fid-text-muted">{{ m.appearance.language.about }}</p>
  </fieldset>
</template>
