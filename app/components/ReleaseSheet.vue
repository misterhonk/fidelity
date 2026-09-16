<script setup lang="ts">
import type { LandedContext, Match, MatchDetail, ReleaseDetail } from '#shared/types'
import { landedPrice } from '#shared/shipping'
import { gradeKey } from '#shared/format'
import { reasonFor } from '~/i18n/reason'
import { pressingText, stampText } from '~/i18n/pressing'
import { useDigMessages } from '~/i18n/dig'

const d = useDigMessages()

const m = useMessages()
const props = defineProps<{ digId: string; listingId: number }>()
const emit = defineEmits<{ close: [] }>()

const { call } = useFidelityWorker()
const { online } = useOnline()
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

onMounted(async () => {
  try {
    const answer = await call('dig.detail', {
      digId: props.digId,
      listingId: props.listingId,
    })
    detail.value = answer
    state.value = answer ? 'ready' : 'gone'
    // Not awaited: the record is already on screen, and the lookup fills in
    // underneath it.
    if (answer) {
      void lookUp(answer.match.releaseId).then(readAhead)
      void postage(answer.dealer)
    }
  } catch (cause) {
    // A failure is not the same as a find that is gone, and the sentence for
    // it is `ErrorNote`'s, which says what broke.
    failed.value = cause
    state.value = 'gone'
  }
})

const match = computed(() => detail.value?.match ?? null)

/*
 * What it actually costs — price plus the postage this record adds.
 *
 * The list has had this since the shipping profiles landed, and the sheet has
 * not: the context is provided by the dig page and the sheet hangs in the
 * shell, outside that page, so nothing reaches it by injection. It asks for
 * itself instead, which costs no Discogs request — the tiers are on this
 * device and the basket count is a count.
 *
 * Missing where a shop has no known postage, which is most of them until
 * somebody has bought there. A missing line is the right answer then; a
 * guessed number would be worse than none.
 */
const landed = ref<LandedContext | null>(null)
const withPostage = computed(() => {
  const found = match.value
  if (!found || !landed.value) return null
  const total = landedPrice(found, landed.value)
  /*
   * Only where it differs from the price.
   *
   * The figure is marginal — what *this* record adds to the parcel — so at a
   * flat rate with something already in the basket it adds nothing, and the
   * box would print the same number twice under two headings. A second
   * identical number is not a second fact.
   */
  if (!total || total.postage <= 0) return null
  return money(total.total, total.currency)
})

/**
 * Asking Discogs about this one offer again (M31.18).
 *
 * One request, and afterwards the sheet reloads itself from the database so
 * the price, the two conditions and the seller's own words come back in place
 * — no navigation, no list to find your way back into.
 *
 * Three answers, and the record says which: it is still there, it has sold, or
 * the listing is gone entirely. The last two are not failures and do not read
 * as one; they are what somebody went to find out.
 */
const asking = ref(false)
const again = ref<'refreshed' | 'sold' | 'gone' | null>(null)

async function askAgain() {
  if (asking.value) return
  asking.value = true
  try {
    again.value = await call('dig.refreshOne', {
      digId: props.digId,
      listingId: props.listingId,
    })
    const answer = await call('dig.detail', {
      digId: props.digId,
      listingId: props.listingId,
    })
    if (answer) detail.value = answer
  } catch (cause) {
    failed.value = cause
  } finally {
    asking.value = false
  }
}

async function postage(dealer: string) {
  try {
    landed.value = await call('basket.landed', { dealer })
  } catch {
    // No postage known is a line that is simply not there.
    landed.value = null
  }
}

/*
 * Walking the list without leaving the sheet (M31.13).
 *
 * A find means something next to its neighbours, and until now comparing two
 * of them was close, scroll back, find the row, open. The arrows step through
 * the list exactly as it stands on the screen behind — the filter, the sort
 * and the shortlist first — and the sheet remounts on each step, because it
 * is a different record and everything in it has to be fetched again.
 *
 * Only where a list said what its order is. From the start page, a credit
 * graph or a shared dig there is nothing to step through and no arrows.
 */
const sheet = useReleaseSheet()
const walk = sheet.walk

function step(to: number | null) {
  if (to === null) return
  sheet.step(props.digId, to)
}

