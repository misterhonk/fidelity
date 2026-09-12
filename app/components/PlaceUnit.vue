<script setup lang="ts">
import { DEFAULT_FINISH } from '#shared/places'
import type { Finish, PlaceNode, PlaceRule, UnitPlan } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * One piece of furniture on the places screen: its name and actions, the
 * wall, and — once a compartment is tapped — what that compartment holds,
 * as covers, with the two things a compartment can do: take a name, and
 * hand everything to another place.
 */
const props = defineProps<{
  unit: PlaceNode
  /** Every node — the compartments are picked out here, and "move all" needs the rest. */
  nodes: PlaceNode[]
}>()

const emit = defineEmits<{ changed: []; record: [instanceId: number] }>()

const c = useCollectionMessages()
const { call } = useFidelityWorker()
const { grab } = usePlaceDrag()

const compartments = computed(() =>
  props.nodes.filter((node) => node.parentId === props.unit.id),
)

const open = ref<string | null>(null)
const openCube = computed(
  () => compartments.value.find((cube) => cube.id === open.value) ?? null,
)

function show(id: string) {
  open.value = open.value === id ? null : id
}

const renaming = ref(false)
async function rename(name: string) {
  if (!name.trim() || name.trim() === props.unit.name) return
  await call('places.rename', { id: props.unit.id, name })
  renaming.value = false
  emit('changed')
}

/** The look, changed after the fact: every change is saved as it is made. */
const finishing = ref(false)
const finish = ref<Finish>({ ...(props.unit.finish ?? DEFAULT_FINISH) })
watch(finish, async (next) => {
  await call('places.finish', { id: props.unit.id, finish: { ...next } })
  emit('changed')
})

/**
 * The order (M27.2). The rule is set with one tap; "sort in" asks for the
 * plan and shows it — how many would move, how many from the pile — and
 * only "apply" moves anything. A rule proposes, never acts.
 */
const RULES: PlaceRule[] = ['artist', 'label', 'year', 'added', 'manual']
async function setRule(rule: PlaceRule) {
  await call('places.rule', { id: props.unit.id, rule })
  plan.value = null
  emit('changed')
}
const plan = ref<UnitPlan | null>(null)
const planning = ref(false)
async function askPlan() {
  planning.value = true
  try {
    plan.value = await call('places.plan', { unitId: props.unit.id, includeUnplaced: true })
  } finally {
    planning.value = false
  }
}
async function applyPlan() {
  await call('places.apply', { unitId: props.unit.id, includeUnplaced: true })
  plan.value = null
  emit('changed')
}

const dissolving = ref(false)
async function dissolve() {
  await call('places.remove', { id: props.unit.id })
  dissolving.value = false
  emit('changed')
}
</script>

<template>
  <section class="flex flex-col gap-3" :aria-label="unit.name">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <!-- The name is the handle: furniture drags into another room by it. -->
      <h3
        class="fid-display cursor-grab text-fid-base font-semibold text-fid-text select-none"
        @pointerdown="
          grab($event, { kind: 'unit', id: unit.id, label: c.places.dragUnit(unit.name) })
        "
      >
        {{ unit.name }}
      </h3>
      <div class="flex flex-wrap gap-4">
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="finishing = !finishing"
        >
          {{ c.places.finish }}
        </button>
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="renaming = !renaming"
        >
          {{ c.places.rename }}
        </button>
        <button
          type="button"
          class="fid-plate fid-action min-h-11 text-fid-text-muted hover:text-fid-text"
          @click="dissolving = !dissolving"
        >
          {{ c.places.dissolve }}
        </button>
      </div>
    </div>

    <input
      v-if="renaming"
      :value="unit.name"
      :aria-label="c.places.renameLabel(unit.name)"
      class="fid-field px-3 py-2 text-fid-base text-fid-text"
      @change="rename(($event.target as HTMLInputElement).value)"
    />

    <FinishPicker v-if="finishing" v-model="finish" />

    <!-- The order: one tap sets the rule; the plan is shown before anything moves. -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" :aria-label="c.places.order" class="flex flex-wrap gap-4">
        <button
          v-for="rule in RULES"
          :key="rule"
          type="button"
          class="fid-plate min-h-11 border-b-2 transition-colors"
          :class="
            (unit.rule ?? 'artist') === rule
              ? 'border-fid-accent text-fid-text'
              : 'border-transparent text-fid-text-muted hover:text-fid-text'
          "
          :aria-pressed="(unit.rule ?? 'artist') === rule"
          @click="setRule(rule)"
        >
          {{ c.places.rules[rule] }}
        </button>
      </div>
      <button
        v-if="(unit.rule ?? 'artist') !== 'manual'"
        type="button"
        :disabled="planning"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text disabled:opacity-50"
        @click="askPlan"
      >
        {{ c.places.sortIn }}
      </button>
    </div>
    <div v-if="plan" class="flex flex-wrap items-center gap-4" aria-live="polite">
      <p class="fid-plate text-fid-text">
        {{
          plan.moves.length === 0
            ? c.places.nothingMoves
            : c.places.planLine(count(plan.moves.length), count(plan.fromPile))
        }}
      </p>
      <button
        v-if="plan.moves.length > 0"
        type="button"
        class="fid-action min-h-11 rounded-fid-sm border border-fid-accent px-4 text-fid-sm text-fid-text"
        @click="applyPlan"
      >
        {{ c.places.apply }}
      </button>
      <button
        type="button"
        class="fid-action min-h-11 px-2 text-fid-sm text-fid-text-muted underline underline-offset-4"
        @click="plan = null"
      >
        {{ c.places.cancel }}
      </button>
    </div>

    <div v-if="dissolving" class="flex flex-col gap-2">
      <p class="text-fid-sm text-fid-text-muted">{{ c.places.dissolveUnitWhat }}</p>
      <button
        type="button"
        class="fid-action min-h-11 self-start rounded-fid-sm border border-fid-sig-scarcity px-4 text-fid-sm text-fid-sig-scarcity"
        @click="dissolve"
      >
        {{ c.places.dissolveConfirm }}
      </button>
    </div>

    <PlaceWall :unit="unit" :compartments="compartments" :open="open" @open="show" />

    <!-- The open compartment slides in from the right; the wall stays put. -->
    <PlaceSheet
      v-if="openCube"
      :cube="openCube"
      :nodes="nodes"
      @close="open = null"
      @changed="emit('changed')"
      @record="emit('record', $event)"
    />
  </section>
</template>
