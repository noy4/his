import type { EpochMs, Watermark } from '../../types.ts'
import type { KyselyDb } from '../../db/db.ts'

export interface WatermarkPatch {
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt?: EpochMs | null
}

// Accepts a transaction so the watermark advances with the same commit as the
// visits it tracks.
export async function getWatermark(db: KyselyDb, sourceProfileId: number): Promise<Watermark> {
  const row = await db
    .selectFrom('profile_watermarks')
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

export async function setWatermark(db: KyselyDb, sourceProfileId: number, patch: WatermarkPatch): Promise<void> {
  const values = {
    source_profile_id: sourceProfileId,
    last_source_visit_id: patch.lastSourceVisitId,
    source_id_offset: patch.sourceIdOffset,
    last_run_at: patch.lastRunAt ?? null,
  }
  await db
    .insertInto('profile_watermarks')
    .values(values)
    .onConflict((oc) => oc.column('source_profile_id').doUpdateSet(values))
    .execute()
}

export function detectCleared(watermark: Watermark, sourceMaxVisitId: number): boolean {
  return watermark.lastSourceVisitId > 0 && sourceMaxVisitId < watermark.lastSourceVisitId
}

export function resetOffset(watermark: Watermark): number {
  return watermark.sourceIdOffset + watermark.lastSourceVisitId
}

// --- target fingerprint (change gate) ---

// Read the change-gate fingerprint for a source profile (browser + profile).
export async function getTargetFingerprint(db: KyselyDb, browser: string, profile: string): Promise<string | null> {
  const row = await db
    .selectFrom('source_profiles as sp')
    .innerJoin('profile_watermarks as pw', 'pw.source_profile_id', 'sp.id')
    .select('pw.last_fingerprint as fingerprint')
    .where('sp.browser', '=', browser)
    .where('sp.profile', '=', profile)
    .executeTakeFirst()
  return row?.fingerprint ?? null
}

// Store the change-gate fingerprint for a source profile.
export async function setTargetFingerprint(db: KyselyDb, sourceProfileId: number, fingerprint: string): Promise<void> {
  await db
    .updateTable('profile_watermarks')
    .set({ last_fingerprint: fingerprint })
    .where('source_profile_id', '=', sourceProfileId)
    .execute()
}
