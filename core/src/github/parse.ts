// github.com URL → owner / repo / PR・Issue

export type GithubKind = 'pull' | 'issue'
// 'repo' = repo root only
// 'issue_pr' = single PR/Issue
// 'code' = other repo pages
export type GithubVisitKind = 'all' | 'repo' | 'code' | 'issue_pr'

export interface GitHubUrlInfo {
  owner: string
  repo?: string
  root?: true // exactly /:owner/:repo
  kind?: GithubKind
  number?: number
}

// top-level paths that are not owners
const RESERVED = new Set([
  'about', 'apps', 'codespaces', 'collections', 'dashboard', 'enterprise', 'events', 'explore',
  'features', 'issues', 'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs',
  'pricing', 'pulls', 'search', 'settings', 'signup', 'site', 'sponsors', 'stars', 'topics',
  'trending',
])

// 'https://github.com/Foo/Bar/pull/12/files?x#y' → { owner: 'foo', repo: 'bar', kind: 'pull', number: 12 }
// gist.github.com etc. → null
export function parseGithubUrl(url: string): GitHubUrlInfo | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
  const [owner, repo, type, num] = u.pathname.toLowerCase().split('/').filter(Boolean)
  if (!owner || RESERVED.has(owner)) return null
  if (!repo) return { owner }
  if (!type) return { owner, repo, root: true }
  const n = num !== undefined && /^\d+$/.test(num) ? Number(num) : undefined
  const kind: GithubKind | undefined =
    n === undefined ? undefined : type === 'pull' ? 'pull' : type === 'issues' ? 'issue' : undefined
  return kind ? { owner, repo, kind, number: n } : { owner, repo }
}

interface VisitLike {
  id: number
  url: string
  title: string
  visitCount: number
  typedCount: number
  firstVisit: number
  lastVisit: number
}

// Collapse repo-root variants (?tab=…, #readme, trailing /) into one row per repo.
// Newest variant wins id/title; url drops query/hash; counts are summed.
export function mergeRepoRoots<T extends VisitLike>(rows: { item: T; urlInfo: GitHubUrlInfo }[]): { item: T; urlInfo: GitHubUrlInfo }[] {
  const roots = new Map<string, { item: T; urlInfo: GitHubUrlInfo }>()
  const out: { item: T; urlInfo: GitHubUrlInfo }[] = []
  for (const row of rows) {
    if (!row.urlInfo.root) {
      out.push(row)
      continue
    }
    const key = `${row.urlInfo.owner}/${row.urlInfo.repo}`
    const prev = roots.get(key)
    if (!prev) {
      roots.set(key, { item: { ...row.item, url: stripUrl(row.item.url) }, urlInfo: row.urlInfo })
      continue
    }
    const a = prev.item
    const b = row.item
    const newer = b.lastVisit > a.lastVisit || (b.lastVisit === a.lastVisit && b.id > a.id) ? b : a
    prev.item = {
      ...newer,
      url: stripUrl(newer.url),
      visitCount: a.visitCount + b.visitCount,
      typedCount: a.typedCount + b.typedCount,
      firstVisit: Math.min(a.firstVisit, b.firstVisit),
      lastVisit: Math.max(a.lastVisit, b.lastVisit),
    }
  }
  return [...out, ...roots.values()]
}

// 'https://github.com/Foo/Bar/?tab=x#y' → 'https://github.com/Foo/Bar'
function stripUrl(url: string): string {
  const u = new URL(url)
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
}

export function matchesKind(urlInfo: GitHubUrlInfo, k: GithubVisitKind): boolean {
  if (k === 'all') return true
  if (k === 'repo') return urlInfo.root === true
  if (k === 'code') return urlInfo.repo !== undefined && !urlInfo.root && !urlInfo.kind
  return urlInfo.kind !== undefined
}

export interface GithubTitle {
  name: string
  desc?: string
  meta?: string
}

// Page <title> → card fields. Falls back to { name: title }.
// repo:     'owner/repo: A fast bundler'                       → { name: 'repo', desc: 'A fast bundler' }
// pull:     'Fix X by alice · Pull Request #12 · owner/repo'   → { name: 'Fix X', meta: 'alice' }
// issue:    'Bug Y · Issue #3 · owner/repo'                    → { name: 'Bug Y' }
export function parseGithubTitle(title: string, urlInfo: GitHubUrlInfo): GithubTitle {
  const t = title.trim()
  if (urlInfo.root && urlInfo.repo) {
    const m = /^([^/\s]+)\/([^:\s]+)(?::\s*(.*))?$/s.exec(t)
    if (m && m[2]) return { name: m[2], desc: m[3]?.trim() || undefined }
    return { name: urlInfo.repo }
  }
  if (urlInfo.kind) {
    const head = t.split(' · ')[0] ?? t
    const by = urlInfo.kind === 'pull' ? / by (\S+)$/.exec(head) : null
    const name = (by ? head.slice(0, by.index) : head).trim()
    return { name: name || t, meta: by?.[1] }
  }
  return { name: t }
}
