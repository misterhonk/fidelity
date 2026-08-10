<script setup lang="ts">
import { describeFormat } from '#shared/format'
import type { Match } from '#shared/types'

const props = defineProps<{ match: Match }>()

const { verdicts, judge } = useFeedback()
const verdict = computed(() => verdicts.value[props.match.listingId])

const { show } = useReleaseSheet()
const { contains, toggle } = useBasket()

/**
 * Das Cover, und die Bitte darum, sobald die Karte ins Bild kommt.
 *
 * Asked for here rather than by the list, because only the card knows when it
 * is actually on screen — and each one costs a request (worker/covers.ts).
 */
const { coverFor, watchCover } = useCovers()
const cover = computed(() => coverFor(props.match.releaseId, props.match.thumbUrl))

const root = useTemplateRef<HTMLElement>('root')
onMounted(() => watchCover(root.value, props.match.releaseId))

const band = computed(() => {
  if (props.match.score >= 85) return { key: 'S', label: 'Side One, Track One' }
  if (props.match.score >= 70) return { key: 'A', label: 'Top Five' }
  if (props.match.score >= 50) return { key: 'B', label: 'Solide' }
  return { key: 'C', label: 'Randnotiz' }
})

const price = computed(() => {
  const { price: value, currency } = props.match
  return money(value, currency)
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
  return [props.match.label, props.match.catno, format || null, props.match.year]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <article
    ref="root"
    class="@container flex scroll-mt-28 flex-col gap-3 rounded-fid-md border border-fid-border bg-fid-surface p-4"
  >
    <div class="flex items-start gap-4">
      <!--
        The cover is fetched by the browser, lazily and only in the viewport.
        i.discogs.com has its own Cloudflare limit that has nothing to do with
        the API budget, so it is never fetched actively.

        Where the address comes from is the interesting part: not from the
        match. `/users/{u}/inventory` returns `release.thumbnail` as an empty
        string — 1.200 of 1.200 rows across four shops, measured 2026-08-10 —
        so `match.thumbUrl` has been null for every find this app ever made and
        this card has been drawing the placeholder since it was written. The
        picture comes from the shared store instead (app/composables/useCovers).
      -->
      <img
        v-if="cover"
        :src="cover.thumbUrl"
        :srcset="cover.coverUrl ? `${cover.thumbUrl} 150w, ${cover.coverUrl} 600w` : undefined"
        sizes="72px"
        alt=""
        loading="lazy"
        decoding="async"
        width="72"
        height="72"
        class="size-18 shrink-0 rounded-fid-cover bg-fid-inset object-cover"
      />
      <!--
        No cover is the normal case, not a failure: Discogs has no image for
        plenty of small pressings, and images are never fetched actively
        (docs/02, the separate Cloudflare limit). A record standing in for one
        says "nothing to show here" where an empty grey square said "still
        loading" for as long as somebody was willing to wait.
      -->
      <div
        v-else
        class="flex size-18 shrink-0 items-center justify-center rounded-fid-cover bg-fid-inset text-fid-text-muted"
        aria-hidden="true"
      >
        <FidIcon name="platte" :size="28" />
      </div>

      <div class="flex min-w-0 grow flex-col gap-1">
        <!--
          The title is the way in. A whole-card click would swallow the
          Discogs link and the four verdict buttons that sit inside it.
        -->
        <button
          type="button"
          class="truncate text-left text-fid-base font-medium text-fid-text underline-offset-4 hover:underline"
          @click="show(match.digId, match.listingId)"
        >
          {{ match.artist }} – {{ match.title }}
        </button>
        <p v-if="meta" class="truncate font-fid-mono text-fid-xs text-fid-text-muted">
          {{ meta }}
        </p>
      </div>

      <div
        class="flex shrink-0 flex-col items-center"
        role="img"
        :aria-label="`Barry Score ${match.score} von 100 – ${band.label}`"
      >
        <span class="fid-num text-fid-xl font-bold text-fid-text">{{ match.score }}</span>
        <span class="text-fid-xs text-fid-text-muted">{{ band.key }}</span>
      </div>
    </div>

    <ul class="flex flex-wrap gap-2">
      <li
        v-for="signal in match.signals"
        :key="signal.type"
        class="rounded-fid-sm border px-2 py-1 text-fid-xs text-fid-text"
        :style="signalChipStyle(signal.type)"
      >
        {{ signalLabel(signal.type) }}
      </li>
    </ul>

    <!-- Never truncated. The sentence is the product. -->
    <!-- A sentence, so it keeps a sentence's width however wide the card gets. -->
    <p class="max-w-prose text-fid-sm text-fid-text">{{ match.reason }}</p>

    <!--
      What this pressing is (M7). Never says a reissue is bad — plenty of
      people want the 180 g remaster — only what the record is, so the price
      can be judged against the right thing.
    -->
    <ul v-if="match.pressingWarnings?.length" class="flex flex-col gap-1">
      <li
        v-for="warning in match.pressingWarnings"
        :key="warning.text"
        class="text-fid-sm"
        :class="warning.severity === 'high' ? 'text-fid-sig-scarcity' : 'text-fid-sig-gap'"
      >
        {{ warning.text }}
      </li>
    </ul>

    <p v-if="match.pressing?.stamps.length" class="flex flex-wrap gap-x-3 text-fid-xs">
      <span
        v-for="stamp in match.pressing.stamps"
        :key="stamp.key"
        class="text-fid-text-muted"
        :title="stamp.note"
      >
        <span class="text-fid-text">{{ stamp.label }}</span> im Auslauf
      </span>
    </p>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="flex flex-wrap items-center gap-x-3 text-fid-sm text-fid-text-muted">
        <span v-if="match.condition">{{ match.condition }}</span>
        <span v-if="price" class="fid-num text-fid-text">{{ price }}</span>
        <a
          class="fid-action text-fid-accent underline underline-offset-4"
          :href="`https://www.discogs.com/sell/item/${match.listingId}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bei Discogs ansehen
        </a>
      </p>

      <!--
        The only way Barry ever gets calibrated. Each press stores the signals
        as they were at the moment of the verdict — the verdict alone would be
        worthless once the weights move (docs/03 §7).
      -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          :aria-pressed="contains(match.listingId)"
          class="rounded-fid-sm border px-3 py-1 text-fid-sm transition-colors"
          :class="
            contains(match.listingId)
              ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
              : 'border-fid-border text-fid-text-muted hover:text-fid-text'
          "
          @click="toggle(match.digId, match.listingId)"
        >
          {{ contains(match.listingId) ? 'Im Korb' : 'In den Korb' }}
        </button>

        <div class="flex gap-1" role="group" aria-label="Wie war der Treffer?">
          <button
            v-for="option in VERDICTS"
            :key="option.key"
            type="button"
            :title="option.label"
            :aria-label="option.label"
            :aria-pressed="verdict === option.key"
            class="rounded-fid-sm border px-2 py-1 text-fid-sm transition-colors"
            :class="
              verdict === option.key
                ? 'border-fid-accent bg-fid-accent/15'
                : 'border-transparent opacity-45 hover:opacity-100'
            "
            @click="judge(match, option.key)"
          >
            <FidIcon :name="option.icon" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
