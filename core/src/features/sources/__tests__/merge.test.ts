import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RegisteredSource } from '../../../types.ts'
import { mergeEntries } from '../list.ts'

const ref = (browser: string, profile: string) => ({ browser, profile, dbPath: `/x/${browser}/${profile}` })

const registered = (browser: string, profile: string): RegisteredSource => ({
  id: 1,
  browser,
  profile,
  kind: 'chromium',
  profilePath: `/x/${browser}/${profile}`,
  checkpoint: { sourceProfileId: 1, lastSourceVisitId: 0, sourceIdOffset: 0, lastRunAt: null },
  visits: 0,
  lastVisit: null,
  pending: true,
})

describe('mergeEntries', () => {
  it('marks a discovered profile without a row as unregistered', () => {
    const entries = mergeEntries([ref('chrome', 'Default')], [])
    assert.deepEqual(entries, [
      { browser: 'chrome', profile: 'Default', profilePath: '/x/chrome/Default', registered: false },
    ])
  })

  it('overlays registered stats on a discovered profile', () => {
    const [entry] = mergeEntries([ref('chrome', 'Default')], [registered('chrome', 'Default')])
    assert.equal(entry!.registered, true)
    assert.equal(entry!.browser, 'chrome')
    assert.equal(entry!.profilePath, '/x/chrome/Default')
  })

  it('appends registered profiles that were not discovered', () => {
    const entries = mergeEntries([], [registered('firefox', 'abc.default')])
    assert.deepEqual(entries.map((e) => `${e.browser}:${e.profile}`), ['firefox:abc.default'])
    assert.equal(entries[0]!.registered, true)
  })

  it('keeps discovered order and appends the rest', () => {
    const entries = mergeEntries(
      [ref('chrome', 'Default'), ref('brave', 'Default')],
      [registered('brave', 'Default'), registered('firefox', 'x')],
    )
    assert.deepEqual(
      entries.map((e) => `${e.browser}:${e.profile}`),
      ['chrome:Default', 'brave:Default', 'firefox:x'],
    )
  })
})
