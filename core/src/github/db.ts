import type { DatabaseSync } from 'node:sqlite'
import { matchesKind, mergeRepoRoots, parseGithubUrl, type GithubKind, type GitHubUrlInfo, type GithubVisitKind } from './parse.ts'
import type { EpochMs, HistoryItem } from '../types.ts'
import { clampLimit, decodeCursor, encodeCursor, HIDDEN_URLS_EXCLUDED, type SearchPage } from '../db/query.ts'
import { MONTH_RANGE, monthRange } from '../db/stats.ts'

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

export function githubStats(db: DatabaseSync, month?: string): GithubStats {
  const repos = new Map<string, { owner: string; repo: string; visits: number }>()
  const owners = new Map<string, { visits: number; repos: Set<string> }>()
  const items = new Map<string, GithubStats['topItems'][number] & { last: EpochMs }>()
  let visits = 0
  let firstVisit = 0
  let lastVisit = 0

  for (const { item, urlInfo } of githubRows(db, month)) {
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

export function githubVisits(db: DatabaseSync, filter: GithubVisitsFilter = {}): SearchPage {
  const owner = filter.owner?.toLowerCase()
  const repo = filter.repo?.toLowerCase()
  const kind = filter.kind ?? 'all'
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)

  const matchingRows = githubRows(db, filter.month)
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
  const items = rowsAfterCursor.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: rowsAfterCursor.length > limit && last !== undefined
      ? encodeCursor(last.lastVisit, last.id)
      : null,
  }
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
const GITHUB_URL = "(urls.url LIKE 'https://github.com/%' OR urls.url LIKE 'https://www.github.com/%' OR urls.url LIKE 'http://github.com/%' OR urls.url LIKE 'http://www.github.com/%')"

// github.com rows; with month, counts / first / last are narrowed to that month
function githubRows(db: DatabaseSync, month?: string): { item: HistoryItem; urlInfo: GitHubUrlInfo }[] {
  let rows: Row[]
  if (month === undefined) {
    rows = db.prepare(
      `SELECT id, url, title, visit_count, typed_count, first_visit_time, last_visit_time
       FROM urls WHERE ${GITHUB_URL} AND ${HIDDEN_URLS_EXCLUDED}`,
    ).all() as unknown as Row[]
  } else {
    const [start, end] = monthRange(month)
    rows = db.prepare(
      `SELECT urls.id AS id, urls.url AS url, urls.title AS title, COUNT(*) AS visit_count,
              SUM(CASE WHEN visits.transition = 'typed' THEN 1 ELSE 0 END) AS typed_count,
              MIN(visits.visit_time) AS first_visit_time, MAX(visits.visit_time) AS last_visit_time
       FROM visits JOIN urls ON urls.id = visits.url_id
       WHERE ${GITHUB_URL} AND ${MONTH_RANGE} AND ${HIDDEN_URLS_EXCLUDED}
       GROUP BY urls.id`,
    ).all(start, end) as unknown as Row[]
  }
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
