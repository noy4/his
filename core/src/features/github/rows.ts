import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely'
import { parseGithubUrl, type GitHubUrlInfo } from './parse.ts'
import type { HistoryItem } from '../../types.ts'
import { hiddenExcluded, monthRange, monthWindow } from '../../db/filters.ts'
import type { KyselyDb } from '../../db/db.ts'
import type { DB } from '../../db/schema.ts'

// github.com rows, parsed to { item, urlInfo }. month ('YYYY-MM') narrows counts to that month.

interface Row {
  id: number
  url: string
  title: string | null
  visit_count: number | bigint
  typed_count: number
  first_visit_time: number
  last_visit_time: number
}

// LIKE is ASCII case-insensitive; parseGithubUrl does the exact host check
function githubUrl(eb: ExpressionBuilder<DB, 'urls'>): Expression<SqlBool> {
  return eb.or([
    eb('urls.url', 'like', 'https://github.com/%'),
    eb('urls.url', 'like', 'https://www.github.com/%'),
  ])
}

export async function githubRows(db: KyselyDb, month?: string): Promise<{ item: HistoryItem; urlInfo: GitHubUrlInfo }[]> {
  const rows: Row[] = month === undefined
    ? await githubAllRows(db)
    : await githubMonthRows(db, month)
  return rows.flatMap((row) => {
    const urlInfo = parseGithubUrl(row.url)
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

function githubAllRows(db: KyselyDb): Promise<Row[]> {
  return db
    .selectFrom('urls')
    .select(['id', 'url', 'title', 'visit_count', 'typed_count', 'first_visit_time', 'last_visit_time'])
    .where(githubUrl)
    .where(hiddenExcluded)
    .execute()
}

function githubMonthRows(db: KyselyDb, month: string): Promise<Row[]> {
  const [start, end] = monthRange(month)
  return db
    .selectFrom('visits')
    .innerJoin('urls', 'urls.id', 'visits.url_id')
    .select([
      'urls.id',
      'urls.url',
      'urls.title',
      sql<number>`COUNT(*)`.as('visit_count'),
      sql<number>`SUM(CASE WHEN visits.transition = 'typed' THEN 1 ELSE 0 END)`.as('typed_count'),
      sql<number>`MIN(visits.visit_time)`.as('first_visit_time'),
      sql<number>`MAX(visits.visit_time)`.as('last_visit_time'),
    ])
    .where(githubUrl)
    .where(monthWindow(start, end))
    .where(hiddenExcluded)
    .groupBy('urls.id')
    .execute()
}
