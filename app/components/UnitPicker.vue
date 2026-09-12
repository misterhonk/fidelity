<script setup lang="ts">
import { DEFAULT_FINISH, MAX_GRID, UNIT_PRESETS, type UnitPreset } from '#shared/places'
import type { Finish } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * The preset is the input (M27.1, docs/18 §4).
 *
 * Nobody measures their shelf; they know it is a Kallax 4×4 or a crate by
 * the door. So the furniture people actually own is a row of buttons, each
 * drawn as the grid it is, and "custom" is the one that asks for numbers.
 */
const props = defineProps<{ parentId: string | null }>()
const emit = defineEmits<{ created: []; cancel: [] }>()

const c = useCollectionMessages()
const { call } = useFidelityWorker()

const chosen = ref<UnitPreset | null>(null)
const custom = ref(false)
const name = ref('')
const columns = ref(4)
const rows = ref(2)
const busy = ref(false)
/** The look; a preset brings its own, and it can be changed before saving. */
const finish = ref<Finish>({ ...DEFAULT_FINISH })

function pick(preset: UnitPreset | null) {
  chosen.value = preset
  custom.value = preset === null
  finish.value = { ...(preset?.finish ?? DEFAULT_FINISH) }
}

const ready = computed(
  () => name.value.trim().length > 0 && (chosen.value !== null || custom.value),
)

async function create() {
  if (!ready.value || busy.value) return
  busy.value = true
  try {
    const shape = chosen.value?.shape ?? 'shelf'
    await call('places.createUnit', {
      name: name.value,
      parentId: props.parentId,
      shape,
      columns: chosen.value?.columns ?? columns.value,
      rows: chosen.value?.rows ?? rows.value,
      capacity: chosen.value ? chosen.value.capacity : 70,
      // A plain object, not the reactive proxy: structured clone refuses a Proxy.
      finish: { ...finish.value },
      rule: chosen.value?.rule ?? 'artist',
    })
    name.value = ''
    chosen.value = null
    custom.value = false
    finish.value = { ...DEFAULT_FINISH }
    emit('created')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="create">
    <div
      role="group"
      :aria-label="c.places.chooseUnit"
      class="grid grid-cols-2 gap-2 @md:grid-cols-4"
    >
      <button
        v-for="preset in UNIT_PRESETS"
        :key="preset.key"
        type="button"
        class="fid-action flex flex-col items-center gap-2 rounded-fid-sm border p-3 text-center transition-colors"
        :class="
          chosen?.key === preset.key
            ? 'border-fid-accent bg-fid-accent/15'
            : 'border-fid-border hover:bg-fid-raised'
        "
        :aria-pressed="chosen?.key === preset.key"
        @click="pick(preset)"
      >
        <!-- The preset drawn as the grid it is — a picture says 4×4 faster than the number. -->
        <span
          class="grid gap-px bg-fid-border p-px"
          :style="{
            gridTemplateColumns: `repeat(${preset.columns}, 0.6rem)`,
            gridTemplateRows: `repeat(${preset.rows}, 0.6rem)`,
          }"
          aria-hidden="true"
        >
          <span
            v-for="n in preset.columns * preset.rows"
            :key="n"
            class="bg-fid-surface"
            :class="preset.shape === 'pile' ? 'bg-fid-inset' : ''"
          />
        </span>
        <span class="text-fid-sm text-fid-text">{{ c.places.presets[preset.key] }}</span>
        <span class="fid-plate text-fid-text-muted">
          {{
            preset.capacity ? c.places.perCompartment(count(preset.capacity)) : c.places.byHand
          }}
        </span>
      </button>
      <button
        type="button"
        class="fid-action flex flex-col items-center justify-center gap-2 rounded-fid-sm border p-3 text-center transition-colors"
        :class="
          custom
            ? 'border-fid-accent bg-fid-accent/15'
            : 'border-fid-border hover:bg-fid-raised'
        "
        :aria-pressed="custom"
        @click="pick(null)"
      >
        <span class="text-fid-sm text-fid-text">{{ c.places.presets.custom }}</span>
        <span class="fid-plate text-fid-text-muted">{{ c.places.columnsByRows }}</span>
      </button>
    </div>

    <div v-if="custom" class="flex flex-wrap gap-4">
      <label class="flex flex-col gap-1 text-fid-sm text-fid-text">
        {{ c.places.columns }}
        <input
          v-model.number="columns"
          type="number"
          min="1"
          :max="MAX_GRID"
          class="fid-field w-24 px-3 py-2 font-fid-mono text-fid-base text-fid-text"
        />
      </label>
      <label class="flex flex-col gap-1 text-fid-sm text-fid-text">
        {{ c.places.rows }}
        <input
          v-model.number="rows"
          type="number"
          min="1"
          :max="MAX_GRID"
          class="fid-field w-24 px-3 py-2 font-fid-mono text-fid-base text-fid-text"
        />
      </label>
    </div>

    <FinishPicker v-if="chosen || custom" v-model="finish" />

    <div class="flex flex-wrap gap-2">
      <input
        v-model="name"
        :placeholder="c.places.unitPlaceholder"
        :aria-label="c.places.unitName"
        class="min-w-0 grow fid-field px-3 py-2 text-fid-base text-fid-text"
      />
      <button
        type="submit"
        :disabled="!ready || busy"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-50"
      >
        {{ c.places.addUnit }}
      </button>
      <button
        type="button"
        class="fid-action min-h-11 px-2 text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="emit('cancel')"
      >
        {{ c.places.cancel }}
      </button>
    </div>
  </form>
</template>
