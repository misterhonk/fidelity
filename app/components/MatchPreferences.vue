<script setup lang="ts">
import { CONDITIONS, type Condition, type Preferences } from '#shared/types'

const { call } = useFidelityWorker()

const prefs = ref<Preferences | null>(null)
const saved = ref(false)
const error = ref<unknown>(null)

onMounted(async () => {
  prefs.value = await call('preferences.get', undefined)
})

/**
 * Saved on change, not on a button.
 *
 * These are eight small decisions somebody adjusts while thinking about the
 * next dig, and a form that has to be submitted turns each of them into two
 * actions and a chance to lose the lot. The confirmation is a word that fades,
 * not a dialog.
 */
let timer: ReturnType<typeof setTimeout> | undefined

async function save(patch: Partial<Preferences>) {
  if (!prefs.value) return
  error.value = null

  try {
    prefs.value = await call('preferences.set', patch)
    saved.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (saved.value = false), 2000)
  } catch (cause) {
    error.value = cause
  }
}

onBeforeUnmount(() => clearTimeout(timer))

/** The mediums the matcher understands (worker/match/format.ts). */
const FORMATS = ['Vinyl', 'CD', 'Cassette', 'File', 'DVD'] as const

function toggleFormat(name: string) {
  const current = prefs.value?.formatsAllow ?? []
  const next = current.includes(name)
    ? current.filter((entry) => entry !== name)
    : [...current, name]
  // An empty list means "no filter", which is a legitimate answer and is
  // exactly what matchesFormat already does with it.
  void save({ formatsAllow: next })
}

const blockedText = computed({
  get: () => (prefs.value?.shipsFromBlock ?? []).join(', '),
  set: (value: string) =>
    void save({
      shipsFromBlock: value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    }),
})

const number = (value: string) => {
  const parsed = Number(value)
  return value.trim() === '' || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed
}
</script>

<template>
  <section v-if="prefs" class="flex flex-col gap-5">
    <ErrorNote v-if="error" :cause="error" />

    <!--
      docs/04 §2 is emphatic that a criterion is either a filter or a dampener,
      never both — otherwise the dampener is dead code. The interface says
      which is which, because "wird verworfen" and "zählt weniger" are very
      different promises and somebody setting a maximum price deserves to know
      which one they just made.
    -->
    <fieldset class="flex flex-col gap-3">
      <legend class="text-fid-sm font-medium text-fid-text">
        Hart — was gar nicht erst auftaucht
      </legend>

      <div class="flex flex-col gap-2">
        <span class="text-fid-sm text-fid-text-muted">Formate</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="format in FORMATS"
            :key="format"
            type="button"
            :aria-pressed="prefs.formatsAllow.includes(format)"
            class="min-h-9 rounded-fid-sm border px-3 py-1 text-fid-sm transition-colors"
            :class="
              prefs.formatsAllow.includes(format)
                ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                : 'border-fid-border text-fid-text-muted hover:text-fid-text'
            "
            @click="toggleFormat(format)"
          >
            {{ format }}
          </button>
        </div>
        <p class="text-fid-xs text-fid-text-muted">
          Nichts ausgewählt heißt: alles zählt. Discogs schreibt Vinyl als
          <span class="font-fid-mono">12"</span>, <span class="font-fid-mono">2xLP</span> oder
          <span class="font-fid-mono">7"</span> – das wird mitgelesen.
        </p>
      </div>

      <div class="grid gap-3 @sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">Höchstpreis</span>
          <input
            :value="prefs.maxPrice ?? ''"
            type="number"
            min="1"
            step="1"
            inputmode="decimal"
            placeholder="kein Limit"
            class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            @change="save({ maxPrice: number(($event.target as HTMLInputElement).value) })"
          />
          <span class="text-fid-xs text-fid-text-muted">Darüber wird verworfen.</span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">Händlerbewertung mindestens</span>
          <input
            :value="prefs.minSellerRating"
            type="number"
            min="0"
            max="100"
            step="1"
            inputmode="numeric"
            class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            @change="
              save({ minSellerRating: Number(($event.target as HTMLInputElement).value) || 0 })
            "
          />
          <span class="text-fid-xs text-fid-text-muted">
            Darunter wird der Dig gar nicht erst gestartet.
          </span>
        </label>
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text-muted">Versand aus diesen Ländern nicht</span>
        <input
          v-model="blockedText"
          type="text"
          autocomplete="off"
          placeholder="z. B. USA, Japan"
          class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />
        <span class="text-fid-xs text-fid-text-muted">
          Mit Komma trennen. Nützlich gegen Zoll und drei Wochen Wartezeit.
        </span>
      </label>
    </fieldset>

    <fieldset class="flex flex-col gap-3 border-t border-fid-border pt-4">
      <legend class="text-fid-sm font-medium text-fid-text">
        Weich — was noch auftaucht, aber weiter unten
      </legend>

      <div class="grid gap-3 @sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">Zustand ab</span>
          <select
            :value="prefs.prefMediaCondition"
            class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
            @change="
              save({
                prefMediaCondition: ($event.target as HTMLSelectElement).value as Condition,
              })
            "
          >
            <option v-for="condition in CONDITIONS" :key="condition" :value="condition">
              {{ condition }}
            </option>
          </select>
          <span class="text-fid-xs text-fid-text-muted">
            Schlechter zählt nur noch 40 %, verschwindet aber nicht.
          </span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">Wohlfühlpreis</span>
          <input
            :value="prefs.targetPrice ?? ''"
            type="number"
            min="1"
            step="1"
            inputmode="decimal"
            placeholder="egal"
            class="rounded-fid-sm border border-fid-border bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            @change="save({ targetPrice: number(($event.target as HTMLInputElement).value) })"
          />
          <span class="text-fid-xs text-fid-text-muted">
            Darüber zählt ein Treffer 55 % – und das ist auch die Grenze, bis zu der der Korb
            Vorschläge macht.
          </span>
        </label>
      </div>

      <label class="flex items-start gap-3">
        <input
          :checked="prefs.excludeReissues"
          type="checkbox"
          class="mt-1 size-4"
          @change="save({ excludeReissues: ($event.target as HTMLInputElement).checked })"
        />
        <span class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text">Originalpressungen bevorzugen</span>
          <!--
            Deliberately soft, though docs/03 lists it as hard. Whether a
            record is a reissue comes from /releases/{id}, which is only
            fetched for the best fifty *after* the scan — so it cannot discard
            anything during one. Dampening what turns out to be a reissue is
            the honest version of the same wish.
          -->
          <span class="text-fid-xs text-fid-text-muted">Neuauflagen zählen dann weniger.</span>
          <WhyNote label="Gedämpft statt verworfen">
            Ob eine Platte eine Neuauflage ist, weiß Discogs erst in der Einzelabfrage – und die
            läuft erst nach dem Scan über die besten 50. Verwerfen könnte sie also nichts.
          </WhyNote>
        </span>
      </label>
    </fieldset>

    <p class="h-4 text-fid-xs text-fid-text-muted" aria-live="polite">
      {{ saved ? 'Gespeichert. Gilt ab dem nächsten Dig.' : '' }}
    </p>
  </section>
</template>
