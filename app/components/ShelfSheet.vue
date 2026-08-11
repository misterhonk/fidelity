<script setup lang="ts">
import type { CollectionItem } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'

const c = useCollectionMessages()
const m = useMessages()

const props = defineProps<{ releaseId: number }>()
const emit = defineEmits<{ close: [] }>()

const { call } = useFidelityWorker()

const record = ref<CollectionItem | null>(null)
const panel = useTemplateRef<HTMLElement>('panel')

onMounted(async () => {
  panel.value?.focus()
  record.value = await call('collection.record', { releaseId: props.releaseId })
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
            sizes="(min-width: 40rem) 96px, 100vw"
            alt=""
            loading="lazy"
            decoding="async"
            width="600"
            height="600"
            class="aspect-square w-full rounded-fid-cover bg-fid-inset object-cover sm:size-24 sm:w-24 sm:shrink-0"
          />
          <dl class="grid min-w-0 grow grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-fid-sm">
            <!--
              Only when it was actually given, and first, because it is the one
              line that is an opinion rather than a fact. A zero on Discogs
              means "never rated", not "rated nothing" — five hollow stars
              would invent an opinion the collector never had.
            -->
            <template v-if="record.rating > 0">
              <dt class="text-fid-text-muted">{{ c.shelf.sheet.facts.rating }}</dt>
              <dd
                class="fid-num min-w-0 text-fid-sig-wantlist"
                :aria-label="c.shelf.sheet.rated(record.rating)"
              >
                {{ '★'.repeat(record.rating) }}
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
        </div>
      </template>
    </aside>
  </div>
</template>
