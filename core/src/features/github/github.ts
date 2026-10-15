import { matchesKind, mergeRepoRoots, type GithubKind, type GithubVisitKind } from './parse.ts'
import { getGithubRows } from './githubRows.ts'
import type { EpochMs } from '../../types.ts'
import { clampLimit, decodeCursor, paginate } from '../../db/paging.ts'
import type { SearchPage } from '../../db/query.ts'
import type { KyselyDb } from '../../db/db.ts'

// GitHub Insights read API: githubStats (aggregate) + githubVisits (paged list).

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

  // take the top N of each
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

/** Paged GitHub visits with owner/repo/kind filters (month optional). */
export async function githubVisits(db: KyselyDb, filter: GithubVisitsFilter = {}): Promise<SearchPage> {
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

function top<T extends { visits: number }>(rows: T[], key: (row: T) => string): T[] {
  return rows.sort((a, b) =>
    b.visits - a.visits
    || key(a).localeCompare(key(b))
  ).slice(0, TOP)
}
