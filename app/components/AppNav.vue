<script setup lang="ts">
const m = useMessages()
const { identity, load } = useIdentity()
const { ids: basketIds, load: loadBasket } = useBasket()
const { percent: digPercent } = useRunningDig()

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
 * Today · Shops · Collection · Basket · Search (#228).
 *
 * The shop is the unit: its page holds the finds, the profile and the visits,
 * and digging is the verb you use on it — so "Dig" is no longer a place of its
 * own. `/shop` and `/stack` light the Shops tab; the collection's four views
 * light the Collection tab.
 *
 * "In the shop" is deliberately not here: it is a *mode* you enter with a
 * record in your hand, not a section you browse. It is reached from the start
 * page, from the end of the setup and from ⌘K. The settings are not here
 * either: they live behind the profile — the name at the end of the bar on a
 * desktop, and on Today on a phone, where the bar has room for five.
 *
 * The `key` names the entry in the message pack. What is left here is only what
 * does not change with the language: where it goes, what it looks like, and
 * which other screens count as part of it.
 */
const SECTIONS = [
  { to: '/', key: 'start', icon: 'house' },
  { to: '/shops', key: 'dealers', icon: 'store', also: ['/shop', '/stack', '/gift'] },
  {
    to: '/collection',
    key: 'shelf',
    icon: 'shelf',
    also: ['/insights', '/wantlist', '/watched', '/places'],
  },
  { to: '/basket', key: 'basket', icon: 'shopping-basket', also: ['/saved'] },
] as const

const paletteOpen = usePaletteOpen()

/**
 * Where a tab goes. Shops leads to the running dig while one runs: the ring
 * on the tab says a shop is being read, and tapping it should show that shop
 * rather than the list it is one row of.
 */
const target = (section: (typeof SECTIONS)[number]) =>
  section.to === '/shops' && digPercent.value !== null ? '/shop' : section.to

const route = useRoute()
/**
 * A section stays lit for the screens that belong to it.
 *
 * The wantlist lives under "Sammlung" — same subject, other side — and a tab
 * that goes dark when you switch to it would say you had left the section.
 */
const isCurrent = (section: { to: string; also?: readonly string[] }) => {
  if (section.to === '/') return route.path === '/'
  const under = (path: string) => route.path === path || route.path.startsWith(`${path}/`)
  return under(section.to) || (section.also ?? []).some(under)
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
    class="z-30 md:sticky md:top-0 md:border-b md:border-fid-border md:bg-fid-bg/90 md:backdrop-blur max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:border-t max-md:border-fid-border max-md:bg-fid-surface/95 max-md:pb-[env(safe-area-inset-bottom,0px)] max-md:backdrop-blur md:pt-[env(safe-area-inset-top,0px)]"
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
    <div class="fid-page flex items-stretch gap-1 max-md:gap-0 max-md:px-3">
      <NuxtLink
        v-for="section in SECTIONS"
        :key="section.to"
        :to="target(section)"
        :aria-current="isCurrent(section) ? 'page' : undefined"
        :aria-describedby="
          section.to === '/shops' && digPercent !== null ? 'nav-dig-running' : undefined
        "
        :title="m.nav[section.key].hint"
        class="relative flex min-h-11 items-center justify-center gap-2 border-b-2 px-3 text-fid-sm transition-colors max-md:min-h-16 max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:rounded-fid-sm max-md:border-b-0 max-md:border-t-0 max-md:px-1 max-md:py-3 max-md:text-fid-xs"
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
            A dig runs on whatever screen somebody is on (#216): a ring round
            the crate, filling as the shop is read. Drawn, not spoken — the
            words are the link's description, after the links.
          -->
          <svg
            v-if="section.to === '/shops' && digPercent !== null"
            data-testid="dig-ring"
            class="pointer-events-none absolute -inset-1.5 -rotate-90"
            viewBox="0 0 36 36"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke-width="2.5"
              class="stroke-fid-inset"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke-width="2.5"
              stroke-linecap="round"
              pathLength="100"
              :stroke-dasharray="`${digPercent} 100`"
              class="stroke-fid-accent"
            />
          </svg>
          <!--
            The badge is on the basket because it is the only number that means
            "you left something unfinished". Everything else is either zero or
            not urgent.
          -->
          <span
            v-if="section.to === '/basket' && basketCount > 0"
            class="fid-num pointer-events-none absolute -top-1.5 -right-2 min-w-4 rounded-full bg-fid-accent-fill px-1 text-center text-[0.625rem] leading-4 font-medium text-fid-on-accent"
            :aria-label="m.nav.inBasket(basketCount)"
          >
            {{ basketCount }}
          </span>
        </span>
        {{ m.nav[section.key].label }}
      </NuxtLink>
      <!--
        A description, not part of the name: the tab stays "Shops" for anyone
        who finds it by name, and says it is busy to anyone who lands on it.
      -->
      <span v-if="digPercent !== null" id="nav-dig-running" class="sr-only">
        {{ m.nav.digRunning(milestone(digPercent)) }}
      </span>

      <!--
        The fifth entry is not a place but a door (#228): the palette searches
        records, shops and actions at once, and a phone has no ⌘K. Built like
        the tabs beside it so it lines up with them — a button, because it
        opens a dialog rather than going anywhere.
      -->
      <button
        type="button"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        :title="m.nav.search.hint"
        class="relative flex min-h-11 items-center justify-center gap-2 border-b-2 px-3 text-fid-sm transition-colors max-md:min-h-16 max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:rounded-fid-sm max-md:border-b-0 max-md:border-t-0 max-md:px-1 max-md:py-3 max-md:text-fid-xs border-transparent text-fid-text-muted hover:text-fid-text"
        @click="paletteOpen = true"
      >
        <span class="relative flex shrink-0"><FidIcon name="search" :size="20" /></span>
        {{ m.nav.search.label }}
      </button>

      <!--
        What this device has asked Discogs for (M31.9). Beside the profile on
        a desktop, and nowhere on a phone: there is no room in that bar, and
        the same numbers live in Settings › Data.
      -->
      <RateMeter class="max-md:hidden md:ml-auto" />

      <!--
        The settings, behind the profile (#228), at the far end on a desktop —
        away from the things somebody actually came to do. Not in the phone
        bar, which holds five; there the name on Today is the door.
      -->
      <NuxtLink
        to="/settings"
        :aria-current="isCurrent({ to: '/settings' }) ? 'page' : undefined"
        :title="m.nav.profile.hint"
        class="relative flex min-h-11 items-center justify-center gap-2 border-b-2 px-3 text-fid-sm transition-colors max-md:min-h-16 max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:rounded-fid-sm max-md:border-b-0 max-md:border-t-0 max-md:px-1 max-md:py-3 max-md:text-fid-xs max-md:hidden"
        :class="
          isCurrent({ to: '/settings' })
            ? 'border-fid-accent text-fid-text max-md:bg-fid-accent/15'
            : 'border-transparent text-fid-text-muted hover:text-fid-text'
        "
      >
        <span class="relative flex shrink-0"><FidIcon name="circle-user" :size="20" /></span>
        {{ m.nav.profile.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
