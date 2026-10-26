import { matchesKind, mergeRepoRoots, parseGithubUrl, type GithubUrlInfo } from './parse.ts'
import { getGithubRows, getGithubVisitDays } from './githubRows.ts'
import type { GithubDayItem, GithubDayKind, GithubStats, GithubVisitsFilter } from './types.ts'
import type { EpochMs, HistoryItem } from '../../types.ts'
import { clampLimit, decodeCursor, paginate } from '../../db/query/paging.ts'
import type { Page } from '../../db/query/paging.ts'
import { topBy } from '../../util/top.ts'
import type { KyselyDb } from '../../db/db.ts'

// GitHub Insights read API: githubStats (aggregate) + githubVisits (paged list).
// Data types live in ./types.ts (browser-safe) and are re-exported here.

export type { GithubDayItem, GithubDayKind, GithubStats, GithubVisitsFilter } from './types.ts'

const TOP = 5
const DAY_TOP = 3

/** GitHub totals + top repos/owners/items (month-scoped when given). */
export async function githubStats(db: KyselyDb, month?: string): Promise<GithubStats> {
  const repos = new Map<string, { owner: string; repo: string; visits: number }>()
  const owners = new Map<string, { visits: number; repos: Set<string> }>()
  const items = new Map<string, GithubStats['topItems'][number] & { last: EpochMs }>()
  let visits = 0
  let firstVisit = 0
  let lastVisit = 0

  for (const { item, urlInfo } of await getGithubRows(db, month)) {
    const visitCount = item.visitCount
    visits += visitCount
    firstVisit = firstVisit === 0 || item.firstVisit < firstVisit
      ? item.firstVisit
      : firstVisit
    lastVisit = Math.max(lastVisit, item.lastVisit)

    // count visits per owner
    const ownerStats = owners.get(urlInfo.owner) ?? {
      visits: 0,
      repos: new Set<string>(),
    }
    ownerStats.visits += visitCount
    owners.set(urlInfo.owner, ownerStats)
    if (urlInfo.repo === undefined) continue
    ownerStats.repos.add(urlInfo.repo)

    // count visits per repo
    const repoKey = `${urlInfo.owner}/${urlInfo.repo}`
    const repoStats = repos.get(repoKey) ?? {
      owner: urlInfo.owner,
      repo: urlInfo.repo,
      visits: 0,
    }
    repoStats.visits += visitCount
    repos.set(repoKey, repoStats)

    // only PR/Issue URLs become items
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
    byDay: await githubByDay(db, month),
    byDayTop: await githubDayTop(db, month),
    topRepos: topVisited([...repos.values()], (s) => `${s.owner}/${s.repo}`),
    topOwners: topVisited([...owners].map(([owner, ownerStats]) => ({
      owner,
      repos: ownerStats.repos.size,
      visits: ownerStats.visits
    })), (s) => s.owner),
    topItems: topVisited([...items.values()], (s) => s.url)
      .map(({ owner, repo, kind, number, title, url, visits }) =>
        ({ owner, repo, kind, number, title, url, visits })),
  }
}

// daily visit counts split by URL kind; 'all' is the day total
async function githubByDay(db: KyselyDb, month?: string): Promise<GithubStats['byDay']> {
  const byDay = new Map<string, GithubStats['byDay'][number]>()
  for (const row of await getGithubVisitDays(db, month)) {
    const urlInfo = parseGithubUrl(row.url)
    if (urlInfo === null) continue
    const kind = urlInfo.root ? 'repo' : urlInfo.kind === undefined ? 'other' : 'issue_pr'
    const bucket = byDay.get(row.day) ?? { day: row.day, all: 0, repo: 0, issue_pr: 0, other: 0 }
    bucket.all += row.visits
    bucket[kind] += row.visits
    byDay.set(row.day, bucket)
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

// per-day top items (most recently visited first) per kind, for chart tooltips
async function githubDayTop(db: KyselyDb, month?: string): Promise<GithubStats['byDayTop']> {
  const days = new Map<string, Record<GithubDayKind, Map<string, GithubDayItem>>>()
  for (const row of await getGithubVisitDays(db, month)) {
    const urlInfo = parseGithubUrl(row.url)
    if (urlInfo === null) continue
    const classified = classifyDayItem(urlInfo)
    const byKind = days.get(row.day) ?? { repo: new Map(), issue_pr: new Map(), other: new Map() }
    const bucket = byKind[classified.kind]
    const item = bucket.get(classified.key) ?? { ...classified, visits: 0, lastVisit: 0 }
    item.visits += row.visits
    item.lastVisit = Math.max(item.lastVisit, row.lastVisit)
    bucket.set(classified.key, item)
    days.set(row.day, byKind)
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, byKind]) => ({
      day,
      repo: topRecent([...byKind.repo.values()]),
      issue_pr: topRecent([...byKind.issue_pr.values()]),
      other: topRecent([...byKind.other.values()]),
    }))
}

// display entity (repo / issue-pr / other) a github URL belongs to
function classifyDayItem(urlInfo: GithubUrlInfo): Omit<GithubDayItem, 'visits' | 'lastVisit'> {
  if (urlInfo.root === true && urlInfo.repo !== undefined) {
    return { key: `repo:${urlInfo.owner}/${urlInfo.repo}`, kind: 'repo', owner: urlInfo.owner, repo: urlInfo.repo }
  }
  if (urlInfo.kind !== undefined && urlInfo.number !== undefined && urlInfo.repo !== undefined) {
    return {
      key: `issue:${urlInfo.owner}/${urlInfo.repo}/${urlInfo.kind}/${urlInfo.number}`,
      kind: 'issue_pr',
      owner: urlInfo.owner,
      repo: urlInfo.repo,
      number: urlInfo.number,
      pullKind: urlInfo.kind,
    }
  }
  return {
    key: `other:${urlInfo.owner}${urlInfo.repo === undefined ? '' : `/${urlInfo.repo}`}`,
    kind: 'other',
    owner: urlInfo.owner,
    repo: urlInfo.repo,
  }
}

// most recently visited first; ties by visits then key
function topRecent(items: GithubDayItem[]): GithubDayItem[] {
  return items
    .sort((a, b) => b.lastVisit - a.lastVisit || b.visits - a.visits || a.key.localeCompare(b.key))
    .slice(0, DAY_TOP)
}

/** Paged GitHub visits with owner/repo/kind filters (month optional). */
export async function githubVisits(db: KyselyDb, filter: GithubVisitsFilter = {}): Promise<Page<HistoryItem>> {
  const owner = filter.owner?.toLowerCase()
  const repo = filter.repo?.toLowerCase()
  const kind = filter.kind ?? 'all'
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)

  const matchingRows = (await getGithubRows(db, filter.month))
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

// --- utils ---

// 'Fix foo by bar · Pull Request #12 · o/r' → 'Fix foo by bar'
function cleanTitle(title: string): string {
  return title.split(' · ')[0] ?? title
}

// rank by visits desc, then key asc; keep the top N
function topVisited<T extends { visits: number }>(items: readonly T[], key: (item: T) => string): T[] {
  return topBy(items, { limit: TOP, score: (item) => item.visits, key })
}
