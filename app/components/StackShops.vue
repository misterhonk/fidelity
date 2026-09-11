<script setup lang="ts">
import type { StackShop } from '#shared/types'

import { useDigMessages } from '~/i18n/dig'

/**
 * The stack's shop row — at the top, with a coloured ring where something is
 * still waiting.
 *
 * It stands in two places, and the second is why this component exists: **the
 * stack was otherwise not findable from the start page.** The only way there
 * led through the dig page, and there only inside `v-if="result"` — so only
 * when a dig happened to be loaded. A screen you have to know about to reach
 * does not exist for most people.
 *
 * The ring is `matches - seen > 0` and nothing else: the same number the stack
 * works through, and not a second truth about whether there is anything new.
 */
const props = defineProps<{
  shops: StackShop[]
  /** Set only in the stack — on the start page no shop is "open". */
  current?: number
}>()

const emit = defineEmits<{ open: [index: number] }>()

const d = useDigMessages()
const router = useRouter()

/**
 * On the start page there is nothing to open but something to walk into.
 *
 * The same button, two meanings — so the caller decides: anyone listening for
 * `open` gets the index; anyone not lands in the stack at exactly this shop.
 */
function choose(index: number, shop: StackShop) {
  if (props.current !== undefined) {
    emit('open', index)
    return
  }
  void router.push({ path: '/stack', query: { dealer: shop.dealer } })
}
</script>

<template>
  <ul v-if="shops.length > 0" class="flex gap-3 overflow-x-auto pb-1">
    <li v-for="(shop, i) in shops" :key="shop.digId" class="shrink-0">
      <button
        type="button"
        class="flex w-16 flex-col items-center gap-1"
        :aria-current="i === props.current ? 'true' : undefined"
        :aria-label="d.stack.shop(shop.displayName, shop.matches - shop.seen)"
        @click="choose(i, shop)"
      >
        <span
          class="flex size-14 items-center justify-center rounded-full border-2 p-1"
          :class="
            shop.matches - shop.seen > 0
              ? 'border-fid-accent-fill'
              : 'border-fid-border opacity-60'
          "
        >
          <img
            v-if="shop.avatarUrl"
            :src="shop.avatarUrl"
            alt=""
            loading="lazy"
            class="size-full rounded-full object-cover"
          />
          <span v-else class="text-fid-sm font-bold text-fid-text">
            {{ shop.displayName.slice(0, 2).toUpperCase() }}
          </span>
        </span>
        <span class="w-full truncate text-center text-fid-xs text-fid-text-muted">
          {{ shop.displayName }}
        </span>
      </button>
    </li>
  </ul>
</template>
