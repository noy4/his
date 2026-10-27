import { sql } from 'kysely'
import type { RegisteredSource, RegisteredSourceEntry, SourceEntry, UnregisteredSourceEntry } from '../../types.ts'
import { probeSourceFingerprint } from './fingerprint.ts'
import type { KyselyDb } from '../../db/db.ts'
import { discoverAllTargets } from './discover.ts'
import { sourceKey } from './utils.ts'
import type { SyncTarget } from './types.ts'

export type ListSourcesOptions = {
  home: string
}

// the sources listing: discovered ∪ registered
export async function listSources(db: KyselyDb, options: ListSourcesOptions): Promise<SourceEntry[]> {
  const discovered = discoverAllTargets(options.home)
  const registered = await listSourceProfiles(db)
  return mergeEntries(discovered, registered)
}

// registered profiles only
export async function listSourceProfiles(db: KyselyDb): Promise<RegisteredSource[]> {
  const rows = await db
    .selectFrom('source_profiles as sp')
    .leftJoin('sync_checkpoints as sc', 'sc.source_profile_id', 'sp.id')
    .leftJoin('visits as v', 'v.source_profile_id', 'sp.id')
    .select([
      'sp.browser',
      'sp.profile',
      'sp.source_path',
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
    browser: row.browser,
    profile: row.profile,
    sourcePath: row.source_path,
    visits: row.visits,
    lastVisit: row.last_visit_time,
    lastRunAt: row.last_run_at,
    pending: isPending(row),
  }))
}

// discovered first, then the registered profiles that were not discovered
export function mergeEntries(
  discovered: readonly SyncTarget[],
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
function isPending(row: { last_fingerprint: string | null; source_path: string }): boolean {
  if (row.last_fingerprint === null) return true
  return probeSourceFingerprint(row.source_path) !== row.last_fingerprint
}

function toRegistered(source: RegisteredSource): RegisteredSourceEntry {
  return { ...source, registered: true }
}

function toUnregistered(target: SyncTarget): UnregisteredSourceEntry {
  return {
    browser: target.browser,
    profile: target.profile,
    sourcePath: target.sourcePath,
    registered: false,
  }
}
