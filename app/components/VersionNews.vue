<script setup lang="ts">
/**
 * "The app is newer than last time" — one line, once.
 *
 * **Why it is needed.** Since 760a11e there is a page saying what is new in
 * this release. It was reachable only through the version number in the
 * footer — so only to somebody who knows that number is a link. That is the
 * kind of route nobody finds who does not already know it.
 *
 * **Why not in the update notice.** That one stands *before* the reload, and
 * the notes are in the build: before it, you see those of the release you are
 * leaving. The line belongs after the change, not before it.
 *
 * **Why against the last-seen version and not against the update notice.**
 * That way it works however somebody arrived at the new release — through the
 * notice, through restarting the browser, through a new device.
 */

const m = useMessages()
const { version } = useRuntimeConfig().public

/**
 * Per browser, not per account.
 *
 * "Have I seen this release" is a property of this window and not of the
 * collection — so it does not belong in the vault and not in IndexedDB. And it
 * is allowed to be lost: the line then stands there one time too many, which
 * is the more harmless of two mistakes.
 */
const KEY = 'fidelity:seen-version'

const show = ref(false)

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    // A private window, blocked site data: then there is simply no line.
    return null
  }
}

function remember() {
  try {
    localStorage.setItem(KEY, String(version))
  } catch {
    /* see above */
  }
}

onMounted(() => {
  const lastSeen = read()

  /*
   * On the very first start it only remembers, it does not report.
   *
   * Somebody opening the app for the first time has updated from nothing —
   * "new since your last visit" would simply be untrue there, and the first
   * line somebody reads from an app should not be a false one.
   */
  if (lastSeen === null) {
    remember()
    return
  }

  show.value = lastSeen !== String(version)
})

/** Read is seen — the line does not come back for this release. */
function seen() {
  remember()
  show.value = false
}
</script>

<template>
  <!--
    One chip, not three rows (#314): the whole of it opens the notes, the cross
    puts it away for this release.
  -->
  <p
    v-if="show"
    class="inline-flex w-fit max-w-full items-center rounded-full border border-fid-border text-fid-xs text-fid-text-muted"
    role="status"
  >
    <NuxtLink to="/whats-new" class="fid-action py-1 pl-3 hover:text-fid-text" @click="seen()"
      ><span class="fid-num">{{ m.news.updatedTo(version) }}</span> ·
      <span class="underline underline-offset-4">{{ m.news.whatChanged }}</span></NuxtLink
    >
    <button
      type="button"
      class="fid-action justify-center rounded-full px-2 hover:text-fid-text"
      :aria-label="m.news.dismiss"
      :title="m.news.dismiss"
      @click="seen()"
    >
      <span aria-hidden="true">×</span>
    </button>
  </p>
</template>
