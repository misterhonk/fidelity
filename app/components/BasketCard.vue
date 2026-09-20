<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import { reasonFor } from '~/i18n/reason'

import type { BasketPlan, BasketSummary } from '#shared/types'
import type { CompareResult } from '~~/worker/basket/compare'

import { useBasketMessages } from '~/i18n/basket'

const b = useBasketMessages()
const m = useMessages()

/**
 * One basket, which is one parcel.
 *
 * Extracted from the basket page the day baskets stopped being singular. Every
 * number in here — subtotal, postage tier, marginal cost, the fill-up plan —
 * is per shipment and always was; what changed is that a shopping session
 * holds several shipments at once, which is what a shopping session is.
 *
 * Each card keeps its own editing state. Two shops open at the same time with
 * one shared "editing" flag would open both tables at once, and saving one
 * would look like saving the other.
 */
/*
 * `DeepReadonly` because that is what the shared basket state hands out: the
 * composable wraps its ref so no component can write into everybody else's
 * copy. Nothing here mutates the summary — every change goes through the
 * worker and comes back as a new one.
 */
const props = defineProps<{ summary: DeepReadonly<BasketSummary> }>()

const { call } = useFidelityWorker()
const { refresh } = useBasket()

/*
 * The same basket, at the other shops (M29).
 *
 * "Five records at one shop for €100 — could another have the same five for
 * €80?" There is no documented way to ask Discogs who else sells a release, so
 * the answer comes out of the stock rows the digs already wrote: free, and
 * limited to the six hours those rows may live (rule 4).
 *
 * On demand rather than on load. A basket page with four shops on it would
 * otherwise run four joins over every dig before anybody asked a question.
 */
const comparison = ref<CompareResult | null>(null)
const comparing = ref(false)
const compareFailed = ref<unknown>(null)

async function compare() {
  if (comparing.value) return
  comparing.value = true
  compareFailed.value = null

  try {
    comparison.value = await call('compare.basket', { dealer: props.summary.dealer })
  } catch (cause) {
    compareFailed.value = cause
  } finally {
    comparing.value = false
  }
}

/** Cheapest first is the order the worker sorts in; this is only the verdict. */
const cheaperFound = computed(() =>
  (comparison.value?.offers ?? []).some((offer) => (offer.delta ?? 0) < 0),
)

/*
 * Every row at once — a basket is short.
 *
 * No observer here, unlike the dig list: a basket holds a handful of records
 * and every one of them is on screen. Watching them into view would be
 * machinery for nothing.
 */
const { coverFor, request: requestCovers } = useCovers()
watch(
  () => props.summary.lines.map((line) => line.releaseId),
  (releaseIds) => void requestCovers([...releaseIds]),
  { immediate: true },
)

const error = ref<unknown>(null)

async function remove(listingId: number) {
  await call('basket.remove', { listingId })
  await refresh()
}

/** Empties this shipment, line by line — the other shops are untouched. */
async function clearThisOne() {
  for (const line of props.summary.lines) {
    await call('basket.remove', { listingId: line.listingId })
  }
  await refresh()
}

/** How many of the suggestions clear the dealer's floor on their own. */
const closers = computed(() => props.summary.candidates.filter((c) => c.closesGap).length)

// --- Is this still there? ---------------------------------------------------

/** What the button will actually cost: one request per line still on offer. */
const stillToCheck = computed(() => props.summary.lines.filter((line) => !line.sold).length)

const checking = ref(false)
const checkProgress = ref<{ done: number; total: number; sold: number } | null>(null)
const checkResult = ref<string | null>(null)

async function checkStock() {
  if (checking.value) return

  checking.value = true
  checkResult.value = null
  error.value = null

  try {
    const before = stillToCheck.value
    await call('basket.refresh', undefined, {
      onProgress: (progress) => {
        checkProgress.value = progress
      },
    })
    await refresh()

    const sold = props.summary.lines.filter((line) => line.sold).length
    checkResult.value =
      sold === 0 ? b.value.allStillThere(before) : b.value.someSold(count(sold))
  } catch (cause) {
    error.value = cause
  } finally {
    checking.value = false
    checkProgress.value = null
  }
}

