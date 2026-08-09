<script setup lang="ts">
defineProps<{
  /** Anchor, so "next step" can point at one card rather than a whole page. */
  anchor?: string
  title: string
  /** One line saying what this is for, before anybody has to guess. */
  description?: string
  /** Set for anything destructive, so the shape warns before the text does. */
  danger?: boolean
}>()

const id = useId()
</script>

<template>
  <!--
    One card per concern.

    The settings used to be a stack of sections separated by a hairline, which
    read as one long form: nothing said where one thing ended and the next
    began, so everything looked equally important and equally urgent. A card
    with its own heading and one line of purpose is the cheapest way to say
    "this is a separate decision".
  -->
  <section
    :id="anchor"
    :aria-labelledby="id"
    class="flex scroll-mt-20 flex-col gap-4 rounded-fid-md border p-5"
    :class="
      danger
        ? 'border-fid-sig-scarcity/40 bg-fid-sig-scarcity/5'
        : 'border-fid-border bg-fid-surface'
    "
  >
    <div class="flex flex-col gap-1">
      <h2 :id="id" class="text-fid-base font-medium text-fid-text">{{ title }}</h2>
      <p v-if="description" class="text-fid-sm text-fid-text-muted">{{ description }}</p>
    </div>

    <slot />
  </section>
</template>
