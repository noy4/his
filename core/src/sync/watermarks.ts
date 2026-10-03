import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs } from '../model.ts'

export interface Watermark {
  sourceProfileId: number
  lastSourceVisitId: number
  sourceIdOffset: number
  lastRunAt: EpochMs | null
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

export function detectCleared(watermark: Watermark, sourceMaxVisitId: number): boolean {
  return watermark.lastSourceVisitId > 0 && sourceMaxVisitId < watermark.lastSourceVisitId
}

export function resetOffset(watermark: Watermark): number {
  return watermark.sourceIdOffset + watermark.lastSourceVisitId
}
