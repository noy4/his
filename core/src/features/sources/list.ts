import { sql } from 'kysely'
import type { RegisteredSource, SourceKind } from '../../types.ts'
import { probeFingerprint } from './fingerprint.ts'
import type { KyselyDb } from '../../db/db.ts'

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
