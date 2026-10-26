import type { KyselyDb } from '../../db/db.ts'
import type { SyncTarget } from '../sources/types.ts'
import { discoverAllTargets } from '../sources/discover.ts'
import { sourceKey } from '../sources/utils.ts'
import { SYNC_TARGETS_KEY } from '../settings/sync-targets.ts'
import { readSettingJson } from '../settings/store.ts'

// keep only the discovered targets the tokens select
export function applyTargetFilter(tokens: string[], discovered: SyncTarget[]): SyncTarget[] {
  if (tokens.length === 0) return []
  const wanted = new Set(tokens)
  return discovered.filter((target) => wanted.has(target.browser) || wanted.has(sourceKey(target)))
}

// configured targets resolved against this machine
export async function resolveConfiguredTargets(db: KyselyDb, home: string): Promise<SyncTarget[]> {
  const tokens = (await readSettingJson(db, SYNC_TARGETS_KEY) ?? []) as string[]
  return applyTargetFilter(tokens, discoverAllTargets(home))
}
