import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import { probeFingerprint } from '../fingerprint.ts'
import { listSourceProfiles } from '../list.ts'
import { sourceProfile } from '../../../testing/db.ts'

let handle: DatabaseSync
let db: KyselyDb
let dir: string
let sourceFile: string

beforeEach(async () => {
  handle = new DatabaseSync(':memory:')
  await migrate(handle)
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'his-fp-'))
  sourceFile = path.join(dir, 'History')
  fs.writeFileSync(sourceFile, 'a')
  db = createDb(handle)
  await db
    .insertInto('source_profiles')
    .values({ ...sourceProfile, profile_path: sourceFile })
    .execute()
  await db
    .insertInto('profile_watermarks')
    .values({
      source_profile_id: 1,
      last_source_visit_id: 0,
      source_id_offset: 0,
      last_run_at: null,
      last_fingerprint: null,
    })
    .execute()
})

afterEach(() => {
  handle.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('listSourceProfiles', () => {
  it('leaves pending null unless check is requested', async () => {
    assert.equal((await listSourceProfiles(db))[0]!.pending, null)
  })

  it('reports pending when the profile was never synced', async () => {
    assert.equal((await listSourceProfiles(db, { check: true }))[0]!.pending, true)
  })

  it('reports not pending when the stored fingerprint matches the source now', async () => {
    await setFingerprint(probeFingerprint(sourceFile))
    assert.equal((await listSourceProfiles(db, { check: true }))[0]!.pending, false)
  })

  it('reports pending when the source changed after the last sync', async () => {
    await setFingerprint('stale')
    assert.equal((await listSourceProfiles(db, { check: true }))[0]!.pending, true)
  })
})

async function setFingerprint(fingerprint: string): Promise<void> {
  await db
    .updateTable('profile_watermarks')
    .set({ last_fingerprint: fingerprint })
    .where('source_profile_id', '=', 1)
    .execute()
}
