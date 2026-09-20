<script setup lang="ts">
import { describeFormat } from '#shared/format'
import { FEW_PRESSINGS, type Match } from '#shared/types'
import { reasonFor } from '~/i18n/reason'
import { pressingText, stampText } from '~/i18n/pressing'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const props = defineProps<{ match: Match }>()

const { verdicts, judge } = useFeedback()

/** Saving is what you do while flipping; "bought" belongs where an order is. */
const CARD_VERDICTS = SHOWN_VERDICTS.filter((option) => option.key === 'interesting')
const verdict = computed(() => verdicts.value[props.match.listingId])

const { show } = useReleaseSheet()
const { contains, toggle } = useBasket()

/**
 * The cover, and the request for it as soon as the card comes into view.
 *
 * Asked for here rather than by the list, because only the card knows when it
 * is actually on screen — and each one costs a request (worker/covers.ts).
 */
const { coverFor, watchCover } = useCovers()
const cover = computed(() => coverFor(props.match.releaseId, props.match.thumbUrl))

const root = useTemplateRef<HTMLElement>('root')
onMounted(() => watchCover(root.value, props.match.releaseId))

const price = computed(() => {
  const { price: value, currency } = props.match
  return money(value, currency)
})

/*
 * The same record with its postage — provided by the dig page, absent
 * everywhere else this card is rendered. Two strings: the number, and the
 * sentence behind it for anyone who hovers or is read the title.
 */
const { of: landedOf } = useLanded()
const landed = computed(() => landedOf(props.match))
const landedText = computed(() => {
  const total = landed.value ? money(landed.value.total, landed.value.currency) : null
  return total ? d.value.landed.with(total) : null
})
const landedWhy = computed(() => {
  if (!landed.value) return undefined
  const postage = money(landed.value.postage, landed.value.currency)
  if (!postage) return undefined
  const source = landed.value.source ? d.value.landed.sources[landed.value.source] : ''
  return d.value.landed.why(postage, landed.value.items, source)
})

/**
 * Label, Nummer, Format, Jahr.
 *
 * The format was missing and it is most of the decision: `7", Single` and
 * `CD, Album` are not the same purchase at any price. Shown as the two facts
 * worth a glance — what it is made of and what kind of release it is — while
 * mono, deluxe, reissue and remastered stay in the pressing profile, where
 * somebody who wants them goes looking.
 */
