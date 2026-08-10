<script setup lang="ts">
import type { BasketPlan, ShippingTier } from '#shared/types'

useSeoMeta({
  title: 'Der Korb',
  description: 'Was der Versand kostet – bevor Discogs es dir sagt.',
})

const { call } = useFidelityWorker()
const { view, load, refresh, clear } = useBasket()

onMounted(load)

const summary = computed(() => view.value.summary)
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

// --- Is this still there? ---------------------------------------------------

/*
 * The one question a basket cannot answer on its own.
 *
 * Prices age out after six hours and the records themselves sell — and finding
 * out at the Discogs checkout that the record you built the whole order around
 * went last night is the worst possible moment to learn it. One request per
 * line answers both at once (docs/02, `GET /marketplace/listings/{id}`).
 */
/** What the button will actually cost: one request per line still on offer. */
const stillToCheck = computed(
  () => summary.value?.lines.filter((line) => !line.sold).length ?? 0,
)

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

    const sold = summary.value?.lines.filter((line) => line.sold).length ?? 0
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
  const dealer = summary.value?.dealer
  if (!dealer) return

  error.value = null
  try {
    await call('basket.setShipping', {
      dealer,
      tiers: rows.value
        .filter((row) => row.price > 0 && row.minItems > 0)
        .map((row) => ({
          minItems: row.minItems,
          maxItems: row.maxItems,
          price: row.price,
          currency: summary.value?.currency || 'EUR',
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
  const curve = summary.value?.curve.filter((point) => point.total !== null) ?? []
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
    plan.value = await call('basket.plan', { budget: budget.value })
  } catch (cause) {
    error.value = cause
  } finally {
    planning.value = false
  }
}

const peak = computed(() =>
  Math.max(1, ...(summary.value?.curve ?? []).map((point) => point.perItem ?? 0)),
)
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
    <div class="flex flex-col gap-3">
      <h1 class="fid-display text-fid-2xl font-bold text-fid-text">Der Korb</h1>
      <BasketTabs />
      <p class="text-fid-base text-fid-text-muted">
        Discogs zeigt den kombinierten Versand erst im eigenen Warenkorb. Hier steht er vorher.
      </p>
    </div>

    <ErrorNote v-if="error" :cause="error" />

    <p v-if="!summary" class="text-fid-base text-fid-text-muted">
      Noch nichts drin. Leg im Dig etwas hinein – der Korb rechnet dann mit.
    </p>

    <template v-else>
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
            <button
              type="button"
              class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
              @click="clear()"
            >
              Korb leeren
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
            class="flex items-baseline gap-3 rounded-fid-sm border px-3 py-2"
            :class="line.sold ? 'border-fid-border/50' : 'border-fid-border'"
          >
            <span
              class="min-w-0 grow truncate text-fid-sm"
              :class="line.sold ? 'text-fid-text-muted line-through' : 'text-fid-text'"
              >{{ line.title }}</span
            >
            <!--
              Sold. Shown rather than deleted — that removal is the collector's
              call — but no price: it is not an offer any more, and it no
              longer counts towards the total or the postage tier.
            -->
            <span v-if="line.sold" class="shrink-0 text-fid-xs text-fid-sig-gap">
              verkauft
            </span>
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
          Mindestens ein Preis ist älter als sechs Stunden. Eine Teilsumme wäre eine kleinere
          Zahl als die Wahrheit – scanne den Händler neu.
        </p>

        <p v-if="summary.belowMinimum" class="text-fid-sm text-fid-sig-gap">
          Der Händler verschickt erst ab
          <span class="fid-num">{{ money(summary.minOrderTotal, summary.currency) }}</span
          >.
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
          Aus dem Freitext des Händlers geraten<template v-if="summary.shippingMatched.length">
            – erkannt: {{ summary.shippingMatched.join(' · ') }}</template
          >. Stimmt das nicht, trag die Staffel ein.
        </p>

        <button
          type="button"
          class="self-start rounded-fid-sm border border-fid-border px-3 py-1.5 text-fid-sm text-fid-text"
          @click="editing = !editing"
        >
          {{
            summary.shippingSource === 'user' ? 'Staffel ändern' : 'Versandstaffel eintragen'
          }}
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

        <div
          v-for="(row, index) in rows"
          :key="index"
          class="flex flex-wrap items-center gap-2"
        >
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
            class="rounded-fid-sm border border-fid-border px-3 py-1.5 text-fid-sm text-fid-text"
            @click="addRow"
          >
            Stufe hinzufügen
          </button>
          <button
            type="button"
            class="rounded-fid-sm bg-fid-accent px-3 py-1.5 text-fid-sm font-medium text-fid-n-990"
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
            class="rounded-fid-sm border border-fid-border px-3 py-1.5 text-fid-sm text-fid-text disabled:opacity-50"
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
      <section
        v-if="view.candidates.length > 0"
        class="flex flex-col gap-3"
        aria-labelledby="candidates"
      >
        <h3 id="candidates" class="text-fid-sm font-medium text-fid-text">
          Käme auch noch infrage
        </h3>
        <ul class="flex flex-col gap-2">
          <li
            v-for="candidate in view.candidates"
            :key="candidate.listingId"
            class="flex items-baseline gap-3 rounded-fid-sm border border-fid-border px-3 py-2"
          >
            <span class="fid-num shrink-0 text-fid-sm font-medium text-fid-text">
              {{ candidate.score }}
            </span>
            <span
              class="min-w-0 grow truncate text-fid-sm text-fid-text"
              :title="candidate.reason"
            >
              {{ candidate.title }}
            </span>
            <span class="fid-num shrink-0 text-fid-sm text-fid-text-muted">
              {{ money(candidate.price, candidate.currency) }}
            </span>
          </li>
        </ul>
      </section>

      <!-- No checkout of our own. That would be a ToS violation and strategically stupid. -->
      <a
        class="self-start rounded-fid-sm bg-fid-accent px-4 py-2 font-medium text-fid-n-990"
        :href="`https://www.discogs.com/seller/${summary.dealer}/profile`"
        target="_blank"
        rel="noopener noreferrer"
      >
        Bei {{ summary.displayName }} weiter
      </a>
      <p class="text-fid-xs text-fid-text-muted">
        Gekauft wird bei Discogs. Diese App hat keinen eigenen Checkout und will keinen –
        <span class="fid-num">{{ number.format(summary.lines.length) }}</span>
        {{ summary.lines.length === 1 ? 'Platte' : 'Platten' }} liegen für dich bereit.
      </p>
    </template>
  </main>
</template>
