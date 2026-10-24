import type { KyselyDb } from '../../db/db.ts'
import { countHidden, getHiddenPatterns, setHiddenPatterns } from './hidden.ts'
import { getSyncTargets, setSyncTargets } from '../sync/targets.ts'

export type SettingsValues = {
  hiddenPatterns: string[]
  syncTargets: string[]
}

export type SettingsStats = {
  /** derived: currently hidden URL count */
  hiddenUrlCount: number
}

export type SettingsInfo = SettingsValues & SettingsStats
export type SettingsPatch = Partial<SettingsValues>

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
