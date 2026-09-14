<script setup lang="ts">
import type { ReleaseDetail } from '#shared/types'

import { useCollectionMessages } from '~/i18n/collection'

/**
 * What a record *is*, on every screen that shows one (M31.5).
 *
 * The shelf's sheet had all of this and a find's sheet had none of it — two
 * data paths, two screens, the same record. And the difference was free to
 * close: the find's sheet already fetches the very same release detail, for
 * the clips, so the tracklist, the credits and the run-out groove were sitting
 * in memory and simply not being unpacked.
 *
 * The order is the one the questions come in: what it sounds like, who made
 * it, which pressing this is, and last what the people who catalogued it wrote
 * down. A beginner stops after the first; somebody standing in a shop with the
 * record in their hand scrolls to the run-out.
 */
const c = useCollectionMessages()
const r = computed(() => c.value.shelf.sheet)

const props = defineProps<{
  detail: ReleaseDetail | null
  /**
   * What it sounds like. Handed in rather than read from `detail`, because the
   * shelf has it out of storage immediately and the find only after the
   * lookup — and a chip that appears a second late reads as a glitch.
   */
  tags?: string[]
  /**
   * Whether the market line may offer to ask again.
   *
   * Only the shelf's sheet can: a find already shows the marketplace numbers
   * further up, and a second "what is it worth" beside them would be two
   * answers to one question.
   */
  refreshable?: boolean
  looking?: boolean
}>()

defineEmits<{ refresh: [] }>()

/** A run-out number is the one identifier you read off the record itself. */
const runouts = computed(() =>
  (props.detail?.identifiers ?? []).filter((identifier) =>
    /matrix|runout/i.test(identifier.type),
  ),
)

const marketPrice = computed(() => {
  const market = props.detail?.market
  return market ? money(market.priceCents / 100, market.currency) : null
})
</script>

<template>
  <section v-if="tags?.length" class="flex flex-col gap-2">
    <h3 class="text-fid-sm font-bold text-fid-text">{{ r.sounds }}</h3>
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

  <section v-if="detail?.credits.length" class="flex flex-col gap-2">
    <h3 class="text-fid-sm font-bold text-fid-text">{{ r.credits }}</h3>
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-fid-sm">
      <template v-for="(credit, index) in detail.credits" :key="`${credit.name}-${index}`">
        <dt class="text-fid-text-muted">{{ credit.role || '—' }}</dt>
        <dd class="min-w-0 text-fid-text">{{ credit.name }}</dd>
      </template>
    </dl>
  </section>

  <!--
        The number in the run-out groove, and what everybody else thinks.

        The matrix is the one identifier you can read off the record itself
        while standing in a shop — which is exactly the question "is this the
        pressing I think it is". The barcode and the rest stay on Discogs.
      -->
  <section
    v-if="runouts.length || detail?.community || detail?.country"
    class="flex flex-col gap-2"
  >
    <h3 class="text-fid-sm font-bold text-fid-text">{{ r.pressing }}</h3>
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-fid-sm">
      <template v-if="detail?.country">
        <dt class="text-fid-text-muted">{{ r.facts.country }}</dt>
        <dd class="min-w-0 text-fid-text">
          {{ detail.country }}
          <template v-if="detail.released"> · {{ detail.released }}</template>
        </dd>
      </template>
      <template v-for="(runout, index) in runouts" :key="index">
        <dt class="text-fid-text-muted">{{ runout.description || runout.type }}</dt>
        <dd class="fid-num min-w-0 text-fid-xs break-all text-fid-text">
          {{ runout.value }}
        </dd>
      </template>
      <template v-if="detail?.community">
        <dt class="text-fid-text-muted">{{ r.everyone }}</dt>
        <dd class="min-w-0 text-fid-text">
          {{
            r.communityRating(detail.community.rating.toFixed(2), count(detail.community.votes))
          }}
        </dd>
      </template>

      <!--
            What it goes for — the one line here allowed to go stale, and
            therefore the one that disappears rather than ageing. Rule 4:
            marketplace data is never shown once it is six hours old. The
            worker drops it on the way out; this offers to ask again, which
            is the only thing on this sheet that costs a second request.
          -->
      <template v-if="detail?.market && marketPrice">
        <dt class="text-fid-text-muted">{{ r.forSale }}</dt>
        <dd class="min-w-0 text-fid-text">
          {{ r.cheapest(marketPrice, count(detail.market.numForSale)) }}
        </dd>
      </template>
      <template v-else-if="detail && refreshable">
        <dt class="text-fid-text-muted">{{ r.forSale }}</dt>
        <dd class="min-w-0">
          <button
            type="button"
            class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4 disabled:opacity-60"
            :disabled="looking"
            @click="$emit('refresh')"
          >
            {{ looking ? r.looking : r.whatIsItWorth }}
          </button>
        </dd>
      </template>
    </dl>
  </section>

  <!--
        What the people who catalogued it wrote down: which sleeve, which
        plant, who licensed what. Late in the sheet, because it is prose in a
        page of facts and reads like a footnote.
      -->
  <section v-if="detail?.notes" class="flex flex-col gap-2">
    <h3 class="text-fid-sm font-bold text-fid-text">{{ r.aboutIt }}</h3>
    <p class="text-fid-sm whitespace-pre-line text-fid-text-muted">{{ detail.notes }}</p>
  </section>
</template>
