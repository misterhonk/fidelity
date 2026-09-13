import { expect, test, type BrowserContext } from '@playwright/test'

import { seed } from './seed'

/**
 * Which pressing this is (docs/06 M19 #7): the record in your hand, read
 * against every pressing of the album.
 *
 * Discogs is answered from here — the search, the release and the versions
 * list — with the shapes measured live on 2026-09-11 (Portishead's Dummy: 160
 * pressings, the first from 1994). The worker's fetch goes through the
 * context, so the route sees it.
 */
const API = 'https://api.discogs.com'

/*
 * Chromium only. The client lives in a Web Worker, and Playwright's routes
 * see a worker's requests in Chromium but not in WebKit — there the fetch
 * goes straight out, to a Discogs that would answer a test token with 401.
 * The same line as offline.spec.ts and service-worker.spec.ts draw.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  "Playwright cannot route a worker's requests in WebKit",
)

const search = (results: unknown[]) => ({
  pagination: { page: 1, pages: 1, items: results.length },
  results,
})

const uk1994 = {
  id: 372340,
  master_id: 5542,
  title: 'Portishead - Dummy',
  year: '1994',
  country: 'UK',
  label: ['Go! Beat', 'PolyGram'],
  catno: '828 553-1',
  format: ['Vinyl', 'LP', 'Album'],
  thumb: '',
}

const eu2017 = {
  id: 10147986,
  master_id: 5542,
  title: 'Portishead - Dummy',
  year: '2017',
  country: 'Europe',
  label: ['Go! Beat', 'Universal Music'],
  catno: '0602557150995',
  format: ['Vinyl', 'LP', 'Album', 'Reissue'],
  thumb: '',
}

const versions = {
  pagination: { page: 1, pages: 2, items: 160 },
  versions: [
    {
      id: 1065562,
      released: '1994',
      country: 'India',
      label: 'Go! Beat',
      catno: '828 553-4',
      format: 'Album',
      major_formats: ['Cassette'],
    },
    {
      id: 372340,
      released: '1994-08-22',
      country: 'UK',
      label: 'Go! Beat',
      catno: '828 553-1',
      format: 'Album',
      major_formats: ['Vinyl'],
    },
    {
      id: 10147986,
      released: '2017-11-03',
      country: 'Europe',
      label: 'Go! Beat',
      catno: '0602557150995',
      format: 'Album, Reissue',
      major_formats: ['Vinyl'],
    },
  ],
}

const releases: Record<string, unknown> = {
  '10147986': {
    id: 10147986,
    master_id: 5542,
    country: 'Europe',
    year: 2017,
    released: '2017-11-03',
    formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album', 'Reissue'] }],
    identifiers: [{ type: 'Matrix / Runout', value: 'STERLING 828 553-1 A1' }],
  },
  '372340': {
    id: 372340,
    master_id: 5542,
    country: 'UK',
    year: 1994,
    released: '1994-08-22',
    formats: [{ name: 'Vinyl', descriptions: ['LP', 'Album'] }],
    identifiers: [{ type: 'Matrix / Runout', value: '828 553-1 A1 TOWNHOUSE' }],
  },
}

type Route = Parameters<Parameters<BrowserContext['route']>[1]>[0]

async function answerDiscogs(context: BrowserContext, found: unknown[]) {
  // The token travels as a header, so the browser asks first — the preflight
  // has to be answered too, with the CORS headers Discogs sends (docs/02).
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, accept, content-type',
    'access-control-allow-methods': 'GET, OPTIONS',
  }
  const answer = (body: unknown | ((url: string) => unknown)) => async (route: Route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors })
    const url = route.request().url()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify(typeof body === 'function' ? body(url) : body),
    })
  }
  await context.route(`${API}/database/search**`, answer(search(found)))
  await context.route(`${API}/masters/5542/versions**`, answer(versions))
  await context.route(
    `${API}/releases/*`,
    answer((url: string) => {
      const id = new URL(url).pathname.split('/').pop() ?? ''
      return releases[id] ?? { id: Number(id) }
    }),
  )
}

test('a barcode shared by two pressings: pick one, and it is placed among all of them', async ({
  page,
  context,
}) => {
  await seed(page, 'en')
  await answerDiscogs(context, [uk1994, eu2017])
  await page.goto('/in-store')

  await page.getByLabel('Barcode or run-out number').fill('5012394144777')
  await page.getByRole('button', { name: 'Look it up' }).click()

  // The pressings as a list to pick from — never the first one as *the* answer.
  await expect(page.getByText('2 pressings share this barcode', { exact: false })).toBeVisible({
    timeout: 15_000,
  })
  const reissue = page.getByRole('button', { name: /2017 Europe Go! Beat 0602557150995/ })
  await expect(page.getByRole('button', { name: /1994 UK Go! Beat 828 553-1/ })).toBeVisible()

  await reissue.click()

  const family = page.getByTestId('pressing-family')
  await expect(family).toBeVisible({ timeout: 15_000 })
  await expect(family).toContainText('Europe reissue from 2017, not the 1994 original.')
  await expect(family).toContainText('One of 160 pressings. The first are from 1994:')
  // The first pressing on the same medium — not the cassette from India.
  await expect(family.getByRole('list', { name: 'The first pressings' })).toContainText(
    /UK\s*Go! Beat 828 553-1/,
  )
  await expect(family.getByRole('list', { name: 'The first pressings' })).not.toContainText(
    'India',
  )
  await expect(family).toContainText('Sterling')
  await expect(family).toContainText('STERLING 828 553-1 A1')
})

test('knows the album from the wantlist, in another pressing (M20 #3)', async ({
  page,
  context,
}) => {
  await seed(page, 'en')
  await answerDiscogs(context, [uk1994, eu2017])
  // A third pressing of Dummy on the wantlist — not one of the two the barcode names.
  await page.evaluate(async () => {
    const open = indexedDB.open('fidelity')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction('wantlist', 'readwrite')
    tx.objectStore('wantlist').put({
      releaseId: 1065562,
      masterId: 5542,
      title: 'Dummy',
      artistIds: [10],
      artistNorms: ['portishead'],
      artistNames: ['Portishead'],
      labelIds: [],
      labelNorms: [],
      labelNames: [],
      catnos: [],
      genres: [],
      styles: [],
      formats: ['Cassette'],
      year: 1994,
      thumbUrl: '',
      coverUrl: '',
      addedAt: '2022-01-01T00:00:00-00:00',
      note: '',
      want: 0,
    })
    await new Promise((done) => (tx.oncomplete = () => done(null)))
    db.close()
  })
  await page.goto('/in-store')

  await page.getByLabel('Barcode or run-out number').fill('5012394144777')
  await page.getByRole('button', { name: 'Look it up' }).click()
  await expect(
    page.getByText(
      'Not in the collection. Another pressing of this album is on your wantlist.',
    ),
  ).toBeVisible({ timeout: 15_000 })
})

test('a run-out that names one pressing is read without a tap', async ({ page, context }) => {
  await seed(page, 'en')
  await answerDiscogs(context, [uk1994])
  await page.goto('/in-store')

  await page.getByLabel('Barcode or run-out number').fill('828 553-1 A1 TOWNHOUSE')
  await page.getByRole('button', { name: 'Look it up' }).click()

  const family = page.getByTestId('pressing-family')
  await expect(family).toBeVisible({ timeout: 20_000 })
  await expect(family).toContainText(
    'One of 160 pressings, and among the first: the album is from 1994.',
  )
  await expect(family.getByRole('list', { name: 'The first pressings' })).toHaveCount(0)
})
