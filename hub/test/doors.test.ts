import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { hubDoors } from '../src/doors.ts'

/**
 * Starting without a door (2026-10-21): refused, unless somebody wrote down
 * that they mean it.
 */
describe('the doors at startup', () => {
  test('no secret and no key is refused', () => {
    assert.ok(hubDoors({}).refusal)
  })

  test('an empty secret is no secret', () => {
    const doors = hubDoors({ HUB_SECRET: '  ' })
    assert.equal(doors.secret, null)
    assert.ok(doors.refusal)
  })

  test('an open hub is allowed when it is asked for', () => {
    const doors = hubDoors({ HUB_OPEN: '1' })
    assert.equal(doors.open, true)
    assert.equal(doors.refusal, null)
  })

  test('a secret or an access key is a door', () => {
    assert.equal(hubDoors({ HUB_SECRET: 'word' }).refusal, null)
    assert.equal(hubDoors({ HUB_SECRET: 'word' }).secret, 'word')
    assert.equal(hubDoors({ HUB_ACCESS_PUBLIC_KEY: 'abc' }).refusal, null)
  })
})
