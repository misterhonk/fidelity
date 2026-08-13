<script setup lang="ts">
/**
 * Ein Cover in einer Reihe.
 *
 * The image is never fetched actively — `loading="lazy"` and nothing else.
 * i.discogs.com has its own Cloudflare limit of roughly 30–40 a minute that
 * has nothing to do with the API budget (docs/02), and a start screen that
 * eagerly pulls forty thumbnails would run into a limit it cannot even see.
 */
const m = useMessages()

const props = withDefaults(
  defineProps<{
    thumbUrl?: string | null
    coverUrl?: string | null
    title: string
    subtitle?: string | null
    /** The Barry score, where there is one. */
    score?: number | null
    note?: string | null
    /** Staggers the entrance, so the rail assembles rather than appears. */
    index?: number
    /**
     * Where the cover leads, for rails that have somewhere to lead.
     *
     * Without either this or an `open` listener the tile renders as a plain
     * `<div>` — which is what three of the four rails on the start screen were
     * doing: a shelf, a wantlist and a shop, all of them shown and none of
     * them reachable.
     */
    href?: string | null
    /**
     * Somewhere inside the app, for a record that has a place here.
     *
     * Separate from `href`, which leaves: an internal address must not open a
     * second tab, and it must be a real link — middle-click, "open in new tab"
     * and a screen reader's list of links all depend on that, which is what a
     * button dressed as a link takes away.
     */
    to?: string | null
    /**
     * Was passiert, wenn jemand die Kachel antippt.
     *
     * A callback rather than an emit, and that is the whole point. This used to
     * be `@open`, and the element decided what to render by asking
     * `$attrs.onOpen` — which Vue strips the moment the event is declared in
     * `defineEmits`. So the test was always false, every tile rendered as a
     * `<div>`, and the release sheet on the start screen could not be opened at
     * all: the listener was bound to something that was never clickable.
     *
     * Passed as a prop, there is one fact instead of two. A tile is a button
     * when it has something to do, and it cannot be bound without becoming one.
     */
    open?: (() => void) | null
  }>(),
  {
    index: 0,
    href: null,
    to: null,
    open: null,
    thumbUrl: null,
    coverUrl: null,
    subtitle: null,
    score: null,
    note: null,
  },
)

/**
 * Which element this tile actually is — decided here, not in the template.
 *
 * `resolveComponent('NuxtLink')` looks like it works in a template expression
 * and does not: in a production build it silently hands back the *string*
 * `'NuxtLink'`, so `<component :is>` renders a literal `<nuxtlink>` element.
 * No error, no warning, and a cover that is simply not clickable — measured
 * 2026-08-13, and found because the accessibility tree stopped listing the
 * wantlist rail at all.
 *
 * Called in setup it resolves to the real component.
 */
const NuxtLinkTag = resolveComponent('NuxtLink')

const tag = computed(() =>
  props.open ? 'button' : props.to ? NuxtLinkTag : props.href ? 'a' : 'div',
)
</script>

<template>
  <li
    class="fid-tile flex w-36 shrink-0 snap-start flex-col gap-2 @2xl:w-44"
    :style="{ '--fid-stagger': index }"
  >
    <component
      :is="tag"
      :type="open ? 'button' : undefined"
      :to="open ? undefined : (to ?? undefined)"
      :href="open || to ? undefined : (href ?? undefined)"
      :target="open || to ? undefined : href ? '_blank' : undefined"
      :rel="open || to ? undefined : href ? 'noopener noreferrer' : undefined"
      :aria-label="
        open || to ? m.common.openRecord(title) : href ? m.common.atDiscogs(title) : undefined
      "
      class="group relative block w-full text-left"
      @click="open?.()"
    >
      <img
        v-if="thumbUrl"
        :src="thumbUrl"
        :srcset="coverUrl ? `${thumbUrl} 150w, ${coverUrl} 600w` : undefined"
        sizes="(min-width: 1024px) 176px, 144px"
        alt=""
        loading="lazy"
        decoding="async"
        class="aspect-square w-full rounded-fid-cover bg-fid-inset object-cover transition-transform duration-200 group-hover:-translate-y-0.5"
      />
      <div
        v-else
        class="flex aspect-square w-full items-center justify-center rounded-fid-cover bg-fid-inset text-fid-text-muted"
        aria-hidden="true"
      >
        <FidIcon name="platte" :size="36" />
      </div>

      <!--
        The score rides on the cover rather than under it. On a rail the
        picture is what the eye lands on, and a number beside it in the caption
        is read after the decision has already been made.
      -->
      <span
        v-if="score !== null && score !== undefined"
        class="fid-num absolute top-1.5 right-1.5 rounded-fid-sm bg-fid-n-990/80 px-2 py-1 text-fid-xs font-medium text-fid-n-50"
      >
        {{ score }}
      </span>
    </component>

    <div class="flex min-w-0 flex-col">
      <span class="truncate text-fid-sm text-fid-text" :title="title">{{ title }}</span>
      <span v-if="subtitle" class="truncate text-fid-xs text-fid-text-muted" :title="subtitle">
        {{ subtitle }}
      </span>
      <span v-if="note" class="fid-num truncate text-fid-xs text-fid-text-muted">{{
        note
      }}</span>
    </div>
  </li>
</template>
