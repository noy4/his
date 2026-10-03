import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs, HistoryItem, Transition, VisitItem } from '../model.ts'

// --- contract ---

export interface SearchFilter {
  query?: string
  url?: string
  from?: EpochMs
  to?: EpochMs
  cursor?: string
  limit?: number
}

export interface SearchPage {
  items: HistoryItem[]
  nextCursor: string | null
}

export interface ItemDetail {
  item: HistoryItem
  visits: VisitItem[]
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const CURSOR_VERSION = 'v1'
const URL_COLUMNS = 'id, url, title, visit_count, typed_count, first_visit_time, last_visit_time, hidden_at'
const VISIT_COLUMNS = 'id, url_id, visit_time, transition'

interface UrlRow {
  id: number
  url: string
  title: string | null
  visit_count: number
  typed_count: number
  first_visit_time: number
  last_visit_time: number
  hidden_at: number | null
}

interface VisitRow {
  id: number
  url_id: number
  visit_time: number
  transition: string
}

// --- queries ---

export function search(db: DatabaseSync, filter: SearchFilter = {}): SearchPage {
  const limit = clampLimit(filter.limit)
  const joinStatements: string[] = []
  const joinParams: (string | number)[] = []
  const whereParams: (string | number)[] = []
  const conditions: string[] = ['hidden_at IS NULL']

  const url = filter.url
  if (url !== undefined) {
    conditions.push('url = ?')
    whereParams.push(url)
  }

  const from = filter.from
  if (from !== undefined) {
    conditions.push('last_visit_time >= ?')
    whereParams.push(from)
  }

  const to = filter.to
  if (to !== undefined) {
    conditions.push('last_visit_time <= ?')
    whereParams.push(to)
  }

  const query = filter.query?.trim() ?? ''
  if (query.length !== 0) {
    if (codePoints(query) >= 3) {
      joinStatements.push('JOIN (SELECT rowid AS fts_id FROM urls_fts WHERE urls_fts MATCH ?) fts ON fts.fts_id = urls.id')
      joinParams.push(ftsPattern(query))
    } else {
      conditions.push('(title LIKE ? ESCAPE ? OR url LIKE ? ESCAPE ?)')
      const pattern = likePattern(query)
      whereParams.push(pattern, '\\', pattern, '\\')
    }
  }

  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)
  if (cursor !== null) {
    conditions.push('(last_visit_time < ? OR (last_visit_time = ? AND id < ?))')
    whereParams.push(cursor[0], cursor[0], cursor[1])
  }

  const statement = db.prepare(
    `SELECT ${URL_COLUMNS} FROM urls ${joinStatements.join(' ')} WHERE ${conditions.join(' AND ')} ORDER BY last_visit_time DESC, id DESC LIMIT ?`,
  )
  const rows = statement.all(...joinParams, ...whereParams, limit + 1) as unknown as UrlRow[]
  const items = rows.slice(0, limit).map(toHistoryItem)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.lastVisit, last.id) : null,
  }
}

export function getVisits(db: DatabaseSync, urlId: number, limit?: number): VisitItem[] {
  if (limit === undefined) {
    const statement = db.prepare(`SELECT ${VISIT_COLUMNS} FROM visits WHERE url_id = ? ORDER BY visit_time DESC`)
    return (statement.all(urlId) as unknown as VisitRow[]).map(toVisitItem)
  }
  const statement = db.prepare(
    `SELECT ${VISIT_COLUMNS} FROM visits WHERE url_id = ? ORDER BY visit_time DESC LIMIT ?`,
  )
  return (statement.all(urlId, clampLimit(limit)) as unknown as VisitRow[]).map(toVisitItem)
}

export function getItem(db: DatabaseSync, id: number): ItemDetail | null {
  const statement = db.prepare(
    `SELECT ${URL_COLUMNS} FROM urls WHERE id = ? AND hidden_at IS NULL`,
  )
  const row = statement.get(id) as unknown as UrlRow | undefined
  if (row === undefined) return null
  return { item: toHistoryItem(row), visits: getVisits(db, id) }
}

// --- helpers ---

function toHistoryItem(row: UrlRow): HistoryItem {
  return {
    id: row.id,
    url: row.url,
    title: row.title ?? '',
    visitCount: row.visit_count,
    typedCount: row.typed_count,
    firstVisit: row.first_visit_time,
    lastVisit: row.last_visit_time,
    hiddenAt: row.hidden_at,
  }
}

function toVisitItem(row: VisitRow): VisitItem {
  return {
    id: row.id,
    urlId: row.url_id,
    transition: row.transition as Transition,
    visitTime: row.visit_time,
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT)
}

function codePoints(text: string): number {
  return Array.from(text).length
}

function ftsPattern(query: string): string {
  return `"${query.replace(/"/g, '""')}"`
}

function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, '\\$&')}%`
}

function encodeCursor(lastVisit: EpochMs, id: number): string {
  return `${CURSOR_VERSION}:${Buffer.from(JSON.stringify([lastVisit, id]), 'utf8').toString('base64url')}`
}

function decodeCursor(cursor: string): [EpochMs, number] | null {
  if (!cursor.startsWith(`${CURSOR_VERSION}:`)) return null
  try {
    const pair: unknown = JSON.parse(Buffer.from(cursor.slice(CURSOR_VERSION.length + 1), 'base64url').toString('utf8'))
    if (!Array.isArray(pair) || pair.length !== 2) return null
    const [lastVisit, id] = pair
    if (typeof lastVisit !== 'number' || typeof id !== 'number') return null
    return [lastVisit, id]
  } catch {
    return null
  }
}
