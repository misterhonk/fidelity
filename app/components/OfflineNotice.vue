<script setup lang="ts">
const m = useMessages()

const { online } = useOnline()

/**
 * The iOS coach mark.
 *
 * Safari has no `beforeinstallprompt` and never will, so there is no prompt to
 * show — only an explanation of where the button lives. Shown once and then
 * remembered, because a permanent instruction is nagging.
 */
const DISMISSED_KEY = 'fidelity:ios-coach-dismissed'

const showCoach = ref(false)

onMounted(() => {
  if (typeof window === 'undefined') return

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // `standalone` is Safari's own, and only Safari's.
  const installed =
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches

  showCoach.value = isIOS && !installed && localStorage.getItem(DISMISSED_KEY) === null
})

function dismissCoach() {
  showCoach.value = false
  localStorage.setItem(DISMISSED_KEY, '1')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!--
      Offline. Deliberately not an error: everything already scanned still
      works, which is the whole point of a record shop being a basement.
    -->
    <section
      v-if="!online"
      role="status"
      class="flex flex-col gap-1 rounded-fid-md border border-fid-border bg-fid-surface p-4"
    >
      <p class="flex items-center gap-2 text-fid-base text-fid-text">
        <FidIcon name="wifi-off" />
        {{ m.notice.offline.title }}
      </p>
      <p class="text-fid-sm text-fid-text-muted">{{ m.notice.offline.body }}</p>
    </section>

    <section
      v-if="showCoach"
      class="flex flex-col gap-2 rounded-fid-md border border-fid-border p-4"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-fid-base text-fid-text">{{ m.notice.install.title }}</p>
        <button
          type="button"
          class="fid-action text-fid-sm text-fid-text-muted underline underline-offset-4"
          @click="dismissCoach"
        >
          {{ m.notice.install.got_it }}
        </button>
      </div>
      <p class="text-fid-sm text-fid-text-muted">
        {{ m.notice.install.body_before }}
        <span class="text-fid-text">{{ m.notice.install.share }}</span>
        {{ m.notice.install.body_middle }}
        <span class="text-fid-text">{{ m.notice.install.addToHome }}</span
        >{{ m.notice.install.body_after }}
      </p>
    </section>
  </div>
</template>
