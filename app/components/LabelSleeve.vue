<script setup lang="ts">
/**
 * A cover, or a die-cut sleeve with the label showing through (#220).
 *
 * The one placeholder for a record without a picture. There used to be three
 * — a disc icon, an empty grey square, and the browser's broken-image glyph
 * whenever a cover failed to decode (a Cloudflare 429 on i.discogs.com, docs/02).
 * A failed image now falls back to the sleeve too.
 *
 * The image is never fetched actively: `loading="lazy"` and nothing else.
 * Size, shape and corners come from the caller's class, on either element.
 */
const props = defineProps<{
  src?: string | null
  srcset?: string
  sizes?: string
  label?: string | null
  catno?: string | null
}>()

const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)

const colour = computed(() => labelColour(props.label))
</script>

<template>
  <img
    v-if="src && !failed"
    :src="src"
    :srcset="srcset"
    :sizes="sizes"
    alt=""
    loading="lazy"
    decoding="async"
    @error="failed = true"
  />
  <div
    v-else
    class="@container relative overflow-hidden bg-fid-inset"
    data-testid="label-sleeve"
    aria-hidden="true"
  >
    <div
      class="absolute inset-[18%] flex flex-col items-center justify-center gap-[3cqw] rounded-full p-[12%] text-center leading-tight"
      :style="{ background: colour.paper, color: colour.ink }"
    >
      <!-- Below about 5rem the words would be specks; the colour alone still says which label. -->
      <span
        v-if="label"
        class="hidden text-[9cqw] font-semibold break-words @min-[5rem]:line-clamp-2"
        >{{ label }}</span
      >
      <span
        v-if="catno"
        class="fid-num hidden max-w-full truncate text-[7cqw] @min-[5rem]:block"
        >{{ catno }}</span
      >
    </div>
  </div>
</template>
