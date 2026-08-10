<script setup lang="ts">
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
 * "Im Laden" is deliberately not here: it is a *mode* you enter with a record
 * in your hand, not a section you browse, and it is reached from the dig
 * result and from the overview where that decision is actually being made.
 */
const SECTIONS = [
  { to: '/', label: 'Start', icon: 'house', hint: 'Was ist neu, was steht an' },
  { to: '/dig', label: 'Graben', icon: 'kiste', hint: 'Einen Händler scannen' },
  {
    to: '/korb',
    label: 'Korb',
    icon: 'shopping-basket',
    hint: 'Was du kaufen willst',
    also: ['/gemerkt'],
  },
  {
    to: '/regal',
    label: 'Sammlung',
    icon: 'regal',
    hint: 'Was du hast und was du suchst',
    also: ['/landkarte', '/wantlist'],
  },
  { to: '/haendler', label: 'Läden', icon: 'store', hint: 'Bei wem du kaufst' },
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
  -->
  <nav
    v-if="identity"
    aria-label="Hauptbereiche"
    class="z-30 md:sticky md:top-0 md:border-b md:border-fid-border md:bg-fid-bg/90 md:backdrop-blur max-md:fixed max-md:inset-x-3 max-md:bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] max-md:rounded-fid-md max-md:border max-md:border-fid-border max-md:bg-fid-surface/95 max-md:shadow-fid-elev-2 max-md:backdrop-blur"
  >
    <!--
      Stretched to equal widths on a phone, where a tab bar is a row of
      thumb-sized targets. Naturally sized on a desktop, where stretching them
      across the window pulls the labels away from the column they belong to.
    -->
    <div class="mx-auto flex max-w-3xl items-stretch gap-1 px-6 max-md:gap-0 max-md:px-1">
      <NuxtLink
        v-for="section in SECTIONS"
        :key="section.to"
        :to="section.to"
        :aria-current="isCurrent(section) ? 'page' : undefined"
        :title="section.hint"
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
        <FidIcon :name="section.icon" :size="20" />
        {{ section.label }}
        <!--
          The badge is on the basket because it is the only number that means
          "you left something unfinished". Everything else is either zero or
          not urgent.
        -->
        <span
          v-if="section.to === '/korb' && basketCount > 0"
          class="fid-num rounded-full bg-fid-accent px-1.5 text-fid-xs font-medium text-fid-n-990"
          :aria-label="`${basketCount} im Korb`"
        >
          {{ basketCount }}
        </span>
      </NuxtLink>

      <NuxtLink
        to="/einstellungen"
        :aria-current="isCurrent({ to: '/einstellungen' }) ? 'page' : undefined"
        aria-label="Einstellungen"
        title="Einstellungen"
        class="flex min-h-11 min-w-11 items-center justify-center border-b-2 text-fid-base transition-colors md:ml-auto max-md:min-h-14 max-md:rounded-fid-sm max-md:border-b-0 max-md:border-t-0"
        :class="
          isCurrent({ to: '/einstellungen' })
            ? 'border-fid-accent text-fid-text max-md:bg-fid-accent/15'
            : 'border-transparent text-fid-text-muted hover:text-fid-text'
        "
      >
        <FidIcon name="settings" :size="20" />
      </NuxtLink>
    </div>
  </nav>
</template>
