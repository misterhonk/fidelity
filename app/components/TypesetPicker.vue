<script setup lang="ts">
const { current, apply, sets } = useTypeset()
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <label v-for="set in sets" :key="set.key" class="flex items-start gap-3">
        <input
          type="radio"
          name="typeset"
          class="mt-1 size-4"
          :checked="current === set.key"
          @change="apply(set.key)"
        />
        <span class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text">{{ set.label }}</span>
          <span class="fid-num text-fid-xs text-fid-text-muted">{{ set.hint }}</span>
          <span class="text-fid-xs text-fid-text-muted">{{ set.about }}</span>
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
        Du hast 5 Platten von Robag Wruhme – diese nicht. Außerdem: Stil passt (Minimal), nur 3
        im Angebot.
      </p>
      <p class="fid-num flex flex-wrap gap-x-4 text-fid-sm text-fid-text">
        <span>87</span><span>14,99 €</span><span>PFR 81</span><span>2018</span
        ><span>0123456789</span>
      </p>
    </div>
  </section>
</template>
