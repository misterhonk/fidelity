<script setup lang="ts">
/**
 * What a record is, at the top of every sheet that shows one (M31.20).
 *
 * The three sheets said the same thing three ways: the find's sheet had a
 * cover beside a grey box, the shelf's a cover beside a label-and-value table,
 * and the wantlist had no sheet at all. Reported on 2026-09-14 as "the records
 * still look far too different from one another", and they did — the same
 * record, opened from two screens, was two designs.
 *
 * One composition, three voices, so the eye sorts them without reading:
 *
 * - the **artist** in the text face, quiet, above;
 * - the **title** in the display face at the largest step this app has outside
 *   a page head — it is the name of the thing and it should look like it;
 * - the **facts** in mono, because catalogue numbers are characters and not
 *   words, and because one compares them rather than reading them.
 *
 * Long names are the case this is designed for rather than the case it hopes
 * against. "Hieroglyphic Being & The Configurative Or Modular Me Trio" is a
 * real artist and "Nightmares On Wax Presents Smokers Delight: Twenty Five
 * Years Later" a real title: two lines and three lines, balanced, hyphenated,
 * with the whole text under the pointer. The sleeve sits on the baseline of
 * that column, so a long name grows upward and never pushes what follows out
 * of the first look.
 */
defineProps<{
  cover: { thumbUrl: string; coverUrl: string } | null
  title: string | null
  /** Plain text; the `artist` slot wins where it has to be a link. */
  artist?: string | null
}>()
</script>

<template>
  <div class="relative -mx-6 shrink-0 border-b border-fid-border px-6 pb-6">
    <div class="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
      <img
        v-if="cover"
        :src="cover.coverUrl || cover.thumbUrl"
        alt=""
        loading="lazy"
        decoding="async"
        width="600"
        height="600"
        class="aspect-square w-full shrink-0 rounded-fid-cover bg-fid-inset object-cover sm:size-56 sm:w-56 lg:size-72 lg:w-72 xl:size-80 xl:w-80"
      />
      <!--
        And a sleeve-shaped hole where there is no sleeve. The masthead is a
        composition of two things; with one of them simply absent the type
        floats in an empty field and the head reads as broken rather than bare.
      -->
      <div
        v-else
        class="flex aspect-square w-full shrink-0 items-center justify-center rounded-fid-cover bg-fid-inset text-fid-text-muted sm:size-56 sm:w-56 lg:size-72 lg:w-72 xl:size-80 xl:w-80"
        aria-hidden="true"
      >
        <FidIcon name="platte" :size="56" />
      </div>

      <div class="flex min-w-0 grow flex-col gap-4 sm:basis-64">
        <div class="flex min-w-0 flex-col gap-1">
          <p
            v-if="$slots.artist || artist"
            class="line-clamp-2 text-fid-sm font-medium text-fid-text-muted"
            :title="artist ?? undefined"
          >
            <slot name="artist">{{ artist }}</slot>
          </p>
          <h2
            class="fid-display line-clamp-3 text-fid-xl leading-[1.08] font-bold tracking-tight text-balance hyphens-auto text-fid-text"
            :title="title ?? undefined"
          >
            {{ title }}
          </h2>
        </div>

        <slot name="facts" />
        <slot />
      </div>
    </div>
  </div>
</template>
