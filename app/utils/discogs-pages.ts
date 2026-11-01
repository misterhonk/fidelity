/**
 * The discogs.com page that shows a piece of data, for the attribution beside
 * it (docs/09 §1.2): the notice links to *that* page, not to the homepage.
 */
const WEB = 'https://www.discogs.com'

export const listingPage = (listingId: number) => `${WEB}/sell/item/${listingId}`
export const releasePage = (releaseId: number) => `${WEB}/release/${releaseId}`
export const sellerPage = (username: string) =>
  `${WEB}/seller/${encodeURIComponent(username)}/profile`
export const collectionPage = (username: string) =>
  `${WEB}/user/${encodeURIComponent(username)}/collection`
export const wantlistPage = (username: string) =>
  `${WEB}/wantlist?user=${encodeURIComponent(username)}`
