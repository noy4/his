import { hostOf } from './util/url.ts'
import type { KyselyDb } from './db/db.ts'

const KEY = 'hidden_patterns'
const MAX_PATTERNS = 500

export interface SettingsInfo {
  hiddenPatterns: string[]
  hiddenCount: number
}

export async function getSettings(db: KyselyDb): Promise<SettingsInfo> {
  return {
    hiddenPatterns: await readPatterns(db),
    hiddenCount: await countHidden(db),
  }
}

// Store the patterns and materialize hidden_urls. Returns the cleaned list.
export async function setSettings(db: KyselyDb, hiddenPatterns: unknown): Promise<SettingsInfo> {
  const patterns = cleanPatterns(hiddenPatterns)
  const value = JSON.stringify(patterns)
  await db
    .insertInto('settings')
    .values({ key: KEY, value })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
    .execute()
  await recomputeHidden(db, patterns)
  return {
    hiddenPatterns: patterns,
    hiddenCount: await countHidden(db),
  }
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

export function matchesHidden(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const host = hostOf(url)
  const full = url.toLowerCase()
  const pathUrl = full.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  return patterns.some((pattern) => {
    // slash patterns are globs over the path (scheme stripped unless the pattern has one)
    if (pattern.includes('/'))
      return globToRegExp(pattern)
        .test(pattern.includes('://') ? full : pathUrl)
    // host-only patterns: bare tokens also match subdomains
    if (!pattern.includes('*'))
      return host === pattern || host.endsWith(`.${pattern}`)
    return globToRegExp(pattern).test(host)
  })
}

export function cleanPatterns(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value !== 'string') continue
    const pattern = value.trim().toLowerCase()
    if (pattern) seen.add(pattern)
  }
  return [...seen].slice(0, MAX_PATTERNS)
}

// --- helpers ---

async function readPatterns(db: KyselyDb): Promise<string[]> {
  const row = await db
    .selectFrom('settings')
    .select('value')
    .where('key', '=', KEY)
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

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}
