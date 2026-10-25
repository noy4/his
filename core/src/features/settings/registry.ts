import type { SettingValue } from './define.ts'
import { HIDDEN_PATTERNS_KEY, hiddenPatternsSetting } from './hidden.ts'
import { SYNC_TARGETS_KEY, syncTargetsSetting } from '../sync/targets.ts'

// key = settings KV key
export const SETTINGS = {
  [HIDDEN_PATTERNS_KEY]: hiddenPatternsSetting,
  [SYNC_TARGETS_KEY]: syncTargetsSetting,
}

export type SettingsValues = {
  [K in keyof typeof SETTINGS]?: SettingValue<typeof SETTINGS[K]>
}

export type SettingsKey = keyof typeof SETTINGS
export const SETTINGS_KEYS = Object.keys(SETTINGS) as SettingsKey[]
