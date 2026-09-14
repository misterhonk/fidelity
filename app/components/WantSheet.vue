<script setup lang="ts">
import type { ReleaseDetail, WantedRecord } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'

/**
 * A record you want, as a record (M31.21).
 *
 * The wantlist was the one screen where a sleeve led *out* of the app: tapping
 * it opened discogs.com. Reported on 2026-09-14 — "I only get linked to
 * Discogs here" — and it was the odd one out in more than that, because
 * everything a record sheet shows was already on the device or one lookup
 * away: the tracklist, the credits, the pressing, the clips.
 *
 * So it opens like everything else, with the same masthead, and it keeps the
 * two things that are only true here: **what you wrote down** about which
 * pressing will do, and **how badly you want it**. Discogs is still one tap
 * away — it is where you go to buy one — but it is now a destination rather
 * than the only thing the screen can do.
 */
const props = defineProps<{
  record: WantedRecord
  /** The list this record was opened from, so the wantlist can be walked. */
  walk?: { index: number; total: number; previous: number | null; next: number | null } | null
}>()
/** `want` carries the star that was pressed; the page owns what a repeat means. */
const emit = defineEmits<{ close: []; step: [releaseId: number]; want: [star: number] }>()

const c = useCollectionMessages()
const m = useMessages()
const { call } = useFidelityWorker()

const detail = ref<ReleaseDetail | null>(null)
const looking = ref(false)

/** Everything under the head: one lookup, kept for ever after. */
async function look(refresh = false) {
  looking.value = true
  try {
    detail.value = await call('release.detail', {
      releaseId: props.record.releaseId,
      refresh,
    })
  } catch {
    // A sheet with less on it, not a sheet with an error on it.
  } finally {
    looking.value = false
  }
}

onMounted(() => void look())

const tags = computed(() => {
  const found = detail.value
  if (!found) return []
  return [...new Set([...(found.genres ?? []), ...(found.styles ?? [])])]
})

/** Year, country and the full release date — what this sheet can say for sure. */
const facts = computed(() => {
  const parts: string[] = []
  if (props.record.year > 0) parts.push(String(props.record.year))
  if (detail.value?.country) parts.push(detail.value.country)
  return parts.join(' · ')
})

const STARS = [1, 2, 3, 4, 5] as const

function step(to: number | null) {
  if (to === null) return
  emit('step', to)
}

/** The arrows from the keyboard, where nobody is typing (M31.13). */
function onArrow(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
  const on = document.activeElement
  if (
    on instanceof HTMLElement &&
    (on.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(on.tagName))
  )
    return
  if (!props.walk) return
  event.preventDefault()
  step(event.key === 'ArrowLeft' ? props.walk.previous : props.walk.next)
}

onMounted(() => document.addEventListener('keydown', onArrow))
onBeforeUnmount(() => document.removeEventListener('keydown', onArrow))
</script>

<template>
  <SheetFrame
    :label="`${record.artist} – ${record.title}`"
    transition="want-sheet"
    @close="emit('close')"
  >
    <template v-if="record.thumbUrl || record.coverUrl" #wash>
      <SleeveWash :src="record.thumbUrl || record.coverUrl" />
    </template>

    <template v-if="walk" #tools>
      <button
        type="button"
        :disabled="walk.previous === null"
        :aria-label="c.shelf.sheet.previous"
        :title="c.shelf.sheet.previous"
        class="fid-lift flex min-h-11 min-w-11 items-center justify-center fid-field-raised text-fid-text disabled:opacity-40"
        @click="step(walk.previous)"
      >
        <FidIcon name="arrow-left" :size="18" aria-hidden="true" />
      </button>
      <span class="fid-num px-1 text-fid-xs whitespace-nowrap text-fid-text-muted">
        {{ m.common.ofTotal(String(walk.index + 1), String(walk.total)) }}
      </span>
      <button
        type="button"
        :disabled="walk.next === null"
        :aria-label="c.shelf.sheet.next"
        :title="c.shelf.sheet.next"
        class="fid-lift flex min-h-11 min-w-11 items-center justify-center fid-field-raised text-fid-text disabled:opacity-40"
        @click="step(walk.next)"
      >
        <FidIcon name="arrow-right" :size="18" aria-hidden="true" />
      </button>
    </template>

    <RecordMasthead
      :cover="
        record.thumbUrl || record.coverUrl
          ? { thumbUrl: record.thumbUrl, coverUrl: record.coverUrl }
          : null
      "
      :title="record.title"
      :artist="record.artist"
    >
      <template #facts>
        <p v-if="facts" class="font-fid-mono text-fid-xs text-fid-text-muted">{{ facts }}</p>
      </template>

      <!--
        How badly, and since when — the two facts that exist only here.

        The stars are Discogs' own 0–5 and the same control the grid has, so
        the answer is one tap in either place. Tapping the lit one takes it
        back: zero is a state, not the absence of one.
      -->
      <div class="flex flex-col gap-2">
        <div role="group" :aria-label="c.wantlist.priority.label" class="-ml-2 flex">
          <button
            v-for="star in STARS"
            :key="star"
            type="button"
            :aria-label="c.wantlist.priority.set(star)"
            :aria-pressed="record.want >= star"
            class="fid-lift flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm text-fid-base transition-colors"
            :class="
              record.want >= star
                ? 'text-fid-sig-wantlist'
                : 'text-fid-text-muted hover:text-fid-text'
            "
            @click="emit('want', star)"
          >
            {{ record.want >= star ? '★' : '☆' }}
          </button>
        </div>
        <p class="fid-plate text-fid-text-muted">
          {{ c.wantlist.sheet.since(day(Date.parse(record.addedAt))) }}
        </p>
      </div>
    </RecordMasthead>

    <!--
      Your own words, at the moment they matter. Standing in a shop with a
      copy in your hand, "only the German press" is the difference between a
      find and a mistake — and it is what a dig cannot know for you.
    -->
    <p
      v-if="record.note"
      class="flex items-start gap-2 rounded-fid-sm border border-fid-sig-wantlist/40 bg-fid-sig-wantlist/10 px-3 py-2 text-fid-sm text-fid-text"
    >
      <FidIcon name="bookmark" :size="16" class="shrink-0 text-fid-sig-wantlist" />
      {{ record.note }}
    </p>

    <!-- Where a dig last offered it — by master, so any pressing counts. -->
    <p v-if="record.lastSeen" class="text-fid-sm text-fid-text-muted">
      {{ c.wantlist.sheet.lastSeen(record.lastSeen.dealer, day(record.lastSeen.at)) }}
    </p>

    <ListenSection
      :artist="record.artist"
      :title="record.title"
      :videos="detail?.videos"
      :tracks="detail?.tracks"
    />

    <ReleaseFacts
      :detail="detail"
      :tags="tags"
      refreshable
      :looking="looking"
      @refresh="look(true)"
    />

    <div
      class="sticky -bottom-6 -mx-6 mt-auto flex items-center justify-between gap-2 border-t border-fid-border bg-fid-surface px-6 pt-4 -mb-6 pb-6"
    >
      <OutwardLink
        tone="inherit"
        class="text-fid-sm"
        :to="`https://www.discogs.com/release/${record.releaseId}`"
      >
        {{ c.shelf.sheet.atDiscogs }}
      </OutwardLink>
    </div>
  </SheetFrame>
</template>
