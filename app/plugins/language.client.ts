/**
 * Pick the language before anything is drawn.
 *
 * The plugin is `async` and Nuxt waits for it, which is the point: a German
 * reader would otherwise see one frame of English while the pack is fetched,
 * and a whole interface changing language after it has appeared looks like a
 * bug even when it settles correctly.
 *
 * English costs nothing here — it is already in the bundle, the promise
 * resolves on the same tick, and nothing is fetched.
 */
export default defineNuxtPlugin(async () => {
  await useLanguage().restore()
})
