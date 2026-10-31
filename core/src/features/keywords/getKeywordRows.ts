import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely'
import { parseSearchQuery, SEARCH_HOSTS, type SearchQueryInfo } from './parse.ts'
import type { HistoryItem } from '../../types.ts'
import { hiddenExcluded, monthRange, monthWindow } from '../../db/query/filters.ts'
import type { KyselyDb } from '../../db/db.ts'
import type { DB } from '../../db/schema.ts'

// supported search-engine rows, parsed to { item, info }. month ('YYYY-MM') narrows counts to that month.

interface KeywordRow {
  id: number
  url: string
  title: string | null
  visit_count: number | bigint
  typed_count: number
  first_visit_time: number
  last_visit_time: number
}

// LIKE is ASCII case-insensitive; parseSearchQuery does the exact host/path check
function searchUrl(eb: ExpressionBuilder<DB, 'urls'>): Expression<SqlBool> {
  return eb.or(SEARCH_HOSTS.map((host) => eb('urls.url', 'like', `%://${host}/%`)))
}

export async function getKeywordRows(db: KyselyDb, month?: string): Promise<{ item: HistoryItem; info: SearchQueryInfo }[]> {
  const rows: KeywordRow[] = month === undefined
    ? await keywordAllRows(db)
    : await keywordMonthRows(db, month)
  return rows.flatMap((row) => {
    const info = parseSearchQuery(row.url)
    if (info === null) return []
    const item: HistoryItem = {
      id: row.id,
      url: row.url,
      title: row.title ?? '',
      visitCount: Number(row.visit_count),
      typedCount: row.typed_count,
      firstVisit: row.first_visit_time,
      lastVisit: row.last_visit_time,
    }
    return [{ item, info }]
  })
}

// all-time rows: stored urls aggregates, no visits join
function keywordAllRows(db: KyselyDb): Promise<KeywordRow[]> {
  return db
    .selectFrom('urls')
    .select(['id', 'url', 'title', 'visit_count', 'typed_count', 'first_visit_time', 'last_visit_time'])
    .where(searchUrl)
    .where(hiddenExcluded)
    .execute()
}

// month rows: recount from visits (urls cannot scope to a month)
function keywordMonthRows(db: KyselyDb, month: string): Promise<KeywordRow[]> {
  const [start, end] = monthRange(month)
  return db
    .selectFrom('urls')
    .crossJoin('visits')
    .select([
      'urls.id',
      'urls.url',
      'urls.title',
      sql<number>`COUNT(*)`.as('visit_count'),
      sql<number>`SUM(CASE WHEN visits.transition = 'typed' THEN 1 ELSE 0 END)`.as('typed_count'),
      sql<number>`MIN(visits.visit_time)`.as('first_visit_time'),
      sql<number>`MAX(visits.visit_time)`.as('last_visit_time'),
    ])
    .whereRef('visits.url_id', '=', 'urls.id')
    .where(searchUrl)
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy('urls.id')
    .execute()
}

// per-(day, url) visit counts, for the daily chart. isSearch is decided by parseSearchQuery.
export interface KeywordDayRow {
  day: string
  url: string
  visits: number
}

export async function getKeywordVisitDays(db: KyselyDb, month?: string): Promise<KeywordDayRow[]> {
  let builder = db
    .selectFrom('urls')
    .crossJoin('visits')
    .select([
      sql<string>`DATE(visits.visit_time / 1000, 'unixepoch', 'localtime')`.as('day'),
      'urls.url as url',
      sql<number>`COUNT(*)`.as('visits'),
    ])
    .whereRef('visits.url_id', '=', 'urls.id')
    .where(searchUrl)
    .where(hiddenExcluded)
  if (month !== undefined) {
    const [start, end] = monthRange(month)
    builder = builder.where(monthWindow(start, end))
  }
  return builder
    .groupBy(sql`day`)
    .groupBy('urls.url')
    .orderBy(sql`day`)
    .execute()
}
