<script setup lang="ts">
import type { MatchDetail } from '#shared/types'

const props = defineProps<{ digId: string; listingId: number }>()
const emit = defineEmits<{ close: [] }>()

const { call } = useFidelityWorker()
const { verdicts, judge } = useFeedback()

const detail = ref<MatchDetail | null>(null)
const panel = useTemplateRef<HTMLElement>('panel')

onMounted(async () => {
  panel.value?.focus()
  detail.value = await call('dig.detail', {
    digId: props.digId,
    listingId: props.listingId,
  })
})

const match = computed(() => detail.value?.match ?? null)
const verdict = computed(() => verdicts.value[props.listingId])

const price = computed(() => {
  const value = match.value?.price
  const currency = match.value?.currency
  if (value === null || value === undefined || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
})

const marketLowest = computed(() => {
  const value = match.value?.marketLowestPrice
  const currency = match.value?.currency
  if (value === null || value === undefined || !currency) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
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
    const label = EVIDENCE_LABEL[key]
    if (!label || value === null || value === undefined || value === '') continue

    const shown = Array.isArray(value)
      ? value.slice(0, 3).join(', ')
      : typeof value === 'number'
        ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)
        : String(value)
    parts.push(`${label}: ${shown}`)
  }
  return parts.join(' · ')
}

/**
 * Every evidence key the engine emits, and what it is called in German.
 *
 * The list is the allowlist: anything not in here is an internal handle
 * (releaseId, role) and stays out of the sheet.
 */
const EVIDENCE_LABEL: Record<string, string> = {
  artist: 'Künstler',
  album: 'Album',
  label: 'Label',
  person: 'Person',
  owned: 'im Regal',
  total: 'Diskografie',
  ownedAs: 'du hast',
  styles: 'Stile',
  similarity: 'Nähe',
  lift: 'Lift',
  share: 'Anteil',
  prefix: 'Serie',
  number: 'Nummer',
  inRun: 'in der Serie',
  wantedYear: 'gewünscht',
  pressingYear: 'diese Pressung',
  price: 'Preis',
  marketLowest: 'Markt-Tiefstpreis',
  ratio: 'Verhältnis',
  numForSale: 'im Angebot',
}

/**
 * "(deine von 2004 bis 2004)" is a sentence nobody would write. One year is
 * one year.
 */
