import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs, RegisteredSource, SourceKind, Watermark } from '../types.ts'
import { probeFingerprint } from './fingerprint.ts'

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

export interface ListSourceProfilesOptions {
  /** probe each profile's source files and report whether it changed since the last sync */
  check?: boolean
}

export function listSourceProfiles(db: DatabaseSync, options: ListSourceProfilesOptions = {}): RegisteredSource[] {
  const rows = db
    .prepare(
      `SELECT sp.id, sp.browser, sp.profile, sp.kind, sp.profile_path, pw.last_source_visit_id, pw.source_id_offset, pw.last_run_at, pw.last_fingerprint, COUNT(v.id) AS visits, MAX(v.visit_time) AS last_visit_time
       FROM source_profiles sp
       LEFT JOIN profile_watermarks pw ON pw.source_profile_id = sp.id
       LEFT JOIN visits v ON v.source_profile_id = sp.id
       GROUP BY sp.id
       ORDER BY sp.browser, sp.profile`,
    )
    .all() as unknown as SourceProfileJoinRow[]
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
function isPending(row: SourceProfileJoinRow): boolean {
  if (row.last_fingerprint === null) return true
  return probeFingerprint(row.profile_path) !== row.last_fingerprint
}

interface SourceProfileJoinRow {
  id: number
  browser: string
  profile: string
  kind: string
  profile_path: string
  last_source_visit_id: number | null
  source_id_offset: number | null
  last_run_at: number | null
  last_fingerprint: string | null
  visits: number | bigint
  last_visit_time: number | null
}

export function detectCleared(watermark: Watermark, sourceMaxVisitId: number): boolean {
  return watermark.lastSourceVisitId > 0 && sourceMaxVisitId < watermark.lastSourceVisitId
}

export function resetOffset(watermark: Watermark): number {
  return watermark.sourceIdOffset + watermark.lastSourceVisitId
}

// --- target fingerprint (change gate) ---

// Read the change-gate fingerprint for a source profile (browser + profile).
export function getTargetFingerprint(db: DatabaseSync, browser: string, profile: string): string | null {
  const row = db
    .prepare(
      'SELECT pw.last_fingerprint AS fingerprint FROM source_profiles sp JOIN profile_watermarks pw ON pw.source_profile_id = sp.id WHERE sp.browser = ? AND sp.profile = ?',
    )
    .get(browser, profile) as unknown as { fingerprint: string | null } | undefined
  return row?.fingerprint ?? null
}

// Store the change-gate fingerprint for a source profile.
export function setTargetFingerprint(db: DatabaseSync, sourceProfileId: number, fingerprint: string): void {
  db.prepare('UPDATE profile_watermarks SET last_fingerprint = ? WHERE source_profile_id = ?').run(fingerprint, sourceProfileId)
}
