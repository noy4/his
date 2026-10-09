import type { DatabaseSync } from 'node:sqlite'
import { matchesKind, mergeRepoRoots, parseGithubUrl, type GithubKind, type GithubRef, type GithubVisitKind } from '../github/parse.ts'
import type { EpochMs, HistoryItem } from '../model.ts'
import { clampLimit, decodeCursor, encodeCursor, type SearchPage } from './query.ts'
import { MONTH_BUCKET, MONTH_RE } from './stats.ts'

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

  for (const { item, ref } of githubRows(db, month)) {
    const n = item.visitCount
    visits += n
    firstVisit = firstVisit === 0 || item.firstVisit < firstVisit ? item.firstVisit : firstVisit
    lastVisit = Math.max(lastVisit, item.lastVisit)
    const o = owners.get(ref.owner) ?? { visits: 0, repos: new Set<string>() }
    o.visits += n
    owners.set(ref.owner, o)
    if (ref.repo === undefined) continue
    o.repos.add(ref.repo)
    const rk = `${ref.owner}/${ref.repo}`
    const r = repos.get(rk) ?? { owner: ref.owner, repo: ref.repo, visits: 0 }
    r.visits += n
    repos.set(rk, r)
    if (ref.kind === undefined || ref.number === undefined) continue
    const ik = `${rk}/${ref.kind}/${ref.number}`
    const cur = items.get(ik)
    if (cur === undefined) {
      items.set(ik, { owner: ref.owner, repo: ref.repo, kind: ref.kind, number: ref.number, title: cleanTitle(item.title), url: item.url, visits: n, last: item.lastVisit })
    } else {
      cur.visits += n
      // latest visit wins for title / url
      if (item.lastVisit > cur.last) Object.assign(cur, { title: cleanTitle(item.title), url: item.url, last: item.lastVisit })
    }
  }

  return {
    totals: { visits, repos: repos.size, owners: owners.size, items: items.size, firstVisit, lastVisit },
    topRepos: top([...repos.values()], (r) => `${r.owner}/${r.repo}`),
    topOwners: top([...owners].map(([owner, o]) => ({ owner, repos: o.repos.size, visits: o.visits })), (o) => o.owner),
    topItems: top([...items.values()], (it) => it.url).map(({ owner, repo, kind, number, title, url, visits }) => ({ owner, repo, kind, number, title, url, visits })),
  }
}

export function githubVisits(db: DatabaseSync, filter: GithubVisitsFilter = {}): SearchPage {
  const owner = filter.owner?.toLowerCase()
  const repo = filter.repo?.toLowerCase()
  const kind = filter.kind ?? 'all'
  const limit = clampLimit(filter.limit)
  const cursor = filter.cursor === undefined ? null : decodeCursor(filter.cursor)

  const rows = mergeRepoRoots(githubRows(db, filter.month))
    .filter(({ ref }) => (owner === undefined || ref.owner === owner) && (repo === undefined || ref.repo === repo) && matchesKind(ref, kind))
    .map(({ item }) => item)
    .sort((a, b) => b.lastVisit - a.lastVisit || b.id - a.id)
  const keyed = cursor === null
    ? rows
    : rows.filter((it) => it.lastVisit < cursor[0] || (it.lastVisit === cursor[0] && it.id < cursor[1]))
  const items = keyed.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    nextCursor: keyed.length > limit && last !== undefined ? encodeCursor(last.lastVisit, last.id) : null,
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
const GITHUB_URL = "(urls.url LIKE 'https://github.com/%' OR urls.url LIKE 'https://www.github.com/%' OR urls.url LIKE 'http://github.com/%')"

// github.com rows; with month, visitCount / first / last are narrowed to that month
function githubRows(db: DatabaseSync, month?: string): { item: HistoryItem; ref: GithubRef }[] {
  let rows: Row[]
  if (month === undefined) {
    rows = db.prepare(
      `SELECT id, url, title, visit_count, typed_count, first_visit_time, last_visit_time
       FROM urls WHERE ${GITHUB_URL}`,
    ).all() as unknown as Row[]
  } else {
    if (!MONTH_RE.test(month)) throw new Error(`month: 'YYYY-MM' required, got ${month}`)
    rows = db.prepare(
      `SELECT urls.id AS id, urls.url AS url, urls.title AS title, COUNT(*) AS visit_count, urls.typed_count AS typed_count,
              MIN(visits.visit_time) AS first_visit_time, MAX(visits.visit_time) AS last_visit_time
       FROM visits JOIN urls ON urls.id = visits.url_id
       WHERE ${GITHUB_URL} AND ${MONTH_BUCKET}
       GROUP BY urls.id`,
    ).all(month) as unknown as Row[]
  }
  return rows.flatMap((row) => {
    const ref = parseGithubUrl(row.url)
    if (ref === null) return []
    const item: HistoryItem = {
      id: row.id,
      url: row.url,
      title: row.title ?? '',
      visitCount: Number(row.visit_count),
      typedCount: row.typed_count,
      firstVisit: row.first_visit_time,
      lastVisit: row.last_visit_time,
    }
    return [{ item, ref }]
  })
}

// 'Fix foo by bar · Pull Request #12 · o/r' → 'Fix foo by bar'
function cleanTitle(title: string): string {
  return title.split(' · ')[0] ?? title
}

function top<T extends { visits: number }>(rows: T[], key: (row: T) => string): T[] {
  return rows.sort((a, b) => b.visits - a.visits || key(a).localeCompare(key(b))).slice(0, TOP)
}
