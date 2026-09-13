<script setup lang="ts">
import type { DigWithMatches } from '#shared/protocol'
import type { StackShop } from '#shared/types'

import { useDigMessages } from '~/i18n/dig'

/**
 * The stack — the same finds, one after another.
 *
 * A second interface **beside** the list, not instead of it (`docs/06` M15).
 * At the top the shops with fresh finds, a coloured ring where something is
 * waiting; below, one record, full-bleed, three buttons, swipe.
 *
 * **A swipe costs zero requests.** The dig happened long ago, the matches are
 * in `matches`, the covers in `covers`. That is why this works at all: at
 * 1.2 s per Discogs request, a feed that loaded as you swiped would be
 * unusable.
 */
const d = useDigMessages()
const m = useMessages()

useSeoMeta({ title: () => d.value.stack.title, description: () => d.value.stack.lead })

const route = useRoute()
const { call } = useFidelityWorker()
const { judge, load: loadFeedback, verdicts } = useFeedback()
const { load: loadBasket } = useBasket()
const { request: requestCovers } = useCovers()

/*
 * Audio preview (ADR-012) — off until somebody switches it on, and even then
 * nothing happens until a tap. `mount` is the place where the frame *would* be
 * created; until somebody taps, an empty div stays there.
 */
const audioOn = ref(false)
const audio = useAudioPreview()
const mount = useTemplateRef<HTMLElement>('mount')

/** The title as Discogs knows it for this record — not the card's. */
const hearing = computed(() =>
  audio.playing.value ? card.value?.videos?.[0]?.title || null : null,
)

const canHear = computed(
  () => audioOn.value && !audio.failed.value && (card.value?.videos?.length ?? 0) > 0,
)

/** After a card change: carry over what was playing, and otherwise stay quiet. */
async function follow() {
  if (!audio.playing.value) return
  const uri = card.value?.videos?.[0]?.uri
  if (!uri || !mount.value) {
    audio.stop()
    return
  }
  await audio.play(uri, mount.value)
}

async function hear() {
  const uri = card.value?.videos?.[0]?.uri
  if (!uri || !mount.value) return
  await audio.play(uri, mount.value, card.value?.videos?.[0]?.title)
}

/*
 * Leaving the stack takes this element with it — and a player whose frame has
 * gone plays nothing and stops nothing. The same handover a sheet makes when
 * it closes (ListenSection.vue).
 */
onBeforeUnmount(() => audio.release(mount.value))

const shops = shallowRef<StackShop[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

const shopIndex = ref(0)
const dig = shallowRef<DigWithMatches | null>(null)
const at = ref(0)

const shop = computed(() => shops.value[shopIndex.value] ?? null)
const cards = computed(() => dig.value?.matches ?? [])
const card = computed(() => cards.value[at.value] ?? null)
const expired = computed(() => (dig.value ? Date.now() >= dig.value.dig.expiresAt : false))

onMounted(async () => {
  try {
    await Promise.all([loadFeedback(), loadBasket()])
    audioOn.value = (await call('preferences.get', undefined)).audioPreview
    shops.value = await call('stack.overview', undefined)

    /*
     * `?dealer=` comes from the shop row on the start page.
     *
     * Without it, every tap there landed at the first shop in the list — which
     * is exactly not the one somebody pointed at.
     */
    const wanted = typeof route.query.dealer === 'string' ? route.query.dealer : null
    const found = wanted ? shops.value.findIndex((s) => s.dealer === wanted) : -1
    await openShop(found >= 0 ? found : 0)
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }
})

async function openShop(index: number) {
  const next = shops.value[index]
  if (!next) return

  shopIndex.value = index
  dig.value = await call('dig.get', { digId: next.digId })
  /*
   * Carry on where you were — but not past the end.
   *
   * Somebody who has been through a shop and opens it again wants to see it
   * from the start, not an empty card. "Done" is a state of the ring, not a
   * state of the stack.
   */
  at.value = next.seen >= next.matches ? 0 : next.seen
  prefetchCovers()
}

/**
 * Requesting the next few covers, not all of them.
 *
 * `useCovers` fetches the missing ones through the worker — free from the
 * collection, otherwise one `/releases/{id}` each. Requesting the whole stack
 * at once would, with three hundred finds, be exactly the loop rule 2 forbids.
 * Five ahead is enough: nobody swipes faster, and what is never reached is
 * never fetched.
 */
function prefetchCovers() {
  const naechste = cards.value.slice(at.value, at.value + 5).map((c) => c.releaseId)
  if (naechste.length > 0) void requestCovers(naechste)
}

function go(step: number) {
  const next = at.value + step
  if (next < 0) return
  if (next >= cards.value.length) {
    void remember(cards.value.length)
    void nextShop()
    return
  }
  at.value = next
  /*
   * The sound travels along — but only if it was already playing.
   *
   * ADR-012: the one gesture carries through the stack. It does not carry
   * *against* somebody who turned the sound off. So: if something is playing,
   * the next card gets its preview; if nothing is, it stays silent.
   *
   * And record A must never carry on under record B — anybody hearing that
   * takes the sound for that of the record they are looking at.
   */
  void follow()
  void remember(next)
  prefetchCovers()
}

/** Counted forwards only — the worker holds to that too; here it is just cheaper. */
async function remember(seen: number) {
  const current = shop.value
  if (!current || seen <= current.seen) return
  await call('stack.seen', { digId: current.digId, seen })
  shops.value = shops.value.map((s) => (s.digId === current.digId ? { ...s, seen } : s))
}

/**
 * At the end of a shop it carries on at the next one that still has something.
 *
 * And when none of them has anything left, the screen says so. Feigning
 * endlessness would be the one kind of pull that does not suit an app whose
 * whole value is honesty (`docs/06` M15).
 */
const done = ref(false)

async function nextShop() {
  const rest = shops.value
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== shopIndex.value && s.matches - s.seen > 0)

  if (rest.length === 0) {
    done.value = true
    return
  }
  await openShop(rest[0]!.i)
}

