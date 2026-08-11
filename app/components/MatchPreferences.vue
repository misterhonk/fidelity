<script setup lang="ts">
import { MEDIUMS } from '#shared/format'
import { CONDITIONS, type Condition, type Preferences } from '#shared/types'
import { useSettingsMessages } from '~/i18n/settings'

/*
 * A computed, not `useMessages().value.settings.search.filter`.
 *
 * Reading `.value` once at setup captures whichever language was active when
 * the component mounted, and this panel then keeps its old words through a
 * switch while everything around it changes. Same trap as a frozen
 * `Intl` formatter, one layer up.
 */
const f = computed(() => useSettingsMessages().value.search.filter)

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

/**
 * The media the matcher understands — from its own table.
 *
 * This used to be a copy: five names typed out again next to the five in the
 * token table. Two lists of the same thing is how one grows a sixth entry and
 * the other does not — which is exactly what happened when reels arrived.
 */
const FORMATS = MEDIUMS

function toggleFormat(name: string) {
  const current = prefs.value?.formatsAllow ?? []
  const next = current.includes(name)
    ? current.filter((entry) => entry !== name)
    : [...current, name]
  // An empty list means "no filter", which is a legitimate answer and is
  // exactly what matchesFormat already does with it.
  void save({ formatsAllow: next })
}

/**
 * The destination country, finally adjustable.
 *
 * Written through the same debounced `save` as everything else here. Empty
 * falls back to the default rather than being stored as an empty string: a
 * blank destination would make the postage parser refuse every dealer whose
 * text is sorted by country, which is a worse answer than "Germany".
 */
const shipsTo = computed({
  get: () => prefs.value?.shipsToCountry ?? '',
  set: (value: string) => void save({ shipsToCountry: value.trim() || 'Germany' }),
})

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

    <fieldset class="flex flex-col gap-3">
      <legend class="text-fid-sm font-medium text-fid-text">{{ f.hard }}</legend>

      <div class="flex flex-col gap-2">
        <span class="text-fid-sm text-fid-text-muted">{{ f.formats }}</span>
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
        <p class="text-fid-xs text-fid-text-muted">{{ f.formatsHint }}</p>
      </div>

      <div class="grid gap-3 @sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">{{ f.maxPrice }}</span>
          <input
            :value="prefs.maxPrice ?? ''"
            type="number"
            min="1"
            step="1"
            inputmode="decimal"
            :placeholder="f.noLimit"
            class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            @change="save({ maxPrice: number(($event.target as HTMLInputElement).value) })"
          />
          <span class="text-fid-xs text-fid-text-muted">{{ f.maxPriceHint }}</span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">{{ f.minRating }}</span>
          <input
            :value="prefs.minSellerRating"
            type="number"
            min="0"
            max="100"
            step="1"
            inputmode="numeric"
            class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            @change="
              save({ minSellerRating: Number(($event.target as HTMLInputElement).value) || 0 })
            "
          />
          <span class="text-fid-xs text-fid-text-muted">{{ f.minRatingHint }}</span>
        </label>
      </div>

      <!--
        Where the record goes.

        This was a field in the data model with no control anywhere: it decided
        the postage — which block of a dealer's shipping text gets read, and
        therefore the number the basket puts under "Shipping" — and it was fixed
        at "Germany" for everybody who ever installed this.
      -->
      <label class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text-muted">{{ f.shipsTo }}</span>
        <input
          v-model="shipsTo"
          type="text"
          autocomplete="country-name"
          :placeholder="f.countryPlaceholder"
          class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />
        <span class="text-fid-xs text-fid-text-muted">{{ f.shipsToHint }}</span>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text-muted">{{ f.blocked }}</span>
        <input
          v-model="blockedText"
          type="text"
          autocomplete="off"
          :placeholder="f.blockedPlaceholder"
          class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />
        <span class="text-fid-xs text-fid-text-muted">{{ f.blockedHint }}</span>
      </label>
    </fieldset>

    <fieldset class="flex flex-col gap-3 border-t border-fid-border pt-4">
      <legend class="text-fid-sm font-medium text-fid-text">{{ f.soft }}</legend>

      <div class="grid gap-3 @sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">{{ f.condition }}</span>
          <select
            :value="prefs.prefMediaCondition"
            class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
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
          <span class="text-fid-xs text-fid-text-muted">{{ f.conditionHint }}</span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-fid-sm text-fid-text-muted">{{ f.targetPrice }}</span>
          <input
            :value="prefs.targetPrice ?? ''"
            type="number"
            min="1"
            step="1"
            inputmode="decimal"
            :placeholder="f.targetPriceAny"
            class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 font-fid-mono text-fid-sm text-fid-text"
            @change="save({ targetPrice: number(($event.target as HTMLInputElement).value) })"
          />
          <span class="text-fid-xs text-fid-text-muted">{{ f.targetPriceHint }}</span>
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
          <span class="text-fid-sm text-fid-text">{{ f.preferOriginals }}</span>
          <!--
            Deliberately soft, though docs/03 lists it as hard. Whether a
            record is a reissue comes from /releases/{id}, which is only
            fetched for the best fifty *after* the scan — so it cannot discard
            anything during one. Dampening what turns out to be a reissue is
            the honest version of the same wish.
          -->
          <span class="text-fid-xs text-fid-text-muted">{{ f.preferOriginalsHint }}</span>
          <WhyNote :label="f.preferOriginalsWhyLabel">{{ f.preferOriginalsWhy }}</WhyNote>
        </span>
      </label>
    </fieldset>

    <p class="h-4 text-fid-xs text-fid-text-muted" aria-live="polite">
      {{ saved ? f.saved : '' }}
    </p>
  </section>
</template>
