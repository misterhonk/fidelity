<script setup lang="ts">
import { addressOf, labelOf } from '#shared/places'
import type {
  CollectionField,
  CollectionFolder,
  CollectionItem,
  PlaceNode,
  ReleaseDetail,
} from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
const m = useMessages()

const props = defineProps<{
  instanceId: number
  /**
   * The list this record was opened from, so the shelf can be walked without
   * closing the sheet (M31.16) — the same arrows a find has had since M31.13.
   *
   * A screen that passes none has none: the wall and the start page open one
   * record out of a context that is not a list to read down.
   */
  walk?: { index: number; total: number; previous: number | null; next: number | null } | null
}>()
const emit = defineEmits<{ close: []; step: [instanceId: number] }>()

const { call } = useFidelityWorker()
const { state: writeState, push } = useWriteBack()

const record = ref<CollectionItem | null>(null)

/*
 * Keeping an eye on this record (M11).
 *
 * The moment you are standing in front of your own record is the same moment
 * it occurs to you: "what is that actually worth?" So the button is here and
 * not on a screen you would have to go looking for.
 *
 * The ceiling is visible rather than silent: a watcher that stops accepting
 * records without a word is worse than one that says no.
 */
const watching = ref(false)
const watchFull = ref(false)

/*
 * And where it stands (M12).
 *
 * The same moment: the record is open, and the question "where was that
 * again" comes up right here. A select rather than a screen of its own —
 * assigning a place is a two-second job, and nobody gets sent elsewhere for
 * it.
 */
const places = shallowRef<PlaceNode[]>([])
const placeId = ref<string | null>(null)
/** The compartment the rule proposes (M27.2), when there is one and it is not where the record already is. */
const proposal = ref<{ placeId: string; unitId: string } | null>(null)
const proposed = computed(() =>
  proposal.value && proposal.value.placeId !== placeId.value
    ? (places.value.find((place) => place.id === proposal.value?.placeId) ?? null)
    : null,
)
/** The reason with the coordinate (M28 #6): the divider the rule wrote, and the rule. */
const proposedBy = computed(() => {
  const unit = places.value.find((place) => place.id === proposal.value?.unitId)
  const rule = unit?.rule && unit.rule !== 'manual' ? unit.rule : null
  return {
    divider: proposed.value?.range?.label ?? '',
    rule: rule ? c.value.places.rules[rule].toLowerCase() : '',
  }
})

async function setPlace(next: string) {
  const item = record.value
  if (!item) return
  placeId.value = next || null
  await call('places.assign', { instanceId: item.instanceId, placeId: placeId.value })
}

async function toggleWatch() {
  const item = record.value
  if (!item) return

  if (watching.value) {
    await call('watched.remove', { releaseId: item.releaseId })
    watching.value = false
    return
  }

  const outcome = await call('watched.add', {
    releaseId: item.releaseId,
    kind: 'shelf',
    artist: item.artistNames[0] ?? '',
    title: item.title,
    threshold: null,
  })
  watching.value = outcome.watched
  watchFull.value = outcome.full
}

/*
 * Rating, and why it is written here rather than after Discogs answers.
 *
 * One paced request is 1.2 seconds. A star that lights up after that has
 * stopped being a response to a tap. So the shelf is written at once and the
 * queue catches up in the background — and if it never does, the old value
 * comes back on its own (`worker/outbox.ts`).
 *
 * Zero is a state, not the absence of one: Discogs distinguishes "never rated"
 * from "rated one star", and taking a rating back has to stay possible.
 */
const STARS = [1, 2, 3, 4, 5] as const

/** False for a record synced before entry ids were kept — see rate.ts. */
const canRate = computed(() => Boolean(record.value?.instanceId && record.value?.folderId))

