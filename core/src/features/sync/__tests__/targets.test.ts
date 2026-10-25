import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import type { SyncTarget } from '../../sources/types.ts'
import { applyTargetFilter, getSyncTargets, setSyncTargets } from '../targets.ts'

const target = (browser: string, profile: string): SyncTarget => ({
  browser,
  profile,
  dbPath: `/x/${browser}/${profile}`,
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

  it('reads back what it stored', async () => {
    assert.deepEqual(await getSyncTargets(db), [])
    const stored = await setSyncTargets(db, ['chrome:Default', 'brave:Default'])
    assert.deepEqual(stored, ['chrome:Default', 'brave:Default'])
    assert.deepEqual(await getSyncTargets(db), ['chrome:Default', 'brave:Default'])
  })

  it('treats broken json as empty', async () => {
    await db.insertInto('settings').values({ key: 'sync_targets', value: '{not json' }).execute()
    assert.deepEqual(await getSyncTargets(db), [])
  })
})
