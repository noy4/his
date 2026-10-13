import type { DatabaseSync } from 'node:sqlite'
import type { EpochMs, HistoryItem, HistoryVisit, Transition, VisitItem } from '../types.ts'

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

export interface SearchVisitsPage {
  items: HistoryVisit[]
  nextCursor: string | null
}

export interface ItemDetail {
  item: HistoryItem
  visits: VisitItem[]
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const CURSOR_VERSION = 'v1'
const URL_COLUMNS = 'id, url, title, last_visit_time, visit_count, typed_count, first_visit_time'
const VISIT_COLUMNS = 'id, url_id, visit_time, transition'

// user-hidden URLs are excluded from every list / aggregate query
export const HIDDEN_URLS_EXCLUDED = 'NOT EXISTS (SELECT 1 FROM hidden_urls WHERE url_id = urls.id)'

interface UrlRow {
  id: number
  url: string
  title: string | null
  visit_count: number
  typed_count: number
  first_visit_time: number
  last_visit_time: number
}

interface VisitRow {
  id: number
  url_id: number
  visit_time: number
  transition: string
}

type HistoryVisitRow = VisitRow & {
  url: string
  title: string | null
  visit_count: number
}

// --- queries ---

// sql text kept together with its positional params
interface Fragment {
  sql: string
  params?: (string | number)[]
}

export function search(db: DatabaseSync, filter: SearchFilter = {}): SearchPage {
  const limit = clampLimit(filter.limit)
  const { join, where, params } = buildSearch(filter, 'urls.last_visit_time', 'urls.id')
  const statement = db.prepare(
    `SELECT ${URL_COLUMNS} FROM urls ${join}${where} ORDER BY last_visit_time DESC, id DESC LIMIT ?`,
  )
  const rows = statement.all(...params, limit + 1) as unknown as UrlRow[]
  const items = rows.slice(0, limit).map(toHistoryItem)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.lastVisit, last.id) : null,
  }
}

export function searchVisits(db: DatabaseSync, filter: SearchFilter = {}): SearchVisitsPage {
  const limit = clampLimit(filter.limit)
  const { join, where, params } = buildSearch(filter, 'visits.visit_time', 'visits.id')
  const statement = db.prepare(
    `SELECT visits.id, visits.url_id, visits.visit_time, visits.transition, urls.url, urls.title, urls.visit_count
     FROM visits JOIN urls ON urls.id = visits.url_id ${join}${where}
     ORDER BY visits.visit_time DESC, visits.id DESC LIMIT ?`,
  )
  const rows = statement.all(...params, limit + 1) as unknown as HistoryVisitRow[]
  const items = rows.slice(0, limit).map((row): HistoryVisit => ({
    ...toVisitItem(row),
    url: row.url,
    title: row.title ?? '',
    visitCount: row.visit_count,
  }))
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.visitTime, last.id) : null,
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
    `SELECT ${URL_COLUMNS} FROM urls WHERE id = ?`,
  )
  const row = statement.get(id) as unknown as UrlRow | undefined
  if (row === undefined) return null
  return { item: toHistoryItem(row), visits: getVisits(db, id) }
}

// --- helpers ---

function buildSearch(filter: SearchFilter, timeColumn: string, idColumn: string) {
  const fragments: Fragment[] = [
    { sql: HIDDEN_URLS_EXCLUDED },
  ]
  if (filter.url !== undefined) fragments.push({ sql: 'urls.url = ?', params: [filter.url] })
  if (filter.from !== undefined) fragments.push({ sql: `${timeColumn} >= ?`, params: [filter.from] })
  if (filter.to !== undefined) fragments.push({ sql: `${timeColumn} <= ?`, params: [filter.to] })

  const query = filter.query?.trim() ?? ''
  let ftsJoin: Fragment | null = null
  if (query.length !== 0) {
    if (codePoints(query) >= 3) {
      ftsJoin = { sql: 'JOIN (SELECT rowid AS fts_id FROM urls_fts WHERE urls_fts MATCH ?) fts ON fts.fts_id = urls.id', params: [ftsPattern(query)] }
    } else {
      const pattern = likePattern(query)
      fragments.push({ sql: '(urls.title LIKE ? ESCAPE ? OR urls.url LIKE ? ESCAPE ?)', params: [pattern, '\\', pattern, '\\'] })
    }
  }

  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)
  if (cursor !== null) {
    fragments.push({ sql: `(${timeColumn} < ? OR (${timeColumn} = ? AND ${idColumn} < ?))`, params: [cursor[0], cursor[0], cursor[1]] })
  }
  const clauses = fragments.map((fragment) => fragment.sql).join(' AND ')
  return {
    join: ftsJoin?.sql ?? '',
    where: clauses === '' ? '' : ` WHERE ${clauses}`,
    params: [...(ftsJoin?.params ?? []), ...fragments.flatMap((fragment) => fragment.params ?? [])],
  }
}

function toHistoryItem(row: UrlRow): HistoryItem {
  return {
    id: row.id,
    url: row.url,
    title: row.title ?? '',
    visitCount: row.visit_count,
    typedCount: row.typed_count,
    firstVisit: row.first_visit_time,
    lastVisit: row.last_visit_time,
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

export function clampLimit(limit: number | undefined): number {
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

/** Encodes `v1:<base64url(JSON([time, id]))>` using the endpoint's timestamp and row ID. */
export function encodeCursor(time: EpochMs, id: number): string {
  return `${CURSOR_VERSION}:${Buffer.from(JSON.stringify([time, id]), 'utf8').toString('base64url')}`
}

/** Decodes `v1:<base64url(JSON([time, id]))>`; returns null if invalid. */
export function decodeCursor(cursor: string): [EpochMs, number] | null {
  if (!cursor.startsWith(`${CURSOR_VERSION}:`)) return null
  try {
    const pair: unknown = JSON.parse(Buffer.from(cursor.slice(CURSOR_VERSION.length + 1), 'base64url').toString('utf8'))
    if (!Array.isArray(pair) || pair.length !== 2) return null
    const [time, id] = pair
    if (typeof time !== 'number' || typeof id !== 'number') return null
    return [time, id]
  } catch {
    return null
  }
}
