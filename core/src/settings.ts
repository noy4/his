import type { DatabaseSync } from 'node:sqlite'

// User "hide" patterns, stored as a JSON string[] under one settings key.
// Matching mirrors the WebUI mock: a bare token matches the host (and its
// subdomains); `*` is a glob; a pattern with a slash matches the path
// (scheme stripped unless the pattern includes one).

const KEY = 'hidden_patterns'
const MAX_PATTERNS = 500

export interface SettingsInfo {
  hiddenPatterns: string[]
  hiddenCount: number
}

export function getSettings(db: DatabaseSync): SettingsInfo {
  return {
    hiddenPatterns: readPatterns(db),
    hiddenCount: countHidden(db),
  }
}

// Store the patterns and materialize hidden_urls. Returns the cleaned list.
export function setSettings(db: DatabaseSync, hiddenPatterns: unknown): SettingsInfo {
  const patterns = cleanPatterns(hiddenPatterns)
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(KEY, JSON.stringify(patterns))
  recomputeHidden(db, patterns)
  return {
    hiddenPatterns: patterns,
    hiddenCount: countHidden(db),
  }
}

// Recompute hidden_urls for every URL. Only changed rows are written.
export function recomputeHidden(db: DatabaseSync, patterns: string[] = readPatterns(db)): number {
  const urls = db.prepare('SELECT id, url FROM urls').all() as unknown as { id: number; url: string }[]
  const matched = new Set<number>()
  for (const row of urls) {
    if (matchesHidden(row.url, patterns)) matched.add(row.id)
  }
  const current = new Set(
    (db.prepare('SELECT url_id FROM hidden_urls').all() as unknown as { url_id: number }[]).map((row) => row.url_id),
  )

  const insert = db.prepare('INSERT OR IGNORE INTO hidden_urls (url_id) VALUES (?)')
  const remove = db.prepare('DELETE FROM hidden_urls WHERE url_id = ?')
  let changed = 0
  db.exec('BEGIN')
  try {
    for (const id of matched) {
      if (current.has(id)) continue
      insert.run(id)
      changed += 1
    }
    for (const id of current) {
      if (matched.has(id)) continue
      remove.run(id)
      changed += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
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
      return globToRegExp(pattern).test(pattern.includes('://') ? full : pathUrl)
    // host-only patterns: bare tokens also match subdomains
    if (!pattern.includes('*')) return host === pattern || host.endsWith(`.${pattern}`)
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

function readPatterns(db: DatabaseSync): string[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as { value: string } | undefined
  if (row === undefined) return []
  try {
    return cleanPatterns(JSON.parse(row.value))
  } catch {
    return []
  }
}

function countHidden(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM hidden_urls').get() as { n: number }
  return Number(row.n)
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}
