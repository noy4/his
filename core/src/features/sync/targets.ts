import type { KyselyDb } from '../../db/db.ts'
import type { SyncTarget } from '../sources/types.ts'
import { discoverAllTargets } from '../sources/discover.ts'
import { sourceKey } from '../sources/utils.ts'
import type { SettingDef } from '../settings/define.ts'
import { readSettingJson } from '../settings/store.ts'

export const SYNC_TARGETS_KEY = 'sync_targets'

export const syncTargetsSetting: SettingDef<string[]> = {}

export async function getSyncTargets(db: KyselyDb): Promise<string[]> {
  return (await readSettingJson(db, SYNC_TARGETS_KEY) ?? []) as string[]
}

// keep only the discovered targets the tokens select
export function applyTargetFilter(tokens: string[], discovered: SyncTarget[]): SyncTarget[] {
  if (tokens.length === 0) return []
  const wanted = new Set(tokens)
  return discovered.filter((target) => wanted.has(target.browser) || wanted.has(sourceKey(target)))
}

// configured targets resolved against this machine
export async function resolveConfiguredTargets(db: KyselyDb, home: string): Promise<SyncTarget[]> {
  const tokens = await getSyncTargets(db)
  return applyTargetFilter(tokens, discoverAllTargets(home))
}
