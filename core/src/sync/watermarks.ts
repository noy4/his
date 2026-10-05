import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../model.ts'
import type { SourceKind } from './applyVisits.ts'

export interface Watermark {
  sourceProfileId: number
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt: EpochMs | null
}

export interface RegisteredSource {
  id: number
  kind: SourceKind
  displayName: string | null
  profilePath: string
  watermark: Watermark
}

export interface WatermarkPatch {
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt?: EpochMs | null
}

interface WatermarkRow {
  source_profile_id: number
  last_source_visit_id: number
  source_id_offset: number
  last_run_at: number | null
}

export function getWatermark(db: DatabaseSync, sourceProfileId: number): Watermark {
  const row = db
    .prepare('SELECT source_profile_id, last_source_visit_id, source_id_offset, last_run_at FROM profile_watermarks WHERE source_profile_id = ?')
    .get(sourceProfileId) as unknown as WatermarkRow | undefined
  return row === undefined
    ? { sourceProfileId, lastSourceVisitId: 0, sourceIdOffset: 0, lastRunAt: null }
    : {
        sourceProfileId: row.source_profile_id,
        lastSourceVisitId: row.last_source_visit_id,
        sourceIdOffset: row.source_id_offset,
        lastRunAt: row.last_run_at,
      }
}

export function setWatermark(db: DatabaseSync, sourceProfileId: number, patch: WatermarkPatch): void {
  db.prepare(
    'INSERT INTO profile_watermarks (source_profile_id, last_source_visit_id, source_id_offset, last_run_at) VALUES (?, ?, ?, ?) ON CONFLICT(source_profile_id) DO UPDATE SET last_source_visit_id = excluded.last_source_visit_id, source_id_offset = excluded.source_id_offset, last_run_at = excluded.last_run_at',
  ).run(sourceProfileId, patch.lastSourceVisitId, patch.sourceIdOffset, patch.lastRunAt ?? null)
}

export function listSourceProfiles(db: DatabaseSync): RegisteredSource[] {
  const rows = db
    .prepare('SELECT sp.id, sp.kind, sp.display_name, sp.profile_path, pw.last_source_visit_id, pw.source_id_offset, pw.last_run_at FROM source_profiles sp LEFT JOIN profile_watermarks pw ON pw.source_profile_id = sp.id ORDER BY sp.kind, sp.profile_path')
    .all() as unknown as SourceProfileJoinRow[]
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as SourceKind,
    displayName: row.display_name,
    profilePath: row.profile_path,
    watermark: {
      sourceProfileId: row.id,
      lastSourceVisitId: row.last_source_visit_id ?? 0,
      sourceIdOffset: row.source_id_offset ?? 0,
      lastRunAt: row.last_run_at,
    },
  }))
}

interface SourceProfileJoinRow {
  id: number
  kind: string
  display_name: string | null
  profile_path: string
  last_source_visit_id: number | null
  source_id_offset: number | null
  last_run_at: number | null
}

export function detectCleared(watermark: Watermark, sourceMaxVisitId: number): boolean {
  return watermark.lastSourceVisitId > 0 && sourceMaxVisitId < watermark.lastSourceVisitId
}

export function resetOffset(watermark: Watermark): number {
  return watermark.sourceIdOffset + watermark.lastSourceVisitId
}

// --- target fingerprint (change gate) ---

// Read the change-gate fingerprint for a source profile (kind + path).
export function getTargetFingerprint(db: DatabaseSync, kind: SourceKind, profilePath: string): string | null {
  const row = db
    .prepare(
      'SELECT pw.last_fingerprint AS fingerprint FROM source_profiles sp JOIN profile_watermarks pw ON pw.source_profile_id = sp.id WHERE sp.kind = ? AND sp.profile_path = ?',
    )
    .get(kind, profilePath) as unknown as { fingerprint: string | null } | undefined
  return row?.fingerprint ?? null
}

// Store the change-gate fingerprint for a source profile.
export function setTargetFingerprint(db: DatabaseSync, sourceProfileId: number, fingerprint: string): void {
  db.prepare('UPDATE profile_watermarks SET last_fingerprint = ? WHERE source_profile_id = ?').run(fingerprint, sourceProfileId)
}