async function rate(stars: number) {
  const item = record.value
  if (!item) return

  const next = item.rating === stars ? 0 : stars
  record.value = { ...item, rating: next }

  // The worker refuses a copy with no entry behind it — which is why the stars
  // are not offered in that case at all. This is the second net.
  const written = await push(() =>
    call('collection.rate', { instanceId: item.instanceId, rating: next }),
  )
  if (!written) record.value = item
}

/*
 * What you noted about this copy: media, sleeve, and a free line.
 *
 * The three fields are Discogs' own, and so are the options — a hand-written
 * list of conditions would drift from the one the server accepts and the write
 * would fail on a value this app itself offered.
 *
 * The values, though, are ours alone. Discogs hands them back in no listing
 * (docs/02), so what is stored here is the only copy the app will ever have.
 */
/*
 * Which shelf inside the shelf, and only when there is more than one.
 *
 * A dropdown with a single option is a control that cannot do anything, and
 * most collections have exactly one folder. It appears when somebody has
 * actually divided their collection, and stays out of the way otherwise.
 */
const folders = ref<CollectionFolder[]>([])
const canMove = computed(() => canRate.value && folders.value.length > 1)

async function move(folderId: number) {
  const item = record.value
  if (!item) return

  const before = item.folderId
  record.value = { ...item, folderId }
  if (!(await push(() => call('collection.move', { instanceId: item.instanceId, folderId })))) {
    record.value = { ...item, folderId: before }
  }
}

const fields = ref<CollectionField[]>([])
const values = ref<Record<number, string>>({})

async function setField(field: CollectionField, value: string) {
  const before = values.value[field.id] ?? ''
  values.value = { ...values.value, [field.id]: value }

  const written = await push(() =>
    call('collection.setField', { instanceId: props.instanceId, fieldId: field.id, value }),
  )
  if (!written) values.value = { ...values.value, [field.id]: before }
}

/**
 * What the sync could not tell us, one request later.
 *
 * Deliberately after everything else and deliberately not awaited with it: the
 * cover, the rating and the condition are already in storage and must be on
 * screen at once. This is a paced request — 1.2 seconds at best — and the
 * tracklist arriving a moment after the sheet opens is right; a sheet that
 * waits 1.2 seconds to show a cover it already has is not.
 *
 * Null when there is no answer. Then the sheet is simply shorter, because none
 * of this is needed to know what the record is (worker/collection/detail.ts).
 */
const detail = ref<ReleaseDetail | null>(null)
const looking = ref(false)

async function look(refresh = false) {
  const releaseId = record.value?.releaseId
  if (!releaseId) return

  looking.value = true
  try {
    detail.value = await call('release.detail', { releaseId, refresh })
  } catch {
    // A sheet with no tracklist, not a sheet with an error on it.
  } finally {
    looking.value = false
  }
}

/**
 * Asking what it is worth, which is the only second request on this sheet.
 *
 * Deliberately a button rather than something that happens on its own: the
 * price is the one thing here that goes stale, and refetching it every time a
 * record is opened would turn browsing a shelf back into a walk of
 * `/releases/{id}` — the thing rule 2 exists to prevent.
 */
const lookAgain = () => look(true)

/**
 * The price, formatted — or nothing at all.
 *
 * `money()` answers null without a currency, and that is the right answer to
 * pass on rather than paper over: a bare number could be euros, dollars or
 * pounds, and a figure somebody cannot act on is worse than a missing line.
 */
/**
 * Stepping, and the keyboard doing the same where nobody is typing.
 *
 * The sheet is re-keyed on the instance id by whoever renders it, so a step
 * builds it again from scratch — which is right: it is a different record and
 * everything in it has to be fetched again.
 */
function step(to: number | null) {
  if (to === null) return
  emit('step', to)
}

function onArrow(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
  const on = document.activeElement
  if (
    on instanceof HTMLElement &&
    (on.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(on.tagName))
  )
    return
  if (!props.walk) return
  event.preventDefault()
  step(event.key === 'ArrowLeft' ? props.walk.previous : props.walk.next)
}

onMounted(() => document.addEventListener('keydown', onArrow))
onBeforeUnmount(() => document.removeEventListener('keydown', onArrow))

