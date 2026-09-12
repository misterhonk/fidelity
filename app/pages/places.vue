<script setup lang="ts">
import type { CollectionItem, PlaceNode } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * Where the records stand (M12).
 *
 * **The one feature in this app that costs zero requests.** A collection does
 * not live in a list, it lives in a flat: shelf in the living room, second
 * compartment, the crate in the cellar, the box in the loft. Discogs does not
 * know that place and does not want to.
 */
const c = useCollectionMessages()
const m = useMessages()

useSeoMeta({ title: () => c.value.places.title, description: () => c.value.places.lead })

const { call } = useFidelityWorker()

const nodes = shallowRef<PlaceNode[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

/** Which place is currently open — one is enough. */
const open = ref<string | null>(null)
const contents = shallowRef<CollectionItem[]>([])

const naming = ref<string | null>(null)
const draft = ref('')

async function load() {
  nodes.value = await call('places.overview', undefined)
}

onMounted(async () => {
  try {
    await load()
  } catch (cause) {
    error.value = cause
  } finally {
    loading.value = false
  }
})

async function show(node: PlaceNode) {
  if (open.value === node.id) {
    open.value = null
    return
  }
  open.value = node.id
  contents.value = await call('places.contents', { placeId: node.id })
}

async function create(parentId: string | null) {
  const name = draft.value.trim()
  if (!name) return

  await call('places.create', { name, parentId })
  draft.value = ''
  naming.value = null
  await load()
}

async function rename(node: PlaceNode, name: string) {
  if (!name.trim() || name.trim() === node.name) return
  await call('places.rename', { id: node.id, name })
  await load()
}

/**
 * Dissolving — and the text says what does **not** happen in the process.
 *
 * Taking the shelf apart does not mean giving the records away. Without that
 * sentence nobody dares press the button, which would be a shame for a note
 * that can be rewritten at any time.
 */
const dissolving = ref<string | null>(null)

async function dissolve(node: PlaceNode) {
  await call('places.remove', { id: node.id })
  dissolving.value = null
  if (open.value === node.id) open.value = null
  await load()
}

/** Moving in: everything out of one crate and into another. */
const moving = ref<string | null>(null)

async function move(from: string, to: string) {
  await call('places.moveAll', { from, to })
  moving.value = null
  await load()
  if (open.value) contents.value = await call('places.contents', { placeId: open.value })
}

const total = computed(() => nodes.value.reduce((sum, node) => sum + node.records, 0))
</script>

<template>
  <AppPage narrow>
    <PageHeader :title="c.title" :heading="c.places.title" :lead="c.places.lead">
      <template #tabs><CollectionTabs /></template>
    </PageHeader>

    <ErrorNote v-if="error" :cause="error" />
    <p v-if="loading" class="text-fid-base text-fid-text-muted">{{ m.common.loading }}</p>

    <template v-else>
      <p v-if="nodes.length === 0" class="text-fid-base text-fid-text-muted">
        {{ c.places.empty }}
      </p>
      <p v-else class="text-fid-sm text-fid-text-muted">
        {{ c.places.placed(count(total)) }}
      </p>

      <ul class="flex flex-col gap-2">
        <li
          v-for="node in nodes"
          :key="node.id"
          class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-3"
          :style="{ marginLeft: `${node.depth * 16}px` }"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <button
              type="button"
              class="fid-action flex min-h-11 min-w-0 items-center gap-2 text-left text-fid-base text-fid-text"
              :aria-expanded="open === node.id"
              @click="show(node)"
            >
              <span class="truncate font-medium">{{ node.name }}</span>
              <!--
                  Two numbers where they differ: what sits here and what sits
                  underneath in total. A cellar showing 0 while three crates in
                  it are full is a lie.
                -->
              <span class="fid-num shrink-0 text-fid-xs text-fid-text-muted">
                {{
                  node.recordsBelow === node.records
                    ? count(node.records)
                    : c.places.withBelow(count(node.records), count(node.recordsBelow))
                }}
              </span>
            </button>

            <!--
                `min-w-0` rather than `shrink-0`: the button group **should**
                be allowed to shrink, or `flex-wrap` can never wrap and the row
                runs past the right edge (`design-restraint.spec.ts`).
              -->
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <button
                v-if="node.depth < 2"
                type="button"
                class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-xs text-fid-text-muted"
                @click="((naming = node.id), (draft = ''))"
              >
                {{ c.places.addInside }}
              </button>
              <button
                type="button"
                class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-xs text-fid-text-muted"
                @click="moving = moving === node.id ? null : node.id"
              >
                {{ c.places.moveAll }}
              </button>
              <button
                type="button"
                class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-3 text-fid-xs text-fid-text-muted"
                @click="dissolving = dissolving === node.id ? null : node.id"
              >
                {{ c.places.dissolve }}
              </button>
            </div>
          </div>

          <input
            :value="node.name"
            :aria-label="c.places.renameLabel(node.name)"
            class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
            @change="rename(node, ($event.target as HTMLInputElement).value)"
          />

          <form
            v-if="naming === node.id"
            class="flex flex-wrap gap-2"
            @submit.prevent="create(node.id)"
          >
            <input
              v-model="draft"
              :placeholder="c.places.namePlaceholder"
              :aria-label="c.places.addInside"
              class="min-w-0 grow rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
            />
            <!--
                Outlined, not filled. A screen carries exactly one filled
                accent (`design-restraint.spec.ts`), and it belongs to the
                button at the foot: "create a place" is why somebody is here.
                This one puts something *into* a place that already exists.
              -->
            <button
              type="submit"
              class="fid-action min-h-11 rounded-fid-sm border border-fid-border px-4 text-fid-sm text-fid-text"
            >
              {{ c.places.add }}
            </button>
          </form>

          <div v-if="moving === node.id" class="flex flex-wrap items-center gap-2">
            <label class="text-fid-xs text-fid-text-muted" :for="`move-${node.id}`">
              {{ c.places.moveTo }}
            </label>
            <select
              :id="`move-${node.id}`"
              class="rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
              @change="move(node.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">—</option>
              <option
                v-for="other in nodes.filter((n) => n.id !== node.id)"
                :key="other.id"
                :value="other.id"
              >
                {{ other.name }}
              </option>
            </select>
          </div>

          <div v-if="dissolving === node.id" class="flex flex-col gap-2">
            <p class="text-fid-sm text-fid-text-muted">{{ c.places.dissolveWhat }}</p>
            <button
              type="button"
              class="fid-action min-h-11 self-start rounded-fid-sm border border-fid-sig-scarcity px-4 text-fid-sm text-fid-sig-scarcity"
              @click="dissolve(node)"
            >
              {{ c.places.dissolveConfirm }}
            </button>
          </div>

          <ul
            v-if="open === node.id"
            class="flex flex-col gap-1 border-t border-fid-border pt-2"
          >
            <li v-if="contents.length === 0" class="text-fid-sm text-fid-text-muted">
              {{ c.places.nothingHere }}
            </li>
            <li
              v-for="record in contents"
              :key="record.instanceId"
              class="text-fid-sm text-fid-text"
            >
              {{ record.artistNames.join(' · ') }} – {{ record.title }}
            </li>
          </ul>
        </li>
      </ul>

      <form class="flex flex-wrap gap-2" @submit.prevent="create(null)">
        <input
          v-model="draft"
          :placeholder="c.places.namePlaceholder"
          :aria-label="c.places.addTop"
          class="min-w-0 grow rounded-fid-sm border border-fid-field bg-fid-surface px-3 py-2 text-fid-sm text-fid-text"
        />
        <button
          type="submit"
          class="fid-fill min-h-11 rounded-fid-sm bg-fid-accent-fill px-4 text-fid-sm font-medium text-fid-on-accent"
        >
          {{ c.places.addTop }}
        </button>
      </form>

      <!--
          Said, because it is why this screen is different from every other:
          something is created here that does not exist at Discogs and goes
          nowhere.
        -->
      <p class="text-fid-xs text-fid-text-muted">{{ c.places.staysHere }}</p>
    </template>
  </AppPage>
</template>
