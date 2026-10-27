import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SyncTarget } from '../../sources/types.ts'
import { applyTargetFilter } from '../targets.ts'

const target = (browser: string, profile: string): SyncTarget => ({
  browser,
  profile,
  sourcePath: `/x/${browser}/${profile}`,
})

describe('applyTargetFilter', () => {
  const all = [
    target('chrome', 'Default'),
    target('chrome', 'Profile-1'),
    target('brave', 'Default'),
  ]

  it('selects nothing when there are no tokens', () => {
    assert.deepEqual(applyTargetFilter([], all), [])
  })

  it('selects every profile of a browser token', () => {
    assert.deepEqual(applyTargetFilter(['chrome'], all).map((t) => t.profile), ['Default', 'Profile-1'])
  })

  it('selects one profile by browser:profile', () => {
    assert.deepEqual(applyTargetFilter(['chrome:Profile-1'], all).map((t) => t.profile), ['Profile-1'])
  })

  it('ignores tokens that match nothing', () => {
    assert.deepEqual(applyTargetFilter(['firefox'], all), [])
  })
})
