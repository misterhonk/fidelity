<script setup lang="ts">
import type { Match } from '#shared/types'
import { useDigMessages } from '~/i18n/dig'

/**
 * A find as a spine in a crate (M31.22).
 *
 * The card is the app's argument — cover, name, and the sentence saying why
 * this record is in front of you. On a phone that argument is a whole screen
 * per record, and two hundred and fifty-nine finds are two hundred and
 * fifty-nine swipes. In a crate you see twenty spines at once and pull out the
 * ones whose sleeve stops you; this is that, and everything that is for
 * *comparing* lives one tap away in the sheet.
 *
 * So: the sleeve, the title, the artist, the price. Nothing else. The score is
 * deliberately absent — a number is a thing you weigh, and weighing is what
 * the other two densities are for.
 */
const props = defineProps<{ match: Match }>()

const d = useDigMessages()
const { show } = useReleaseSheet()
const { coverFor, watchCover } = useCovers()

const cover = computed(() => coverFor(props.match.releaseId, props.match.thumbUrl))
const root = useTemplateRef<HTMLElement>('root')
onMounted(() => watchCover(root.value, props.match.releaseId))

const price = computed(() => money(props.match.price, props.match.currency))
</script>

<template>
  <div ref="root" class="flex flex-col gap-1">
    <button
      type="button"
      class="fid-cover-button rounded-fid-cover"
      :aria-label="d.match.open(`${match.artist} – ${match.title}`)"
      @click="show(match.digId, match.listingId)"
    >
      <img
        v-if="cover"
        :src="cover.thumbUrl"
        alt=""
        loading="lazy"
        decoding="async"
        width="150"
        height="150"
        class="aspect-square w-full rounded-fid-cover bg-fid-inset object-cover"
      />
      <span
        v-else
        class="flex aspect-square w-full items-center justify-center rounded-fid-cover bg-fid-inset text-fid-text-muted"
        aria-hidden="true"
      >
        <FidIcon name="record" :size="28" />
      </span>
    </button>

    <!--
      Two lines for the title and one for the artist, both clamped: in a grid
      every tile has to be the same height or the rows comb, and a long name is
      not a reason for a row to be twice as tall as the one above it.
    -->
    <p class="fid-display line-clamp-2 text-fid-sm leading-tight font-semibold text-fid-text">
      {{ match.title }}
    </p>
    <p class="truncate text-fid-xs text-fid-text-muted">{{ match.artist }}</p>
    <p v-if="price" class="fid-num text-fid-xs text-fid-text">{{ price }}</p>
  </div>
</template>
