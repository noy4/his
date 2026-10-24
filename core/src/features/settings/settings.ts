import type { KyselyDb } from '../../db/db.ts'
import { cleanPatterns, matchesHidden } from './hidden-patterns.ts'
import { getSyncTargets, setSyncTargets } from '../sync/targets.ts'

const HIDDEN_KEY = 'hidden_patterns'

export interface SettingsInfo {
  hiddenPatterns: string[]
  hiddenCount: number
  syncTargets: string[]
}

export interface SettingsPatch {
  hiddenPatterns?: string[]
  syncTargets?: string[]
}

export async function getSettings(db: KyselyDb): Promise<SettingsInfo> {
  return {
    hiddenPatterns: await readPatterns(db),
    hiddenCount: await countHidden(db),
    syncTargets: await getSyncTargets(db),
  }
}

// partial update, only the provided fields change
export async function setSettings(db: KyselyDb, patch: SettingsPatch): Promise<SettingsInfo> {
  if (patch.hiddenPatterns !== undefined) {
    const patterns = cleanPatterns(patch.hiddenPatterns)
    const value = JSON.stringify(patterns)
    await db
      .insertInto('settings')
      .values({ key: HIDDEN_KEY, value })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      .execute()
    await recomputeHidden(db, patterns)
  }
  if (patch.syncTargets !== undefined) {
    await setSyncTargets(db, patch.syncTargets)
  }
  return getSettings(db)
}

// Recompute hidden_urls for every URL. Only changed rows are written.
export async function recomputeHidden(db: KyselyDb, patterns?: string[]): Promise<number> {
  const resolved = patterns ?? await readPatterns(db)
  const urls = await db
    .selectFrom('urls')
    .select(['id', 'url'])
    .execute()
  const matched = new Set<number>()
  for (const row of urls) {
    if (matchesHidden(row.url, resolved))
      matched.add(row.id)
  }
  const hiddenRows = await db
    .selectFrom('hidden_urls')
    .select('url_id')
    .execute()
  const current = new Set(hiddenRows.map((row) => row.url_id))

  let changed = 0
  await db.transaction().execute(async (tx) => {
    const toAdd = [...matched].filter((id) => !current.has(id))
    const toRemove = [...current].filter((id) => !matched.has(id))
    if (toAdd.length > 0)
      await tx
        .insertInto('hidden_urls')
        .values(toAdd.map((url_id) => ({ url_id })))
        .onConflict((oc) => oc.column('url_id').doNothing())
        .execute()
    if (toRemove.length > 0)
      await tx
        .deleteFrom('hidden_urls')
        .where('url_id', 'in', toRemove)
        .execute()
    changed = toAdd.length + toRemove.length
  })
  return changed
}

// --- helpers ---

async function readPatterns(db: KyselyDb): Promise<string[]> {
  const row = await db
    .selectFrom('settings')
    .select('value')
    .where('key', '=', HIDDEN_KEY)
    .executeTakeFirst()
  if (row === undefined) return []
  try {
    return cleanPatterns(JSON.parse(row.value))
  } catch {
    return []
  }
}

async function countHidden(db: KyselyDb): Promise<number> {
  const row = await db
    .selectFrom('hidden_urls')
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()
  return Number(row.count)
}
