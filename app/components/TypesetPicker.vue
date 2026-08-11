<script setup lang="ts">
import { useSettingsMessages } from '~/i18n/settings'

const st = useSettingsMessages()
const { current, apply, sets } = useTypeset()

/*
 * The specimen's price follows the interface language, because half of what it
 * is showing off is how the typeface sets a decimal separator — and that mark
 * is a comma in one language and a full stop in the other.
 */
const price = computed(() => money(14.99, 'EUR'))
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <!--
        The name is the name, the rest is description.

        A `<label>` wrapping all three lines makes the option's accessible name
        the whole block: "Presswerk Switzer · Chivo Mono · Array Narrow and
        technical, like the lettering on a record spine". Spoken aloud that is
        one option read as a paragraph, three times over, with the word that
        tells them apart buried at the front of each. `aria-labelledby` names
        it and `aria-describedby` carries the rest.
      -->
      <label v-for="set in sets" :key="set.key" class="flex items-start gap-3">
        <input
          type="radio"
          name="typeset"
          class="mt-1 size-4"
          :checked="current === set.key"
          :aria-labelledby="`typeset-${set.key}-label`"
          :aria-describedby="`typeset-${set.key}-about`"
          @change="apply(set.key)"
        />
        <span class="flex flex-col gap-1">
          <span :id="`typeset-${set.key}-label`" class="text-fid-sm text-fid-text">
            {{ set.label }}
          </span>
          <span :id="`typeset-${set.key}-about`" class="flex flex-col gap-1">
            <span class="fid-num text-fid-xs text-fid-text-muted">{{ set.hint }}</span>
            <span class="text-fid-xs text-fid-text-muted">
              {{ st.appearance.type[set.key] }}
            </span>
          </span>
        </span>
      </label>
    </div>

    <!--
      A specimen of the three things this app actually sets: a headline, a row
      of prose, and the numbers that carry most of its meaning.
    -->
    <div class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4">
      <p class="fid-display text-fid-xl font-bold text-fid-text">Fidelity</p>
      <p class="max-w-prose text-fid-sm text-fid-text-muted">
        {{ st.appearance.type.specimen }}
      </p>
      <p class="fid-num flex flex-wrap gap-x-4 text-fid-sm text-fid-text">
        <span>87</span><span>{{ price }}</span
        ><span>PFR 81</span><span>2018</span><span>0123456789</span>
      </p>
    </div>
  </section>
</template>
