import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { migrate } from '../db/db.ts'
import { probeFingerprint } from './fingerprint.ts'
import { listSourceProfiles } from './watermarks.ts'

let db: DatabaseSync
let dir: string
let sourceFile: string

beforeEach(async () => {
  db = new DatabaseSync(':memory:')
  await migrate(db)
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'his-fp-'))
  sourceFile = path.join(dir, 'History')
  fs.writeFileSync(sourceFile, 'a')
  db.prepare("INSERT INTO source_profiles (id, browser, profile, kind, profile_path) VALUES (1, 'chrome', 'Default', 'chromium', ?)").run(sourceFile)
  db.prepare('INSERT INTO profile_watermarks (source_profile_id, last_source_visit_id, source_id_offset, last_run_at, last_fingerprint) VALUES (1, 0, 0, NULL, NULL)').run()
})

afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('listSourceProfiles', () => {
  it('leaves pending null unless check is requested', () => {
    assert.equal(listSourceProfiles(db)[0]!.pending, null)
  })

  it('reports pending when the profile was never synced', () => {
    assert.equal(listSourceProfiles(db, { check: true })[0]!.pending, true)
  })

  it('reports not pending when the stored fingerprint matches the source now', () => {
    db.prepare('UPDATE profile_watermarks SET last_fingerprint = ? WHERE source_profile_id = 1').run(probeFingerprint(sourceFile))
    assert.equal(listSourceProfiles(db, { check: true })[0]!.pending, false)
  })

  it('reports pending when the source changed after the last sync', () => {
    db.prepare('UPDATE profile_watermarks SET last_fingerprint = ? WHERE source_profile_id = 1').run('stale')
    assert.equal(listSourceProfiles(db, { check: true })[0]!.pending, true)
  })
})
