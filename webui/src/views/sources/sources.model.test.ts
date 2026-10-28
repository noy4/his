/// <reference types="node" />
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { HisApi, SyncSummary } from '@/app/api'
import { SourcesModel } from './sources.model.ts'

const summary: SyncSummary = {
  attempted: 2, failures: 2, skipped: 0, insertedVisits: 0, touchedUrls: 0,
  errors: ['First source failed', 'Second source failed'],
}

describe('SourcesModel sync', () => {
  it('keeps all returned errors and clears them for a retry', async () => {
    let calls = 0
    const model = new SourcesModel({
      sync: { async run() { return ++calls === 1 ? summary : { ...summary, failures: 0, errors: [] } } },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: ['browser'] } } },
    } as unknown as HisApi)
    model.enabled.value = new Set(['browser'])
    model.syncSelected()
    await setImmediate()
    assert.deepEqual(model.lastSync.value?.errors, summary.errors)
    assert.equal(model.running.value, false)

    model.syncSelected()
    assert.equal(model.lastSync.value, null)
    await setImmediate()
    assert.deepEqual(model.lastSync.peek()?.errors, [])
    assert.equal(model.error.value, null)
  })

  it('shows RPC exception messages and clears them for a retry', async () => {
    let calls = 0
    const model = new SourcesModel({
      sync: { async run() { if (++calls === 1) throw new Error('RPC failed'); return summary } },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: ['browser'] } } },
    } as unknown as HisApi)
    model.enabled.value = new Set(['browser'])
    model.syncSelected()
    await setImmediate()
    assert.equal(model.error.value, 'RPC failed')
    assert.equal(model.running.value, false)

    model.syncSelected()
    assert.equal(model.error.value, null)
    await setImmediate()
    assert.deepEqual(model.lastSync.value?.errors, summary.errors)
  })

  it('retains the sync result if refreshing sources fails', async () => {
    const model = new SourcesModel({
      sync: { async run() { return summary } },
      sources: { async list() { throw new Error('refresh failed') } },
      settings: { async get() { return { sync_targets: ['browser'] } } },
    } as unknown as HisApi)
    model.enabled.value = new Set(['browser'])
    model.syncSelected()
    await setImmediate()
    assert.deepEqual(model.lastSync.value?.errors, summary.errors)
    assert.equal(model.error.value, 'Could not refresh sources')
    assert.equal(model.running.value, false)
  })
})
