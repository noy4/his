import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely'
import { matchesKind, mergeRepoRoots, parseGithubUrl, type GithubKind, type GitHubUrlInfo, type GithubVisitKind } from './parse.ts'
import type { EpochMs, HistoryItem } from '../types.ts'
import { clampLimit, decodeCursor, hiddenExcluded, paginate, type SearchPage } from '../db/query.ts'
import { monthRange, monthWindow } from '../db/stats.ts'
import type { KyselyDb } from '../db/db.ts'
import type { DB } from '../db/schema.ts'

// GitHub Insights. SQL only narrows to github.com rows; path parsing / grouping is JS
// (parse.ts) so it stays testable. month ('YYYY-MM') scopes to that month's visits.

export interface GithubStats {
  totals: { visits: number; repos: number; owners: number; items: number; firstVisit: EpochMs; lastVisit: EpochMs }
  topRepos: { owner: string; repo: string; visits: number }[]
  topOwners: { owner: string; repos: number; visits: number }[]
  topItems: { owner: string; repo: string; kind: GithubKind; number: number; title: string; url: string; visits: number }[]
}

export interface GithubVisitsFilter {
  month?: string
  owner?: string
  repo?: string
  kind?: GithubVisitKind
  cursor?: string
  limit?: number
}

const TOP = 5

export async function githubStats(db: KyselyDb, month?: string): Promise<GithubStats> {
  const repos = new Map<string, { owner: string; repo: string; visits: number }>()
  const owners = new Map<string, { visits: number; repos: Set<string> }>()
  const items = new Map<string, GithubStats['topItems'][number] & { last: EpochMs }>()
  let visits = 0
  let firstVisit = 0
  let lastVisit = 0

  for (const { item, urlInfo } of await githubRows(db, month)) {
    const visitCount = item.visitCount
    visits += visitCount
    firstVisit = firstVisit === 0 || item.firstVisit < firstVisit
      ? item.firstVisit
      : firstVisit
    lastVisit = Math.max(lastVisit, item.lastVisit)

    const ownerStats = owners.get(urlInfo.owner) ?? {
      visits: 0,
      repos: new Set<string>(),
    }
    ownerStats.visits += visitCount
    owners.set(urlInfo.owner, ownerStats)
    if (urlInfo.repo === undefined) continue
    ownerStats.repos.add(urlInfo.repo)

    const repoKey = `${urlInfo.owner}/${urlInfo.repo}`
    const repoStats = repos.get(repoKey) ?? {
      owner: urlInfo.owner,
      repo: urlInfo.repo,
      visits: 0,
    }
    repoStats.visits += visitCount
    repos.set(repoKey, repoStats)

    if (urlInfo.kind === undefined || urlInfo.number === undefined) continue
    const itemKey = `${repoKey}/${urlInfo.kind}/${urlInfo.number}`
    const itemStats = items.get(itemKey)
    if (itemStats === undefined) {
      items.set(itemKey, {
        owner: urlInfo.owner,
        repo: urlInfo.repo,
        kind: urlInfo.kind,
        number: urlInfo.number,
        title: cleanTitle(item.title),
        url: item.url,
        visits: visitCount,
        last: item.lastVisit,
      })
    } else {
      itemStats.visits += visitCount
      // latest visit wins for title / url
      if (item.lastVisit > itemStats.last)
        Object.assign(itemStats, {
          title: cleanTitle(item.title),
          url: item.url,
          last: item.lastVisit,
        })
    }
  }

  return {
    totals: {
      visits,
      repos: repos.size,
      owners: owners.size,
      items: items.size,
      firstVisit,
      lastVisit,
    },
    topRepos: top([...repos.values()], (repoStats) => `${repoStats.owner}/${repoStats.repo}`),
    topOwners: top([...owners].map(([owner, ownerStats]) => ({
      owner,
      repos: ownerStats.repos.size,
      visits: ownerStats.visits
    })), (ownerStats) => ownerStats.owner),
    topItems: top([...items.values()], (itemStats) => itemStats.url)
      .map(({ owner, repo, kind, number, title, url, visits }) =>
        ({ owner, repo, kind, number, title, url, visits })),
  }
}

export async function githubVisits(db: KyselyDb, filter: GithubVisitsFilter = {}): Promise<SearchPage> {
  const owner = filter.owner?.toLowerCase()
  const repo = filter.repo?.toLowerCase()
  const kind = filter.kind ?? 'all'
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)

  const matchingRows = (await githubRows(db, filter.month))
    .filter(({ urlInfo }) => (
      owner === undefined || urlInfo.owner === owner)
      && (repo === undefined || urlInfo.repo === repo)
      && matchesKind(urlInfo, kind)
    )
  const rows = mergeRepoRoots(matchingRows).map(({ item }) => item)
  const rowsAfterCursor = cursor === null
    ? rows
    : rows.filter((it) =>
      it.lastVisit < cursor[0]
      || (it.lastVisit === cursor[0] && it.id < cursor[1])
    )
  rowsAfterCursor.sort((a, b) => b.lastVisit - a.lastVisit || b.id - a.id)
  return paginate(rowsAfterCursor, limit, (item) => [item.lastVisit, item.id])
}

// --- implementation ---

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

// github.com rows; with month, counts / first / last are narrowed to that month
async function githubRows(db: KyselyDb, month?: string): Promise<{ item: HistoryItem; urlInfo: GitHubUrlInfo }[]> {
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

// --- utils ---

// 'Fix foo by bar · Pull Request #12 · o/r' → 'Fix foo by bar'
function cleanTitle(title: string): string {
  return title.split(' · ')[0] ?? title
}

function top<T extends { visits: number }>(rows: T[], key: (row: T) => string): T[] {
  return rows.sort((a, b) =>
    b.visits - a.visits
    || key(a).localeCompare(key(b))
  ).slice(0, TOP)
}
