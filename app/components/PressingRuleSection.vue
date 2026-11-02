<script setup lang="ts">
import type { PressingRule } from '#shared/types'
import { useCollectionMessages } from '~/i18n/collection'

/**
 * Which pressings of a wanted album will do (#242, docs/04 §S2).
 *
 * "First pressing only", "anything but the 2016 reissue" — what people write
 * into the Discogs note, kept where a dig can read it. Per album and on this
 * device; the next dig honours it.
 */
const props = defineProps<{ masterId: number }>()

const c = useCollectionMessages()
const { call } = useFidelityWorker()

const rule = ref<PressingRule>({ firstOnly: false, except: [] })
const typed = ref('')
const invalid = ref(false)
// A new keystroke is a new attempt; the old complaint no longer applies.
watch(typed, () => {
  invalid.value = false
})

onMounted(async () => {
  try {
    rule.value = (await call('wantlist.rule', { masterId: props.masterId })) ?? rule.value
  } catch {
    // Any pressing, which is what the dig assumes without one.
  }
})

async function save(next: PressingRule) {
  rule.value = next
  try {
    // Plain copies: a reactive array does not survive postMessage.
    await call('wantlist.setRule', {
      masterId: props.masterId,
      rule: { firstOnly: next.firstOnly, except: [...next.except] },
    })
  } catch {
    // Shown as set; the next open reads what was really stored.
  }
}

/** A release id, or a Discogs release address that carries one. */
function add() {
  const id = releaseIdFrom(typed.value)
  invalid.value = id === null
  if (id === null) return
  typed.value = ''
  void save({ ...rule.value, except: [...new Set([...rule.value.except, id])] })
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h3 class="text-fid-sm font-bold text-fid-text">{{ c.wantlist.rule.heading }}</h3>

    <label class="flex items-start gap-3">
      <input
        :checked="rule.firstOnly"
        type="checkbox"
        class="mt-1 size-4"
        @change="save({ ...rule, firstOnly: ($event.target as HTMLInputElement).checked })"
      />
      <span class="flex flex-col gap-1">
        <span class="text-fid-sm text-fid-text">{{ c.wantlist.rule.firstOnly }}</span>
        <span class="text-fid-xs text-fid-text-muted">{{ c.wantlist.rule.firstOnlyHint }}</span>
      </span>
    </label>

    <ul v-if="rule.except.length > 0" class="flex flex-col gap-1">
      <li
        v-for="id in rule.except"
        :key="id"
        class="flex items-center justify-between gap-2 text-fid-sm"
      >
        <OutwardLink tone="inherit" :to="`https://www.discogs.com/release/${id}`">
          {{ c.wantlist.rule.notThis(id) }}
        </OutwardLink>
        <button
          type="button"
          class="fid-lift flex min-h-11 min-w-11 items-center justify-center text-fid-text-muted hover:text-fid-text"
          :aria-label="c.wantlist.rule.allow(id)"
          @click="save({ ...rule, except: rule.except.filter((other) => other !== id) })"
        >
          <span aria-hidden="true">×</span>
        </button>
      </li>
    </ul>

    <form class="flex flex-col gap-1" @submit.prevent="add">
      <label for="rule-except" class="text-fid-xs text-fid-text-muted">
        {{ c.wantlist.rule.exceptLabel }}
      </label>
      <div class="flex gap-2">
        <input
          id="rule-except"
          v-model="typed"
          autocomplete="off"
          :aria-invalid="invalid"
          :placeholder="c.wantlist.rule.exceptPlaceholder"
          class="fid-num min-h-11 min-w-0 flex-1 rounded-fid-sm border bg-fid-surface px-3 text-fid-sm text-fid-text"
          :class="invalid ? 'border-fid-error' : 'border-fid-border'"
        />
        <FidButton variant="tertiary" type="submit">{{ c.wantlist.rule.exceptAdd }}</FidButton>
      </div>
      <p v-if="invalid" role="alert" class="flex items-center gap-1 text-fid-xs text-fid-error">
        <FidIcon name="circle-alert" :size="14" aria-hidden="true" />
        {{ c.wantlist.rule.notARelease }}
      </p>
    </form>
  </section>
</template>
