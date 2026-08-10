<script setup lang="ts">
defineProps<{
  title: string
  /** One line, only where the title alone would leave somebody guessing. */
  lead?: string
}>()

/**
 * The chrome every settings subpage shares.
 *
 * The way back matters more here than anywhere else in the app: these pages
 * are reached from one index and nothing else links to them, so a browser back
 * button is the only exit unless one is drawn.
 *
 * The sign-in check lives here rather than in each page. Every one of these
 * screens configures something that needs a token, and seven copies of the
 * same guard is seven chances to forget one.
 */
const { identity, load } = useIdentity()

onMounted(load)
</script>

<template>
  <main class="@container mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
    <div class="flex flex-col gap-3">
      <NuxtLink
        to="/einstellungen"
        class="fid-action gap-1.5 self-start text-fid-sm text-fid-text-muted transition-colors hover:text-fid-text"
      >
        <FidIcon name="arrow-left" :size="16" />
        Einstellungen
      </NuxtLink>

      <header class="flex flex-col gap-1">
        <h1 class="fid-display text-fid-2xl font-bold text-fid-text">{{ title }}</h1>
        <p v-if="lead" class="max-w-prose text-fid-base text-fid-text-muted">{{ lead }}</p>
      </header>
    </div>

    <slot v-if="identity" />

    <p v-else class="text-fid-base text-fid-text-muted">
      Erst anmelden –
      <NuxtLink class="underline underline-offset-4" to="/">zur Startseite</NuxtLink>.
    </p>
  </main>
</template>