// --- The hand-over to Discogs (M20 #9) ---------------------------------------
//
// One link at a time, the next one moving up, and the memory of which are
// done in the basket item itself — so a closed tab or a reload loses nothing.
// The cart at Discogs cannot be filled from here (docs/02); this is the way
// there made short.
const handing = computed({
  get: () => handingByDealer.has(props.summary.dealer),
  set: (on: boolean) => {
    if (on) handingByDealer.add(props.summary.dealer)
    else handingByDealer.delete(props.summary.dealer)
  },
})
const openLines = computed(() => props.summary.lines.filter((line) => !line.sold))
const handedLines = computed(() => openLines.value.filter((line) => line.atDiscogsAt))
const nextToHand = computed(() => openLines.value.find((line) => !line.atDiscogsAt) ?? null)
const handingShown = computed(() => handing.value || handedLines.value.length > 0)

/** Marks the line on the click that opens it; the link itself opens the tab. */
async function markHanded(listingId: number) {
  handing.value = true
  await call('basket.handedOver', { listingId, at: Date.now() })
  await refresh()
}

async function resetHanding() {
  for (const line of handedLines.value) {
    await call('basket.handedOver', { listingId: line.listingId, at: null })
  }
  handing.value = false
  await refresh()
}

// --- Entering a shipping table by hand -------------------------------------

/* The read-off field (M34.3). */
const liveCount = computed(() => props.summary.lines.filter((line) => !line.sold).length)
const readOffPrice = ref<number | null>(null)

async function readOff() {
  const price = readOffPrice.value
  if (!price || price <= 0 || liveCount.value === 0) return
  error.value = null
  try {
    await call('basket.readOff', {
      dealer: props.summary.dealer,
      items: liveCount.value,
      price,
      currency: props.summary.currency || 'EUR',
    })
    readOffPrice.value = null
    await refresh()
  } catch (cause) {
    error.value = cause
  }
}

const editing = ref(false)
const rows = ref<{ minItems: number; maxItems: number | null; price: number }[]>([
  { minItems: 1, maxItems: 1, price: 0 },
])

function addRow() {
  const last = rows.value.at(-1)
  const from = last?.maxItems === null ? (last.minItems ?? 1) + 1 : (last?.maxItems ?? 0) + 1
  rows.value = [...rows.value, { minItems: from, maxItems: from, price: 0 }]
}

async function saveShipping() {
  error.value = null
  try {
    await call('basket.setShipping', {
      dealer: props.summary.dealer,
      tiers: rows.value
        .filter((row) => row.price > 0 && row.minItems > 0)
        .map((row) => ({
          minItems: row.minItems,
          maxItems: row.maxItems,
          price: row.price,
          currency: props.summary.currency || 'EUR',
        })),
    })
    editing.value = false
    await refresh()
  } catch (cause) {
    error.value = cause
  }
}

/** Seeded from whatever is already known, so editing beats retyping. */
watch(editing, (open) => {
  if (!open) return
  const curve = props.summary.curve.filter((point) => point.total !== null)
  rows.value =
    curve.length > 0
      ? curve.map((point) => ({
          minItems: point.items,
          maxItems: point.items,
          price: point.total ?? 0,
        }))
      : [{ minItems: 1, maxItems: 1, price: 0 }]
})

// --- The optimiser --------------------------------------------------------

const budget = ref<number | null>(null)
const plan = ref<BasketPlan | null>(null)
const planning = ref(false)

/**
 * "What would you buy at this dealer for X?"
 *
 * A suggestion, not an order. It never touches the basket by itself — being
 * shown a plan and having one applied to your shopping list are different
 * things, and only one of them is reversible without annoyance.
 */
async function makePlan() {
  if (!budget.value || budget.value <= 0 || planning.value) return
  planning.value = true
  error.value = null
  try {
    plan.value = await call('basket.plan', {
      dealer: props.summary.dealer,
      budget: budget.value,
    })
  } catch (cause) {
    error.value = cause
  } finally {
    planning.value = false
  }
}

const peak = computed(() =>
  Math.max(1, ...props.summary.curve.map((point) => point.perItem ?? 0)),
)
</script>