/* ── Swiping ───────────────────────────────────────────────────────────
 *
 * Pointer events and a CSS transform, no library. A card that follows the
 * finger is these fifty lines — and the budget is 180 kB (rule 7).
 */
const dragX = ref(0)
const dragging = ref(false)
let startX = 0
let pointer: number | null = null

/** From here it counts as a swipe and not as a wobble while tapping. */
const THRESHOLD = 80

function down(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointer = event.pointerId
  startX = event.clientX
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function move(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointer) return
  dragX.value = event.clientX - startX
}

function up(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointer) return
  dragging.value = false
  pointer = null

  const distance = dragX.value
  dragX.value = 0
  if (Math.abs(distance) < THRESHOLD) return
  go(distance < 0 ? 1 : -1)
}

/*
 * And the same movement on the keyboard.
 *
 * A stack only a thumb can operate is a screen some people do not have.
 */
function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'ArrowLeft') go(-1)
}

/* ── The three buttons ─────────────────────────────────────────────────
 * All three have existed for ages: `feedback` from M3, `basket` from M4, the
 * sharing from M9. Nothing here is new except where they sit.
 */
const busy = ref(false)
const shareLink = ref<string | null>(null)

async function like() {
  if (!card.value || !dig.value) return
  await judge({ ...card.value, digId: dig.value.dig.id }, 'interesting')
  go(1)
}

