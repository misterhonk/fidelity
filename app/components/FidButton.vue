<script setup lang="ts">
import type { IconName } from '~/utils/icons'

/**
 * The one button (#221): four tiers, nothing else.
 *
 * - **primary** — filled. The one thing a screen is for; one per screen
 *   (`tests/unit/design-restraint.spec.ts` counts them).
 * - **secondary** — tonal: the same accent, quieter. For the reversible
 *   companions beside the primary one.
 * - **tertiary** — a line of text that acts. Sentence case, never the plate's
 *   mono capitals: a plate is a reading, and a reading you can press looks
 *   like a label that happens to be clickable.
 * - **destructive** — outlined, because red is a warning and not a button.
 *   Always followed by an undo line on the screen that uses it; the unit test
 *   holds every caller to that.
 *
 * Under `pointer: coarse` every tier is at least 44 px square — a thumb, not a
 * cursor (WCAG 2.5.5 rather than the 24 px floor of 2.5.8).
 *
 * With `icon`, the slot is the label: shown beside the icon on a phone, where
 * a bare arrow is a guess, and read to a screen reader only from `md` up.
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive'
    size?: 'md' | 'lg'
    /** A route makes it a NuxtLink that looks like this button. */
    to?: string | null
    icon?: IconName | null
  }>(),
  { variant: 'primary', size: 'md', to: null, icon: null },
)

// Resolved in setup: in a template expression a production build hands back
// the string 'NuxtLink' (see CoverTile.vue).
const NuxtLinkTag = resolveComponent('NuxtLink')

const tier = computed(() => {
  const box =
    props.size === 'lg'
      ? 'rounded-fid-md px-6 py-3 text-fid-base'
      : 'rounded-fid-sm px-4 py-2 text-fid-sm'
  return {
    primary: `fid-fill ${box} bg-fid-accent-fill font-medium text-fid-on-accent`,
    secondary: `fid-tonal ${box} font-medium`,
    destructive: `${box} border border-fid-border text-fid-text transition-colors hover:border-fid-error hover:text-fid-error`,
    tertiary:
      'text-fid-sm text-fid-text-muted underline underline-offset-4 transition-colors hover:text-fid-text',
  }[props.variant]
})
</script>

<template>
  <component
    :is="to ? NuxtLinkTag : 'button'"
    :to="to ?? undefined"
    :type="to ? undefined : 'button'"
    class="fid-button inline-flex items-center gap-2 disabled:opacity-50"
    :class="tier"
  >
    <FidIcon v-if="icon" :name="icon" :size="16" />
    <span v-if="icon" class="md:sr-only"><slot /></span>
    <slot v-else />
  </component>
</template>

<style scoped>
.fid-button {
  min-height: var(--fid-chip-min-target);
  /* Never the plate's mono capitals, even inside a plate. */
  font-family: var(--fid-font-sans);
  letter-spacing: normal;
  text-transform: none;
}

@media (pointer: coarse) {
  .fid-button {
    min-height: 44px;
    min-width: 44px;
  }
}

/*
 * The filled surface — lives here and nowhere else (#221).
 *
 * Three things, none of them loud: a light fall from top to bottom so the
 * surface has a direction, a one-pixel inner highlight along the top edge
 * where the light would catch, and a shadow that grows on hover and collapses
 * on press — a physical key rather than a coloured rectangle. Mixed from the
 * tokens, so a change to the accent carries through.
 *
 * It used to be a global class, and twenty call sites each spelled out their
 * own padding around it. Now it is a tier of this component.
 */
.fid-fill {
  background-image: linear-gradient(
    to bottom,
    color-mix(in oklch, var(--fid-white) 16%, transparent),
    transparent 55%
  );
  box-shadow:
    var(--shadow-fid-elev-1),
    inset 0 1px 0 color-mix(in oklch, var(--fid-white) 22%, transparent);
  transition:
    box-shadow var(--fid-motion-feedback) ease,
    transform 0.12s ease,
    filter var(--fid-motion-feedback) ease;
}

.fid-fill:hover:not(:disabled) {
  box-shadow:
    var(--shadow-fid-elev-2),
    inset 0 1px 0 color-mix(in oklch, var(--fid-white) 26%, transparent);
  filter: brightness(1.06);
}

/* Down, and the shadow goes with it — the press has to cost something. */
.fid-fill:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: inset 0 1px 3px color-mix(in oklch, black 30%, transparent);
}

.fid-fill:disabled {
  background-image: none;
  box-shadow: none;
}
</style>
