import type { EpochMs, SyncCheckpoint } from '../../types.ts'
import type { KyselyDb } from '../../db/db.ts'

export interface SyncCheckpointPatch {
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt?: EpochMs | null
}

// Accepts a transaction so the checkpoint advances with the same commit as the
// visits it tracks.
export async function getCheckpoint(db: KyselyDb, sourceProfileId: number): Promise<SyncCheckpoint> {
  const row = await db
    .selectFrom('sync_checkpoints')
    .select(['source_profile_id', 'last_source_visit_id', 'source_id_offset', 'last_run_at'])
    .where('source_profile_id', '=', sourceProfileId)
    .executeTakeFirst()
  return row === undefined
    ? {
      sourceProfileId,
      lastSourceVisitId: 0,
      sourceIdOffset: 0,
      lastRunAt: null,
    }
    : {
      sourceProfileId: row.source_profile_id,
      lastSourceVisitId: row.last_source_visit_id,
      sourceIdOffset: row.source_id_offset,
      lastRunAt: row.last_run_at,
    }
}

export async function setCheckpoint(db: KyselyDb, sourceProfileId: number, patch: SyncCheckpointPatch): Promise<void> {
  const values = {
    source_profile_id: sourceProfileId,
    last_source_visit_id: patch.lastSourceVisitId,
    source_id_offset: patch.sourceIdOffset,
    last_run_at: patch.lastRunAt ?? null,
  }
  await db
    .insertInto('sync_checkpoints')
    .values(values)
    .onConflict((oc) => oc.column('source_profile_id').doUpdateSet(values))
    .execute()
}

// --- target fingerprint (change gate) ---

// Read the stored change-gate fingerprint for a source profile (browser + profile).
export async function getStoredFingerprint(db: KyselyDb, browser: string, profile: string): Promise<string | null> {
  const row = await db
    .selectFrom('source_profiles as sp')
    .innerJoin('sync_checkpoints as sc', 'sc.source_profile_id', 'sp.id')
    .select('sc.last_fingerprint as fingerprint')
    .where('sp.browser', '=', browser)
    .where('sp.profile', '=', profile)
    .executeTakeFirst()
  return row?.fingerprint ?? null
}

// Store the change-gate fingerprint for a source profile.
export async function storeFingerprint(db: KyselyDb, sourceProfileId: number, fingerprint: string): Promise<void> {
  await db
    .updateTable('sync_checkpoints')
    .set({ last_fingerprint: fingerprint })
    .where('source_profile_id', '=', sourceProfileId)
    .execute()
}
