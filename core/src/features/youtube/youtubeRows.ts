import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely'
import { parseYoutubeUrl, type YoutubeUrlInfo } from './parse.ts'
import type { EpochMs, HistoryItem } from '../../types.ts'
import { hiddenExcluded, monthRange, monthWindow } from '../../db/query/filters.ts'
import type { KyselyDb } from '../../db/db.ts'
import type { DB } from '../../db/schema.ts'

// youtube.com / youtu.be rows, parsed to { item, urlInfo }. month ('YYYY-MM') narrows counts to that month.

interface YoutubeRow {
  id: number
  url: string
  title: string | null
  visit_count: number | bigint
  typed_count: number
  first_visit_time: number
  last_visit_time: number
}

// LIKE is ASCII case-insensitive; parseYoutubeUrl does the exact host check
function youtubeUrl(eb: ExpressionBuilder<DB, 'urls'>): Expression<SqlBool> {
  return eb.or([
    eb('urls.url', 'like', 'https://youtube.com/%'),
    eb('urls.url', 'like', 'https://www.youtube.com/%'),
    eb('urls.url', 'like', 'https://m.youtube.com/%'),
    eb('urls.url', 'like', 'https://youtu.be/%'),
  ])
}

export async function getYoutubeRows(db: KyselyDb, month?: string): Promise<{ item: HistoryItem; urlInfo: YoutubeUrlInfo }[]> {
  const rows: YoutubeRow[] = month === undefined
    ? await youtubeAllRows(db)
    : await youtubeMonthRows(db, month)
  return rows.flatMap((row) => {
    const urlInfo = parseYoutubeUrl(row.url)
    if (urlInfo === null) return []
    const item: HistoryItem = {
      id: row.id,
      url: row.url,
      title: row.title ?? '',
      visitCount: Number(row.visit_count),
      typedCount: row.typed_count,
      firstVisit: row.first_visit_time,
      lastVisit: row.last_visit_time,
    }
    return [{ item, urlInfo }]
  })
}

// all-time rows: stored urls aggregates, no visits join
function youtubeAllRows(db: KyselyDb): Promise<YoutubeRow[]> {
  return db
    .selectFrom('urls')
    .select(['id', 'url', 'title', 'visit_count', 'typed_count', 'first_visit_time', 'last_visit_time'])
    .where(youtubeUrl)
    .where(hiddenExcluded)
    .execute()
}

// month rows: recount from visits (urls cannot scope to a month);
// urls-first (crossJoin) so the LIKE filter spares non-youtube visits — revisit for narrow windows
function youtubeMonthRows(db: KyselyDb, month: string): Promise<YoutubeRow[]> {
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
    .where(youtubeUrl)
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy('urls.id')
    .execute()
}

// per-(day, url) visit counts + last visit time, for daily charts.
// kind is not classified here (needs parseYoutubeUrl).
export interface YoutubeDayRow {
  day: string
  url: string
  visits: number
  lastVisit: EpochMs
}

export async function getYoutubeVisitDays(db: KyselyDb, month?: string): Promise<YoutubeDayRow[]> {
  let builder = db
    .selectFrom('urls')
    .crossJoin('visits')
    .select([
      sql<string>`DATE(visits.visit_time / 1000, 'unixepoch', 'localtime')`.as('day'),
      'urls.url as url',
      sql<number>`COUNT(*)`.as('visits'),
      sql<number>`MAX(visits.visit_time)`.as('lastVisit'),
    ])
    .whereRef('visits.url_id', '=', 'urls.id')
    .where(youtubeUrl)
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