onMounted(async () => {
  record.value = await call('collection.record', { instanceId: props.instanceId })
  if (record.value) {
    const list = await call('watched.list', undefined)
    watching.value = list.some((row) => row.releaseId === record.value?.releaseId)

    places.value = await call('places.overview', undefined)
    placeId.value = await call('places.of', { instanceId: props.instanceId })
    // Where the rule would put it — shown only where it differs from where it is.
    proposal.value = await call('places.propose', { instanceId: props.instanceId })
  }

  if (record.value?.releaseId) void look()

  const noted = await call('collection.fields', { instanceId: props.instanceId })
  fields.value = noted.fields
  values.value = noted.values

  folders.value = await call('collection.folders', undefined)
})

const artist = computed(() => record.value?.artistNames.join(' · ') ?? '')

const added = computed(() => {
  const at = record.value?.addedAt
  if (!at) return ''
  const when = new Date(at)
  return Number.isNaN(when.getTime()) ? '' : day(when)
})

/*
 * What is on the record, one line per question.
 *
 * All of it comes from the same sync response the shelf grid already uses, so
 * a record of your own opens with no request at all — that is the difference
 * between this sheet and the dig sheet: nothing here has to be fetched, and
 * nothing here goes stale.
 *
 * Run together into one line, "Get Physical Music · gpm050-6 · Vinyl · 12\" ·
 * 2006" reads like a catalogue string and answers nothing at a glance. Named,
 * every part is findable: which label, which number, which pressing, which
 * year. Empty ones are dropped rather than shown blank — a row that says
 * "Catalogue number: —" is a row that wasted a line.
 */
/**
 * The two facts that are also questions.
 *
 * "Who else is on this label" and "what do I own by them" are the things a
 * collector asks with the record already in hand, and until now the answer
 * meant typing the name into the search box on another screen and hoping it
 * spelled the same. Each name is its own link, because a record on two labels
 * belongs under both — and the list on the shelf only ever shows the first.
 */
function shelfLinks(names: string[], facet: 'label' | 'artist') {
  return names
    .filter((name) => name.trim().length > 0)
    .map((name) => ({ name, to: `/shelf?${facet}=${encodeURIComponent(name)}` }))
}

/**
 * "2 × Vinyl · 12" · 45 RPM · Blue Translucent".
 *
 * All of it came with the sync and none of it was shown: the disc count was
 * parsed away, so a double LP looked exactly like a single, and the colour the
 * submitter typed never arrived at all.
 *
 * The count goes in front, because that is where it changes the meaning of
 * everything after it. One disc is left unsaid — "1 × Vinyl" is noise on
 * almost every record in a collection, and a row that says nothing new is a
 * row that cost a line.
 */
function pressing(item: CollectionItem): string {
  const words = [...item.formats, ...(item.formatText ?? [])].join(' · ')
  const discs = item.discs ?? 1
  return discs > 1 ? `${discs} × ${words}` : words
}

interface Fact {
  key: keyof typeof c.value.shelf.sheet.facts
  /** A plain statement — a year, a catalogue number, a format. */
  value?: string
  /** Or names that lead somewhere: this label, this artist, on your shelf. */
  links?: { name: string; to: string }[]
  mono?: boolean
}

const facts = computed<Fact[]>(() => {
  const item = record.value
  if (!item) return []
  return (
    /*
     * What is left of the table once the masthead has the record itself
     * (M31.20): artist, label, catalogue number, format and year are the
     * *record*, and they now stand where every other sheet puts them. What
     * stays here is what is true of **your copy** and of nobody else's — the
     * rating, the folder, and the day it arrived.
     */
    ([{ key: 'added', value: added.value, mono: true }] as Fact[])
      // Empty ones are dropped rather than shown blank — a row that says
      // "Catalogue number: —" is a row that wasted a line.
      .filter((fact) => (fact.links?.length ?? 0) > 0 || (fact.value?.length ?? 0) > 0)
  )
})

