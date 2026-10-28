import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { SyncRunner } from '../sync-runner.ts'

describe('SyncRunner last run', () => {
  it('records complete summaries for successes, skips, and target errors', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'his-sync-runner-'))
    try {
      const takeout = path.join(home, 'takeout')
      fs.mkdirSync(takeout)
      fs.writeFileSync(path.join(takeout, 'good.json'), JSON.stringify([
        { url: 'https://example.com/', time: '2024-01-01T00:00:00Z' },
      ]))
      fs.writeFileSync(path.join(takeout, 'bad.json'), 'invalid json')
      const runner = new SyncRunner({ home })
      assert.equal(runner.lastSummary, null)

      const before = Date.now()
      const summary = await runner.run({ targets: ['takeout'] })
      const after = Date.now()
      const last = runner.lastSummary!
      assert.deepEqual(last, summary)
      assert.equal(summary.attempted, 2)
      assert.equal(summary.failures, 1)
      assert.equal(summary.skipped, 0)
      assert.equal(summary.insertedVisits, 1)
      assert.equal(summary.touchedUrls, 1)
      assert.match(summary.errors[0]!, /^Takeout · bad-/)
      assert.ok(before <= last.startedAt && last.startedAt <= last.finishedAt && last.finishedAt <= after)
      const next = await runner.run({ targets: ['takeout'] })
      assert.equal(next.skipped, 1)
      assert.equal(next.failures, 1)
      assert.deepEqual(runner.lastSummary, next)

      fs.rmSync(path.join(takeout, 'bad.json'))
      const success = await runner.run({ targets: ['takeout'] })
      assert.equal(success.skipped, 1)
      assert.deepEqual(runner.lastSummary, success)
      assert.deepEqual(success.errors, [])
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })

  it('records and rethrows setup errors without counting target failures', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'his-sync-runner-'))
    try {
      const home = path.join(dir, 'not-a-directory')
      fs.writeFileSync(home, '')
      const runner = new SyncRunner({ home })
      const before = Date.now()
      let thrown: unknown
      try {
        await runner.run()
        assert.fail('expected a setup error')
      } catch (error) {
        thrown = error
      }
      const after = Date.now()
      assert.ok(thrown instanceof Error)
      const last = runner.lastSummary!
      assert.deepEqual(last, {
        startedAt: last.startedAt,
        finishedAt: last.finishedAt,
        attempted: 0,
        failures: 0,
        skipped: 0,
        insertedVisits: 0,
        touchedUrls: 0,
        errors: [thrown.message],
      })
      assert.ok(before <= last.startedAt && last.startedAt <= last.finishedAt && last.finishedAt <= after)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects concurrent runs without replacing the last result', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'his-sync-runner-'))
    try {
      const runner = new SyncRunner({ home })
      const previous = await runner.run({ targets: [] })
      const pending = runner.run({ targets: [] })
      await assert.rejects(runner.run(), /sync already running/)
      assert.deepEqual(runner.lastSummary, previous)
      const summary = await pending
      assert.deepEqual(runner.lastSummary, summary)
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })
})
