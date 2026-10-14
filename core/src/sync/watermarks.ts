import { sql } from 'kysely'
import type { EpochMs, RegisteredSource, SourceKind, Watermark } from '../types.ts'
import { probeFingerprint } from './fingerprint.ts'
import type { KyselyDb } from '../db/db.ts'

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

export interface ListSourceProfilesOptions {
  /** probe each profile's source files and report whether it changed since the last sync */
  check?: boolean
}

export async function listSourceProfiles(db: KyselyDb, options: ListSourceProfilesOptions = {}): Promise<RegisteredSource[]> {
  const rows = await db
    .selectFrom('source_profiles as sp')
    .leftJoin('profile_watermarks as pw', 'pw.source_profile_id', 'sp.id')
    .leftJoin('visits as v', 'v.source_profile_id', 'sp.id')
    .select([
      'sp.id',
      'sp.browser',
      'sp.profile',
      'sp.kind',
      'sp.profile_path',
      'pw.last_source_visit_id',
      'pw.source_id_offset',
      'pw.last_run_at',
      'pw.last_fingerprint',
      sql<number>`COUNT(v.id)`.as('visits'),
      sql<number | null>`MAX(v.visit_time)`.as('last_visit_time'),
    ])
    .groupBy('sp.id')
    .orderBy('sp.browser')
    .orderBy('sp.profile')
    .execute()
  return rows.map((row) => ({
    id: row.id,
    browser: row.browser,
    profile: row.profile,
    kind: row.kind as SourceKind,
    profilePath: row.profile_path,
    watermark: {
      sourceProfileId: row.id,
      lastSourceVisitId: row.last_source_visit_id ?? 0,
      sourceIdOffset: row.source_id_offset ?? 0,
      lastRunAt: row.last_run_at,
    },
    visits: Number(row.visits),
    lastVisit: row.last_visit_time === null ? null : Number(row.last_visit_time),
    pending: options.check ? isPending(row) : null,
  }))
}

// probe the source files now and compare to the fingerprint saved at the last sync
function isPending(row: { last_fingerprint: string | null; profile_path: string }): boolean {
  if (row.last_fingerprint === null) return true
  return probeFingerprint(row.profile_path) !== row.last_fingerprint
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
