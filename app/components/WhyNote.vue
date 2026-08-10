<script setup lang="ts">
defineProps<{
  /** The one word on the closed state. "Warum?" unless something fits better. */
  label?: string
}>()

/**
 * The reasoning, one click away.
 *
 * This app explains itself, and that is deliberate — a number without its
 * denominator is a claim, and docs/00 is built on not making claims. But the
 * explanation had ended up *in front of* the number: four lines of prose about
 * how lift is computed, and then the lift.
 *
 * So the paragraph stays and moves behind a disclosure. Somebody reading the
 * screen for the third time skips it; somebody wondering where a number came
 * from is one click from the answer.
 *
 * `<details>` rather than a popover: it is keyboard-operable, screen readers
 * announce its state, it survives with no JavaScript, and it costs nothing.
 */
</script>

<template>
  <details class="group">
    <summary
      class="fid-action w-fit cursor-pointer list-none text-fid-xs text-fid-text-muted underline decoration-dotted underline-offset-4 hover:text-fid-text"
    >
      {{ label ?? 'Warum?' }}
    </summary>
    <p class="mt-2 max-w-prose text-fid-sm text-fid-text-muted">
      <slot />
    </p>
  </details>
</template>

<style scoped>
/* Safari puts a disclosure triangle here that no other browser does. */
summary::-webkit-details-marker {
  display: none;
}
</style>
