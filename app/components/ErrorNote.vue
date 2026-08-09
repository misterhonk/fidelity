<script setup lang="ts">
const props = defineProps<{ cause: unknown }>()

const explained = computed(() => explain(props.cause))
const showDetail = ref(false)
</script>

<template>
  <div role="alert" class="flex flex-col gap-1">
    <p class="text-fid-sm text-fid-sig-scarcity">{{ explained.title }}</p>
    <p v-if="explained.action" class="text-fid-sm text-fid-text-muted">
      {{ explained.action }}
    </p>

    <!--
      The raw message stays reachable. Somebody debugging a genuinely new
      failure needs the words Discogs used, and hiding them behind a friendly
      sentence is how a real bug becomes unreportable.
    -->
    <template v-if="explained.detail">
      <button
        v-if="!showDetail"
        type="button"
        class="fid-action self-start text-fid-xs text-fid-text-muted underline underline-offset-4"
        @click="showDetail = true"
      >
        Was Discogs genau gesagt hat
      </button>
      <p v-else class="font-fid-mono text-fid-xs break-all text-fid-text-muted">
        {{ explained.detail }}
      </p>
    </template>
  </div>
</template>
