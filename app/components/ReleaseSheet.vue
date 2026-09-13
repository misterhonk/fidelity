<script setup lang="ts">
import type { Match, MatchDetail } from '#shared/types'
import { LISTEN_NAMES, listenUrl, type ListenService } from '#shared/listen'
import { reasonFor } from '~/i18n/reason'
import { pressingText, stampText } from '~/i18n/pressing'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const m = useMessages()
const props = defineProps<{ digId: string; listingId: number }>()
const emit = defineEmits<{ close: [] }>()

const { call } = useFidelityWorker()
const { verdicts, judge } = useFeedback()

const detail = ref<MatchDetail | null>(null)

/**
 * Loading, there, or gone — three states, because two of them used to look
 * alike and the one that looked like nothing was the one that mattered.
 *
 * Reported from a real device: a record on the start page opened nothing at
 * all. The sheet *was* opening; `dig.detail` answered null, and the template
 * had no branch for that, so it sat on its loading title with an empty body
 * for ever. A find whose dig has been dropped — five are kept — is exactly
 * that case, and it says so now, with the way to get the record back.
 */
const state = ref<'loading' | 'ready' | 'gone'>('loading')
const failed = ref<unknown>(null)

/*
 * One tap to the music (M31).
 *
 * A link, not an integration: it opens the chosen service's search with the
 * artist and the title. Nothing is fetched and nothing leaves the device until
 * somebody taps it — the same standing as the "at Discogs" link beside it.
 *
 * Absent until a service is chosen, which is the default: a button to a
 * service somebody does not use is in the way of the one they do.
 */
const listen = ref<ListenService>('none')

const listenTo = computed(() =>
  match.value ? listenUrl(listen.value, match.value.artist, match.value.title) : null,
)

/** The service's own name, or null where none is chosen — the button's label. */
const listenName = computed(() => (listen.value === 'none' ? null : LISTEN_NAMES[listen.value]))

onMounted(async () => {
  // Not awaited together with the detail: the sheet must not wait for a
  // preference to draw the record it is about.
  void call('preferences.get', undefined).then((prefs) => (listen.value = prefs.listenService))

  try {
    const answer = await call('dig.detail', {
      digId: props.digId,
      listingId: props.listingId,
    })
    detail.value = answer
    state.value = answer ? 'ready' : 'gone'
  } catch (cause) {
    // A failure is not the same as a find that is gone, and the sentence for
    // it is `ErrorNote`'s, which says what broke.
    failed.value = cause
    state.value = 'gone'
  }
})

const match = computed(() => detail.value?.match ?? null)

/*
 * One cover, for the one record that is open.
 *
 * Asked for the moment the sheet has its match — one request at most, and only
 * for a record somebody deliberately tapped. Usually none: whatever list they
 * tapped it from asked for it already, and the store answers offline.
 */
/**
 * What the sheet is called. A find from before 2026-09-12 that passed its
 * six hours lost its title with its price (shared/types.ts, MARKETPLACE_FIELDS);
 * those rows are still around for a few days, and "–" is no name for them.
 */
function nameOf(m: Match): string {
  if (!m.title && !m.artist) return `Release ${m.releaseId}`
  return [m.artist, m.title].filter(Boolean).join(' – ')
}

const { coverFor, request: requestCovers } = useCovers()
const cover = computed(() =>
  match.value ? coverFor(match.value.releaseId, match.value.thumbUrl) : null,
)
watch(match, (open) => open && void requestCovers([open.releaseId]))
const verdict = computed(() => verdicts.value[props.listingId])

/*
 * Wanting it, from the screen where you decided not to buy it.
 *
 * The most common ending to opening a find is "not at this price" — and until
 * now that ending was a dead end. A want costs nothing to add and nothing to
 * take back, so unlike the collection there is no confirmation here.
 *
 * Local state only: the sheet is opened per listing and closed again, so
 * asking the worker whether the shelf already wants this would spend a read
 * on something the wantlist page answers better anyway.
 */
const wanted = ref(false)

async function want() {
  wanted.value = true
  if (!(await call('wantlist.add', { digId: props.digId, listingId: props.listingId }))) {
    wanted.value = false
  }
}

const price = computed(() => {
  const value = match.value?.price
  const currency = match.value?.currency
  return money(value, currency)
})

const marketLowest = computed(() => {
  const value = match.value?.marketLowestPrice
  const currency = match.value?.currency
  return money(value, currency)
})

const meta = computed(() =>
  [match.value?.label, match.value?.catno, match.value?.format, match.value?.year]
    .filter(Boolean)
    .join(' · '),
)

/**
 * The evidence behind each signal, rendered as a phrase.
 *
 * Deliberately not the Barry sentence again: the card already carries that.
 * This is the sheet, so it answers the follow-up question — *why* did the
 * label signal fire, how many records is "some".
 */
