import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { createDb, migrate, type KyselyDb } from '../../../db/db.ts'
import { probeSourceFingerprint } from '../fingerprint.ts'
import { listSourceProfiles } from '../list.ts'
import { seedUrl, sourceProfile } from '../../../testing/db.ts'

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
    .values({ ...sourceProfile, source_path: sourceFile })
    .execute()
  await db
    .insertInto('sync_checkpoints')
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
  it('returns listing fields and aggregates for the profile', async () => {
    await seedUrl(db, { url: 'https://example.com', title: 'Example', times: [100, 200] })
    await db.updateTable('sync_checkpoints').set({ last_run_at: 300 }).execute()
    await setFingerprint(probeSourceFingerprint(sourceFile))

    assert.deepEqual(await listSourceProfiles(db), [{
      browser: 'chrome',
      profile: 'Default',
      sourcePath: sourceFile,
      visits: 2,
      lastVisit: 200,
      lastRunAt: 300,
      pending: false,
    }])
  })

  it('returns null lastRunAt when there is no checkpoint', async () => {
    await db.deleteFrom('sync_checkpoints').execute()
    const [source] = await listSourceProfiles(db)
    assert.equal(source!.lastRunAt, null)
    assert.equal(source!.pending, true)
  })

  it('reports pending when the profile was never synced', async () => {
    assert.equal((await listSourceProfiles(db))[0]!.pending, true)
  })

  it('reports not pending when the stored fingerprint matches the source now', async () => {
    await setFingerprint(probeSourceFingerprint(sourceFile))
    assert.equal((await listSourceProfiles(db))[0]!.pending, false)
  })

  it('reports pending when the source changed after the last sync', async () => {
    await setFingerprint('stale')
    assert.equal((await listSourceProfiles(db))[0]!.pending, true)
  })
})

async function setFingerprint(fingerprint: string): Promise<void> {
  await db
    .updateTable('sync_checkpoints')
    .set({ last_fingerprint: fingerprint })
    .where('source_profile_id', '=', 1)
    .execute()
}
