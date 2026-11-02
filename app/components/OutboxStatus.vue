<script setup lang="ts">
import type { OutboxOverview } from '~~/worker/outbox'
import { useCollectionMessages } from '~/i18n/collection'

/**
 * What has not reached Discogs yet, and what needs you (#238).
 *
 * A line beside the shelf's own state, there only when something waits, and
 * the sheet behind it: every waiting change by record with its attempts and
 * last answer, a choice where both sides changed, and the copies a full sync
 * no longer found. Nothing disappears silently. Read off the device, no request.
 */
const c = useCollectionMessages()
const o = computed(() => c.value.outbox)
const { call } = useFidelityWorker()

const overview = shallowRef<OutboxOverview | null>(null)
const open = ref(false)
const busy = ref<string | null>(null)

async function load() {
  overview.value = await call('outbox.list', undefined)
}
onMounted(load)

const waiting = computed(
  () => overview.value?.records.reduce((sum, record) => sum + record.changes.length, 0) ?? 0,
)
const decide = computed(
  () =>
    overview.value?.records.reduce(
      (sum, record) => sum + record.changes.filter((change) => change.theirs !== null).length,
      0,
    ) ?? 0,
)
const gone = computed(() => overview.value?.gone.length ?? 0)

async function show() {
  await load()
  open.value = true
}

async function resolve(id: string, keep: 'mine' | 'theirs') {
  busy.value = id
  try {
    await call('outbox.resolve', { id, keep })
    // Kept: on its way now, through the same nudge every change gives.
    if (keep === 'mine') await call('outbox.flush', undefined).catch(() => undefined)
  } finally {
    busy.value = null
    await load()
  }
}
</script>

<template>
  <FidButton
    v-if="waiting + gone > 0"
    variant="tertiary"
    data-testid="outbox-open"
    @click="show()"
  >
    {{ o.open(waiting, decide, gone) }}
  </FidButton>

  <SheetFrame v-if="open" :label="o.title" @close="open = false">
    <template #title>{{ o.title }}</template>

    <p v-if="waiting === 0" class="text-fid-sm text-fid-text-muted">{{ o.empty }}</p>

    <ul v-else class="flex flex-col gap-4">
      <li
        v-for="record in overview?.records ?? []"
        :key="record.key"
        class="flex flex-col gap-2 border-b border-fid-border pb-4"
      >
        <h3 class="text-fid-base font-bold text-fid-text">{{ record.title }}</h3>
        <ul class="flex flex-col gap-3">
          <li v-for="change in record.changes" :key="change.id" class="flex flex-col gap-1">
            <p class="text-fid-sm text-fid-text">
              {{ o.kinds[change.kind]
              }}<template v-if="change.ours">: {{ change.ours }}</template>
            </p>
            <p class="text-fid-sm text-fid-text-muted">
              {{ change.attempts > 0 ? o.attempts(change.attempts) : o.waiting
              }}<template v-if="change.lastError">
                · {{ o.lastError(change.lastError) }}</template
              >
            </p>

            <div
              v-if="change.theirs !== null"
              role="group"
              :aria-label="o.conflict"
              class="flex flex-col gap-2 rounded-fid-sm bg-fid-inset p-3"
            >
              <p class="text-fid-sm text-fid-text">{{ o.conflict }}</p>
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 text-fid-sm">
                <dt class="text-fid-text-muted">{{ o.yours }}</dt>
                <dd class="text-fid-text">{{ change.ours }}</dd>
                <dt class="text-fid-text-muted">{{ o.theirs }}</dt>
                <dd class="text-fid-text">{{ change.theirs }}</dd>
              </dl>
              <div class="flex flex-wrap gap-2">
                <FidButton
                  variant="secondary"
                  :disabled="busy === change.id"
                  @click="resolve(change.id, 'mine')"
                >
                  {{ o.keepMine }}
                </FidButton>
                <FidButton
                  variant="secondary"
                  :disabled="busy === change.id"
                  @click="resolve(change.id, 'theirs')"
                >
                  {{ o.takeTheirs }}
                </FidButton>
              </div>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <section v-if="gone > 0" class="flex flex-col gap-2" aria-labelledby="outbox-gone">
      <h3 id="outbox-gone" class="text-fid-base font-bold text-fid-text">{{ o.gone }}</h3>
      <p class="text-fid-sm text-fid-text-muted">{{ o.goneLead }}</p>
      <ul class="flex flex-col gap-2">
        <li v-for="copy in overview?.gone ?? []" :key="copy.instanceId" class="text-fid-sm">
          <span class="text-fid-text">{{ copy.title }}</span>
          <span class="text-fid-text-muted">
            · {{ o.goneUntil(copy.place, day(copy.until)) }}</span
          >
        </li>
      </ul>
    </section>
  </SheetFrame>
</template>