function evidenceOf(evidence: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(evidence)) {
    // Only labelled keys are shown. Evidence also carries internal handles —
    // releaseId, masterId — and printing "releaseId: 10.147.986" at somebody
    // is worse than printing nothing: it looks like an answer and is not one.
    const label = EVIDENCE_LABEL.value[key]
    if (!label || value === null || value === undefined || value === '') continue

    const shown = Array.isArray(value)
      ? value.slice(0, 3).join(', ')
      : typeof value === 'number'
        ? decimal(value, 2)
        : String(value)
    parts.push(`${label}: ${shown}`)
  }
  return parts.join(' · ')
}

/**
 * The evidence keys the sheet is allowed to print, and what each is called.
 *
 * The table is the allowlist: anything not in it is an internal handle
 * (releaseId, role) and stays out of the sheet. It lives in the packs, so the
 * words travel with the language and the allowlist stays one list.
 */
const EVIDENCE_LABEL = computed<Record<string, string>>(() => m.value.evidence)

/*
 * The words are in the language pack, the decision is here: a year is a year,
 * and nobody writes "from 2004 to 2004". The sentence itself stood in German
 * at this spot until 2026-09-10, inside an English interface.
 */
function years(entry: { from: number; to: number }): string {
  return entry.from === entry.to
    ? d.value.sheet.ownedYear(String(entry.from))
    : d.value.sheet.ownedYears(String(entry.from), String(entry.to))
}
</script>

