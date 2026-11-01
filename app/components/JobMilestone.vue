<script setup lang="ts">
/**
 * The one live region of a running job, and it speaks once per tenth (#216).
 *
 * The bar and its counter beside it stay silent; this sentence changes only
 * when `milestone()` does, so a dig of a thousand pages is ten announcements.
 */
const props = defineProps<{ label: string; percent: number }>()
const m = useMessages()
const said = computed(() => m.value.common.progressAt(props.label, milestone(props.percent)))
</script>

<template>
  <p role="status" class="sr-only">{{ said }}</p>
</template>
