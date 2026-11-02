<script setup lang="ts">
import { toRaw } from 'vue'

import { labelOf } from '#shared/places'
import { GRADES } from '#shared/format'
import type { AddState, Identified, PlaceNode, Pressing } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'
import { lookupKind } from '~/utils/lookup'

/**
 * Add mode (#233): a record into the collection in two to four taps.
 *
 * Code → pressing → your copy → place, with the tray of this visit's adds
 * under it. Requests: one for the barcode or the run-out, one more for a
 * run-out that narrows a barcode's list. The family reading (two) stays on the
 * in-store screen, on a tap. The add itself is a queued write, never awaited
 * against Discogs, so the sheet is ready for the next record at once.
 */
const emit = defineEmits<{ close: [] }>()

const c = useCollectionMessages()
const a = computed(() => c.value.add)
const { call } = useFidelityWorker()
const { prefill, tray } = useAddMode()

const typed = ref('')
const found = shallowRef<Identified | null>(null)
const chosen = ref<number | null>(null)
const grade = ref<string | null>(null)
const looking = ref(false)
const error = ref<unknown>(null)

/** The pressings, the ones you own first (#233). */
const candidates = shallowRef<Pressing[]>([])
const ownedCount = (releaseId: number) =>
  found.value?.owned.filter((copy) => copy.releaseId === releaseId).length ?? 0

function show(answer: Identified, pick: number | null = null) {
  found.value = answer
  candidates.value = [...answer.candidates].sort(
    (x, y) => Number(ownedCount(y.releaseId) > 0) - Number(ownedCount(x.releaseId) > 0),
  )
  chosen.value = pick ?? (candidates.value.length === 1 ? candidates.value[0]!.releaseId : null)
}

const given = prefill.value
prefill.value = null
// The shop's answer, unwrapped: a proxy cannot cross postMessage.
if (given) show(structuredClone(toRaw(given.found)), given.releaseId)

async function look() {
  const code = typed.value.trim()
  const sort = lookupKind(code)
  if (!sort || sort === 'text') return
  looking.value = true
  error.value = null
  try {
    show(
      sort === 'barcode'
        ? await call('identify.barcode', { barcode: code })
        : await call('identify.runout', { runout: code }),
    )
  } catch (cause) {
    error.value = cause
  } finally {
    looking.value = false
  }
}

/** A barcode names up to eight pressings; the run-out names one. One request. */
const runout = ref('')
const narrowedNone = ref(false)
async function narrow() {
  if (!runout.value.trim()) return
  looking.value = true
  narrowedNone.value = false
  error.value = null
  try {
    const named = new Set(
      (await call('identify.runout', { runout: runout.value.trim() })).candidates.map(
        (pressing) => pressing.releaseId,
      ),
    )
    const left = candidates.value.filter((pressing) => named.has(pressing.releaseId))
    if (left.length === 0) narrowedNone.value = true
    else {
      candidates.value = left
      if (left.length === 1) chosen.value = left[0]!.releaseId
    }
  } catch (cause) {
    error.value = cause
  } finally {
    looking.value = false
  }
}

const pressing = computed(() => candidates.value.find((p) => p.releaseId === chosen.value))
const second = computed(() => (chosen.value ? ownedCount(chosen.value) > 0 : false))
const short = (condition: string) => /\(([^)]+)\)/.exec(condition)?.[1] ?? condition

/* The add, then where it goes. */
const added = ref<number | null>(null)
const nodes = shallowRef<PlaceNode[]>([])
const proposal = ref<string | null>(null)
const placedIn = ref<string | null>(null)
const nameOf = (id: string) => {
  const node = nodes.value.find((n) => n.id === id)
  return node ? labelOf(node) : ''
}

async function add() {
  const chosenPressing = pressing.value
  if (!chosenPressing) return
  error.value = null
  try {
    const copy = await call('collection.addPressing', {
      pressing: { ...toRaw(chosenPressing) },
      grade: grade.value ?? undefined,
    })
    tray.value = [{ ...copy, label: chosenPressing.title }, ...tray.value]
    added.value = copy.key
    void flush()
    const [overview, proposed] = await Promise.all([
      call('places.overview', undefined),
      call('places.propose', { instanceId: copy.key }),
    ])
    nodes.value = overview
    proposal.value = proposed?.placeId ?? null
  } catch (cause) {
    error.value = cause
  }
}

