import type { KyselyDb } from '../../db/db.ts'
import type { SyncTarget } from '../sources/types.ts'
import { discoverAllTargets } from '../sources/discover.ts'
import { sourceKey } from '../sources/utils.ts'
import { readSettingJson, writeSettingJson } from '../settings/store.ts'

const SYNC_TARGETS_KEY = 'sync_targets'
const MAX_TARGETS = 500

// trims, drops malformed, dedupes, caps
export function cleanTargets(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value !== 'string') continue
    const token = cleanToken(value)
    if (token !== null) seen.add(token)
  }
  return [...seen].slice(0, MAX_TARGETS)
}

export async function getSyncTargets(db: KyselyDb): Promise<string[]> {
  return cleanTargets(await readSettingJson(db, SYNC_TARGETS_KEY))
}

export async function setSyncTargets(db: KyselyDb, input: unknown): Promise<string[]> {
  const targets = cleanTargets(input)
  await writeSettingJson(db, SYNC_TARGETS_KEY, targets)
  return targets
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

// --- helpers ---

// 'Chrome:Default' → 'chrome:Default'
function cleanToken(value: string): string | null {
  const raw = value.trim()
  if (raw === '') return null
  const sep = raw.indexOf(':')
  if (sep === -1) return raw.toLowerCase()
  const browser = raw.slice(0, sep).trim().toLowerCase()
  const profile = raw.slice(sep + 1)
  if (browser === '' || profile === '') return null
  return `${browser}:${profile}`
}
