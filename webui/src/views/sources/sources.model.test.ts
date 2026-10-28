/// <reference types="node" />
import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { HisApi, SyncSummary } from '@/app/api'
import { SourcesModel } from './sources.model.ts'

const summary: SyncSummary = {
  startedAt: 1, finishedAt: 2,
  attempted: 2, failures: 2, skipped: 0, insertedVisits: 0, touchedUrls: 0,
  errors: ['First source failed', 'Second source failed'],
}
const failed: SyncSummary = summary
const success: SyncSummary = {
  ...failed, startedAt: 3, finishedAt: 4, failures: 0, skipped: 1, errors: [],
}

describe('SourcesModel sync status', () => {
  it('shows the combined sync errors and clears them on a later refresh', async () => {
    mock.timers.enable({ apis: ['setInterval'] })
    let status: SyncSummary = failed
    const model = new SourcesModel({
      sync: { async status() { return status } },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: [] } } },
    } as unknown as HisApi)
    try {
      const unsubscribe = model.subscribe()
      await setImmediate()
      assert.equal(model.error.value, 'First source failed\nSecond source failed')
      status = success
      mock.timers.tick(30_000)
      await setImmediate()
      assert.equal(model.error.value, null)
      unsubscribe()
    } finally {
      mock.timers.reset()
    }
  })

  it('refreshes while subscribed and stops polling after unsubscribe', async () => {
    mock.timers.enable({ apis: ['setInterval'] })
    let status = failed
    let calls = 0
    const model = new SourcesModel({
      sync: { async status() { calls++; return status } },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: [] } } },
    } as unknown as HisApi)
    try {
      const unsubscribe = model.subscribe()
      await setImmediate()
      assert.deepEqual(model.lastSync.value, failed)
      status = success
      mock.timers.tick(30_000)
      await setImmediate()
      assert.deepEqual(model.lastSync.value, success)
      unsubscribe()
      mock.timers.tick(30_000)
      assert.equal(calls, 2)
      const again = model.subscribe()
      await setImmediate()
      assert.equal(calls, 3)
      again()
    } finally {
      mock.timers.reset()
    }
  })

  it('ignores stale requests and retains the last status on failure', async () => {
    let resolveFirst!: (status: SyncSummary) => void
    let calls = 0
    const model = new SourcesModel({
      sync: { status() {
        calls++
        if (calls === 1) return new Promise<SyncSummary>((resolve) => { resolveFirst = resolve })
        if (calls === 2) return Promise.resolve(success)
        return Promise.reject(new Error('offline'))
      } },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: [] } } },
    } as unknown as HisApi)
    const first = model.subscribe()
    first()
    const second = model.subscribe()
    await setImmediate()
    resolveFirst(failed)
    await setImmediate()
    assert.deepEqual(model.lastSync.value, success)
    second()
    const third = model.subscribe()
    await setImmediate()
    assert.deepEqual(model.lastSync.value, success)
    third()
  })

  it('refreshes the shared status after manual sync and a subsequent retry', async () => {
    let status: SyncSummary | null = null
    let calls = 0
    const model = new SourcesModel({
      sync: {
        async status() { return status },
        async run() { status = ++calls === 1 ? failed : success; return status },
      },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: ['browser'] } } },
    } as unknown as HisApi)
    const unsubscribe = model.subscribe()
    try {
      await setImmediate()
      model.syncSelected()
      await setImmediate()
      assert.deepEqual(model.lastSync.value, failed)
      assert.equal(model.running.value, false)
      model.syncSelected()
      await setImmediate()
      assert.deepEqual(model.lastSync.value, success)
      assert.equal(model.error.value, null)
    } finally {
      unsubscribe()
    }
  })

  it('shows RPC errors and replaces them with the summary on retry', async () => {
    let calls = 0
    const model = new SourcesModel({
      sync: {
        async status() { return success },
        async run() { if (++calls === 1) throw new Error('RPC failed'); return summary },
      },
      sources: { async list() { return [] } },
      settings: { async get() { return { sync_targets: ['browser'] } } },
    } as unknown as HisApi)
    const unsubscribe = model.subscribe()
    try {
      await setImmediate()
      model.syncSelected()
      await setImmediate()
      assert.equal(model.error.value, 'RPC failed')
      assert.deepEqual(model.lastSync.value, success)
      model.syncSelected()
      await setImmediate()
      assert.equal(model.error.value, 'First source failed\nSecond source failed')
      assert.deepEqual(model.lastSync.value, summary)
    } finally {
      unsubscribe()
    }
  })

  it('retains the sync status if refreshing sources fails', async () => {
    let shouldFail = false
    const model = new SourcesModel({
      sync: { async status() { return failed }, async run() { return summary } },
      sources: { async list() { if (shouldFail) throw new Error('refresh failed'); return [] } },
      settings: { async get() { return { sync_targets: ['browser'] } } },
    } as unknown as HisApi)
    const unsubscribe = model.subscribe()
    try {
      await setImmediate()
      shouldFail = true
      model.syncSelected()
      await setImmediate()
      assert.deepEqual(model.lastSync.value, failed)
      assert.equal(model.error.value, 'Could not refresh sources')
      assert.equal(model.running.value, false)
    } finally {
      unsubscribe()
    }
  })
})