/**
 * Reading ahead, once somebody is actually reading along (M31.15).
 *
 * A record's detail is kept for ever once fetched, and for the finds whose
 * covers were fetched it is already there — the cover pass files the whole
 * answer, not just the picture. Below that window, though, every step costs a
 * request and 1,2 s of waiting on a screen that has nothing else to do.
 *
 * So: after the *first* arrow, the next one is looked up while this one is
 * being read. Not before — opening one record is no evidence that anybody
 * wants a second, and a request spent on a guess is a request spent. And not
 * further than one: reading ahead by five would be exactly the loop rule 2
 * forbids, dressed up as a courtesy.
 *
 * If the arrow is pressed while this is still in the air, the two are one
 * request and not two — the client joins them by address.
 */
async function readAhead() {
  if (!sheet.stepped.value) return
  const next = walk.value?.next
  if (next === null || next === undefined) return
  try {
    const found = await call('dig.detail', { digId: props.digId, listingId: next })
    if (found) await call('release.detail', { releaseId: found.match.releaseId })
  } catch {
    // A guess that does not come off is not an event. The arrow still works.
  }
}

/*
 * And from the keyboard: `←`/`→` and `k`/`j`, with the guard that keeps them
 * out of the note field and the search box (`useWalkKeys`).
 */
useWalkKeys((to) =>
  step(to === 'next' ? (walk.value?.next ?? null) : (walk.value?.previous ?? null)),
)

/**
 * What the record *is* — one lookup, and everything under it (M31.5).
 *
 * The shelf's sheet has fetched this for a long time: tracklist, credits,
 * run-out groove, styles, and the clips. A find's sheet fetched the same thing
 * for the clips alone and then showed none of the rest, so the same record
 * looked like two different records depending on which screen it was opened
 * from.
 *
 * One release, once, for a record somebody deliberately opened — the bargain
 * the covers make. Kept for ever after, so the second open costs nothing.
 */
const release = ref<ReleaseDetail | null>(null)
const looking = ref(false)

async function lookUp(releaseId: number) {
  looking.value = true
  try {
    release.value = await call('release.detail', { releaseId })
  } catch {
    // A record with less on it, not an error on the screen: everything above
    // this line came from storage and is already drawn.
    release.value = null
  } finally {
    looking.value = false
  }
}

/** What it sounds like — the find carries none of this, the lookup does. */
const tags = computed(() => {
  const found = release.value
  if (!found) return []
  return [...new Set([...(found.genres ?? []), ...(found.styles ?? [])])]
})

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

/**
 * A grade in words, for somebody who does not yet read Discogs' abbreviations.
 *
 * "Very Good Plus (VG+)" is a vocabulary item, not an answer. The sentence
 * behind it is the single biggest hurdle of the first weeks, and there is room
 * for it here — this is the screen where the decision is made.
 */
