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

/*
 * Ein Cover, für die eine Platte, die gerade offen ist.
 *
 * Asked for the moment the sheet has its match — one request at most, and only
 * for a record somebody deliberately tapped. Usually none: whatever list they
 * tapped it from asked for it already, and the store answers offline.
 */
const { coverFor, request: requestCovers } = useCovers()
const cover = computed(() =>
  match.value ? coverFor(match.value.releaseId, match.value.thumbUrl) : null,
)
watch(match, (open) => open && void requestCovers([open.releaseId]))
const verdict = computed(() => verdicts.value[props.listingId])

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
    const label = EVIDENCE_LABEL[key]
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
        <h2 class="text-fid-base font-bold text-fid-text">
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
          <!--
            Das größte Cover, das die App zeigt — also das, wo die 600er
            Fassung sich lohnt.

            The address comes from the shared store, not from the match: the
            marketplace returns listings without images, so `match.thumbUrl`
            has always been null here (worker/covers.ts). At 96 px on a retina
            screen the 150er is already soft, and this is the one screen
            somebody opens *because* they want a closer look.
          -->
          <img
            v-if="cover"
            :src="cover.thumbUrl"
            :srcset="
              cover.coverUrl ? `${cover.thumbUrl} 150w, ${cover.coverUrl} 600w` : undefined
            "
            sizes="96px"
            alt=""
            loading="lazy"
            decoding="async"
            width="96"
            height="96"
            class="size-24 shrink-0 rounded-fid-cover bg-fid-inset object-cover"
          />
          <div class="flex min-w-0 grow flex-col gap-1">
            <p v-if="meta" class="font-fid-mono text-fid-xs text-fid-text-muted">{{ meta }}</p>
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
              <span v-if="price" class="fid-num text-fid-base text-fid-text">{{ price }}</span>
            </p>
          </div>
          <span
            class="fid-num shrink-0 text-fid-xl font-bold text-fid-text"
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
          The pressing. Everything here is traceable to a field: "Neuauflage"
          is Discogs' own word, and the runout is printed verbatim so somebody
          can hold the record up and compare.
        -->
        <section
          v-if="match.pressing"
          class="flex flex-col gap-2"
          aria-labelledby="sheet-pressing"
        >
          <h3 id="sheet-pressing" class="text-fid-sm font-medium text-fid-text">Pressung</h3>

          <ul v-if="match.pressingWarnings?.length" class="flex flex-col gap-1">
            <li
              v-for="warning in match.pressingWarnings"
              :key="warning.text"
              class="text-fid-sm"
              :class="
                warning.severity === 'high' ? 'text-fid-sig-scarcity' : 'text-fid-sig-gap'
              "
            >
              {{ warning.text }}
            </li>
          </ul>

          <p class="text-fid-sm text-fid-text-muted">
            <template v-if="match.pressing.country">{{ match.pressing.country }}</template>
            <template v-if="match.pressing.year">
              · <span class="fid-num">{{ match.pressing.year }}</span></template
            >
            <template v-if="match.pressing.plant">
              · Presswerk {{ match.pressing.plant }}</template
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
              <span class="text-fid-text">{{ stamp.label }}</span> – {{ stamp.note }}
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
              <FidIcon :name="option.icon" :size="16" />
            </button>
          </div>

          <a
            class="fid-action text-fid-sm text-fid-accent underline underline-offset-4"
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
