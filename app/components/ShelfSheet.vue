<script setup lang="ts">
import type { CollectionField, CollectionFolder, CollectionItem } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
const m = useMessages()

const props = defineProps<{ instanceId: number }>()
const emit = defineEmits<{ close: [] }>()

const { call } = useFidelityWorker()
const { state: writeState, push } = useWriteBack()

const record = ref<CollectionItem | null>(null)
const panel = useTemplateRef<HTMLElement>('panel')

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

onMounted(async () => {
  panel.value?.focus()
  record.value = await call('collection.record', { instanceId: props.instanceId })

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
const facts = computed(() => {
  const item = record.value
  if (!item) return []
  return [
    { key: 'label', value: item.labelNames.join(' · ') },
    { key: 'catno', value: item.catnos.join(' · '), mono: true },
    { key: 'format', value: item.formats.join(' · ') },
    { key: 'year', value: item.year > 0 ? String(item.year) : '', mono: true },
    { key: 'added', value: added.value, mono: true },
  ].filter((fact) => fact.value.length > 0) as {
    key: keyof typeof c.value.shelf.sheet.facts
    value: string
    mono?: boolean
  }[]
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
    <aside
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="record ? `${artist} – ${record.title}` : c.shelf.sheet.loading"
      tabindex="-1"
      class="fid-sheet flex h-full w-full max-w-lg flex-col gap-6 overflow-y-auto border-l border-fid-border bg-fid-surface p-6 outline-none"
      style="scrollbar-gutter: stable"
      @keydown.esc="emit('close')"
    >
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-fid-base font-bold text-fid-text">
          <template v-if="record">{{ artist }} – {{ record.title }}</template>
          <template v-else>{{ c.shelf.sheet.loading }}</template>
        </h2>
        <button
          type="button"
          :aria-label="m.close"
          class="fid-lift flex min-h-11 min-w-11 items-center justify-center rounded-fid-sm border border-fid-field bg-fid-surface-raised text-fid-base text-fid-text"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

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

        <!-- Same shape as the dig sheet: cover on top on a phone, beside from `sm` up. -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            v-if="record.coverUrl || record.thumbUrl"
            :src="record.coverUrl || record.thumbUrl"
            :srcset="
              record.coverUrl && record.thumbUrl
                ? `${record.thumbUrl} 150w, ${record.coverUrl} 600w`
                : undefined
            "
            sizes="(min-width: 64rem) 224px, (min-width: 40rem) 176px, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
            width="600"
            height="600"
            class="aspect-square w-full shrink-0 rounded-fid-cover bg-fid-inset object-cover sm:size-44 sm:w-44 lg:size-56 lg:w-56"
          />
          <dl class="grid min-w-0 grow grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-fid-sm">
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
                  class="min-h-11 w-full rounded-fid-sm border border-fid-field bg-fid-surface px-2 text-fid-sm text-fid-text"
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
                {{ fact.value }}
              </dd>
            </template>
          </dl>
        </div>

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
                class="min-h-11 rounded-fid-sm border border-fid-field bg-fid-surface px-3 text-fid-sm text-fid-text"
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
                class="min-h-11 rounded-fid-sm border border-fid-field bg-fid-surface px-3 text-fid-sm text-fid-text"
                @change="setField(field, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </section>

        <section v-if="tags.length > 0" class="flex flex-col gap-2">
          <h3 class="text-fid-sm font-bold text-fid-text">{{ c.shelf.sheet.sounds }}</h3>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="tag in tags"
              :key="tag"
              class="rounded-fid-sm border border-fid-field px-2 py-1 text-fid-xs text-fid-text-muted"
            >
              {{ tag }}
            </li>
          </ul>
        </section>

        <!--
          What Discogs still owns.
          Tracklist, credits, every other pressing, and editing the entry
          itself all live over there — this sheet says what the app knows
          without asking, and hands over for the rest.
        -->
        <div class="mt-auto flex flex-wrap items-center gap-3 border-t border-fid-border pt-4">
          <a
            :href="`https://www.discogs.com/release/${record.releaseId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="fid-lift inline-flex min-h-11 items-center gap-2 rounded-fid-sm border border-fid-field bg-fid-surface-raised px-4 text-fid-sm font-medium text-fid-text"
          >
            {{ c.shelf.sheet.atDiscogs }}
            <FidIcon name="external-link" :size="14" />
          </a>

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
    </aside>
  </div>
</template>
