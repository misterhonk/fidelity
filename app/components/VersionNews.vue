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
  <p
    v-if="show"
    class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-fid-sm text-fid-text-muted"
    role="status"
  >
    <span class="fid-num">{{ m.news.updatedTo(version) }}</span>
    <NuxtLink to="/whats-new" class="fid-action underline underline-offset-4" @click="seen()">{{
      m.news.whatChanged
    }}</NuxtLink>
    <button type="button" class="fid-action underline underline-offset-4" @click="seen()">
      {{ m.news.dismiss }}
    </button>
  </p>
</template>