function years(entry: { from: number; to: number }): string {
  return entry.from === entry.to
    ? `(deine von ${entry.from})`
    : `(deine von ${entry.from} bis ${entry.to})`
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex justify-end bg-black/60"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <!--
      view-transition-name is set here and matched by the card that opened it,
      so the cover and title carry across instead of the panel simply appearing
      (docs/05 §4: same-document View Transitions only).
    -->
    <aside
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="match ? `${match.artist} – ${match.title}` : 'Release'"
      tabindex="-1"
      class="fid-sheet flex h-full w-full max-w-lg flex-col gap-6 overflow-y-auto border-l border-fid-border bg-fid-surface p-6 outline-none"
      style="scrollbar-gutter: stable"
      @keydown.esc="emit('close')"
    >
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-fid-lg font-bold text-fid-text">
          <template v-if="match">{{ match.artist }} – {{ match.title }}</template>
          <template v-else>Wird geladen …</template>
        </h2>
        <button
          type="button"
          aria-label="Schließen"
          class="min-h-6 min-w-6 rounded-fid-sm border border-fid-border px-2 text-fid-sm text-fid-text-muted"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <template v-if="match">
        <div class="flex items-start gap-4">
          <img
            v-if="match.thumbUrl"
            :src="match.thumbUrl"
            alt=""
            loading="lazy"
            decoding="async"
            width="96"
            height="96"
            class="size-24 shrink-0 rounded-fid-cover bg-fid-n-800 object-cover"
          />
          <div class="flex min-w-0 grow flex-col gap-1">
            <p v-if="meta" class="font-fid-mono text-fid-xs text-fid-text-muted">{{ meta }}</p>
            <p class="flex flex-wrap items-baseline gap-x-3 text-fid-sm text-fid-text-muted">
              <span v-if="match.condition">{{ match.condition }}</span>
              <span v-if="match.sleeve">Cover {{ match.sleeve }}</span>
              <span v-if="price" class="fid-num text-fid-base text-fid-text">{{ price }}</span>
            </p>
          </div>
          <span
            class="fid-num shrink-0 text-fid-2xl font-bold text-fid-text"
            :aria-label="`Barry Score ${match.score} von 100`"
          >
            {{ match.score }}
          </span>
        </div>

        <p class="text-fid-base text-fid-text">{{ match.reason }}</p>

        <!--
          The market numbers, whenever the enrichment pass paid for them. Shown
          even where neither signal fired: "40 im Angebot, Tiefstpreis 8 €" is
          the answer to "ist das ein Fund oder Massenware", and that question
          does not stop being interesting because the answer is no.
        -->
        <section
          v-if="match.marketNumForSale !== null"
          class="flex flex-col gap-1"
          aria-labelledby="sheet-market"
        >
          <h3 id="sheet-market" class="text-fid-sm font-medium text-fid-text">Marktlage</h3>
          <p class="text-fid-sm text-fid-text-muted">
            <span class="fid-num">{{ match.marketNumForSale }}</span>
            {{ match.marketNumForSale === 1 ? 'Exemplar' : 'Exemplare' }} weltweit im
            Angebot<template v-if="marketLowest">
              · Tiefstpreis
              <span class="fid-num text-fid-text">{{ marketLowest }}</span></template
            >
          </p>
        </section>

        <!-- Every signal with its evidence — the follow-up to the sentence. -->
        <section class="flex flex-col gap-2" aria-labelledby="sheet-signals">
          <h3 id="sheet-signals" class="text-fid-sm font-medium text-fid-text">Signale</h3>
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
          The catalogue series as a grid. This is the one view where the
          horizon shows its work: Brain 1001, 1002, 1004, 1005 filled in and
          1003 the gap you are looking at.
        -->
        <section
          v-if="detail?.catalogue"
          class="flex flex-col gap-2"
          aria-labelledby="sheet-run"
        >
          <h3 id="sheet-run" class="text-fid-sm font-medium text-fid-text">
            {{ detail.catalogue.label }} · {{ detail.catalogue.prefix }}
          </h3>
          <!-- CSS Grid, not a chart library (docs/12 §2). -->
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1">
            <li
              v-for="entry in detail.catalogue.neighbours"
              :key="entry.number"
              class="fid-num rounded-fid-sm border px-1 py-1 text-center text-fid-xs"
              :class="[
                entry.isThis
                  ? 'border-fid-accent bg-fid-accent/20 text-fid-text'
                  : entry.owned
                    ? 'border-fid-border bg-fid-n-800 text-fid-text'
                    : 'border-transparent text-fid-text-muted',
              ]"
              :aria-label="
                entry.isThis
                  ? `${entry.number} – diese Platte`
                  : entry.owned
                    ? `${entry.number} – hast du`
                    : `${entry.number} – fehlt dir`
              "
            >
              {{ entry.number }}
            </li>
          </ul>
          <p class="text-fid-xs text-fid-text-muted">
            Ausgefüllt = im Regal. Umrandet = diese Platte.
          </p>
        </section>

        <section
          v-if="detail && detail.discography.length > 0"
          class="flex flex-col gap-2"
          aria-labelledby="sheet-disc"
        >
          <h3 id="sheet-disc" class="text-fid-sm font-medium text-fid-text">Diskografie</h3>
          <ul class="flex flex-col gap-1">
            <li
              v-for="entry in detail.discography"
              :key="entry.artist"
              class="text-fid-sm text-fid-text-muted"
            >
              <span class="text-fid-text">{{ entry.artist }}</span> –
              <span class="fid-num">{{ entry.owned }}</span> von
              <span class="fid-num">{{ entry.total }}</span> Hauptveröffentlichungen
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
            Verbindungen zu deiner Sammlung
          </h3>
          <p class="text-fid-sm text-fid-text-muted">
            {{ detail.connections.map((c) => c.name).join(' · ') }}
          </p>
        </section>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
          <div class="flex gap-1" role="group" aria-label="Wie war der Treffer?">
            <button
              v-for="option in VERDICTS"
              :key="option.key"
              type="button"
              :title="option.label"
              :aria-label="option.label"
              :aria-pressed="verdict === option.key"
              class="min-h-6 min-w-6 rounded-fid-sm border px-2 py-1 text-fid-sm"
              :class="
                verdict === option.key
                  ? 'border-fid-accent bg-fid-accent/15'
                  : 'border-transparent opacity-45 hover:opacity-100'
              "
              @click="judge(match, option.key)"
            >
              <span aria-hidden="true">{{ option.icon }}</span>
            </button>
          </div>

          <a
            class="text-fid-sm text-fid-accent underline underline-offset-4"
            :href="`https://www.discogs.com/sell/item/${match.listingId}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bei Discogs ansehen
          </a>
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.fid-sheet {
  view-transition-name: release-sheet;
}

/*
  The slide is the browser's, not ours — a View Transition on a name the card
  also carries. Anyone who asked not to be moved gets the state change without
  the movement.
*/
@media (prefers-reduced-motion: reduce) {
  .fid-sheet {
    view-transition-name: none;
  }
}
</style>