const tags = computed(() => {
  const item = record.value
  if (!item) return []
  return [...new Set([...item.genres, ...item.styles])]
})

/*
 * Taking a record off the shelf — the one destructive thing here.
 *
 * Two taps, and the second one is a different button that has to be brought
 * into being first. Not a browser confirm(): those get dismissed by reflex,
 * and this one deletes something on somebody's real account. The record and
 * its cover stay in front of you while you decide.
 */
const confirming = ref(false)

async function remove() {
  if (!(await push(() => call('collection.remove', { instanceId: props.instanceId })))) {
    confirming.value = false
    return
  }
  emit('close')
}
</script>

<template>
  <SheetFrame
    :label="record ? `${artist} – ${record.title}` : c.shelf.sheet.loading"
    transition="shelf-sheet"
    @close="emit('close')"
  >
    <!-- Where this record stands in the list, and the two either side of it. -->
    <template v-if="walk" #tools>
      <button
        type="button"
        :disabled="walk.previous === null"
        :aria-label="c.shelf.sheet.previous"
        :title="c.shelf.sheet.previous"
        class="fid-lift flex min-h-11 min-w-11 items-center justify-center fid-field-raised text-fid-text disabled:opacity-40"
        @click="step(walk.previous)"
      >
        <FidIcon name="arrow-left" :size="18" aria-hidden="true" />
      </button>
      <span class="fid-num px-1 text-fid-xs whitespace-nowrap text-fid-text-muted">
        {{ m.common.ofTotal(String(walk.index + 1), String(walk.total)) }}
      </span>
      <button
        type="button"
        :disabled="walk.next === null"
        :aria-label="c.shelf.sheet.next"
        :title="c.shelf.sheet.next"
        class="fid-lift flex min-h-11 min-w-11 items-center justify-center fid-field-raised text-fid-text disabled:opacity-40"
        @click="step(walk.next)"
      >
        <FidIcon name="arrow-right" :size="18" aria-hidden="true" />
      </button>
    </template>

    <!-- The sheet's own name, only while there is no masthead to carry it. -->
    <template v-if="!record" #title>{{ c.shelf.sheet.loading }}</template>

    <template v-if="record?.coverUrl || record?.thumbUrl" #wash>
      <SleeveWash :src="record.thumbUrl || record.coverUrl" />
    </template>

    <template v-if="record">
      <!--
          What became of the last change, in one line.

          A change lands here first and travels to Discogs afterwards, which is
          what makes a star light up the moment it is tapped. The price of that
          is two different moments — "it looks changed" and "Discogs knows" —
          and until now the screen only ever showed the first. Somebody rated a
          record, looked at discogs.com, and found nothing there.
        -->
      <p
        v-if="writeState !== 'idle'"
        role="status"
        class="flex items-center gap-2 rounded-fid-sm px-3 py-2 text-fid-sm"
        :class="
          writeState === 'failed'
            ? 'bg-fid-sig-scarcity/10 text-fid-sig-scarcity'
            : 'bg-fid-surface-raised text-fid-text-muted'
        "
      >
        <FidIcon
          v-if="writeState === 'sent'"
          name="check"
          :size="14"
          class="shrink-0 text-fid-sig-price"
        />
        {{ c.shelf.sheet.write[writeState] }}
      </p>

      <!--
        The same masthead as every other sheet (M31.20). What used to stand
        here was a label-and-value table of the record itself — artist, label,
        catalogue number, format, year — which made the same record look like
        two designs depending on which screen it was opened from.
      -->
      <RecordMasthead
        :cover="
          record.coverUrl || record.thumbUrl
            ? { thumbUrl: record.thumbUrl, coverUrl: record.coverUrl }
            : null
        "
        :title="record.title"
      >
        <template #artist>
          <template
            v-for="(link, index) in shelfLinks(record.artistNames, 'artist')"
            :key="link.to"
          >
            <span v-if="index > 0"> · </span>
            <NuxtLink :to="link.to" class="underline underline-offset-4 hover:text-fid-accent">
              {{ link.name }}
            </NuxtLink>
          </template>
        </template>

        <!--
          One mono line, the same one the find's sheet has — with the labels
          still leading back to your own shelf, because "who else is on this
          label" is a question somebody asks with the record in hand.
        -->
        <template #facts>
          <p class="flex flex-wrap gap-x-2 font-fid-mono text-fid-xs text-fid-text-muted">
            <span
              v-for="(link, index) in shelfLinks(record.labelNames, 'label')"
              :key="link.to"
            >
              <span v-if="index > 0" class="pr-2">·</span>
              <NuxtLink
                :to="link.to"
                class="underline underline-offset-4 hover:text-fid-accent"
              >
                {{ link.name }}
              </NuxtLink>
            </span>
            <span v-if="record.catnos.length">· {{ record.catnos.join(' · ') }}</span>
            <span v-if="pressing(record)">· {{ pressing(record) }}</span>
            <span v-if="record.year > 0" class="fid-num">· {{ record.year }}</span>
          </p>
        </template>

        <dl
          class="grid min-w-0 grow grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-fid-sm sm:basis-52"
        >
          <!--
              Only when it was actually given, and first, because it is the one
              line that is an opinion rather than a fact. A zero on Discogs
              means "never rated", not "rated nothing" — five hollow stars
              would invent an opinion the collector never had.
            -->
          <template v-if="canRate || record.rating > 0">
            <dt class="text-fid-text-muted">{{ c.shelf.sheet.facts.rating }}</dt>
            <dd class="min-w-0">
              <div v-if="canRate" class="flex gap-1">
                <!--
                    Five buttons, not a slider and not a select.
                    A rating is one tap on the star you mean, and tapping the
                    one already lit takes it back — which is the only way to
                    reach "never rated" again once something has been given.
                  -->
                <button
                  v-for="star in STARS"
                  :key="star"
                  type="button"
                  :aria-label="c.shelf.sheet.rate(star)"
                  :aria-pressed="record.rating >= star"
                  class="fid-lift flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm text-fid-base transition-colors"
                  :class="
                    record.rating >= star
                      ? 'text-fid-sig-wantlist'
                      : 'text-fid-text-muted hover:text-fid-text'
                  "
                  @click="rate(star)"
                >
                  {{ record.rating >= star ? '★' : '☆' }}
                </button>
              </div>
              <span
                v-else
                class="fid-num text-fid-sig-wantlist"
                :aria-label="c.shelf.sheet.rated(record.rating)"
              >
                {{ '★'.repeat(record.rating) }}
              </span>
            </dd>
          </template>

          <template v-if="canMove">
            <dt class="text-fid-text-muted">{{ c.shelf.sheet.facts.folder }}</dt>
            <dd class="min-w-0">
              <select
                :value="record.folderId"
                class="min-h-11 w-full fid-field px-2 text-fid-sm text-fid-text"
                :aria-label="c.shelf.sheet.facts.folder"
                @change="move(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                  {{ folder.name }}
                </option>
              </select>
            </dd>
          </template>

          <template v-for="fact in facts" :key="fact.key">
            <dt class="text-fid-text-muted">{{ c.shelf.sheet.facts[fact.key] }}</dt>
            <dd
              class="min-w-0 text-fid-text"
              :class="fact.mono ? 'font-fid-mono text-fid-xs' : ''"
            >
              <!--
                  A name that leads back to your own shelf. The separator stays
                  outside the link so that two labels read as two things, not
                  as one long one somebody might click by accident.
                -->
              <template v-if="fact.links">
                <template v-for="(link, index) in fact.links" :key="link.to">
                  <span v-if="index > 0" class="text-fid-text-muted"> · </span>
                  <NuxtLink
                    :to="link.to"
                    class="underline underline-offset-4 hover:text-fid-accent"
                    :title="c.shelf.sheet.ownedBy(link.name)"
                  >
                    {{ link.name }}
                  </NuxtLink>
                </template>
              </template>
              <template v-else>{{ fact.value }}</template>
            </dd>
          </template>
        </dl>
      </RecordMasthead>

      <section v-if="canRate && fields.length > 0" class="flex flex-col gap-3">
        <h3 class="text-fid-sm font-bold text-fid-text">{{ c.shelf.sheet.condition }}</h3>
        <div class="grid gap-3 @sm:grid-cols-2">
          <label
            v-for="field in fields"
            :key="field.id"
            class="flex flex-col gap-1"
            :class="field.type === 'text' ? '@sm:col-span-2' : ''"
          >
            <span class="text-fid-xs text-fid-text-muted">{{ field.name }}</span>
            <!--
                A select for what Discogs enumerates, a line for what it does
                not. The empty option is not padding: a condition you have not
                decided on yet has to stay sayable, and clearing one is the
                only way back to it.
              -->
            <select
              v-if="field.type === 'dropdown'"
              :value="values[field.id] ?? ''"
              class="min-h-11 fid-field px-3 text-fid-sm text-fid-text"
              @change="setField(field, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ c.shelf.sheet.unset }}</option>
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
            <input
              v-else
              :value="values[field.id] ?? ''"
              type="text"
              class="min-h-11 fid-field px-3 text-fid-sm text-fid-text"
              @change="setField(field, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </section>

      <!--
        What the record is — the same block the find's sheet draws (M31.5).

        It used to live here in full while a find's sheet showed none of it,
        although both fetch the very same release detail. One component, one
        order of sections, and a record now looks the same whichever screen it
        is opened from.
      -->
      <ListenSection
        :artist="record.artistNames[0] ?? null"
        :title="record.title"
        :videos="detail?.videos"
        :tracks="detail?.tracks"
      />

      <ReleaseFacts
        :detail="detail"
        :tags="tags"
        refreshable
        :looking="looking"
        @refresh="lookAgain()"
      />

      <!--
          Six, and it says so when there are more.

          Discogs collects these from everybody, and a single 12" came back
          with eighty-nine (measured 2026-08-12). A list that long buries the
          rest of the sheet; a list silently cut to six claims to be all of
          them. So it is cut, and the cut is named.
        -->
      <!--
        And the section now also stands when there are no videos at all.

        Two of the seven releases ADR-012 measured had none, and for those the
        heading disappeared with them — a record with nothing to hear looked
        like a record nobody had thought about. A search at the chosen service
        is something to hear either way (M31).
      -->

      <!--
          Said while the one request is out, and only until it answers.
          Not `v-else` on the block above: a record with no videos is not a
          record that is still loading.
        -->
      <p v-if="looking && !detail" class="text-fid-sm text-fid-text-muted" aria-live="polite">
        {{ c.shelf.sheet.looking }}
      </p>

      <!--
          What Discogs still owns.
          Every other pressing and editing the entry itself live over there —
          this sheet says what the app knows, and hands over for the rest.
        -->
      <!--
        On a phone the sheet is eight sections tall, and the action lived
        under the eighth (M31.10). It sticks to the bottom edge instead —
        the most settled pattern in mobile commerce, and here it is one
        line: the sheet scrolls inside itself, so `sticky` works without
        any fixed positioning. The negative margin and the padding put its
        background across the sheet's own inset, or the content would show
        through underneath it.
      -->
      <div
        class="sticky -bottom-6 -mx-6 mt-auto flex flex-wrap items-center gap-3 border-t border-fid-border bg-fid-surface px-6 pt-4 -mb-6 pb-6"
      >
        <a
          :href="`https://www.discogs.com/release/${record.releaseId}`"
          target="_blank"
          rel="noopener noreferrer"
          class="fid-lift inline-flex min-h-11 items-center gap-2 fid-field-raised px-4 text-fid-sm font-medium text-fid-text"
        >
          {{ c.shelf.sheet.atDiscogs }}
          <FidIcon name="external-link" :size="14" />
        </a>

        <!--
            Where it stands — only where there are any places at all. An empty
            select beside "view on Discogs" would be a control that can do
            nothing, and the way to make one is right next to it.
          -->
        <label v-if="places.length > 0" class="flex items-center gap-2 text-fid-sm">
          <span class="text-fid-text-muted">{{ c.places.where }}</span>
          <select
            :value="placeId ?? ''"
            class="fid-field px-3 py-2 text-fid-sm text-fid-text"
            @change="setPlace(($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ c.places.nowhere }}</option>
            <option v-for="place in places" :key="place.id" :value="place.id">
              {{ '— '.repeat(place.depth) }}{{ labelOf(place) }}
            </option>
          </select>
        </label>
        <NuxtLink
          v-else
          to="/places"
          class="fid-action inline-flex min-h-11 items-center text-fid-sm text-fid-text-muted underline underline-offset-4"
        >
          {{ c.places.addTop }}
        </NuxtLink>
        <!-- The address, the way it reads on the wall: room · furniture · compartment. -->
        <p v-if="placeId" class="fid-plate text-fid-text-muted">
          {{ addressOf(placeId, places).join(' · ') }}
        </p>
        <!-- And where the rule would put it, one tap away. -->
        <p
          v-if="proposed"
          class="flex flex-wrap items-center gap-3 text-fid-sm text-fid-text-muted"
        >
          {{
            c.places.suggested(
              addressOf(proposed.id, places).join(' · '),
              proposedBy.divider,
              proposedBy.rule,
            )
          }}
          <button
            type="button"
            class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-sm text-fid-text"
            @click="setPlace(proposed.id)"
          >
            {{ c.places.putThere }}
          </button>
        </p>

        <button
          type="button"
          class="fid-lift inline-flex min-h-11 items-center gap-2 rounded-fid-sm border px-4 text-fid-sm"
          :class="
            watching
              ? 'border-fid-accent-fill text-fid-accent'
              : 'border-fid-field text-fid-text'
          "
          @click="toggleWatch"
        >
          <FidIcon name="eye" :size="14" aria-hidden="true" />
          {{ watching ? c.watched.watchingOn : c.watched.watch }}
        </button>
        <p v-if="watchFull" class="text-fid-xs text-fid-sig-scarcity">
          {{ c.watched.full }}
        </p>

        <button
          v-if="canRate && !confirming"
          type="button"
          class="fid-lift ml-auto inline-flex min-h-11 items-center rounded-fid-sm px-3 text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
          @click="confirming = true"
        >
          {{ c.shelf.sheet.remove }}
        </button>
        <!--
            Deleting is the one thing here that reaches into a real account and
            cannot be undone from this app — Discogs does not hand back what it
            never deleted. So it says what will happen, in a colour that is
            used nowhere else on this screen, and the confirming button is not
            where the first one was.
          -->
        <div
          v-else-if="confirming"
          class="flex w-full flex-wrap items-center gap-3 rounded-fid-sm border border-fid-sig-scarcity bg-fid-sig-scarcity/10 px-3 py-2"
        >
          <span class="text-fid-sm text-fid-text">{{ c.shelf.sheet.removeSure }}</span>
          <button
            type="button"
            class="fid-lift inline-flex min-h-11 items-center rounded-fid-sm border border-fid-field px-3 text-fid-sm text-fid-text"
            @click="confirming = false"
          >
            {{ m.cancel }}
          </button>
          <button
            type="button"
            class="fid-lift inline-flex min-h-11 items-center rounded-fid-sm border border-fid-sig-scarcity px-3 text-fid-sm font-medium text-fid-sig-scarcity"
            @click="remove()"
          >
            {{ c.shelf.sheet.removeYes }}
          </button>
        </div>
      </div>
    </template>
  </SheetFrame>
</template>
