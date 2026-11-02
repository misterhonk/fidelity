import { afterEach, describe, expect, it } from 'vitest'

import { releaseIdFrom } from '~/utils/discogs-pages'
import { getMeta } from '~~/db/meta'
import { deleteFidelityDb } from '~~/db/open'
import { handlers } from '~~/worker/handlers'

afterEach(async () => {
  await deleteFidelityDb()
})

/** Pressing rules (#242): kept per master on this device, read by the next dig. */
describe('the pressing rule of a wanted album', () => {
  it('is any pressing until somebody says otherwise', async () => {
    expect(await handlers['wantlist.rule']({ masterId: 77 })).toBeNull()
  })

  it('stores a rule and hands it back cleaned', async () => {
    const kept = await handlers['wantlist.setRule']({
      masterId: 77,
      rule: { firstOnly: false, except: [501, 501, -3, 1.5] },
    })
    expect(kept).toEqual({ firstOnly: false, except: [501] })
    expect(await handlers['wantlist.rule']({ masterId: 77 })).toEqual(kept)
  })

  it('forgets a rule that allows everything again', async () => {
    await handlers['wantlist.setRule']({ masterId: 77, rule: { firstOnly: true, except: [] } })
    await handlers['wantlist.setRule']({ masterId: 78, rule: { firstOnly: true, except: [] } })
    expect(
      await handlers['wantlist.setRule']({
        masterId: 77,
        rule: { firstOnly: false, except: [] },
      }),
    ).toBeNull()
    expect(await getMeta('pressingRules')).toEqual({ 78: { firstOnly: true, except: [] } })
  })

  it('refuses an album that is not one', async () => {
    expect(
      await handlers['wantlist.setRule']({
        masterId: 0,
        rule: { firstOnly: true, except: [] },
      }),
    ).toBeNull()
    expect(await getMeta('pressingRules')).toBeUndefined()
  })
})

describe('reading the release somebody wants excluded', () => {
  it('takes a number or a release address, and nothing else', () => {
    expect(releaseIdFrom(' 9101 ')).toBe(9101)
    expect(releaseIdFrom('https://www.discogs.com/release/9101-Portishead-Dummy-2016')).toBe(
      9101,
    )
    expect(releaseIdFrom('https://www.discogs.com/master/77')).toBeNull()
    expect(releaseIdFrom('Dummy 2016')).toBeNull()
    expect(releaseIdFrom('0')).toBeNull()
  })
})
