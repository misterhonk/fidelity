<script setup lang="ts">
import { describeFormat } from '#shared/format'
import type { Match } from '#shared/types'

const props = defineProps<{ match: Match }>()

const { verdicts, judge } = useFeedback()
const verdict = computed(() => verdicts.value[props.match.listingId])

const { show } = useReleaseSheet()

const { coverFor, watchCover } = useCovers()
const cover = computed(() => coverFor(props.match.releaseId, props.match.thumbUrl))

const root = useTemplateRef<HTMLElement>('root')
onMounted(() => watchCover(root.value, props.match.releaseId))

/**
 * A shorthand, not the whole format.
 *
 * At 34 px this row already carries a score, a title, a reason and a price.
 * The one format token worth that space is what it physically is — `12"`,
 * `7"`, `CD` — because that is what somebody scanning four hundred rows is
 * sorting by in their head. Album or EP is a click away in the sheet.
 */
const shape = computed(() => {
  const { medium, size } = describeFormat(props.match.format)
  return size ?? medium
})

const price = computed(() => {
  const { price: value, currency } = props.match
  return money(value, currency)
})
</script>

<template>
  <!--
    The compact row: 34 px, per docs/05 §3. Density is a feature here because
    collectors want to see a lot at once, and a shelf of four hundred records
    is not readable as four hundred cards.

    The sentence survives the shrink, truncated to a line — a score without a
    reason is an insult in either density. The full one is a hover and a tap
    away in the detail sheet.
  -->
  <div
    ref="root"
    class="group grid h-[34px] scroll-mt-28 grid-cols-[1.75rem_2.25rem_1fr_auto] items-center gap-x-2 rounded-fid-sm px-2 hover:bg-fid-surface"
  >
    <!--
      Sechsundzwanzig Pixel Cover in einer 34-Pixel-Zeile.

      This mode is a table and stays one — but a table of records with no
      records in it is a spreadsheet. At this size the sleeve is not something
      you read, it is something you recognise: the colour alone tells you you
      have seen this pressing before, three hundred rows into a scan, faster
      than the title does.
    -->
    <img
      v-if="cover"
      :src="cover.thumbUrl"
      alt=""
      loading="lazy"
      decoding="async"
      width="26"
      height="26"
      class="size-[26px] shrink-0 rounded-[3px] bg-fid-inset object-cover"
    />
    <span
      v-else
      class="flex size-[26px] shrink-0 items-center justify-center rounded-[3px] bg-fid-inset text-fid-text-muted"
      aria-hidden="true"
    >
      <FidIcon name="platte" :size="14" />
    </span>

    <span
      class="fid-num text-fid-sm font-medium text-fid-text"
      :aria-label="`Barry Score ${match.score} von 100`"
    >
      {{ match.score }}
    </span>

    <p class="flex min-w-0 items-baseline gap-2">
      <button
        type="button"
        class="min-w-0 shrink truncate text-left text-fid-sm text-fid-text underline-offset-4 hover:underline"
        @click="show(match.digId, match.listingId)"
      >
        {{ match.artist }} – {{ match.title }}
      </button>
      <span class="truncate text-fid-xs text-fid-text-muted" :title="match.reason">
        {{ match.reason }}
      </span>
    </p>

    <span class="flex shrink-0 items-center gap-2">
      <span v-if="shape" class="fid-num shrink-0 text-fid-xs text-fid-text-muted">
        {{ shape }}
      </span>
      <span v-if="price" class="fid-num text-fid-sm text-fid-text-muted">{{ price }}</span>

      <!--
        Only the verdict already given stays visible when the row is at rest.
        Four buttons on every one of four hundred rows would be the noisiest
        thing on the screen; the rest appear on hover and on keyboard focus,
        which is what focus-within is here for.
      -->
      <span
        class="flex gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        :class="verdict ? 'opacity-100' : 'opacity-0'"
        role="group"
        aria-label="Wie war der Treffer?"
      >
        <button
          v-for="option in VERDICTS"
          :key="option.key"
          type="button"
          :title="option.label"
          :aria-label="option.label"
          :aria-pressed="verdict === option.key"
          class="min-h-6 min-w-6 rounded-fid-sm border text-fid-xs"
          :class="
            verdict === option.key ? 'border-fid-accent bg-fid-accent/15' : 'border-transparent'
          "
          @click="judge(match, option.key)"
        >
          <FidIcon :name="option.icon" :size="16" />
        </button>
      </span>
    </span>
  </div>
</template>
