import { describe, expect, it } from 'vitest'

import { createHubClient } from '~~/worker/hub/client'

/**
 * What a hub answers about shops is data from somebody else's machine
 * (M34.5): a username is a Discogs username, a sign is a Discogs picture or
 * nothing, and an answer has bounds.
 */
function hubAnswering(body: unknown) {
  return createHubClient({
    baseUrl: 'https://hub.test',
    secret: null,
    fetchImpl: async () =>
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  } as never)
}

const shop = (over: Record<string, unknown> = {}) => ({
  username: 'plattenkiste',
  displayName: 'Plattenkiste',
  shipsFrom: 'Germany',
  numForSale: 2881,
  avatarUrl: 'https://i.discogs.com/shop.jpg',
  seenAt: 1_800_000_000_000,
  fingerprint: {
    sampledItems: 100,
    totalItems: 2881,
    coverage: 0.03,
    labelDist: { 'Blue Note': 40 },
    styleDist: {},
    decadeDist: {},
  },
  ...over,
})

describe('the shops a hub answers', () => {
  it('drops a sign that is not a Discogs picture', async () => {
    const shops = await hubAnswering({
      shops: [shop({ avatarUrl: 'https://evil.test/pixel.gif' })],
    }).shops()
    expect(shops?.[0]?.avatarUrl).toBe('')
  })

  it('refuses a name that is not a username, and an answer without bounds', async () => {
    // A hub whose answer does not match the schema is a hub that answered nothing.
    expect(await hubAnswering({ shops: [shop({ username: '<b>x</b>' })] }).shops()).toEqual([])
    const big = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`L${i}`, 1]))
    expect(
      await hubAnswering({
        shops: [shop({ fingerprint: { ...shop().fingerprint, labelDist: big } })],
      }).shops(),
    ).toEqual([])
  })
})
