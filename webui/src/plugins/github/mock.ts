import {
  matchesKind, mergeRepoRoots, parseGithubUrl,
  type GithubDayItem, type GithubDayKind, type GithubSearchParams, type GithubStats,
  type GithubUrlInfo, type HistoryItem, type SearchPage, type StatsParams,
} from '@his/core'
import { isoDay } from '@/lib/date'
import { MOCK_VISITS, byLastVisitDesc, inPeriod, paginate, visibleItems } from '@/app/api/mock/kit'

const GITHUB_TOP = 20
const DAY_TOP = 3

function githubItems(): { item: HistoryItem; urlInfo: GithubUrlInfo }[] {
  return visibleItems().flatMap((item) => {
    const urlInfo = parseGithubUrl(item.url)
    return urlInfo ? [{ item, urlInfo }] : []
  })
}

function githubPeriod(month?: string): { item: HistoryItem; urlInfo: GithubUrlInfo }[] {
  return githubItems().flatMap(({ item, urlInfo }) => {
    const it = inPeriod(item, month)
    return it ? [{ item: it, urlInfo }] : []
  })
}

// 'Fix foo by bar · Pull Request #12 · o/r' → 'Fix foo by bar'
function cleanTitle(title: string): string {
  return title.split(' · ')[0]
}

function computeGithubStats(month?: string): GithubStats {
  const repos = new Map<string, { owner: string; repo: string; visits: number }>()
  const owners = new Map<string, { visits: number; repos: Set<string> }>()
  const items = new Map<string, GithubStats['topItems'][number] & { last: number }>()
  let visits = 0
  let firstVisit = Number.POSITIVE_INFINITY
  let lastVisit = 0

  for (const { item, urlInfo } of githubPeriod(month)) {
    const n = item.visitCount
    visits += n
    firstVisit = Math.min(firstVisit, item.firstVisit)
    lastVisit = Math.max(lastVisit, item.lastVisit)
    const o = owners.get(urlInfo.owner) ?? { visits: 0, repos: new Set<string>() }
    o.visits += n
    owners.set(urlInfo.owner, o)
    if (!urlInfo.repo) continue
    o.repos.add(urlInfo.repo)
    const rk = `${urlInfo.owner}/${urlInfo.repo}`
    const r = repos.get(rk) ?? { owner: urlInfo.owner, repo: urlInfo.repo, visits: 0 }
    r.visits += n
    repos.set(rk, r)
    if (!urlInfo.kind || urlInfo.number === undefined) continue
    const ik = `${rk}/${urlInfo.kind}/${urlInfo.number}`
    const cur = items.get(ik)
    if (cur) {
      cur.visits += n
      if (item.lastVisit > cur.last) Object.assign(cur, { title: cleanTitle(item.title), url: item.url, last: item.lastVisit })
    } else {
      items.set(ik, { owner: urlInfo.owner, repo: urlInfo.repo, kind: urlInfo.kind, number: urlInfo.number, title: cleanTitle(item.title), url: item.url, visits: n, last: item.lastVisit })
    }
  }

  const byVisits = <T extends { visits: number }>(a: T, b: T) => b.visits - a.visits
  return {
    totals: {
      visits,
      repos: repos.size,
      owners: owners.size,
      items: items.size,
      firstVisit: Number.isFinite(firstVisit) ? firstVisit : 0,
      lastVisit,
    },
    byDay: computeGithubByDay(month),
    byDayTop: computeGithubByDayTop(month),
    kindCounts: computeGithubKindCounts(month),
    topRepos: [...repos.values()].sort(byVisits).slice(0, GITHUB_TOP),
    topOwners: [...owners]
      .map(([owner, o]) => ({ owner, repos: o.repos.size, visits: o.visits }))
      .sort(byVisits)
      .slice(0, GITHUB_TOP),
    topItems: [...items.values()]
      .sort(byVisits)
      .slice(0, GITHUB_TOP)
      .map(({ last: _, ...it }) => it),
  }
}

// per-day visit counts split by github URL kind; 'all' is the row total
function computeGithubByDay(month?: string): { day: string; all: number; repo: number; issue_pr: number; other: number }[] {
  const map = new Map<string, { day: string; all: number; repo: number; issue_pr: number; other: number }>()
  for (const item of visibleItems()) {
    const urlInfo = parseGithubUrl(item.url)
    if (!urlInfo) continue
    const kind = urlInfo.root ? 'repo' : urlInfo.kind ? 'issue_pr' : 'other'
    for (const visit of MOCK_VISITS.get(item.id) ?? []) {
      const day = isoDay(visit.visitTime)
      if (month !== undefined && day.slice(0, 7) !== month) continue
      const row = map.get(day) ?? { day, all: 0, repo: 0, issue_pr: 0, other: 0 }
      row.all += 1
      row[kind] += 1
      map.set(day, row)
    }
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
}

// per-day top items (most recently visited first) per kind, for chart tooltips
function computeGithubByDayTop(month?: string): GithubStats['byDayTop'] {
  const days = new Map<string, Record<GithubDayKind, Map<string, GithubDayItem>>>()
  for (const item of visibleItems()) {
    const urlInfo = parseGithubUrl(item.url)
    if (!urlInfo) continue
    const classified = classifyDayItem(urlInfo)
    const perDay = new Map<string, { visits: number; lastVisit: number }>()
    for (const visit of MOCK_VISITS.get(item.id) ?? []) {
      const day = isoDay(visit.visitTime)
      if (month !== undefined && day.slice(0, 7) !== month) continue
      const agg = perDay.get(day) ?? { visits: 0, lastVisit: 0 }
      agg.visits += 1
      agg.lastVisit = Math.max(agg.lastVisit, visit.visitTime)
      perDay.set(day, agg)
    }
    for (const [day, agg] of perDay) {
      const byKind = days.get(day) ?? { repo: new Map(), issue_pr: new Map(), other: new Map() }
      const bucket = byKind[classified.kind]
      const cur = bucket.get(classified.key) ?? { ...classified, visits: 0, lastVisit: 0 }
      cur.visits += agg.visits
      cur.lastVisit = Math.max(cur.lastVisit, agg.lastVisit)
      bucket.set(classified.key, cur)
      days.set(day, byKind)
    }
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

// distinct items per kind, counted the way mockGithubSearch lists them (repo roots merged)
function computeGithubKindCounts(month?: string): GithubStats['kindCounts'] {
  const counts: GithubStats['kindCounts'] = { all: 0, repo: 0, issue_pr: 0, other: 0 }
  for (const { urlInfo } of mergeRepoRoots(githubPeriod(month))) {
    counts.all += 1
    counts[classifyDayItem(urlInfo).kind] += 1
  }
  return counts
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

function mockGithubSearch(params: GithubSearchParams): SearchPage {
  const owner = params.owner?.toLowerCase()
  const repo = params.repo?.toLowerCase()
  const kind = params.kind ?? 'all'
  const rows = mergeRepoRoots(githubPeriod(params.month))
    .filter(({ urlInfo }) => (!owner || urlInfo.owner === owner) && (!repo || urlInfo.repo === repo) && matchesKind(urlInfo, kind))
    .map(({ item }) => item)
    .sort(byLastVisitDesc)
  return paginate(rows, params.cursor, params.limit)
}

export const githubMock = {
  github: {
    async stats({ month }: StatsParams = {}): Promise<GithubStats> {
      return computeGithubStats(month)
    },
    async search(params: GithubSearchParams): Promise<SearchPage> {
      return mockGithubSearch(params)
    },
  },
}