async function toBasket() {
  if (!card.value || !dig.value || busy.value) return
  busy.value = true
  try {
    await call('basket.add', { digId: dig.value.dig.id, listingId: card.value.listingId })
    go(1)
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

async function share() {
  if (!dig.value || busy.value) return
  busy.value = true
  shareLink.value = null
  try {
    const made = await call('share.create', { digId: dig.value.dig.id })
    const base = location.origin + location.pathname.replace(/\/stack\/?$/, '')
    shareLink.value = `${base}/shared?id=${made.id}#k=${made.key}`
    await navigator.clipboard.writeText(shareLink.value).catch(() => {})
  } catch (cause) {
    error.value = cause
  } finally {
    busy.value = false
  }
}

const verdict = computed(() => (card.value ? verdicts.value[card.value.listingId] : undefined))

/**
 * The four middle buttons: icon above text.
 *
 * Side by side, "add to basket" broke onto two lines and pushed the whole row
 * apart — four buttons of different heights, one of which looked broken.
 * Stacked, each is the same height, and the label may be as long as it happens
 * to be in that language.
 *
 * Back and next do **not** join in: there the arrow carries the direction, and
 * a direction above the word is no longer one.
 */
const STACKED =
  'fid-action flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-fid-sm border px-2 py-2 text-fid-xs sm:min-w-11 sm:flex-none sm:px-3'
</script>

<template>
  <main class="mx-auto flex w-full max-w-lg flex-col gap-4 p-4" @keydown="onKey">
    <h1 class="sr-only">{{ d.stack.title }}</h1>

    <!--
      The top row. The ring is `matches - seen > 0` and nothing else — not a
      second truth about whether there is anything new.
    -->
    <StackShops :shops="shops" :current="shopIndex" @open="openShop" />

    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ m.common.loading }}</p>
    <ErrorNote v-if="error" :cause="error" />

    <section v-if="!loading && shops.length === 0" class="flex flex-col gap-3">
      <p class="text-fid-base text-fid-text-muted">{{ d.stack.empty }}</p>
      <NuxtLink
        to="/dig"
        class="fid-fill self-start rounded-fid-sm bg-fid-accent-fill px-4 py-2 text-fid-sm font-medium text-fid-on-accent"
      >
        {{ d.stack.toDig }}
      </NuxtLink>
    </section>

    <section v-else-if="done" class="flex flex-col gap-3">
      <p class="text-fid-base text-fid-text">{{ d.stack.through }}</p>
      <NuxtLink
        to="/dig"
        class="fid-action self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
      >
        {{ d.stack.toDig }}
      </NuxtLink>
    </section>

    <template v-else-if="card && shop">
      <div
        class="h-[62vh] min-h-80 touch-pan-y select-none"
        :style="{
          transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`,
          transition: dragging ? 'none' : 'transform 150ms ease-out',
        }"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
      >
        <!--
          One instance per card.

          Without `key`, Vue only replaces the prop and keeps the `<img>` — and
          that carries on showing the previous cover until the new one has
          loaded. In a list this does not show, because each row has its own
          picture there; here it is **the same element** changing between two
          records, and then somebody else's cover briefly stands above the
          right title.
        -->
        <StackCard :key="card.listingId" :match="card" :expired="expired" />
      </div>

      <p class="text-center text-fid-xs text-fid-text-muted" aria-live="polite">
        {{ d.stack.position(count(at + 1), count(cards.length), shop.displayName) }}
      </p>

      <!--
        `items-stretch`, not `items-center`.

        The four middle buttons are two lines (icon above text), back and next
        one line — centred, they then float at different heights in one row.
        Stretched, each takes the height of the row, and the tallest sets it.

        Two rows on a phone (2026-09-12): six buttons in one row were wider
        than an iPhone, the page scrolled sideways and the whole screen slid
        under the thumb. The judging buttons take the first row and share its
        width; back and next take the second, at its two ends.
      -->
      <div class="flex flex-wrap items-stretch justify-between gap-2">
        <button
          type="button"
          :disabled="at === 0"
          class="fid-action flex min-h-11 items-center gap-2 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-40"
          @click="go(-1)"
        >
          <FidIcon name="arrow-left" :size="16" aria-hidden="true" />
          {{ d.stack.back }}
        </button>

        <div class="order-first flex w-full items-stretch gap-2 sm:order-none sm:w-auto">
          <button
            type="button"
            :class="[
              STACKED,
              verdict === 'interesting'
                ? 'border-fid-accent-fill text-fid-accent'
                : 'border-fid-border text-fid-text',
            ]"
            @click="like"
          >
            <FidIcon name="bookmark" :size="18" aria-hidden="true" />
            <span>{{ d.stack.like }}</span>
          </button>
          <button
            v-if="canHear"
            type="button"
            :class="[
              STACKED,
              audio.playing.value
                ? 'border-fid-accent-fill text-fid-accent'
                : 'border-fid-border text-fid-text',
            ]"
            @click="audio.playing.value ? audio.stop() : hear()"
          >
            <FidIcon
              :name="audio.playing.value ? 'square' : 'play'"
              :size="18"
              aria-hidden="true"
            />
            <span>{{ audio.playing.value ? d.stack.hearStop : d.stack.hear }}</span>
          </button>
          <button
            type="button"
            :disabled="busy"
            :class="[STACKED, 'border-fid-border text-fid-text disabled:opacity-40']"
            @click="toBasket"
          >
            <FidIcon name="shopping-cart" :size="18" aria-hidden="true" />
            <span>{{ d.stack.basket }}</span>
          </button>
          <button
            type="button"
            :disabled="busy"
            :class="[STACKED, 'border-fid-border text-fid-text disabled:opacity-40']"
            @click="share"
          >
            <FidIcon name="share-2" :size="18" aria-hidden="true" />
            <span>{{ d.stack.share }}</span>
          </button>
        </div>

        <button
          type="button"
          class="fid-action flex min-h-11 items-center gap-2 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text"
          @click="go(1)"
        >
          {{ d.stack.next }}
          <FidIcon name="arrow-right" :size="16" aria-hidden="true" />
        </button>
      </div>

      <p v-if="shareLink" class="font-fid-mono text-fid-xs break-all text-fid-text-muted">
        {{ shareLink }}
      </p>

      <!--
        The player is created here — and until somebody taps, this is an empty
        div and nothing else. No script, no frame, no request to Google
        (ADR-012).

        After that it is **visible**: YouTube's terms require it, and a hidden
        player does not start anyway (measured 2026-09-11). So a small, honest
        area rather than a trick — anyone turning sound on also sees where it
        comes from.
      -->
      <!--
        Visible only while something is playing — and playing for **this**
        card.

        It hung off `armed` at first, so off whether anybody had ever tapped.
        Then the player stayed standing after stopping and showed the previous
        record's still under the new card: "Robag Wruhme" above, "The
        Persuader" in the frame below. A still is not sound, but it claims the
        same thing.
      -->
      <div v-show="audio.playing.value" class="flex flex-col gap-1">
        <div
          ref="mount"
          class="aspect-video w-full overflow-hidden rounded-fid-sm bg-fid-inset"
        />
        <!--
          What is playing, named (ADR-012, condition 8).

          People enter Discogs' videos, not Discogs — under a 12" there is
          sometimes an album rip, a live version or simply a different record.
          The player shows YouTube's own picture and its own title; without
          this line that looks as though it were *the* record on the card. If a
          different name stands here, you see it at once.
        -->
        <p v-if="hearing" class="text-fid-xs text-fid-text">{{ hearing }}</p>
        <p class="text-fid-xs text-fid-text-muted">{{ d.stack.hearVia }}</p>
      </div>
    </template>
  </main>
</template>