async function place(placeId: string) {
  const entry = tray.value.find((e) => e.key === added.value)
  if (!entry) return
  error.value = null
  try {
    const add = { key: entry.key, releaseId: entry.releaseId, before: [...entry.before] }
    if (await call('collection.placeAdd', { add, placeId })) placedIn.value = nameOf(placeId)
  } catch (cause) {
    error.value = cause
  }
}

function again() {
  typed.value = ''
  runout.value = ''
  found.value = null
  candidates.value = []
  chosen.value = null
  grade.value = null
  added.value = null
  proposal.value = null
  placedIn.value = null
  narrowedNone.value = false
}

/* The tray: what this visit added, read off the outbox and the shelf. */
const states = ref<Record<number, AddState>>({})
const note = ref('')
const statusOf = (key: number) => states.value[key]?.status ?? 'waiting'

async function refresh() {
  if (tray.value.length === 0) return
  const answer = await call('collection.addStatus', {
    adds: tray.value.map(({ key, releaseId, before }) => ({
      key,
      releaseId,
      before: [...before],
    })),
  })
  states.value = Object.fromEntries(answer.map((state) => [state.key, state]))
}

async function flush() {
  // Unreachable is not lost: the job waits in the queue for the keeper.
  await call('outbox.flush', undefined).catch(() => undefined)
  await refresh()
}

