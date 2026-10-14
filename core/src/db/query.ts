import { sql, type Expression, type ExpressionBuilder, type RawBuilder, type SqlBool } from 'kysely'
import type { EpochMs, HistoryItem, HistoryVisit, Transition, VisitItem } from '../types.ts'
import type { KyselyDb } from './db.ts'
import type { DB } from './schema.ts'

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

// searchVisits joins the URL for the display fields.
interface VisitUrlRow extends VisitRow {
  url: string
  title: string | null
  visit_count: number
}

// --- queries ---

// FTS matching and cursor paging use raw SQL fragments.
export async function search(db: KyselyDb, filter: SearchFilter = {}): Promise<SearchPage> {
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)
  const text = filter.query?.trim()
  let builder = db
    .selectFrom('urls')
    .selectAll()
    .where(hiddenExcluded)
  if (filter.url)
    builder = builder.where('urls.url', '=', filter.url)
  if (filter.from !== undefined)
    builder = builder.where('urls.last_visit_time', '>=', filter.from)
  if (filter.to !== undefined)
    builder = builder.where('urls.last_visit_time', '<=', filter.to)
  if (text && hasFts(text))
    builder = builder.where(ftsCondition(text))
  if (text && hasLike(text))
    builder = builder.where(likeCondition(text))
  if (cursor)
    builder = builder.where(afterCursor('urls.last_visit_time', 'urls.id', cursor))
  const rows = await builder
    .orderBy('urls.last_visit_time', 'desc')
    .orderBy('urls.id', 'desc')
    .limit(limit + 1)
    .execute()
  return paginate(rows.map(toHistoryItem), limit, (item) => [item.lastVisit, item.id])
}

export async function searchVisits(db: KyselyDb, filter: SearchFilter = {}): Promise<SearchVisitsPage> {
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)
  const text = filter.query?.trim()
  let builder = db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select(['visits.id', 'visits.url_id', 'visits.visit_time', 'visits.transition', 'urls.url', 'urls.title', 'urls.visit_count'])
    .where(hiddenExcluded)
  if (filter.url)
    builder = builder.where('urls.url', '=', filter.url)
  if (filter.from !== undefined)
    builder = builder.where('visits.visit_time', '>=', filter.from)
  if (filter.to !== undefined)
    builder = builder.where('visits.visit_time', '<=', filter.to)
  if (text && hasFts(text))
    builder = builder.where(ftsCondition(text))
  if (text && hasLike(text))
    builder = builder.where(likeCondition(text))
  if (cursor)
    builder = builder.where(afterCursor('visits.visit_time', 'visits.id', cursor))
  const rows = await builder
    .orderBy('visits.visit_time', 'desc')
    .orderBy('visits.id', 'desc')
    .limit(limit + 1)
    .execute()
  return paginate(rows.map(toHistoryVisit), limit, (item) => [item.visitTime, item.id])
}

export async function getVisits(db: KyselyDb, urlId: number, limit?: number): Promise<VisitItem[]> {
  const query = db
    .selectFrom('visits')
    .select(['id', 'url_id', 'visit_time', 'transition'])
    .where('url_id', '=', urlId)
    .orderBy('visit_time', 'desc')
  const rows = limit === undefined
    ? await query.execute()
    : await query.limit(clampLimit(limit)).execute()
  return rows.map(toVisitItem)
}

export async function getItem(db: KyselyDb, id: number): Promise<ItemDetail | null> {
  const row = await db
    .selectFrom('urls')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (row === undefined) return null
  return {
    item: toHistoryItem(row),
    visits: await getVisits(db, id),
  }
}

// --- helpers ---

// user-hidden URLs are excluded from every list / aggregate query
export function hiddenExcluded(eb: ExpressionBuilder<DB, 'urls'>): Expression<SqlBool> {
  return eb.not(
    eb.exists(
      eb.selectFrom('hidden_urls')
        .select('url_id')
        .whereRef('hidden_urls.url_id', '=', 'urls.id'),
    ),
  )
}

function hasFts(query: string): boolean {
  return query.length !== 0 && codePoints(query) >= 3
}

function hasLike(query: string): boolean {
  return !hasFts(query)
}

function ftsCondition(query: string): RawBuilder<SqlBool> {
  return sql<SqlBool>`urls.id IN (SELECT rowid FROM urls_fts WHERE urls_fts MATCH ${ftsPattern(query)})`
}

function likeCondition(query: string): RawBuilder<SqlBool> {
  const pattern = likePattern(query)
  return sql<SqlBool>`(urls.title LIKE ${pattern} ESCAPE ${'\\'} OR urls.url LIKE ${pattern} ESCAPE ${'\\'})`
}

// Keyset condition over (time, id) desc: rows strictly after `cursor`.
function afterCursor(timeColumn: string, idColumn: string, cursor: [EpochMs, number]): RawBuilder<SqlBool> {
  const [time, id] = cursor
  return sql<SqlBool>`(${sql.ref(timeColumn)} < ${time} OR (${sql.ref(timeColumn)} = ${time} AND ${sql.ref(idColumn)} < ${id}))`
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

function toHistoryVisit(row: VisitUrlRow): HistoryVisit {
  return {
    ...toVisitItem(row),
    url: row.url,
    title: row.title ?? '',
    visitCount: row.visit_count,
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

/** Splits a `limit + 1` fetch into a page: the extra row only signals that more follow. */
export function paginate<T>(
  rows: readonly T[],
  limit: number,
  keyOf: (last: T) => [EpochMs, number],
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  if (last === undefined || rows.length <= limit)
    return { items, nextCursor: null }
  const [time, id] = keyOf(last)
  return { items, nextCursor: encodeCursor(time, id) }
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