<template>
  <!--
    The slide is the browser's, not ours — a View Transition on the name the
    frame passes down. Anyone who asked not to be moved gets the state change
    without the movement; that opt-out lives in `main.css`, once for every sheet.
  -->
  <SheetFrame
    :label="match ? nameOf(match) : state === 'gone' ? d.sheet.goneTitle : d.sheet.loading"
    transition="release-sheet"
    @close="emit('close')"
  >
    <template #title>
      <template v-if="match">{{ nameOf(match) }}</template>
      <template v-else-if="state === 'gone'">{{ d.sheet.goneTitle }}</template>
      <template v-else>{{ d.sheet.loading }}</template>
    </template>

    <template v-if="match">
      <!--
          On a phone the cover goes on top, full width.
          A 96px square beside three lines of text is a layout thought up at a
          desk. On a phone there is no column left next to it for text to
          breathe in, and the sleeve — the reason anyone opens this sheet — ends
          up the smallest thing on the screen. From `sm` up the row comes back:
          there the room is real.
        -->
      <!--
          Wrap rather than crush.

          The cover is `shrink-0` and takes its width; the facts got what was
          left — with a 512 px sheet and a 320 px cover that is 128, and out of
          it came "Poker / Flat / Record". With a minimum width and `flex-wrap`
          they slide under the cover instead, as soon as side by side would no
          longer be legible.
        -->
      <!--
        The colour comes from the sleeve (M26.2).

        Not read off the pixels: `i.discogs.com` sends no CORS header
        (docs/02), so a canvas that drew the cover would be tainted and refuse
        to say what it saw. A blurred copy of the same cached thumbnail behind
        the head does the job without asking — a Saville sleeve tints the
        sheet blue, a Blue Note one orange, and nothing leaves the device or is
        fetched twice.
      -->
      <div class="relative overflow-hidden rounded-fid-md">
        <img
          v-if="cover"
          :src="cover.thumbUrl || cover.coverUrl"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          class="pointer-events-none absolute inset-0 size-full scale-150 object-cover opacity-30 blur-3xl"
        />
        <div class="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
          <!--
            The largest cover the app shows — so the one where the 600 px
            version is worth having.

            The address comes from the shared store, not from the match: the
            marketplace returns listings without images, so `match.thumbUrl`
            has always been null here (worker/covers.ts). At 96 px on a retina
            screen the 150er is already soft, and this is the one screen
            somebody opens *because* they want a closer look.

            No `srcset` — the reasoning is in `ShelfSheet.vue`: the 600w
            candidate did not keep its promise, and the 150 was never picked.
          -->
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
          <div class="flex min-w-0 grow items-start gap-4 sm:basis-52">
            <div class="flex min-w-0 grow flex-col gap-1">
              <p v-if="meta" class="font-fid-mono text-fid-xs text-fid-text-muted">
                {{ meta }}
              </p>
              <p class="flex flex-wrap items-baseline gap-x-3 text-fid-sm text-fid-text-muted">
                <span v-if="match.condition" class="flex items-center gap-2">
                  <FidIcon name="platte" :size="14" />
                  {{ match.condition }}
                </span>
                <!--
                Two gradings side by side, and which is which decides whether a
                record is worth buying. "Cover VG" and "VG" read as the same
                word twice; the disc and the sleeve do not.
              -->
                <span v-if="match.sleeve" class="flex items-center gap-2">
                  <FidIcon name="huelle" :size="14" />
                  {{ match.sleeve }}
                </span>
                <span v-if="price" class="fid-num text-fid-base text-fid-text">{{
                  price
                }}</span>
              </p>
            </div>
            <span
              class="fid-num shrink-0 text-fid-xl font-bold text-fid-text"
              :aria-label="d.match.score(match.score)"
            >
              {{ match.score }}
            </span>
          </div>
        </div>
      </div>
      <p class="text-fid-base text-fid-text">{{ reasonFor(match.signals) }}</p>

      <!--
          Your own words, at the moment they matter.
          Standing in a shop with the record in your hand, "only the German
          press" is the difference between a find and a mistake — and it has
          been sitting in Discogs, unread by this app, the whole time.
        -->
      <p
        v-if="detail?.wantNote"
        class="flex items-start gap-2 rounded-fid-sm border border-fid-sig-wantlist/40 bg-fid-sig-wantlist/10 px-3 py-2 text-fid-sm text-fid-text"
      >
        <FidIcon name="bookmark" :size="16" class="shrink-0 text-fid-sig-wantlist" />
        {{ detail.wantNote }}
      </p>

      <!--
          The market numbers, whenever the enrichment pass paid for them. Shown
          even where neither signal fired: "40 im Angebot, Tiefstpreis 8 €" is
          the answer to "is this a find or mass-produced", and that question
          does not stop being interesting because the answer is no.
        -->
      <section
        v-if="match.marketNumForSale !== null"
        class="flex flex-col gap-1"
        aria-labelledby="sheet-market"
      >
        <h3 id="sheet-market" class="text-fid-sm font-medium text-fid-text">
          {{ d.sheet.market }}
        </h3>
        <p class="text-fid-sm text-fid-text-muted">
          {{ d.sheet.forSale(count(match.marketNumForSale), match.marketNumForSale === 1) }}
          <template v-if="marketLowest">
            · {{ d.sheet.lowest }}
            <span class="fid-num text-fid-text">{{ marketLowest }}</span></template
          >
        </p>
      </section>

      <!-- Every signal with its evidence — the follow-up to the sentence. -->
      <section class="flex flex-col gap-2" aria-labelledby="sheet-signals">
        <h3 id="sheet-signals" class="text-fid-sm font-medium text-fid-text">
          {{ d.sheet.signals }}
        </h3>
        <ul class="flex flex-col gap-2">
          <li
            v-for="signal in match.signals"
            :key="signal.type"
            class="rounded-fid-sm border px-3 py-2"
            :style="signalChipStyle(signal.type)"
          >
            <p class="flex items-baseline justify-between gap-3 text-fid-sm text-fid-text">
              {{ signalLabel(signal.type) }}
              <span class="fid-num text-fid-xs text-fid-text-muted">
                {{ Math.round(signal.confidence * 100) }} %
              </span>
            </p>
            <p v-if="evidenceOf(signal.evidence)" class="text-fid-xs text-fid-text-muted">
              {{ evidenceOf(signal.evidence) }}
            </p>
          </li>
        </ul>
      </section>

      <!--
          The pressing. Everything here is traceable to a field: "Neuauflage"
          is Discogs' own word, and the runout is printed verbatim so somebody
          can hold the record up and compare.
        -->
      <section
        v-if="match.pressing"
        class="flex flex-col gap-2"
        aria-labelledby="sheet-pressing"
      >
        <h3 id="sheet-pressing" class="text-fid-sm font-medium text-fid-text">
          {{ d.sheet.pressing }}
        </h3>

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

        <p class="text-fid-sm text-fid-text-muted">
          <template v-if="match.pressing.country">{{ match.pressing.country }}</template>
          <template v-if="match.pressing.year">
            · <span class="fid-num">{{ match.pressing.year }}</span></template
          >
          <template v-if="match.pressing.plant">
            · {{ d.sheet.plant }} {{ match.pressing.plant }}</template
          >
          <template v-if="match.pressing.freeText.length">
            · {{ match.pressing.freeText.join(', ') }}</template
          >
        </p>

        <ul v-if="match.pressing.stamps.length" class="flex flex-col gap-1">
          <li
            v-for="stamp in match.pressing.stamps"
            :key="stamp.key"
            class="text-fid-sm text-fid-text-muted"
          >
            <span class="text-fid-text">{{ stampText(stamp).label }}</span> –
            {{ stampText(stamp).note }}
          </li>
        </ul>

        <!-- Printed verbatim: this is what you compare against the record. -->
        <ul v-if="match.pressing.runouts.length" class="flex flex-col gap-1">
          <li
            v-for="runout in match.pressing.runouts"
            :key="runout"
            class="font-fid-mono text-fid-xs break-all text-fid-text-muted"
          >
            {{ runout }}
          </li>
        </ul>
      </section>

      <CatalogRunGrid v-if="detail?.catalogue" :run="detail.catalogue" />

      <section
        v-if="detail && detail.discography.length > 0"
        class="flex flex-col gap-2"
        aria-labelledby="sheet-disc"
      >
        <h3 id="sheet-disc" class="text-fid-sm font-medium text-fid-text">
          {{ d.sheet.discography }}
        </h3>
        <ul class="flex flex-col gap-1">
          <li
            v-for="entry in detail.discography"
            :key="entry.artist"
            class="text-fid-sm text-fid-text-muted"
          >
            <span class="text-fid-text">{{ entry.artist }}</span> –
            {{ d.sheet.owned(count(entry.owned), m.mainReleases(count(entry.total))) }}
            <template v-if="entry.from > 0">{{ years(entry) }}</template>
          </li>
        </ul>
      </section>

      <section
        v-if="detail && detail.connections.length > 0"
        class="flex flex-col gap-2"
        aria-labelledby="sheet-links"
      >
        <h3 id="sheet-links" class="text-fid-sm font-medium text-fid-text">
          {{ d.sheet.connections }}
        </h3>
        <p class="text-fid-sm text-fid-text-muted">
          {{ detail.connections.map((c) => c.name).join(' · ') }}
        </p>
      </section>

      <div
        class="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-fid-border pt-4"
      >
        <div class="flex gap-1" role="group" :aria-label="d.match.feedback">
          <!-- Same pair of words as on the card, see MatchCard.vue. -->
          <button
            v-for="option in SHOWN_VERDICTS"
            :key="option.key"
            type="button"
            :aria-pressed="verdict === option.key"
            class="fid-lift inline-flex min-h-11 items-center gap-2 rounded-fid-sm border px-3 text-fid-sm transition-colors"
            :class="
              verdict === option.key
                ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                : 'border-fid-field text-fid-text-muted hover:text-fid-text'
            "
            @click="judge(match, option.key)"
          >
            <FidIcon :name="option.icon" :size="16" />
            {{
              verdict === option.key
                ? d.match.verdictsDone[option.key]
                : d.match.verdicts[option.key]
            }}
          </button>
        </div>

        <!--
          Hearing it, before deciding about it (M31).

          A search at the chosen service, and the label says so: Fidelity
          cannot know Spotify's id for a record without asking Spotify, and
          asking needs an account and a key.
        -->
        <a
          v-if="listenTo && listenName"
          class="fid-lift inline-flex min-h-11 items-center gap-2 fid-field-raised px-4 text-fid-sm font-medium text-fid-text"
          :href="listenTo"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ d.sheet.listen(listenName) }}
          <FidIcon name="external-link" :size="14" />
        </a>

        <a
          class="fid-lift inline-flex min-h-11 items-center gap-2 fid-field-raised px-4 text-fid-sm font-medium text-fid-text"
          :href="`https://www.discogs.com/sell/item/${match.listingId}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ d.sheet.atDiscogs }}
          <!--
              The arrow out of the box. A link that leaves the app and lands in
              a new tab should say so beforehand — before, it was a text link
              like any other, and the jump came unannounced.
            -->
          <FidIcon name="external-link" :size="14" />
        </a>

        <button
          v-if="match && !wanted"
          type="button"
          class="fid-lift inline-flex min-h-11 items-center gap-2 rounded-fid-sm border border-fid-field px-3 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
          @click="want()"
        >
          <FidIcon name="bookmark" :size="14" />
          {{ d.sheet.want }}
        </button>
        <span
          v-else-if="wanted"
          class="inline-flex min-h-11 items-center gap-2 px-3 text-fid-sm text-fid-sig-wantlist"
        >
          <FidIcon name="bookmark" :size="14" />
          {{ d.sheet.wanted }}
        </span>
      </div>
    </template>

    <!--
      The find is gone, and it says so instead of nothing.

      Five digs are kept, so a newer one eventually drops an older one and the
      record behind a tile on the start page goes with it. That used to render
      as an empty sheet under a loading title — the one state the user reads
      as "the app is broken".
    -->
    <template v-else-if="state === 'gone'">
      <ErrorNote v-if="failed" :cause="failed" />
      <p v-else class="max-w-prose text-fid-base text-fid-text-muted">
        {{ d.sheet.gone }}
        <NuxtLink to="/dig" class="text-fid-accent underline underline-offset-4">
          {{ d.sheet.goneAction }}
        </NuxtLink>
      </p>
    </template>
  </SheetFrame>
</template>