function gradeWord(condition: string | null | undefined): string | null {
  const key = gradeKey(condition)
  return key ? m.value.grades[key] : null
}

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
    <!--
      Where this record stands in the list, and the two either side of it.
      Icon-only, because three words beside a title is a second title — with
      the position spoken in full on each.
    -->
    <template v-if="walk" #tools>
      <button
        type="button"
        :disabled="walk.previous === null"
        :aria-label="d.sheet.previous"
        :title="d.sheet.previous"
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
        :aria-label="d.sheet.next"
        :title="d.sheet.next"
        class="fid-lift flex min-h-11 min-w-11 items-center justify-center fid-field-raised text-fid-text disabled:opacity-40"
        @click="step(walk.next)"
      >
        <FidIcon name="arrow-right" :size="18" aria-hidden="true" />
      </button>
    </template>

    <!--
      No title in the chrome once the record is here (M31.19).

      The masthead below carries the name at a size worth reading, and the
      same two words six millimetres above it in bold are a duplicate, not a
      heading. While it loads and when the find is gone there is no masthead,
      so the chrome says it instead.
    -->
    <template v-if="!match" #title>
      <template v-if="state === 'gone'">{{ d.sheet.goneTitle }}</template>
      <template v-else>{{ d.sheet.loading }}</template>
    </template>

    <template v-if="cover" #wash>
      <SleeveWash :src="cover.thumbUrl || cover.coverUrl" />
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
      <!--
        `shrink-0`, and it is not cosmetic.

        The sheet is a flex column, so its blocks shrink when the content is
        taller than the screen — and `overflow-hidden` resolves this one's
        automatic minimum size to zero, which means it can absorb the *whole*
        shrink and collapse to nothing. It did: the offer block made the head
        taller, and the head promptly rendered at zero pixels with its content
        clipped, while every sibling kept its size. Measured 2026-09-14.
      -->
      <RecordMasthead :cover="cover ?? null" :title="match.title" :artist="match.artist">
        <template #facts>
          <p v-if="meta" class="font-fid-mono text-fid-xs text-fid-text-muted">
            {{ meta }}
          </p>
        </template>

        <div v-if="price || match.condition || match.sleeve" class="flex flex-wrap gap-6">
          <p v-if="price" class="flex flex-col gap-1">
            <span class="fid-plate text-fid-text-muted">{{ d.sheet.offer.price }}</span>
            <span class="fid-num text-fid-base text-fid-text">{{ price }}</span>
          </p>
          <!--
                And what it actually costs. Absent where a shop's postage is
                not known, which is most of them until somebody has bought
                there — a missing line is the honest answer, a guessed number
                would not be.
              -->
          <p v-if="withPostage" class="flex min-w-0 flex-col gap-1">
            <span class="fid-plate text-fid-text-muted">{{ d.sheet.offer.landed }}</span>
            <span class="fid-num text-fid-base text-fid-text">{{ withPostage }}</span>
          </p>
          <!--
                Two gradings side by side, and which is which decides whether a
                record is worth buying. "Cover VG" and "VG" read as the same
                word twice; the disc and the sleeve do not.
              -->
          <p v-if="match.condition" class="flex min-w-0 flex-col gap-1">
            <span class="fid-plate flex items-center gap-2 text-fid-text-muted">
              <FidIcon name="record" :size="12" />
              {{ d.sheet.offer.media }}
            </span>
            <span class="text-fid-sm text-fid-text">{{ match.condition }}</span>
            <span
              v-if="gradeWord(match.condition)"
              class="max-w-64 text-fid-xs text-fid-text-muted"
            >
              {{ gradeWord(match.condition) }}
            </span>
          </p>
          <p v-if="match.sleeve" class="flex min-w-0 flex-col gap-1">
            <span class="fid-plate flex items-center gap-2 text-fid-text-muted">
              <FidIcon name="sleeve" :size="12" />
              {{ d.sheet.offer.sleeve }}
            </span>
            <span class="text-fid-sm text-fid-text">{{ match.sleeve }}</span>
            <span
              v-if="gradeWord(match.sleeve)"
              class="max-w-64 text-fid-xs text-fid-text-muted"
            >
              {{ gradeWord(match.sleeve) }}
            </span>
          </p>
        </div>

        <!--
              Six hours gone — and the way back, from here (M31.18).

              The dig-wide refresh is on the page behind this sheet and costs
              one request per find. For the one record somebody is actually
              looking at, that is thirty-two requests to answer a question
              about one. This asks about this one: a single listing, 1,2 s,
              and the row carries its own six hours afterwards.
            -->
        <div v-else-if="match.expired" class="flex max-w-prose flex-col items-start gap-3">
          <p class="text-fid-sm text-fid-text-muted">{{ d.expired }}</p>
          <p v-if="again !== null" class="text-fid-sm text-fid-text">
            {{ d.sheet.againSaid[again] }}
          </p>
          <button
            v-else
            type="button"
            :disabled="asking || !online"
            class="fid-action fid-tonal inline-flex min-h-11 items-center gap-2 rounded-fid-sm px-4 text-fid-sm font-medium disabled:opacity-50"
            @click="askAgain()"
          >
            <FidIcon name="arrow-up" :size="16" aria-hidden="true" />
            {{ asking ? d.sheet.asking : d.sheet.askAgain }}
          </button>
        </div>
      </RecordMasthead>

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

      <!--
        Every signal with its evidence — the follow-up to the sentence, and now
        with the number they add up to standing at the head of them.

        That is the real explanation of a score: not the formula behind a
        question mark, but the reasons themselves, immediately underneath.
      -->
      <section class="flex flex-col gap-3" aria-labelledby="sheet-signals">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <h3 id="sheet-signals" class="text-fid-sm font-medium text-fid-text">
            {{ d.sheet.signals }}
          </h3>
          <ScoreMark :score="match.score" block />
        </div>
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

      <!--
        Hearing it, before deciding about it (M31).

        The clips a record carries and the search at the chosen service, in one
        block — see ListenSection.vue for why those two have to be told apart.
      -->
      <ListenSection
        v-if="match"
        :artist="match.artist"
        :title="match.title ?? undefined"
        :videos="release?.videos ?? match.videos"
        :tracks="release?.tracks"
      />

      <ReleaseFacts :detail="release" :tags="tags" />

      <!--
        The row that has to stay reachable, at every width (M31.11).

        `-bottom-6` rather than `bottom-0`: a sticky child pins to its scroll
        container's *padding* box, and this sheet has a 24 px inset — pinned at
        zero it floated that far above the edge and the tracklist scrolled
        through the gap underneath it. Measured, not guessed.

        The sheet is eight sections tall, and the action used to live under the
        eighth (M31.10). It sticks to the bottom edge instead —
        the most settled pattern in mobile commerce, and here it is one
        line: the sheet scrolls inside itself, so `sticky` works without
        any fixed positioning. The negative margin and the padding put its
        background across the sheet's own inset, or the content would show
        through underneath it.
      -->
      <div
        class="sticky -bottom-6 -mx-6 mt-auto flex items-center justify-between gap-2 border-t border-fid-border bg-fid-surface px-6 pt-4 -mb-6 pb-6"
      >
        <!--
          Four controls do not fit across a 390 px phone with German words in
          them (M31.11 asked for one row; "Als gekauft" was taking two). So
          below `@md` the two verdicts give up their words and keep everything
          else: the same 44 px target, the whole action in `aria-label`, the
          same words under a pointer. That is the one case the icon rule
          allows — a row that has to stay narrow — and it allows it only like
          this.
        -->
        <div class="flex min-w-0 gap-1" role="group" :aria-label="d.match.feedback">
          <!-- Same pair of words as on the card, see MatchCard.vue. -->
          <button
            v-for="option in SHOWN_VERDICTS"
            :key="option.key"
            type="button"
            :aria-pressed="verdict === option.key"
            :aria-label="
              verdict === option.key
                ? d.match.verdictsDone[option.key]
                : d.match.verdicts[option.key]
            "
            :title="
              verdict === option.key
                ? d.match.verdictsDone[option.key]
                : d.match.verdicts[option.key]
            "
            class="fid-lift inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-fid-sm border px-3 text-fid-sm whitespace-nowrap transition-colors"
            :class="
              verdict === option.key
                ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                : 'border-fid-field text-fid-text-muted hover:text-fid-text'
            "
            @click="judge(match, option.key)"
          >
            <FidIcon :name="option.icon" :size="16" />
            <span class="hidden @md:inline">
              {{
                verdict === option.key
                  ? d.match.verdictsDone[option.key]
                  : d.match.verdicts[option.key]
              }}
            </span>
          </button>
        </div>

        <!--
          The one control here that is a direction rather than an action, and
          therefore the one that gives up its words when the row is tight
          (M31.11). Named for a screen reader and under a pointer — an icon
          without either is a rebus.
        -->
        <a
          class="fid-lift inline-flex size-11 shrink-0 items-center justify-center fid-field-raised text-fid-text"
          :href="`https://www.discogs.com/sell/item/${match.listingId}`"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="d.sheet.atDiscogs"
          :title="d.sheet.atDiscogs"
        >
          <FidIcon name="external-link" :size="16" />
        </a>

        <button
          v-if="match && !wanted"
          type="button"
          class="fid-lift inline-flex min-h-11 shrink-0 items-center gap-2 rounded-fid-sm border border-fid-field px-3 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
          :aria-label="d.sheet.want"
          :title="d.sheet.want"
          @click="want()"
        >
          <FidIcon name="heart" :size="16" />
          {{ d.sheet.wantShort }}
        </button>
        <span
          v-else-if="wanted"
          class="inline-flex min-h-11 items-center gap-2 px-3 text-fid-sm text-fid-sig-wantlist"
        >
          <FidIcon name="heart" :size="16" />
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
