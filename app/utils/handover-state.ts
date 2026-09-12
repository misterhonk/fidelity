/**
 * Which shops' hand-over to Discogs is open right now (M20 #9).
 *
 * Module state rather than a `ref` in the basket card: the basket view
 * refreshes on its own, and a refreshed summary can re-create the card — a
 * ref inside it would forget that the hand-over was opened between two
 * taps. Per shop, and gone on reload, when the lines' own memory takes over.
 */
export const handingByDealer = reactive(new Set<string>())
