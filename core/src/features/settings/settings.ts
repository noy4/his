import type { KyselyDb } from '../../db/db.ts'
import { countHidden } from './hidden.ts'
import { SETTINGS, SETTINGS_KEYS } from './registry.ts'
import type { SettingsValues } from './registry.ts'
import { readSettingsJson, writeSettingJson } from './store.ts'

/** Derived stats */
export type SettingsStats = {
  hidden_url_count: number
}

export type SettingsInfo = SettingsValues & SettingsStats
export type SettingsPatch = SettingsValues

export async function getSettings(db: KyselyDb): Promise<SettingsInfo> {
  // only the stored settings; absent keys stay undefined
  const values = Object.fromEntries(await readSettingsJson(db, SETTINGS_KEYS)) as SettingsValues
  return {
    ...values,
    hidden_url_count: (values.hidden_patterns ?? []).length === 0 ? 0 : await countHidden(db),
  }
}

// partial update, only the provided fields change
export async function setSettings(db: KyselyDb, patch: SettingsPatch): Promise<SettingsInfo> {
  for (const key of SETTINGS_KEYS) {
    const value = patch[key]
    if (value === undefined) continue
    await writeSettingJson(db, key, value)
    await SETTINGS[key].afterWrite?.(db, value)
  }
  return getSettings(db)
}
