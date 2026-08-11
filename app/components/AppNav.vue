<script setup lang="ts">
const m = useMessages()
const { identity, load } = useIdentity()
const { ids: basketIds, load: loadBasket } = useBasket()

/*
 * The nav asks for the identity itself.
 *
 * It used to read the shared ref and rely on whichever page happened to have
 * loaded it — so opening /dig directly showed no navigation at all, because
 * that page never asks who is signed in. The composable is idempotent: several
 * components asking on one load still make one request.
 */
onMounted(() => {
  void load()
  void loadBasket()
})

/**
 * The five nouns of the hobby, in the order somebody moves through them.
 *
 * They were buttons inside the sync panel before, which put navigation inside
 * a piece of data and made "where am I" unanswerable. A persistent bar is the
 * plainest fix and the one every phone user already knows.
 *
 * "In the shop" is deliberately not here: it is a *mode* you enter with a
 * record in your hand, not a section you browse, and it is reached from the dig
 * result and from the overview where that decision is actually being made.
 *
 * The `key` names the entry in the message pack. What is left here is only what
 * does not change with the language: where it goes, what it looks like, and
 * which other screens count as part of it.
 */
const SECTIONS = [
  { to: '/', key: 'start', icon: 'house' },
  { to: '/dig', key: 'dig', icon: 'kiste' },
  { to: '/basket', key: 'basket', icon: 'shopping-basket', also: ['/saved'] },
  { to: '/shelf', key: 'shelf', icon: 'regal', also: ['/map', '/wantlist'] },
  { to: '/dealers', key: 'dealers', icon: 'store' },
] as const

const route = useRoute()
/**
 * A section stays lit for the screens that belong to it.
 *
 * The wantlist lives under "Sammlung" — same subject, other side — and a tab
 * that goes dark when you switch to it would say you had left the section.
 */
const isCurrent = (section: { to: string; also?: readonly string[] }) => {
  if (section.to === '/') return route.path === '/'
  if (route.path.startsWith(section.to)) return true
  return (section.also ?? []).some((path) => route.path.startsWith(path))
}

const basketCount = computed(() => basketIds.value.size)
</script>

<template>
  <!--
    Nothing before there is somebody to navigate. Showing five sections to a
    visitor who has not entered a token yet promises screens that cannot work.

    And nothing during the setup either: the token step signs somebody in, so
    the bar would pop into existence halfway through a flow that is supposed to
    be the only thing on screen.
  -->
  <nav
    v-if="identity && route.path !== '/welcome'"
    :aria-label="m.nav.label"
    class="z-30 md:sticky md:top-0 md:border-b md:border-fid-border md:bg-fid-bg/90 md:backdrop-blur max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:border-t max-md:border-fid-border max-md:bg-fid-surface/95 max-md:pb-[env(safe-area-inset-bottom)] max-md:backdrop-blur"
  >
    <!--
      Stretched to equal widths on a phone, where a tab bar is a row of
      thumb-sized targets. Naturally sized on a desktop, where stretching them
      across the window pulls the labels away from the column they belong to.
    -->
    <!--
      The side padding is not cosmetic on a phone. The screen corners are
      rounded, and a row stretched edge to edge puts the outermost tab — Start
      on one side, the gear on the other — into the curve.
    -->
    <div class="mx-auto flex max-w-3xl items-stretch gap-1 px-6 max-md:gap-0 max-md:px-3">
      <NuxtLink
        v-for="section in SECTIONS"
        :key="section.to"
        :to="section.to"
        :aria-current="isCurrent(section) ? 'page' : undefined"
        :title="m.nav[section.key].hint"
        class="relative flex min-h-11 items-center justify-center gap-2 border-b-2 px-3 text-fid-sm transition-colors max-md:min-h-14 max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:rounded-fid-sm max-md:border-b-0 max-md:border-t-0 max-md:px-1 max-md:py-2 max-md:text-fid-xs"
        :class="
          isCurrent(section)
            ? 'border-fid-accent text-fid-text max-md:bg-fid-accent/15'
            : 'border-transparent text-fid-text-muted hover:text-fid-text'
        "
      >
        <!--
          The icon carries the recognition, the word carries the meaning.
          Neither is dropped at any width: a bare glyph is a guess, and on a
          phone a row of five words in 11px is a row nobody aims at.
        -->
        <!--
          The badge sits on the basket, not beside it.

          It used to be a third child of the link — which on a phone, where the
          link is a column, made it a third *row*: the basket tab grew taller
          than its four neighbours and pushed its own icon and label up out of
          the line they share. On a desktop it did the same sideways.

          Pinned to the icon rather than to the link, so it stays on the basket
          in both directions instead of drifting to the corner of a wide tab.
        -->
        <span class="relative flex shrink-0">
          <FidIcon :name="section.icon" :size="20" />
          <!--
            The badge is on the basket because it is the only number that means
            "you left something unfinished". Everything else is either zero or
            not urgent.
          -->
          <span
            v-if="section.to === '/basket' && basketCount > 0"
            class="fid-num pointer-events-none absolute -top-1.5 -right-2 min-w-4 rounded-full bg-fid-accent px-1 text-center text-[0.625rem] leading-4 font-medium text-fid-on-accent"
            :aria-label="m.nav.inBasket(basketCount)"
          >
            {{ basketCount }}
          </span>
        </span>
        {{ m.nav[section.key].label }}
      </NuxtLink>

      <!--
        On the same line as the other five.

        The gear carries no label, so centring it in a bar sized for
        icon-plus-word put its glyph eleven pixels below the rest. Centred is
        right for a box on its own and wrong for the sixth thing in a row: the
        eye reads the line of icons, and one sitting low reads as a mistake
        rather than as a different kind of control.

        Same column and the same top padding as the labelled tabs, minus the
        label. On a desktop the bar is a row of centred items and this changes
        nothing.
      -->
      <NuxtLink
        to="/settings"
        :aria-current="isCurrent({ to: '/settings' }) ? 'page' : undefined"
        :aria-label="m.nav.settings"
        :title="m.nav.settings"
        class="flex min-h-11 min-w-11 items-center justify-center border-b-2 text-fid-base transition-colors md:ml-auto max-md:min-h-14 max-md:flex-col max-md:justify-start max-md:rounded-fid-sm max-md:border-b-0 max-md:border-t-0 max-md:py-2"
        :class="
          isCurrent({ to: '/settings' })
            ? 'border-fid-accent text-fid-text max-md:bg-fid-accent/15'
            : 'border-transparent text-fid-text-muted hover:text-fid-text'
        "
      >
        <FidIcon name="settings" :size="20" />
      </NuxtLink>
    </div>
  </nav>
</template>