<template>
  <article class="fid-lift flex flex-col gap-6 rounded-fid-md border border-fid-border p-5">
    <ErrorNote v-if="error" :cause="error" />
    <section class="flex flex-col gap-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="flex items-center gap-3 text-fid-xl font-bold text-fid-text">
          <ShopLogo :dealer="summary.dealer" :avatar-url="summary.avatarUrl" :size="32" />
          {{ summary.displayName }}
        </h2>
        <div class="flex items-baseline gap-4">
          <button
            type="button"
            class="fid-action text-fid-sm text-fid-accent underline underline-offset-4 disabled:opacity-50"
            :disabled="checking"
            @click="checkStock()"
          >
            {{ b.stillThere
            }}<template v-if="stillToCheck > 0">
              <span class="fid-num"> ({{ stillToCheck }})</span></template
            >
          </button>
          <!--
            This shop's basket, not every shop's. "Alles leeren" is on the page
            above, where it can say how many shops it is about to empty.
          -->
          <button
            type="button"
            class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
            @click="clearThisOne()"
          >
            {{ b.clearThis }}
          </button>
        </div>
      </div>

      <!--
        The cost is named before it is spent, and while it runs the count
        moves — a rate-limited loop with no visible progress reads as broken.
      -->
      <p v-if="checking" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ m.common.asking }}
        <template v-if="checkProgress">
          {{ m.common.ofTotal(count(checkProgress.done), count(checkProgress.total)) }}
        </template>
      </p>
      <p v-else-if="checkResult" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ checkResult }}
      </p>

      <ul class="flex flex-col gap-2">
        <li
          v-for="line in summary.lines"
          :key="line.listingId"
          class="flex items-center gap-3 rounded-fid-sm border px-3 py-2"
          :class="line.sold ? 'border-fid-border/50' : 'border-fid-border'"
        >
          <!--
            The cover, here too.

            A basket is the one list where somebody checks that what they are
            about to spend money on is what they meant — and a row of titles is
            the slowest possible way to do that. Five records, five covers
            already in the store or five requests: cheap, and the only place in
            the app where a wrong record costs real money.
          -->
          <img
            v-if="coverFor(line.releaseId)"
            :src="coverFor(line.releaseId)!.thumbUrl"
            alt=""
            loading="lazy"
            decoding="async"
            width="40"
            height="40"
            class="size-10 shrink-0 rounded-[4px] bg-fid-inset object-cover"
            :class="line.sold ? 'opacity-50' : ''"
          />
          <span
            v-else
            class="flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-fid-inset text-fid-text-muted"
            aria-hidden="true"
          >
            <FidIcon name="record" :size="18" />
          </span>

          <div class="flex min-w-0 grow flex-wrap items-baseline gap-x-3 gap-y-1">
            <!--
            Every line goes to its own listing, because that is the only
            place the record can actually be bought.

            Discogs has no cart in its API — `/marketplace/cart` answers 404
            where a real endpoint answers 401 (measured 2026-08-10). So this
            list cannot become a Discogs cart by itself; what it can do is
            put every record one tap away from the "Add to Cart" button on
            its own page.

            The title takes a whole line on a phone rather than an ellipsis.
            A basket holds five records, not five hundred — there is no density
            to protect, and "Wighnomy Brothers & Robag Wruhme – Polytikk…" is a
            record nobody can check against what they meant to buy.
          -->
            <OutwardLink
              v-if="!line.sold"
              tone="inherit"
              class="min-w-0 grow basis-full text-fid-sm text-fid-text @sm:basis-auto"
              :to="`https://www.discogs.com/sell/item/${line.listingId}`"
              >{{ line.title || b.unknownRecord }}</OutwardLink
            >
            <span
              v-else
              class="min-w-0 grow basis-full text-fid-sm text-fid-text-muted line-through @sm:basis-auto"
            >
              {{ line.title || b.unknownRecord }}
            </span>
            <!--
            Sold. Shown rather than deleted — that removal is the collector's
            call — but no price: it is not an offer any more, and it no
            longer counts towards the total or the postage tier.
          -->
            <span v-if="line.sold" class="shrink-0 text-fid-xs text-fid-sig-gap">
              {{ b.line.sold }}
            </span>
            <!-- Already opened on the way to the cart: the hand-over's memory, shown. -->
            <span v-else-if="line.atDiscogsAt" class="shrink-0 text-fid-xs text-fid-text-muted">
              ✓ {{ b.atDiscogs }}
            </span>
            <!--
            Six hours on the price may not be shown any more — the same rule
            a dig lives under (CLAUDE.md rule 4). The record stays in the
            basket; only the number goes.
          -->
            <span v-else-if="line.priceExpired" class="shrink-0 text-fid-xs text-fid-sig-gap">
              {{ b.line.priceExpired }}
            </span>
            <span v-else class="fid-num shrink-0 text-fid-sm text-fid-text">
              {{ money(line.price, line.currency) }}
            </span>
            <button
              type="button"
              class="fid-action shrink-0 text-fid-xs text-fid-text-muted underline underline-offset-4"
              :aria-label="b.line.remove(line.title || b.unknownRecord)"
              @click="remove(line.listingId)"
            >
              {{ b.line.removeShort }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4">
      <dl class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-fid-sm">
        <dt class="text-fid-text-muted">{{ b.records }}</dt>
        <dd class="fid-num text-right text-fid-text">{{ summary.lines.length }}</dd>

        <dt class="text-fid-text-muted">{{ b.subtotal }}</dt>
        <dd class="fid-num text-right text-fid-text">
          {{ money(summary.subtotal, summary.currency) ?? '–' }}
        </dd>

        <dt class="text-fid-text-muted">
          {{ b.shipping }}
          <span v-if="summary.shippingSource" class="text-fid-xs">
            ({{
              summary.shippingConfirmedBy
                ? b.sourceShared(summary.shippingConfirmedBy)
                : b.source[summary.shippingSource]
            }})
          </span>
        </dt>
        <dd class="fid-num text-right text-fid-text">
          {{ money(summary.shipping, summary.currency) ?? b.shippingUnknown }}
          <span v-if="summary.shippingConverted" class="block text-fid-xs text-fid-text-muted">
            {{ b.converted(summary.shippingConverted.from) }}
          </span>
        </dd>

        <dt class="font-medium text-fid-text">{{ b.total }}</dt>
        <dd class="fid-num text-right font-bold text-fid-text">
          {{ money(summary.total, summary.currency) ?? '–' }}
        </dd>

        <dt class="text-fid-text-muted">{{ b.perRecord }}</dt>
        <dd class="fid-num text-right text-fid-text-muted">
          {{ money(summary.perItem, summary.currency) ?? '–' }}
        </dd>
      </dl>

      <p v-if="summary.subtotal === null" class="text-fid-sm text-fid-sig-gap">
        {{ b.subtotalExpired }}
      </p>

      <p v-if="summary.missingToMinimum !== null" class="fid-num text-fid-sm text-fid-sig-gap">
        {{
          b.missingToMinimum(
            money(summary.missingToMinimum, summary.currency) ?? '',
            money(summary.minOrderTotal, summary.currency) ?? '',
          )
        }}
      </p>

      <!-- The sentence the whole feature exists for (docs/00 §7). -->
      <p v-if="summary.advice" class="fid-num text-fid-base text-fid-text">
        {{
          b.advice(
            summary.advice.addItems,
            money(summary.advice.perItemNow, summary.currency) ?? '',
            money(summary.advice.perItemThen, summary.currency) ?? '',
          )
        }}
      </p>

      <p v-if="summary.shippingSource === 'parsed'" class="text-fid-xs text-fid-text-muted">
        {{ b.parsedFrom
        }}<template v-if="summary.shippingSection">
          {{ b.parsedSection(summary.shippingSection) }}</template
        ><template v-if="summary.shippingMatched.length">
          {{ b.parsedMatched(summary.shippingMatched.join(' · ')) }}</template
        >. {{ b.parsedWrong }}
      </p>

      <!--
        What the parser failed on — and what it would not have.
        Where he gives up, the screen used to say "trag die Staffel ein" and
        leave somebody to guess what he had been hoping for. He has carried a
        list of the shapes he reads since he was written, exported and captioned
        "for the interface to show when it fails". No interface ever showed it.
      -->
      <!--
        The one figure that is not a guess (M34.2). Discogs names the postage
        for one record to your address; for a basket of one it is the line
        above, for more it stands here beside the table as the floor.
      -->
      <p v-if="summary.shipsHere === false" class="text-fid-sm text-fid-sig-gap">
        {{ b.noShipping }}
      </p>
      <!-- "Free delivery above £75", read off the shop's text (M34.3): the threshold and the distance to it. -->
      <p v-if="summary.freeOver" class="fid-num text-fid-xs text-fid-text-muted">
        {{
          summary.freeOver.missing === 0
            ? b.freeOverReached(money(summary.freeOver.amount, summary.currency) ?? '')
            : b.freeOverMissing(
                money(summary.freeOver.amount, summary.currency) ?? '',
                money(summary.freeOver.missing, summary.currency) ?? '',
              )
        }}
      </p>
      <p
        v-else-if="summary.postageNamed && summary.shippingSource !== 'discogs'"
        class="fid-num text-fid-xs text-fid-text-muted"
      >
        {{
          b.namedForOne(
            money(
              summary.postageNamed.original?.value ?? summary.postageNamed.value,
              summary.postageNamed.original?.currency ?? summary.postageNamed.currency,
            ) ?? '',
            summary.postageNamed.original
              ? money(summary.postageNamed.value, summary.postageNamed.currency)
              : null,
          )
        }}
      </p>

      <details v-if="summary.shippingSource === null" class="group">
        <summary
          class="fid-action cursor-pointer list-none text-fid-sm text-fid-text-muted hover:text-fid-text"
        >
          {{ summary.shippingByWeight ? b.weightLabel : b.unknownLabel }}
        </summary>
        <div class="mt-2 flex flex-col gap-2">
          <!--
            Two different failures, and only one of them is a failure.

            A text the parser could not read is one thing; a shop that prices
            by grams is another, and no parser will ever read that into a table
            per record. Naming it turns "Fidelity cannot do this" into "here is
            what to type", which is the whole difference.
          -->
          <p class="max-w-prose text-fid-sm text-fid-text-muted">
            {{ summary.shippingByWeight ? b.weightAbout : b.unknownAbout }}
          </p>
          <ul v-if="!summary.shippingByWeight" class="flex flex-col gap-1">
            <li
              v-for="shape in UNDERSTOOD_SHAPES"
              :key="shape"
              class="font-fid-mono text-fid-xs text-fid-text-muted"
            >
              {{ shape }}
            </li>
          </ul>

          <!--
            The shop's own words, verbatim, next to the form that needs them.

            They have been on the device since the dig that met the shop and
            were shown on one screen the postage table is not entered on. Asked
            for in as many words: "can you output the dealer's shipping tiers in
            Fidelity, so a human can transfer them into the table?"
          -->
          <template v-if="summary.shippingNote">
            <p class="text-fid-xs text-fid-text-muted">{{ b.noteLabel }}</p>
            <pre
              class="max-w-prose overflow-x-auto rounded-fid-sm bg-fid-inset p-3 font-fid-mono text-fid-xs whitespace-pre-wrap text-fid-text"
              >{{ summary.shippingNote }}</pre>
          </template>
        </div>
      </details>

      <!--
        The read-off field (M34.3): the one figure Discogs' own cart shows for
        exactly this basket, typed in once and kept as a tier for this count.
        The shortest road to a right number for two or more records.
      -->
      <form
        v-if="liveCount > 0"
        class="flex flex-wrap items-end gap-2"
        @submit.prevent="readOff"
      >
        <label class="flex min-w-48 flex-col gap-1 text-fid-xs text-fid-text-muted">
          {{ b.readOff.label(liveCount) }}
          <input
            v-model.number="readOffPrice"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0"
            :title="b.readOff.hint"
            class="fid-field px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
          />
        </label>
        <button
          type="submit"
          :disabled="!readOffPrice || readOffPrice <= 0"
          class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        >
          {{ b.readOff.take }}
        </button>
      </form>

      <button
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
        @click="editing = !editing"
      >
        {{ summary.shippingSource === 'user' ? b.editTiers : b.enterTiers }}
      </button>
    </section>

    <!--
      The same basket, at the other shops (M29).

      On demand: a page with four shops on it would otherwise run four joins
      over every dig before anybody asked a question.
    -->
    <section class="flex flex-col gap-3 border-t border-fid-border pt-4">
      <button
        type="button"
        :disabled="comparing"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        @click="compare"
      >
        {{ comparing ? b.compare.busy : b.compare.start }}
      </button>

      <ErrorNote v-if="compareFailed" :cause="compareFailed" />

      <template v-if="comparison">
        <!--
          The denominator, always. An empty answer means "not cheaper at your
          shops", and letting it read as "not cheaper anywhere" would be the
          same mistake as an acquittal without a horizon.
        -->
        <p class="max-w-prose text-fid-sm text-fid-text-muted">
          {{ b.compare.scope(comparison.looked) }}
        </p>

        <ul v-if="comparison.offers.length > 0" class="flex flex-col gap-3">
          <li
            v-for="offer in comparison.offers"
            :key="offer.dealer"
            class="flex flex-col gap-1 rounded-fid-sm border p-3"
            :class="(offer.delta ?? 0) < 0 ? 'border-fid-accent/40' : 'border-fid-border'"
          >
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-fid-base font-medium text-fid-text">
                {{ offer.displayName }}
              </span>
              <span class="fid-num text-fid-sm text-fid-text-muted">
                {{ b.compare.covered(offer.covered, summary.lines.length) }}
              </span>
            </p>

            <!--
              The combined number, not the shop's own. Four of five somewhere
              else is a saving only once the fifth has been paid for a second
              time — a second parcel and a second postage tier.
            -->
            <p v-if="offer.combined !== null" class="fid-num text-fid-base text-fid-text">
              {{ money(offer.combined, offer.currency) }}
              <span
                v-if="offer.delta !== null"
                :class="offer.delta < 0 ? 'text-fid-accent' : 'text-fid-text-muted'"
              >
                {{
                  offer.delta < 0
                    ? b.compare.saves(money(-offer.delta, offer.currency) ?? '')
                    : b.compare.costs(money(offer.delta, offer.currency) ?? '')
                }}
              </span>
            </p>
            <p v-else class="text-fid-sm text-fid-sig-gap">{{ b.compare.noPostage }}</p>

            <p v-if="offer.rest" class="text-fid-sm text-fid-text-muted">
              {{
                b.compare.rest(
                  offer.rest.items,
                  summary.displayName,
                  money(offer.rest.total ?? offer.rest.subtotal, offer.currency) ?? '',
                )
              }}
            </p>

            <p
              v-if="offer.better > 0 || offer.worse > 0"
              class="text-fid-sm text-fid-text-muted"
            >
              <template v-if="offer.better > 0">{{ b.compare.better(offer.better) }}</template>
              <template v-if="offer.better > 0 && offer.worse > 0"> · </template>
              <template v-if="offer.worse > 0">{{ b.compare.worse(offer.worse) }}</template>
            </p>
          </li>
        </ul>

        <p v-else class="max-w-prose text-fid-base text-fid-text-muted">
          {{ cheaperFound ? '' : b.compare.nothing }}
        </p>

        <!--
          Where to look next. It ranks; it does not fetch — digging one of
          these is minutes of somebody's rate limit and stays their decision.
        -->
        <div v-if="comparison.candidates.length > 0" class="flex flex-col gap-2">
          <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ b.compare.tryThese }}</p>
          <nav class="flex flex-wrap gap-2" :aria-label="b.compare.tryThese">
            <NuxtLink
              v-for="candidate in comparison.candidates"
              :key="candidate.dealer"
              :to="{ path: '/dig', query: { dealer: candidate.dealer } }"
              class="fid-action rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text-muted hover:text-fid-text"
            >
              {{ candidate.displayName }}
              <span class="fid-num ml-1.5 text-fid-xs opacity-70">
                {{ Math.round(candidate.overlap * 100) }} %
              </span>
            </NuxtLink>
          </nav>
        </div>
      </template>
    </section>

    <!-- Bars are <div>s and the grid is CSS Grid (docs/12 §2). -->
    <section
      v-if="summary.curve.some((point) => point.perItem !== null)"
      class="flex flex-col gap-2"
      aria-labelledby="curve"
    >
      <h3 id="curve" class="text-fid-sm font-medium text-fid-text">{{ b.curve }}</h3>
      <dl class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 gap-y-1">
        <template v-for="point in summary.curve" :key="point.items">
          <dt class="fid-num text-fid-xs text-fid-text-muted">{{ point.items }}×</dt>
          <dd class="min-w-0">
            <span
              class="block h-1.5 rounded-full"
              :class="point.items === summary.lines.length ? 'bg-fid-accent' : 'bg-fid-inset'"
              :style="{ width: `${Math.max(2, ((point.perItem ?? 0) / peak) * 100)}%` }"
            />
          </dd>
          <dd class="fid-num text-right text-fid-xs text-fid-text-muted">
            {{ money(point.perItem, summary.currency) ?? '–' }}
          </dd>
        </template>
      </dl>
    </section>

    <section
      v-if="editing"
      class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
    >
      <h3 class="text-fid-sm font-medium text-fid-text">{{ b.tiersTitle }}</h3>
      <p class="text-fid-xs text-fid-text-muted">{{ b.tiersAbout }}</p>

      <div v-for="(row, index) in rows" :key="index" class="flex flex-wrap items-center gap-2">
        <label class="sr-only" :for="`from-${index}`">{{ b.tiersFrom }}</label>
        <input
          :id="`from-${index}`"
          v-model.number="row.minItems"
          type="number"
          min="1"
          class="w-16 fid-field px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
        />
        <span class="text-fid-sm text-fid-text-muted">{{ m.common.to }}</span>
        <label class="sr-only" :for="`to-${index}`">{{ b.tiersTo }}</label>
        <input
          :id="`to-${index}`"
          :value="row.maxItems ?? ''"
          type="number"
          min="1"
          :placeholder="b.tiersOpen"
          class="w-16 fid-field px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
          @input="
            row.maxItems =
              ($event.target as HTMLInputElement).value === ''
                ? null
                : Number(($event.target as HTMLInputElement).value)
          "
        />
        <label class="sr-only" :for="`price-${index}`">{{ b.tiersPrice }}</label>
        <input
          :id="`price-${index}`"
          v-model.number="row.price"
          type="number"
          min="0"
          step="0.01"
          class="w-24 fid-field px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
        />
        <span class="text-fid-sm text-fid-text-muted">{{ summary.currency }}</span>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
          @click="addRow"
        >
          {{ b.addTier }}
        </button>
        <button
          type="button"
          class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
          @click="saveShipping"
        >
          {{ m.common.save }}
        </button>
      </div>
    </section>

    <!--
      The optimiser. Greedy twice, then swap improvement — a shopping
      suggestion rather than a proof, and it says so.
    -->
    <section class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4">
      <h3 class="text-fid-sm font-medium text-fid-text">{{ b.budget.title }}</h3>
      <form class="flex flex-wrap items-center gap-2" @submit.prevent="makePlan">
        <label class="sr-only" for="budget">{{ b.budget.label }}</label>
        <input
          id="budget"
          v-model.number="budget"
          type="number"
          min="1"
          step="1"
          placeholder="60"
          class="w-24 fid-field px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
        />
        <span class="text-fid-sm text-fid-text-muted">
          {{ b.budget.including(summary.currency ?? '') }}
        </span>
        <button
          type="submit"
          :disabled="planning || !budget"
          class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        >
          {{ b.budget.compute }}
        </button>
      </form>

      <template v-if="plan">
        <p v-if="plan.chosen.length === 0" class="text-fid-sm text-fid-text-muted">
          {{ b.budget.tooSmall }}
        </p>
        <template v-else>
          <ul class="flex flex-col gap-1">
            <li
              v-for="item in plan.chosen"
              :key="item.listingId"
              class="flex items-baseline gap-3 text-fid-sm"
            >
              <span class="fid-num shrink-0 font-medium text-fid-text">{{ item.score }}</span>
              <span class="min-w-0 grow truncate text-fid-text">{{ item.title }}</span>
              <span class="fid-num shrink-0 text-fid-text-muted">
                {{ money(item.price, item.currency) }}
              </span>
            </li>
          </ul>
          <p class="fid-num text-fid-sm text-fid-text-muted">
            {{
              b.budget.result(
                plan.chosen.length,
                money(plan.goods, summary.currency) ?? '?',
                money(plan.shipping, summary.currency) ?? '?',
                money(plan.total, summary.currency) ?? '?',
              )
            }}
          </p>
          <p v-if="plan.belowMinimum" class="fid-num text-fid-sm text-fid-sig-gap">
            {{ b.budget.belowMinimum(money(summary.minOrderTotal, summary.currency) ?? '') }}
          </p>
          <p class="text-fid-xs text-fid-text-muted">{{ b.budget.caveat }}</p>
        </template>
      </template>
    </section>

    <!--
      What else this dealer has that scores well. The price ceiling is your
      own comfort price, not a number derived from the postage saving —
      nobody buys a record because it saves postage.
    -->
    <!--
      Having nothing to suggest is not one state, it is three — spelled out in
      `app/i18n/basket.ts`.
    -->
    <section
      v-if="summary.candidates.length === 0"
      class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4"
    >
      <h3 class="text-fid-sm font-medium text-fid-text">{{ b.candidates.title }}</h3>

      <p class="max-w-prose text-fid-sm text-fid-text-muted">
        {{
          !summary.dig
            ? b.candidates.neverDug
            : summary.dig.expired
              ? b.candidates.expired(since(summary.dig.at))
              : b.candidates.nothing(since(summary.dig.at))
        }}
      </p>

      <NuxtLink
        class="self-start text-fid-sm text-fid-text underline underline-offset-4"
        :to="{ path: '/dig', query: { dealer: summary.dealer } }"
      >
        {{ summary.dig ? b.candidates.digAgain : b.candidates.digNow(summary.displayName) }}
      </NuxtLink>
    </section>

    <section v-else class="flex flex-col gap-3" aria-labelledby="candidates">
      <h3 id="candidates" class="text-fid-sm font-medium text-fid-text">
        {{ b.candidates.title }}
      </h3>
      <p v-if="summary.missingToMinimum !== null" class="text-fid-xs text-fid-text-muted">
        {{ closers > 0 ? b.candidates.closers(closers) : b.candidates.noClosers }}
      </p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="candidate in summary.candidates"
          :key="candidate.listingId"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-fid-sm border border-fid-border px-3 py-2"
        >
          <span class="fid-num text-fid-sm font-medium text-fid-text">
            {{ candidate.score }}
          </span>
          <span
            class="min-w-0 grow text-fid-sm text-fid-text"
            :title="reasonFor(candidate.signals)"
          >
            {{ candidate.title }}
          </span>
          <span v-if="candidate.closesGap" class="text-fid-xs text-fid-text-muted">
            {{ b.candidates.closesGap }}
          </span>
          <span class="fid-num text-fid-sm text-fid-text-muted">
            {{ money(candidate.price, candidate.currency) }}
          </span>
        </li>
      </ul>
    </section>

    <!--
      What this button really does — the long version is in
      `app/i18n/basket.ts`.

      The actual action is one line up: every record links to its own listing,
      where the "Add to Cart" button lives. Discogs has no cart in its API —
      `/marketplace/cart` and `/users/{u}/cart` both answer 404 where an
      endpoint that merely needs a token answers 401 (measured 2026-08-10) —
      and it refuses to be embedded either (`x-frame-options: SAMEORIGIN`).
      So the last step is a tap per record, and saying so beats waiting for a
      button that cannot exist.
    -->
    <div class="flex flex-col gap-2 border-t border-fid-border pt-3">
      <p class="max-w-prose text-fid-sm text-fid-text-muted">
        {{ b.toBuy(summary.lines.length) }}
      </p>

      <!--
        The hand-over (M20 #9): the way to the cart made short. Not the cart
        itself — docs/02 measured that there is no endpoint, and the website's
        form is not ours — but one link at a time with the next one moving
        up, and a memory of which are done that survives a closed tab.
      -->
      <button
        v-if="!handingShown && openLines.length > 0"
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-4 py-2 text-fid-sm text-fid-text"
        @click="handing = true"
      >
        {{ b.handOver }}
      </button>

      <section
        v-if="handingShown"
        class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4"
        aria-live="polite"
      >
        <p class="max-w-prose text-fid-sm text-fid-text-muted">{{ b.handOverLead }}</p>
        <p class="fid-num text-fid-sm text-fid-text">
          {{ b.handOverProgress(count(handedLines.length), count(openLines.length)) }}
        </p>
        <OutwardLink
          v-if="nextToHand"
          class="self-start rounded-fid-sm border border-fid-accent px-4 py-2 text-fid-sm font-medium no-underline"
          :to="`https://www.discogs.com/sell/item/${nextToHand.listingId}`"
          @click="markHanded(nextToHand.listingId)"
          >{{ b.handOverNext(nextToHand.title || b.unknownRecord) }}</OutwardLink
        >
        <template v-else>
          <p class="text-fid-sm text-fid-text">{{ b.handOverDone(handedLines.length) }}</p>
          <OutwardLink to="https://www.discogs.com/sell/cart">{{ b.toCart }}</OutwardLink>
        </template>
        <button
          v-if="handedLines.length > 0"
          type="button"
          class="fid-action self-start text-fid-xs text-fid-text-muted underline underline-offset-4"
          @click="resetHanding()"
        >
          {{ b.handOverReset }}
        </button>
      </section>
      <a
        class="fid-action self-start gap-2 text-fid-sm text-fid-text underline underline-offset-4"
        :href="`https://www.discogs.com/seller/${summary.dealer}/profile`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ b.viewAtDiscogs(summary.displayName) }}
      </a>
    </div>
  </article>
</template>
