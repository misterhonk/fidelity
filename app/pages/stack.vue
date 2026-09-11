<script setup lang="ts">
import type { DigWithMatches } from '#shared/protocol'
import type { StackShop } from '#shared/types'

import { useDigMessages } from '~/i18n/dig'

/**
 * Der Stapel — dieselben Funde, einer nach dem anderen.
 *
 * Eine zweite Oberfläche **neben** der Liste, nicht statt ihr (`docs/06` M15).
 * Oben die Läden mit frischen Funden, farbiger Ring wo noch etwas liegt;
 * darunter eine Platte, ganzflächig, drei Knöpfe, wischen.
 *
 * **Ein Wisch kostet null Requests.** Der Dig hat längst stattgefunden, die
 * Treffer liegen in `matches`, die Cover in `covers`. Das ist der Grund,
 * warum das hier überhaupt geht: bei 1,2 s pro Discogs-Anfrage wäre ein Feed,
 * der beim Wischen nachlädt, unbenutzbar.
 */
const d = useDigMessages()
const m = useMessages()

useSeoMeta({ title: () => d.value.stack.title, description: () => d.value.stack.lead })

const { call } = useFidelityWorker()
const { judge, load: loadFeedback, verdicts } = useFeedback()
const { load: loadBasket } = useBasket()
const { request: requestCovers } = useCovers()

/*
 * Hörprobe (ADR-012) — aus, bis jemand sie einschaltet, und selbst dann
 * passiert erst beim Tippen etwas. `mount` ist der Platz, an dem der Rahmen
 * entstehen *würde*; solange niemand tippt, bleibt dort ein leeres div.
 */
const audioOn = ref(false)
const audio = useAudioPreview()
const mount = useTemplateRef<HTMLElement>('mount')

/** Der Titel, wie Discogs ihn zu dieser Platte kennt — nicht der der Karte. */
const hearing = computed(() =>
  audio.playing.value ? card.value?.videos?.[0]?.title || null : null,
)

const canHear = computed(
  () => audioOn.value && !audio.failed.value && (card.value?.videos?.length ?? 0) > 0,
)

/** Nach einem Kartenwechsel: mitnehmen, was lief, und sonst schweigen. */
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
  await audio.play(uri, mount.value)
}

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
    await openShop(0)
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
   * Da weitermachen, wo man war — aber nicht hinter dem Ende.
   *
   * Wer einen Laden durchgesehen hat und ihn erneut öffnet, will ihn wieder
   * von vorn sehen und nicht eine leere Karte. „Fertig" ist ein Zustand des
   * Rings, kein Zustand des Stapels.
   */
  at.value = next.seen >= next.matches ? 0 : next.seen
  prefetchCovers()
}

/**
 * Die nächsten paar Cover anfordern, nicht alle.
 *
 * `useCovers` holt fehlende über den Worker — gratis aus der Sammlung, sonst
 * je ein `/releases/{id}`. Den ganzen Stapel auf einmal anzufordern wäre bei
 * dreihundert Funden genau die Schleife, die Regel 2 verbietet. Fünf voraus
 * reicht: schneller wischt niemand, und was nie erreicht wird, wird nie
 * geholt.
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
   * Der Ton wandert mit — aber nur, wenn er schon lief.
   *
   * ADR-012: die eine Geste trägt durch den Stapel. Sie trägt aber nicht
   * *gegen* den, der den Ton ausgemacht hat. Also: läuft etwas, bekommt die
   * nächste Karte ihre Hörprobe; läuft nichts, bleibt es still.
   *
   * Und Platte A darf nie unter Platte B weiterlaufen — wer das hört, hält
   * den Ton für den der Platte, die er sieht.
   */
  void follow()
  void remember(next)
  prefetchCovers()
}

/** Nur vorwärts gezählt — der Worker hält das ebenso, hier ist es nur billiger. */
async function remember(seen: number) {
  const current = shop.value
  if (!current || seen <= current.seen) return
  await call('stack.seen', { digId: current.digId, seen })
  shops.value = shops.value.map((s) => (s.digId === current.digId ? { ...s, seen } : s))
}

/**
 * Am Ende eines Ladens geht es beim nächsten weiter, der noch etwas hat.
 *
 * Und wenn keiner mehr etwas hat, sagt der Bildschirm das. Unendlichkeit
 * vorzutäuschen wäre die eine Sorte Sog, die zu einer App, deren ganzer Wert
 * Ehrlichkeit ist, nicht passt (`docs/06` M15).
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

/* ── Wischen ────────────────────────────────────────────────────────────
 *
 * Pointer Events und eine CSS-Transformation, keine Bibliothek. Eine Karte,
 * die dem Finger folgt, sind diese fünfzig Zeilen — und das Budget liegt bei
 * 180 kB (Regel 7).
 */
const dragX = ref(0)
const dragging = ref(false)
let startX = 0
let pointer: number | null = null

/** Ab hier gilt es als Wisch und nicht als Zittern beim Tippen. */
const SCHWELLE = 80

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

  const weit = dragX.value
  dragX.value = 0
  if (Math.abs(weit) < SCHWELLE) return
  go(weit < 0 ? 1 : -1)
}

