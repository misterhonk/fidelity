<script setup lang="ts">
/**
 * One row of choices, one of them in force (M32.2).
 *
 * The shelf and the dig both had a bar over their list — sort here, density
 * there, a count at the end — and the two had drifted into different shapes:
 * the shelf used plate words with an accent rule under the one in force, the
 * dig used small pills with a tinted fill, and each spelled out the name of
 * the group beside it ("Sort", "Density") where the other did not. Reported on
 * 2026-09-14: "the bar differs between the two pages, unify it."
 *
 * The shelf's shape won because it is the quieter of the two: an underline
 * marks a choice without spending a fill, and this app allows exactly one
 * unconditional accent fill per screen (`design-restraint.spec.ts`) — which on
 * a find list belongs to "add to basket", not to a sort.
 *
 * The group's name lives in `aria-label`, not beside it: a screen reader gets
 * "Sorting, Price, pressed", and the eye gets four words it can tell apart
 * without being told they are sorts.
 */
export interface PlateTab<K extends string> {
  key: K
  label: string
  /** The one-line explanation, under the pointer. */
  about?: string
  /** A direction arrow or similar, shown only on the one in force. */
  suffix?: string
  /** Spoken name where it says more than the label — "Last added, descending". */
  spoken?: string
}

defineProps<{
  /** Names the group for anything that reads the screen rather than sees it. */
  label: string
  options: PlateTab<string>[]
  value: string
  /** `nav` for an ordering, `group` for a choice that is not navigation. */
  as?: 'nav' | 'group'
}>()

const emit = defineEmits<{ select: [key: string] }>()
</script>

<template>
  <component
    :is="as === 'nav' ? 'nav' : 'div'"
    :role="as === 'nav' ? undefined : 'group'"
    :aria-label="label"
    class="flex flex-wrap gap-4"
  >
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      :aria-pressed="value === option.key"
      :aria-label="value === option.key ? option.spoken : undefined"
      :title="option.about"
      class="fid-plate min-h-9 border-b-2 whitespace-nowrap transition-colors"
      :class="
        value === option.key
          ? 'border-fid-accent text-fid-text'
          : 'border-transparent text-fid-text-muted hover:text-fid-text'
      "
      @click="emit('select', option.key)"
    >
      {{ option.label
      }}<span
        v-if="value === option.key && option.suffix"
        aria-hidden="true"
        class="ml-1 text-fid-text-muted"
        >{{ option.suffix }}</span
      >
    </button>
  </component>
</template>
