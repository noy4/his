import { parseSearchQuery } from './parse.ts'
import { getKeywordRows, getKeywordVisitDays } from './getKeywordRows.ts'
import type { KeywordStats, KeywordSearchParams } from './types.ts'
import type { StatsParams } from '../history/types.ts'
import type { HistoryItem } from '../../types.ts'
import { clampLimit, decodeCursor, paginate } from '../../db/query/paging.ts'
import type { Page } from '../../db/query/paging.ts'
import type { KyselyDb } from '../../db/db.ts'

// Keywords read API: keywordsStats (aggregate) + keywordsSearch (paged list).

/** Search totals + daily counts (month-scoped when given). */
export async function keywordsStats(db: KyselyDb, { month }: StatsParams = {}): Promise<KeywordStats> {
  const terms = new Set<string>()
  let searches = 0
  let firstVisit = 0
  let lastVisit = 0

  for (const { item, info } of await getKeywordRows(db, month)) {
    searches += item.visitCount
    terms.add(info.term.toLowerCase())
    firstVisit = (firstVisit === 0 || item.firstVisit < firstVisit) ? item.firstVisit : firstVisit
    lastVisit = Math.max(lastVisit, item.lastVisit)
  }

  return {
    totals: {
      searches,
      keywords: terms.size,
      firstVisit,
      lastVisit,
    },
    byDay: await keywordsByDay(db, month),
  }
}

// daily search counts; parseSearchQuery drops LIKE matches that are not real search URLs
async function keywordsByDay(db: KyselyDb, month?: string): Promise<KeywordStats['byDay']> {
  const byDay = new Map<string, number>()
  for (const row of await getKeywordVisitDays(db, month)) {
    if (parseSearchQuery(row.url) === null) continue
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.visits)
  }
  return [...byDay.entries()]
    .map(([day, visits]) => ({ day, visits }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** Paged search-engine history items, newest first (month optional). */
export async function keywordsSearch(db: KyselyDb, params: KeywordSearchParams = {}): Promise<Page<HistoryItem>> {
  const limit = clampLimit(params.limit)
  const cursor = params.cursor === undefined
    ? null
    : decodeCursor(params.cursor)

  const rows = (await getKeywordRows(db, params.month)).map(({ item }) => item)
  const rowsAfterCursor = cursor === null
    ? rows
    : rows.filter((it) =>
      it.lastVisit < cursor[0]
      || (it.lastVisit === cursor[0] && it.id < cursor[1])
    )
  rowsAfterCursor.sort((a, b) => b.lastVisit - a.lastVisit || b.id - a.id)
  return paginate(rowsAfterCursor, limit, (item) => [item.lastVisit, item.id])
}
