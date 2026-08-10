/**
 * Before the first paint, so nobody sees one typeface replaced by another.
 *
 * A plugin rather than a component: the attribute has to be on <html> while
 * the stylesheet is still deciding what to draw with.
 */
export default defineNuxtPlugin(() => {
  useTypeset().restore()
})
