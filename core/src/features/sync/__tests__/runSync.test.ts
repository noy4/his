import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { runSync } from '../runSync.ts'

describe('runSync', () => {
  it('returns timestamps and partial failure details', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'his-run-sync-'))
    try {
      const takeout = path.join(home, 'takeout')
      fs.mkdirSync(takeout)
      fs.writeFileSync(path.join(takeout, 'good.json'), JSON.stringify([
        { url: 'https://example.com/', time: '2024-01-01T00:00:00Z' },
      ]))
      fs.writeFileSync(path.join(takeout, 'bad.json'), 'invalid json')
      const before = Date.now()
      const summary = await runSync(home, { targets: ['takeout'] })
      const after = Date.now()
      assert.ok(before <= summary.startedAt && summary.startedAt <= summary.finishedAt && summary.finishedAt <= after)
      assert.equal(summary.attempted, 2)
      assert.equal(summary.failures, 1)
      assert.equal(summary.skipped, 0)
      assert.equal(summary.insertedVisits, 1)
      assert.equal(summary.touchedUrls, 1)
      assert.equal(summary.errors.length, 1)
      assert.match(summary.errors[0]!, /^Takeout · bad-/)
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })

  it('propagates unexpected exceptions', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'his-run-sync-'))
    try {
      const error = new Error('log failed')
      await assert.rejects(runSync(home, { targets: [] }, {
        onLog() { throw error },
      }), (actual) => actual === error)
    } finally {
      fs.rmSync(home, { recursive: true, force: true })
    }
  })
})