/*
 * Und dieselbe Bewegung auf der Tastatur.
 *
 * Ein Stapel, den nur ein Daumen bedienen kann, ist ein Bildschirm, den ein
 * Teil der Leute nicht hat.
 */
function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'ArrowLeft') go(-1)
}

/* ── Die drei Knöpfe ───────────────────────────────────────────────────
 * Alle drei gibt es längst: `feedback` aus M3, `basket` aus M4, das Teilen
 * aus M9. Hier ist nichts neu außer der Stelle, an der sie sitzen.
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
</script>

<template>
  <main class="mx-auto flex w-full max-w-lg flex-col gap-4 p-4" @keydown="onKey">
    <h1 class="sr-only">{{ d.stack.title }}</h1>

    <!--
      Die obere Reihe. Der Ring ist `matches - seen > 0` und sonst nichts —
      keine zweite Wahrheit darüber, ob es etwas Neues gibt.
    -->
    <ul v-if="shops.length > 0" class="flex gap-3 overflow-x-auto pb-1">
      <li v-for="(s, i) in shops" :key="s.digId" class="shrink-0">
        <button
          type="button"
          class="flex w-16 flex-col items-center gap-1"
          :aria-current="i === shopIndex ? 'true' : undefined"
          :aria-label="d.stack.shop(s.displayName, s.matches - s.seen)"
          @click="openShop(i)"
        >
          <span
            class="flex size-14 items-center justify-center rounded-full border-2 p-1"
            :class="
              s.matches - s.seen > 0 ? 'border-fid-accent-fill' : 'border-fid-border opacity-60'
            "
          >
            <img
              v-if="s.avatarUrl"
              :src="s.avatarUrl"
              alt=""
              loading="lazy"
              class="size-full rounded-full object-cover"
            />
            <span v-else class="text-fid-sm font-bold text-fid-text">
              {{ s.displayName.slice(0, 2).toUpperCase() }}
            </span>
          </span>
          <span class="w-full truncate text-center text-fid-xs text-fid-text-muted">
            {{ s.displayName }}
          </span>
        </button>
      </li>
    </ul>

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
        <StackCard :match="card" :expired="expired" />
      </div>

      <p class="text-center text-fid-xs text-fid-text-muted" aria-live="polite">
        {{ d.stack.position(count(at + 1), count(cards.length), shop.displayName) }}
      </p>

      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          :disabled="at === 0"
          class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-40"
          @click="go(-1)"
        >
          {{ d.stack.back }}
        </button>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="fid-action flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm border px-3 text-fid-sm"
            :class="
              verdict === 'interesting'
                ? 'border-fid-accent-fill text-fid-accent'
                : 'border-fid-border text-fid-text'
            "
            :aria-label="d.stack.like"
            @click="like"
          >
            {{ d.stack.like }}
          </button>
          <button
            v-if="canHear"
            type="button"
            class="fid-action min-h-11 rounded-fid-sm border px-3 text-fid-sm"
            :class="
              audio.playing.value
                ? 'border-fid-accent-fill text-fid-accent'
                : 'border-fid-border text-fid-text'
            "
            @click="audio.playing.value ? audio.stop() : hear()"
          >
            {{ audio.playing.value ? d.stack.hearStop : d.stack.hear }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text disabled:opacity-40"
            @click="toBasket"
          >
            {{ d.stack.basket }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text disabled:opacity-40"
            @click="share"
          >
            {{ d.stack.share }}
          </button>
        </div>

        <button
          type="button"
          class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text"
          @click="go(1)"
        >
          {{ d.stack.next }}
        </button>
      </div>

      <p v-if="shareLink" class="font-fid-mono text-fid-xs break-all text-fid-text-muted">
        {{ shareLink }}
      </p>

      <!--
        Hier entsteht der Spieler — und bis jemand tippt, ist das ein leeres
        div und sonst nichts. Kein Skript, kein Rahmen, keine Anfrage an
        Google (ADR-012).

        Danach ist er **sichtbar**: YouTubes Bedingungen verlangen das, und ein
        versteckter Spieler startet ohnehin nicht (2026-09-11 gemessen). Also
        eine kleine, ehrliche Fläche statt eines Tricks — wer Ton anmacht,
        sieht auch, woher er kommt.
      -->
      <div v-show="audio.armed.value" class="flex flex-col gap-1">
        <div
          ref="mount"
          class="aspect-video w-full overflow-hidden rounded-fid-sm bg-fid-inset"
        />
        <!--
          Was da läuft, beim Namen genannt (ADR-012, Bedingung 8).

          Discogs' Videos tragen Leute ein, nicht Discogs — unter einer 12"
          liegt auch mal ein Album-Rip, eine Live-Fassung oder schlicht eine
          andere Platte. Der Spieler zeigt YouTubes eigenes Bild und seinen
          eigenen Titel; ohne diese Zeile sieht das aus, als sei es *die*
          Platte von der Karte. Steht hier ein anderer Name, sieht man es
          sofort.
        -->
        <p v-if="hearing" class="text-fid-xs text-fid-text">{{ hearing }}</p>
        <p class="text-fid-xs text-fid-text-muted">{{ d.stack.hearVia }}</p>
      </div>
    </template>
  </main>
</template>
