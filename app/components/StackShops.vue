<script setup lang="ts">
import type { StackShop } from '#shared/types'

import { useDigMessages } from '~/i18n/dig'

/**
 * Die Ladenreihe des Stapels — oben, mit farbigem Ring wo noch etwas liegt.
 *
 * Steht an zwei Stellen, und die zweite ist der Grund, warum es dieses
 * Bauteil gibt: **auf der Startseite war der Stapel sonst nicht zu finden.**
 * Der einzige Weg dorthin führte über die Dig-Seite und dort auch nur
 * innerhalb von `v-if="result"` — also nur, wenn zufällig gerade ein Dig
 * geladen war. Ein Bildschirm, den man kennen muss, um ihn zu erreichen,
 * existiert für die meisten nicht.
 *
 * Der Ring ist `matches - seen > 0` und sonst nichts: dieselbe Zahl, die der
 * Stapel abarbeitet, und keine zweite Wahrheit darüber, ob es Neues gibt.
 */
const props = defineProps<{
  shops: StackShop[]
  /** Nur im Stapel gesetzt — auf der Startseite ist kein Laden „offen". */
  current?: number
}>()

const emit = defineEmits<{ open: [index: number] }>()

const d = useDigMessages()
const router = useRouter()

/**
 * Auf der Startseite gibt es nichts zu öffnen, sondern etwas zu betreten.
 *
 * Derselbe Knopf, zwei Bedeutungen — deshalb entscheidet der Aufrufer: wer
 * auf `open` hört, bekommt den Index; wer nicht, landet im Stapel bei genau
 * diesem Laden.
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
