import type { KyselyDb } from '../../db/db.ts'
import { countHidden, getHiddenPatterns, setHiddenPatterns } from './hidden.ts'
import { getSyncTargets, setSyncTargets } from '../sync/targets.ts'

export interface SettingsInfo {
  hiddenPatterns: string[]
  /** derived: currently hidden URL count, not settable */
  hiddenUrlCount: number
  syncTargets: string[]
}

export interface SettingsPatch {
  hiddenPatterns?: string[]
  syncTargets?: string[]
}

export async function getSettings(db: KyselyDb): Promise<SettingsInfo> {
  const hiddenPatterns = await getHiddenPatterns(db)
  return {
    hiddenPatterns,
    hiddenUrlCount: hiddenPatterns.length === 0 ? 0 : await countHidden(db),
    syncTargets: await getSyncTargets(db),
  }
}

// partial update, only the provided fields change
export async function setSettings(db: KyselyDb, patch: SettingsPatch): Promise<SettingsInfo> {
  if (patch.hiddenPatterns !== undefined)
    await setHiddenPatterns(db, patch.hiddenPatterns)
  if (patch.syncTargets !== undefined)
    await setSyncTargets(db, patch.syncTargets)
  return getSettings(db)
}
