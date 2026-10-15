import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { takeoutDir } from '../../../paths.ts'
import type { EpochMs, NativeVisit, Transition } from '../../../types.ts'
import type { Browser, Engine, SyncTarget } from '../types.ts'

export const takeoutEngine: Engine = {
  kind: 'takeout',
  idMode: 'hash',
  discover: (_browser, home, profile) => resolveTakeout(home, profile),
  parse: parseTakeout,
}

export const TAKEOUT_BROWSER: Browser = { name: 'takeout', label: 'Takeout', engine: takeoutEngine }

// --- parse ---

function parseTakeout(path: string): NativeVisit[] {
  const raw: unknown = JSON.parse(fs.readFileSync(path, 'utf8'))
  const items = extractVisitArray(raw)
  if (items === null) throw new Error(`no visit array found in ${path}`)
  return items.map(toNativeVisit).filter((visit): visit is NativeVisit => visit !== null)
}

// --- discovery ---

// resolve the home takeout dir's export files; the profile token is the file
// name (".json" optional), undefined = every *.json in the dir
export function resolveTakeout(home: string, profile: string | undefined): SyncTarget[] {
  const dir = takeoutDir(home)
  if (!fs.existsSync(dir)) return []
  if (profile === undefined) {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => takeoutTarget(dir, name))
  }
  const base = path.basename(profile)
  if (base !== profile || base === '.' || base === '..') return []
  const name = base.endsWith('.json') ? base : `${base}.json`
  const dbPath = path.join(dir, name)
  return fs.existsSync(dbPath) ? [takeoutTarget(dir, name)] : []
}

function takeoutTarget(dir: string, name: string): SyncTarget {
  const dbPath = path.join(dir, name)
  return {
    browser: 'takeout' as const,
    profile: takeoutProfileKey(dbPath),
    dbPath,
  }
}

// --- helpers ---

const MAX_SAFE_HASH = (1n << 53n) - 1n

export function stableVisitHash(url: string, visitTimeMs: EpochMs): number {
  const digest = createHash('sha256').update(`${url}\u0000${visitTimeMs}`).digest()
  return Number(digest.readBigUInt64BE(0) & MAX_SAFE_HASH)
}

// profile key; 'takeout' lives in SyncTarget.browser
export function takeoutProfileKey(jsonPath: string): string {
  const stem = path.basename(jsonPath).replace(/\.json$/i, '')
  const slug = stem.replace(/[^A-Za-z0-9._-]+/g, '-')
  return `${slug}-${createHash('sha256').update(path.resolve(jsonPath)).digest('hex').slice(0, 8)}`
}

const TAKEOUT_TIME_UTC = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?) UTC$/

export function parseTakeoutTime(text: string): EpochMs | null {
  const trimmed = text.trim()
  const utc = TAKEOUT_TIME_UTC.exec(trimmed)
  if (utc !== null) {
    const parsed = Date.parse(`${utc[1]}T${utc[2]}Z`)
    return Number.isNaN(parsed) ? null : parsed
  }
  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

// takeout page_transition strings are uppercase; map to the lowercase enum
const NAME_TO_TRANSITION = new Map<string, Transition>([
  ['LINK', 'link'],
  ['TYPED', 'typed'],
  ['AUTO_BOOKMARK', 'auto_bookmark'],
  ['AUTO_SUBFRAME', 'auto_subframe'],
  ['MANUAL_SUBFRAME', 'manual_subframe'],
  ['GENERATED', 'generated'],
  ['AUTO_TOPLEVEL', 'auto_toplevel'],
  ['FORM_SUBMIT', 'form_submit'],
  ['RELOAD', 'reload'],
  ['KEYWORD', 'keyword'],
  ['KEYWORD_GENERATED', 'keyword_generated'],
])

function extractVisitArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  if (raw !== null && typeof raw === 'object') {
    const record = raw as Record<string, unknown>
    for (const key of ['Browser History', 'My Activity']) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
  }
  return null
}

function toNativeVisit(item: unknown): NativeVisit | null {
  if (item === null || typeof item !== 'object') return null
  const entry = item as Record<string, unknown>
  const url = entry.url ?? entry.titleUrl
  if (typeof url !== 'string' || url === '') return null
  const visitTimeMs = entryTimeMs(entry)
  if (visitTimeMs === null) return null
  const transition = entryTransition(entry.page_transition)
  const title = entry.title
  return {
    sourceVisitId: stableVisitHash(url, visitTimeMs),
    url,
    title: typeof title === 'string' && title !== '' ? title : null,
    visitTime: visitTimeMs,
    transition,
  }
}

function entryTimeMs(entry: Record<string, unknown>): EpochMs | null {
  const usec = entry.time_usec
  if (typeof usec === 'number') return Math.round(usec / 1000)
  if (typeof usec === 'string' && /^\d+$/.test(usec)) return Number((BigInt(usec) + 500n) / 1000n)
  const time = entry.time
  if (typeof time === 'number' && Number.isFinite(time)) return Math.round(time)
  if (typeof time === 'string') {
    const parsed = parseTakeoutTime(time)
    if (parsed !== null) return parsed
  }
  return null
}

function entryTransition(raw: unknown): Transition {
  if (typeof raw !== 'string' || raw === '') return 'link'
  return NAME_TO_TRANSITION.get(raw) ?? 'link'
}