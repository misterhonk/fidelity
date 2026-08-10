<script setup lang="ts">
import type { DeepReadonly } from 'vue'

import type { BasketPlan, BasketSummary, ShippingTier } from '#shared/types'

/**
 * Ein Korb, also eine Sendung.
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

const error = ref<unknown>(null)

function money(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
}

const number = new Intl.NumberFormat('de-DE')

/** Where the postage table came from — said out loud, never implied. */
const SOURCE_LABEL: Record<ShippingTier['source'], string> = {
  user: 'von dir eingetragen',
  bundled: 'aus den mitgelieferten Profilen',
  parsed: 'geschätzt aus dem Händlertext',
}

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
      sold === 0
        ? `Alles noch da – ${number.format(before)} ${before === 1 ? 'Platte' : 'Platten'}, Preise wieder aktuell.`
        : `${number.format(sold)} inzwischen verkauft. Der Rest ist wieder aktuell.`
  } catch (cause) {
    error.value = cause
  } finally {
    checking.value = false
    checkProgress.value = null
  }
}

// --- Entering a shipping table by hand -------------------------------------

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
 * "Was würdest du bei diesem Händler für X € kaufen?"
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
  <article class="flex flex-col gap-6 rounded-fid-md border border-fid-border p-5">
    <ErrorNote v-if="error" :cause="error" />
    <section class="flex flex-col gap-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-fid-xl font-bold text-fid-text">{{ summary.displayName }}</h2>
        <div class="flex items-baseline gap-4">
          <button
            type="button"
            class="fid-action text-fid-sm text-fid-accent underline underline-offset-4 disabled:opacity-50"
            :disabled="checking"
            @click="checkStock()"
          >
            Noch da?<template v-if="stillToCheck > 0">
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
            Diesen Korb leeren
          </button>
        </div>
      </div>

      <!--
        The cost is named before it is spent, and while it runs the count
        moves — a rate-limited loop with no visible progress reads as broken.
      -->
      <p v-if="checking" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        Frage nach …
        <template v-if="checkProgress">
          <span class="fid-num">{{ checkProgress.done }}</span> von
          <span class="fid-num">{{ checkProgress.total }}</span>
        </template>
      </p>
      <p v-else-if="checkResult" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ checkResult }}
      </p>

      <ul class="flex flex-col gap-2">
        <li
          v-for="line in summary.lines"
          :key="line.listingId"
          class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-fid-sm border px-3 py-2"
          :class="line.sold ? 'border-fid-border/50' : 'border-fid-border'"
        >
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
          <a
            v-if="!line.sold"
            class="min-w-0 grow basis-full text-fid-sm text-fid-text underline-offset-4 hover:underline @sm:basis-auto"
            :href="`https://www.discogs.com/sell/item/${line.listingId}`"
            target="_blank"
            rel="noopener noreferrer"
            >{{ line.title }}</a
          >
          <span
            v-else
            class="min-w-0 grow basis-full text-fid-sm text-fid-text-muted line-through @sm:basis-auto"
          >
            {{ line.title }}
          </span>
          <!--
            Sold. Shown rather than deleted — that removal is the collector's
            call — but no price: it is not an offer any more, and it no
            longer counts towards the total or the postage tier.
          -->
          <span v-if="line.sold" class="shrink-0 text-fid-xs text-fid-sig-gap"> verkauft </span>
          <!--
            Six hours on the price may not be shown any more — the same rule
            a dig lives under (CLAUDE.md rule 4). The record stays in the
            basket; only the number goes.
          -->
          <span v-else-if="line.priceExpired" class="shrink-0 text-fid-xs text-fid-sig-gap">
            Preis abgelaufen
          </span>
          <span v-else class="fid-num shrink-0 text-fid-sm text-fid-text">
            {{ money(line.price, line.currency) }}
          </span>
          <button
            type="button"
            class="fid-action shrink-0 text-fid-xs text-fid-text-muted underline underline-offset-4"
            :aria-label="`${line.title} entfernen`"
            @click="remove(line.listingId)"
          >
            raus
          </button>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4">
      <dl class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-fid-sm">
        <dt class="text-fid-text-muted">Platten</dt>
        <dd class="fid-num text-right text-fid-text">{{ summary.lines.length }}</dd>

        <dt class="text-fid-text-muted">Summe</dt>
        <dd class="fid-num text-right text-fid-text">
          {{ money(summary.subtotal, summary.currency) ?? '–' }}
        </dd>

        <dt class="text-fid-text-muted">
          Versand
          <span v-if="summary.shippingSource" class="text-fid-xs">
            ({{ SOURCE_LABEL[summary.shippingSource] }})
          </span>
        </dt>
        <dd class="fid-num text-right text-fid-text">
          {{ money(summary.shipping, summary.currency) ?? 'unbekannt' }}
        </dd>

        <dt class="font-medium text-fid-text">Gesamt</dt>
        <dd class="fid-num text-right font-bold text-fid-text">
          {{ money(summary.total, summary.currency) ?? '–' }}
        </dd>

        <dt class="text-fid-text-muted">pro Platte</dt>
        <dd class="fid-num text-right text-fid-text-muted">
          {{ money(summary.perItem, summary.currency) ?? '–' }}
        </dd>
      </dl>

      <p v-if="summary.subtotal === null" class="text-fid-sm text-fid-sig-gap">
        Mindestens ein Preis ist älter als sechs Stunden. Eine Teilsumme wäre eine kleinere Zahl
        als die Wahrheit – scanne den Händler neu.
      </p>

      <p v-if="summary.missingToMinimum !== null" class="text-fid-sm text-fid-sig-gap">
        Noch
        <span class="fid-num">{{ money(summary.missingToMinimum, summary.currency) }}</span>
        bis zum Mindestbestellwert von
        <span class="fid-num">{{ money(summary.minOrderTotal, summary.currency) }}</span
        >, sonst verschickt der Händler nicht.
      </p>

      <!-- The sentence the whole feature exists for (docs/00 §7). -->
      <p v-if="summary.advice" class="text-fid-base text-fid-text">
        Noch
        <span class="fid-num">{{ summary.advice.addItems }}</span>
        {{ summary.advice.addItems === 1 ? 'Platte' : 'Platten' }} und der Versand fällt von
        <span class="fid-num">{{ money(summary.advice.perItemNow, summary.currency) }}</span>
        auf
        <span class="fid-num">{{ money(summary.advice.perItemThen, summary.currency) }}</span>
        pro Stück.
      </p>

      <p v-if="summary.shippingSource === 'parsed'" class="text-fid-xs text-fid-text-muted">
        Aus dem Freitext des Händlers geraten<template v-if="summary.shippingSection">
          (Abschnitt „{{ summary.shippingSection }}“)</template
        ><template v-if="summary.shippingMatched.length">
          – erkannt: {{ summary.shippingMatched.join(' · ') }}</template
        >. Stimmt das nicht, trag die Staffel ein.
      </p>

      <button
        type="button"
        class="self-start rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
        @click="editing = !editing"
      >
        {{ summary.shippingSource === 'user' ? 'Staffel ändern' : 'Versandstaffel eintragen' }}
      </button>
    </section>

    <!-- Bars are <div>s and the grid is CSS Grid (docs/12 §2). -->
    <section
      v-if="summary.curve.some((point) => point.perItem !== null)"
      class="flex flex-col gap-2"
      aria-labelledby="curve"
    >
      <h3 id="curve" class="text-fid-sm font-medium text-fid-text">Versand pro Platte</h3>
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
      <h3 class="text-fid-sm font-medium text-fid-text">Versandstaffel</h3>
      <p class="text-fid-xs text-fid-text-muted">
        Steht auf der Händlerseite bei Discogs. Einmal eingetragen, bleibt sie.
      </p>

      <div v-for="(row, index) in rows" :key="index" class="flex flex-wrap items-center gap-2">
        <label class="sr-only" :for="`from-${index}`">ab wie vielen Platten</label>
        <input
          :id="`from-${index}`"
          v-model.number="row.minItems"
          type="number"
          min="1"
          class="w-16 rounded-fid-sm border border-fid-border bg-fid-surface px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
        />
        <span class="text-fid-sm text-fid-text-muted">bis</span>
        <label class="sr-only" :for="`to-${index}`">bis wie vielen Platten</label>
        <input
          :id="`to-${index}`"
          :value="row.maxItems ?? ''"
          type="number"
          min="1"
          placeholder="offen"
          class="w-16 rounded-fid-sm border border-fid-border bg-fid-surface px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
          @input="
            row.maxItems =
              ($event.target as HTMLInputElement).value === ''
                ? null
                : Number(($event.target as HTMLInputElement).value)
          "
        />
        <label class="sr-only" :for="`price-${index}`">Preis</label>
        <input
          :id="`price-${index}`"
          v-model.number="row.price"
          type="number"
          min="0"
          step="0.01"
          class="w-24 rounded-fid-sm border border-fid-border bg-fid-surface px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
        />
        <span class="text-fid-sm text-fid-text-muted">{{ summary.currency }}</span>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
          @click="addRow"
        >
          Stufe hinzufügen
        </button>
        <button
          type="button"
          class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text"
          @click="saveShipping"
        >
          Speichern
        </button>
      </div>
    </section>

    <!--
      The optimiser. Greedy twice, then swap improvement — a shopping
      suggestion rather than a proof, and it says so.
    -->
    <section class="flex flex-col gap-3 rounded-fid-md border border-fid-border p-4">
      <h3 class="text-fid-sm font-medium text-fid-text">Was ginge für ein Budget?</h3>
      <form class="flex flex-wrap items-center gap-2" @submit.prevent="makePlan">
        <label class="sr-only" for="budget">Budget</label>
        <input
          id="budget"
          v-model.number="budget"
          type="number"
          min="1"
          step="1"
          placeholder="60"
          class="w-24 rounded-fid-sm border border-fid-border bg-fid-surface px-2 py-1 font-fid-mono text-fid-sm text-fid-text"
        />
        <span class="text-fid-sm text-fid-text-muted"
          >{{ summary.currency }} inklusive Versand</span
        >
        <button
          type="submit"
          :disabled="planning || !budget"
          class="rounded-fid-sm border border-fid-border px-3 py-2 text-fid-sm text-fid-text disabled:opacity-50"
        >
          Vorschlag rechnen
        </button>
      </form>

      <template v-if="plan">
        <p v-if="plan.chosen.length === 0" class="text-fid-sm text-fid-text-muted">
          Dafür reicht es hier nicht – der Versand allein frisst das Budget.
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
          <p class="text-fid-sm text-fid-text-muted">
            <span class="fid-num">{{ plan.chosen.length }}</span>
            {{ plan.chosen.length === 1 ? 'Platte' : 'Platten' }} ·
            <span class="fid-num">{{ money(plan.goods, summary.currency) }}</span> plus
            <span class="fid-num">{{ money(plan.shipping, summary.currency) ?? '?' }}</span>
            Versand =
            <span class="fid-num text-fid-text">{{
              money(plan.total, summary.currency) ?? '?'
            }}</span>
          </p>
          <p v-if="plan.belowMinimum" class="text-fid-sm text-fid-sig-gap">
            Das bleibt unter dem Mindestbestellwert von
            <span class="fid-num">{{ money(summary.minOrderTotal, summary.currency) }}</span
            >– der Händler verschickt es so nicht. Mehr Budget oder ein anderer Laden.
          </p>
          <p class="text-fid-xs text-fid-text-muted">
            Ein Vorschlag, kein Beweis: gierig gefüllt und dann getauscht, nicht exakt
            optimiert. Der Korb bleibt, wie er ist – das hier ändert nichts.
          </p>
        </template>
      </template>
    </section>

    <!--
      What else this dealer has that scores well. The price ceiling is your
      own comfort price, not a number derived from the postage saving —
      nobody buys a record because it saves postage.
    -->
    <!--
      Nichts vorzuschlagen ist kein Zustand, es sind drei.
      A shop nobody has walked, a dig whose prices have aged past the six-hour
      rule, and a shop that genuinely has nothing else. They look identical as
      an empty list, and only the last one is an answer.
    -->
    <section
      v-if="summary.candidates.length === 0"
      class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4"
    >
      <h3 class="text-fid-sm font-medium text-fid-text">Käme auch noch infrage</h3>

      <p class="max-w-prose text-fid-sm text-fid-text-muted">
        <template v-if="!summary.dig">
          Diesen Laden hast du noch nicht durchsucht. Ein Dig sagt dir, was hier sonst noch zu
          dir passt – und was davon der Versand ohnehin mitnimmt.
        </template>
        <template v-else-if="summary.dig.expired">
          Der letzte Dig war {{ since(summary.dig.at) }}. Marktpreise, die älter als sechs
          Stunden sind, zeige ich nicht – ich weiß gerade nicht, was hier liegt.
        </template>
        <template v-else>
          Beim Dig {{ since(summary.dig.at) }} war hier sonst nichts dabei, das zu dir passt.
        </template>
      </p>

      <NuxtLink
        class="self-start text-fid-sm text-fid-text underline underline-offset-4"
        :to="{ path: '/dig', query: { dealer: summary.dealer } }"
      >
        {{ summary.dig ? 'Neu durchsuchen' : `${summary.displayName} durchsuchen` }}
      </NuxtLink>
    </section>

    <section v-else class="flex flex-col gap-3" aria-labelledby="candidates">
      <h3 id="candidates" class="text-fid-sm font-medium text-fid-text">
        Käme auch noch infrage
      </h3>
      <p v-if="summary.missingToMinimum !== null" class="text-fid-xs text-fid-text-muted">
        <template v-if="closers > 0">
          <span class="fid-num">{{ closers }}</span>
          {{ closers === 1 ? 'davon hebt' : 'davon heben' }} den Korb allein über den
          Mindestbestellwert.
        </template>
        <template v-else>
          Keine davon reicht allein über den Mindestbestellwert – zwei zusammen schon.
        </template>
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
          <span class="min-w-0 grow text-fid-sm text-fid-text" :title="candidate.reason">
            {{ candidate.title }}
          </span>
          <span v-if="candidate.closesGap" class="text-fid-xs text-fid-text-muted">
            schließt die Lücke
          </span>
          <span class="fid-num text-fid-sm text-fid-text-muted">
            {{ money(candidate.price, candidate.currency) }}
          </span>
        </li>
      </ul>
    </section>

    <!--
      Was dieser Knopf wirklich tut.

      He said "Bei fatplastics weiter", which promises a continuation of a
      purchase — and there is none: the link goes to the seller's Discogs
      storefront, it does not carry this basket and there is no checkout at the
      other end. A filled accent on a promise the app cannot keep is the worst
      button on the screen, so it is now named after what it does and looks
      like the secondary link it is.

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
        Zum Kaufen: jede Zeile oben führt zu ihrem Angebot bei Discogs, dort sitzt der „Add to
        Cart"-Knopf.
        <span class="fid-num">{{ number.format(summary.lines.length) }}</span>
        {{ summary.lines.length === 1 ? 'Platte' : 'Platten' }} liegen bereit.
      </p>
      <a
        class="fid-action self-start gap-2 text-fid-sm text-fid-text underline underline-offset-4"
        :href="`https://www.discogs.com/seller/${summary.dealer}/profile`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ summary.displayName }} bei Discogs ansehen
      </a>
    </div>
  </article>
</template>
