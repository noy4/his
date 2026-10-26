import { sql } from 'kysely'
import type { RegisteredSource, RegisteredSourceEntry, SourceEntry, SourceKind, UnregisteredSourceEntry } from '../../types.ts'
import { probeSourceFingerprint } from './fingerprint.ts'
import type { KyselyDb } from '../../db/db.ts'
import { discoverAllTargets } from './discover.ts'
import { sourceKey } from './utils.ts'

export interface ListSourceProfilesOptions {
  /** probe each profile's source files and report whether it changed since the last sync */
  check?: boolean
}

export type ListSourcesOptions = ListSourceProfilesOptions & {
  home: string
}

// the sources listing: discovered ∪ registered
export async function listSources(db: KyselyDb, options: ListSourcesOptions): Promise<SourceEntry[]> {
  const discovered = discoverAllTargets(options.home)
  const registered = await listSourceProfiles(db, { check: options.check })
  return mergeEntries(discovered, registered)
}

// registered profiles only
export async function listSourceProfiles(db: KyselyDb, options: ListSourceProfilesOptions = {}): Promise<RegisteredSource[]> {
  const rows = await db
    .selectFrom('source_profiles as sp')
    .leftJoin('sync_checkpoints as sc', 'sc.source_profile_id', 'sp.id')
    .leftJoin('visits as v', 'v.source_profile_id', 'sp.id')
    .select([
      'sp.id',
      'sp.browser',
      'sp.profile',
      'sp.kind',
      'sp.profile_path',
      'sc.last_source_visit_id',
      'sc.source_id_offset',
      'sc.last_run_at',
      'sc.last_fingerprint',
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
    checkpoint: {
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

// discovered first, then the registered profiles that were not discovered
export function mergeEntries(
  discovered: readonly { browser: string; profile: string }[],
  registered: readonly RegisteredSource[],
): SourceEntry[] {
  const registeredByKey = new Map(registered.map((source) => [sourceKey(source), source]))
  const entries: SourceEntry[] = []
  const seen = new Set<string>()
  for (const target of discovered) {
    const key = sourceKey(target)
    seen.add(key)
    const source = registeredByKey.get(key)
    entries.push(source ? toRegistered(source) : toUnregistered(target))
  }
  for (const source of registered) {
    const key = sourceKey(source)
    if (seen.has(key)) continue
    entries.push(toRegistered(source))
  }
  return entries
}

// compare the source files to the last stored fingerprint
function isPending(row: { last_fingerprint: string | null; profile_path: string }): boolean {
  if (row.last_fingerprint === null) return true
  return probeSourceFingerprint(row.profile_path) !== row.last_fingerprint
}

function toRegistered(source: RegisteredSource): RegisteredSourceEntry {
  return { ...source, registered: true }
}

function toUnregistered(target: { browser: string; profile: string }): UnregisteredSourceEntry {
  return {
    browser: target.browser,
    profile: target.profile,
    registered: false,
  }
}
