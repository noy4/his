import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SyncTarget } from '../../sources/types.ts'
import { filterTargets } from '../targets.ts'

const target = (browser: string, profile: string): SyncTarget => ({
  browser,
  profile,
  sourcePath: `/x/${browser}/${profile}`,
})

describe('filterTargets', () => {
  const all = [
    target('chrome', 'Default'),
    target('chrome', 'Profile-1'),
    target('brave', 'Default'),
  ]

  it('selects nothing when there are no tokens', () => {
    assert.deepEqual(filterTargets([], all), [])
  })

  it('selects every profile of a browser token', () => {
    assert.deepEqual(filterTargets(['chrome'], all).map((t) => t.profile), ['Default', 'Profile-1'])
  })

  it('selects one profile by browser:profile', () => {
    assert.deepEqual(filterTargets(['chrome:Profile-1'], all).map((t) => t.profile), ['Profile-1'])
  })

  it('ignores tokens that match nothing', () => {
    assert.deepEqual(filterTargets(['firefox'], all), [])
  })
})