async function undo(key: number) {
  const entry = tray.value.find((e) => e.key === key)
  if (!entry) return
  const { label, ...add } = entry
  if (await call('collection.undoAdd', { add: { ...add, before: [...add.before] } })) {
    tray.value = tray.value.filter((e) => e.key !== key)
    note.value = a.value.undone(label)
    if (added.value === key) again()
    void flush()
  } else note.value = a.value.cannotUndo
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void refresh()
  timer = setInterval(() => void refresh(), 3000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <SheetFrame :label="a.title" @close="emit('close')">
    <template #title>{{ a.title }}</template>

    <ErrorNote v-if="error" :cause="error" />

    <!-- The code: a barcode or a run-out, one field (#225's lookupKind tells them apart). -->
    <form v-if="added === null" class="flex flex-col gap-2" @submit.prevent="look()">
      <label for="add-code" class="text-fid-sm text-fid-text">{{ a.field }}</label>
      <div class="flex gap-2">
        <input
          id="add-code"
          v-model="typed"
          inputmode="search"
          autocomplete="off"
          class="fid-num min-h-11 min-w-0 flex-1 rounded-fid-sm border border-fid-border bg-fid-surface px-3 text-fid-base text-fid-text"
        />
        <FidButton variant="secondary" type="submit" :disabled="looking">{{
          a.look
        }}</FidButton>
      </div>
      <NuxtLink
        class="fid-action self-start text-fid-xs text-fid-text-muted underline underline-offset-4"
        to="/in-store"
        @click="emit('close')"
        >{{ a.camera }}</NuxtLink
      >
    </form>

    <p v-if="looking" class="text-fid-sm text-fid-text-muted" aria-live="polite">
      {{ a.looking }}
    </p>

    <template v-if="found && added === null">
      <p v-if="candidates.length === 0" class="text-fid-sm text-fid-text-muted">
        {{ a.nothing }}
      </p>

      <!-- The pressing: yours first, and a second copy said out loud. -->
      <section v-else class="flex flex-col gap-2" :aria-label="a.pick">
        <h3 class="text-fid-sm font-bold text-fid-text">{{ a.pick }}</h3>
        <ul class="flex flex-col gap-1">
          <li v-for="candidate in candidates" :key="candidate.releaseId">
            <button
              type="button"
              class="fid-action flex min-h-11 w-full flex-wrap items-baseline gap-x-2 rounded-fid-sm border px-3 py-1 text-left text-fid-sm text-fid-text"
              :class="
                chosen === candidate.releaseId
                  ? 'border-fid-text bg-fid-inset'
                  : 'border-fid-border'
              "
              :aria-pressed="chosen === candidate.releaseId"
              @click="chosen = candidate.releaseId"
            >
              <span>{{ candidate.title }}</span>
              <span v-if="candidate.year" class="fid-num">{{ candidate.year }}</span>
              <span v-if="candidate.country">{{ candidate.country }}</span>
              <span class="fid-num text-fid-text-muted">{{
                [candidate.label, candidate.catno].filter(Boolean).join(' ')
              }}</span>
              <span
                v-if="ownedCount(candidate.releaseId) > 0"
                class="text-fid-xs text-fid-sig-artist-text"
                >{{ a.you(ownedCount(candidate.releaseId)) }}</span
              >
            </button>
          </li>
        </ul>

        <form
          v-if="candidates.length > 1"
          class="flex flex-col gap-1"
          @submit.prevent="narrow()"
        >
          <label for="add-runout" class="text-fid-xs text-fid-text-muted">{{ a.runout }}</label>
          <div class="flex gap-2">
            <input
              id="add-runout"
              v-model="runout"
              autocomplete="off"
              class="fid-num min-h-11 min-w-0 flex-1 rounded-fid-sm border border-fid-border bg-fid-surface px-3 text-fid-sm text-fid-text"
            />
            <FidButton variant="tertiary" type="submit" :disabled="looking">{{
              a.narrow
            }}</FidButton>
          </div>
          <p v-if="narrowedNone" class="text-fid-xs text-fid-text-muted">{{ a.narrowNone }}</p>
        </form>
      </section>

      <!-- Your copy: the grade as one row of chips, best to worst. -->
      <section v-if="pressing" class="flex flex-col gap-3">
        <p v-if="second" role="status" class="text-fid-sm text-fid-sig-gap-text">
          {{ a.secondCopy }}
        </p>
        <div role="group" :aria-label="a.grade" class="flex flex-col gap-1">
          <span class="text-fid-xs text-fid-text-muted">{{ a.grade }}</span>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="condition in GRADES"
              :key="condition"
              type="button"
              class="fid-action fid-num min-h-11 min-w-11 rounded-fid-sm border px-2 text-fid-sm"
              :class="
                grade === condition
                  ? 'border-fid-accent bg-fid-accent/15 text-fid-text'
                  : 'border-fid-border text-fid-text-muted'
              "
              :aria-pressed="grade === condition"
              :aria-label="condition"
              @click="grade = grade === condition ? null : condition"
            >
              {{ short(condition) }}
            </button>
          </div>
        </div>
        <FidButton size="lg" class="self-start" @click="add()">
          {{ second ? a.addSecond : a.add }}
        </FidButton>
      </section>
    </template>

    <!-- The place the rule proposes, one tap; anywhere else, two. -->
    <section v-if="added !== null" class="flex flex-col gap-3">
      <h3 class="text-fid-sm font-bold text-fid-text">{{ a.place }}</h3>
      <p v-if="placedIn" role="status" class="text-fid-sm text-fid-text">
        {{ a.placed(placedIn) }}
      </p>
      <template v-else>
        <FidButton
          v-if="proposal"
          variant="secondary"
          class="self-start"
          @click="place(proposal)"
        >
          {{ a.putIn(nameOf(proposal)) }}
        </FidButton>
        <details v-if="nodes.length > 0">
          <summary class="fid-action min-h-11 cursor-pointer text-fid-sm text-fid-text-muted">
            {{ a.elsewhere }}
          </summary>
          <PlacePicker :nodes="nodes" :except="null" @pick="place" />
        </details>
      </template>
      <div class="flex gap-4">
        <FidButton variant="secondary" @click="again()">{{ a.next }}</FidButton>
        <FidButton v-if="!placedIn" variant="tertiary" @click="again()">{{
          a.later
        }}</FidButton>
      </div>
    </section>

    <!-- Outside the tray: undoing the last add empties it, and the line must stay. -->
    <p v-if="note" role="status" class="text-fid-xs text-fid-text-muted">{{ note }}</p>

    <!-- The tray: this visit's adds, each with where it stands and its way back. -->
    <section v-if="tray.length > 0" class="flex flex-col gap-2 border-t border-fid-border pt-4">
      <h3 class="text-fid-sm font-bold text-fid-text">{{ a.tray }}</h3>
      <ul class="flex flex-col gap-1" data-testid="add-tray">
        <li
          v-for="entry in tray"
          :key="entry.key"
          class="flex min-h-11 items-center gap-3 text-fid-sm text-fid-text"
        >
          <span class="min-w-0 flex-1 truncate">{{ entry.label }}</span>
          <span
            class="fid-plate shrink-0"
            :class="statusOf(entry.key) === 'failed' ? 'text-fid-error' : 'text-fid-text-muted'"
            >{{ a.status[statusOf(entry.key)] }}</span
          >
          <FidButton
            v-if="statusOf(entry.key) !== 'failed'"
            variant="tertiary"
            @click="undo(entry.key)"
            >{{ a.undo }}</FidButton
          >
        </li>
      </ul>
    </section>
  </SheetFrame>
</template>
