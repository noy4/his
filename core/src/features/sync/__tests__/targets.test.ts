import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import type { SyncTarget } from '../../sources/types.ts'
import { applyTargetFilter, cleanTargets, getSyncTargets, setSyncTargets } from '../targets.ts'

const target = (browser: string, profile: string): SyncTarget => ({
  browser,
  profile,
  dbPath: `/x/${browser}/${profile}`,
})

describe('cleanTargets', () => {
  it('trims, lowercases the browser and keeps the profile', () => {
    assert.deepEqual(cleanTargets([' Chrome:Default ', 'Chrome:Default']), ['chrome:Default'])
  })

  it('keeps bare browser tokens', () => {
    assert.deepEqual(cleanTargets(['Brave', ' brave ']), ['brave'])
  })

  it('drops non-strings, empty and malformed tokens', () => {
    assert.deepEqual(cleanTargets(['', '   ', ':', ':x', 'x:', 3, null, 'ok']), ['ok'])
  })

  it('returns empty for a non-array', () => {
    assert.deepEqual(cleanTargets('chrome'), [])
  })
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

describe('sync target storage', () => {
  let handle: DatabaseSync
  let db: KyselyDb

  beforeEach(async () => {
    handle = new DatabaseSync(':memory:')
    await migrate(handle)
    db = createDb(handle)
  })

  afterEach(() => handle.close())

  it('reads back what it stored, cleaned', async () => {
    assert.deepEqual(await getSyncTargets(db), [])
    const stored = await setSyncTargets(db, ['Chrome:Default', 'bad', 1])
    assert.deepEqual(stored, ['chrome:Default', 'bad'])
    assert.deepEqual(await getSyncTargets(db), ['chrome:Default', 'bad'])
  })

  it('treats broken json as empty', async () => {
    await db.insertInto('settings').values({ key: 'sync_targets', value: '{not json' }).execute()
    assert.deepEqual(await getSyncTargets(db), [])
  })
})