const meta = computed(() => {
  const { medium, kind, size } = describeFormat(props.match.format)
  const format = [size ?? medium, kind].filter(Boolean).join(' ')
  return [
    // A later full dig no longer saw it (M36): said first, in the plate face.
    props.match.goneAt ? d.value.match.gone : null,
    props.match.label,
    props.match.catno,
    format || null,
    props.match.year,
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <!--
    The sleeve carries the card (M26.2, docs/05 §3.1).

    Until 2026-09-12 the cover was 72 px beside eight lines of text — a
    thumbnail on a form. Now it takes forty per cent of the card from a
    tablet up and the full width on a phone, the title stands in the display
    face, the facts are a plate, and the sentence keeps its width. Nothing is
    fetched that was not fetched before: the 600 px address was in the srcset
    all along, and the browser picks it now because the box is big enough to
    want it.

    No frame around the card. It separates itself from its neighbour by the
    cover and the gap, the way sleeves do in a crate.
  -->
  <article
    ref="root"
    class="fid-lift @container flex scroll-mt-28 flex-col gap-4 rounded-fid-md bg-fid-surface p-4"
  >
    <div class="grid gap-4 @md:grid-cols-[minmax(10rem,40%)_1fr]">
      <!--
        The cover is fetched by the browser, lazily and only in the viewport.
        i.discogs.com has its own Cloudflare limit that has nothing to do with
        the API budget, so it is never fetched actively.

        Where the address comes from is the interesting part: not from the
        match. `/users/{u}/inventory` returns `release.thumbnail` as an empty
        string — 1.200 of 1.200 rows across four shops, measured 2026-08-10 —
        so `match.thumbUrl` has been null for every find this app ever made.
        The picture comes from the shared store instead (app/composables/useCovers).

        The cover opens the record, because the cover is what a person reaches
        for. Not a whole-card click: that would swallow the Discogs link and
        the verdict buttons.
      -->
      <button
        v-if="cover"
        type="button"
        class="fid-cover-button aspect-square w-full overflow-hidden rounded-fid-cover bg-fid-inset"
        :aria-label="d.match.open(`${match.artist} – ${match.title}`)"
        @click="show(match.digId, match.listingId)"
      >
        <img
          :src="cover.thumbUrl"
          :srcset="
            cover.coverUrl ? `${cover.thumbUrl} 150w, ${cover.coverUrl} 600w` : undefined
          "
          sizes="(min-width: 48rem) 20rem, 100vw"
          alt=""
          loading="lazy"
          decoding="async"
          width="600"
          height="600"
          class="size-full object-cover"
        />
      </button>
      <!--
        No cover is the normal case, not a failure: Discogs has no image for
        plenty of small pressings, and images are never fetched actively
        (docs/02, the separate Cloudflare limit). A record standing in for one
        says "nothing to show here" where an empty grey square said "still
        loading" for as long as somebody was willing to wait.
      -->
      <div
        v-else
        class="flex aspect-square w-full items-center justify-center rounded-fid-cover bg-fid-inset text-fid-text-muted"
        aria-hidden="true"
      >
        <FidIcon name="record" :size="48" />
      </div>

      <div class="flex min-w-0 flex-col gap-2">
        <!--
          The title is the way in, and it says the artist too — as its own
          line for the eye, and as "artist – title" for anything that reads
          the button's name.
        -->
        <button
          type="button"
          class="flex flex-col items-start gap-1 text-left"
          @click="show(match.digId, match.listingId)"
        >
          <span class="text-fid-base text-fid-text">{{ match.artist }}</span>
          <span class="sr-only"> – </span>
          <span
            class="fid-display text-fid-xl leading-tight font-bold text-fid-text underline decoration-fid-border decoration-1 underline-offset-4 transition-colors hover:decoration-fid-accent"
          >
            {{ match.title }}
          </span>
        </button>
        <!--
          The sentence under the title, the facts under the sentence.

          A card is read top to bottom in about a second: the sleeve stops you,
          the title says what it is, and then comes the one line this app exists
          to write — *why this record is in front of you*. A mono line of label
          and catalogue number between the two was a comparison table
          interrupting a sentence.

          Never truncated. The sentence is the product.
        -->
        <p class="max-w-prose text-fid-base text-fid-text">{{ reasonFor(match.signals) }}</p>
        <p v-if="meta" class="fid-plate text-fid-text-muted">{{ meta }}</p>

        <!--
          Rare, per the catalogue (M20 #6): an album with five pressings or fewer
          does not come round again the way one with a hundred and sixty does. A
          hint, not a signal — the score is what the marketplace says is for sale.
        -->
        <p
          v-if="
            match.pressings !== null &&
            match.pressings !== undefined &&
            match.pressings <= FEW_PRESSINGS
          "
          class="text-fid-sm text-fid-sig-scarcity"
        >
          {{ d.match.fewPressings(match.pressings) }}
        </p>

        <!--
          What this pressing is (M7). Never says a reissue is bad — plenty of
          people want the 180 g remaster — only what the record is, so the price
          can be judged against the right thing.
        -->
        <ul v-if="match.pressingWarnings?.length" class="flex flex-col gap-1">
          <li
            v-for="warning in match.pressingWarnings"
            :key="warning.kind + (warning.facts.special ?? '')"
            class="text-fid-sm"
            :class="warning.severity === 'high' ? 'text-fid-sig-scarcity' : 'text-fid-sig-gap'"
          >
            {{ pressingText(warning) }}
          </li>
        </ul>

        <p v-if="match.pressing?.stamps.length" class="flex flex-wrap gap-x-3 text-fid-xs">
          <span
            v-for="stamp in match.pressing.stamps"
            :key="stamp.key"
            class="text-fid-text-muted"
            :title="stampText(stamp).note"
          >
            <span class="text-fid-text">{{ stampText(stamp).label }}</span>
            {{ d.match.inRunOut }}
          </span>
        </p>

        <!-- The score and the price, on the card's last line, with the band as a plate. -->
        <div class="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pt-2">
          <!--
            The score, with the word its band actually has and a ladder of
            four — see ScoreMark.vue. It used to be `48 c`: the number in the
            same size as the record's title, and a letter whose legend was
            nowhere on the screen.
          -->
          <ScoreMark :score="match.score" />
          <p class="flex flex-wrap items-baseline gap-x-3 text-fid-sm text-fid-text-muted">
            <span v-if="match.condition">{{ match.condition }}</span>
            <span v-if="price" class="fid-num text-fid-text">{{ price }}</span>
            <span v-if="landedText" class="fid-num" :title="landedWhy">{{ landedText }}</span>
          </p>
        </div>
      </div>
    </div>

    <!--
      The only way Barry ever gets calibrated. Each press stores the signals
      as they were at the moment of the verdict — the verdict alone would be
      worthless once the weights move (docs/03 §7).
    -->
    <div class="flex flex-wrap items-center gap-2">
      <!--
        The middle volume (M31.3), not the filled one: in a list of two
        hundred, twenty filled buttons are the wall the list was built to
        avoid. The filled one lives on the sheet, once, for the record that is
        open.

        And the icon stands next to the word at both ends — the word changes,
        because "in den Korb" is an action and "im Korb" is a state.
      -->
      <button
        type="button"
        :aria-pressed="contains(match.listingId)"
        class="fid-action inline-flex items-center gap-2 rounded-fid-sm px-3 py-1 text-fid-sm transition-colors"
        :class="
          contains(match.listingId) ? 'border border-fid-accent text-fid-text' : 'fid-tonal'
        "
        @click="toggle(match.digId, match.listingId)"
      >
        <FidIcon :name="contains(match.listingId) ? 'check' : 'shopping-basket'" :size="14" />
        {{ contains(match.listingId) ? d.match.basketIn : d.match.basketAdd }}
      </button>

      <!--
        One verdict here, both on the sheet.

        Saving is a flip-through movement — you do it without stopping. Marking
        something bought is not: it happens after an order, and the basket, the
        saved screen and the sheet all offer it where that actually is.
      -->
      <div class="flex gap-1" role="group" :aria-label="d.match.feedback">
        <!--
          The word stands next to the icon, and it changes: "Save" is the
          action, "Saved" is the state, and the accessible name is the same
          text everyone else reads.
        -->
        <button
          v-for="option in CARD_VERDICTS"
          :key="option.key"
          type="button"
          :aria-pressed="verdict === option.key"
          class="fid-lift inline-flex items-center gap-2 rounded-fid-sm border px-2 py-1 text-fid-xs transition-colors"
          :class="
            verdict === option.key
              ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
              : 'border-fid-field text-fid-text-muted hover:text-fid-text'
          "
          @click="judge(match, option.key)"
        >
          <FidIcon :name="option.icon" :size="14" />
          {{
            verdict === option.key
              ? d.match.verdictsDone[option.key]
              : d.match.verdicts[option.key]
          }}
        </button>
      </div>
    </div>
  </article>
</template>
