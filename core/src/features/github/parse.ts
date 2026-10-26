// github.com URL → owner / repo / PR・Issue

import type { GithubKind, GithubVisitKind } from './types.ts'

export interface GithubUrlInfo {
  owner: string
  repo?: string
  root?: true // exactly /:owner/:repo
  kind?: GithubKind
  number?: number // PR or Issue number
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
export function parseGithubUrl(url: string): GithubUrlInfo | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com')
    return null
  const [owner, repo, type, num] = u.pathname.toLowerCase().split('/').filter(Boolean)
  if (!owner || RESERVED.has(owner)) return null
  if (!repo) return { owner }
  if (!type) return { owner, repo, root: true }
  if (num === undefined || !/^\d+$/.test(num))
    return { owner, repo }

  const number = Number(num)
  const kind = type === 'pull'
    ? 'pull'
    : type === 'issues'
      ? 'issue'
      : undefined
  return kind
    ? { owner, repo, kind, number }
    : { owner, repo }
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
export function mergeRepoRoots<T extends VisitLike>(rows: { item: T; urlInfo: GithubUrlInfo }[]): { item: T; urlInfo: GithubUrlInfo }[] {
  const roots = new Map<string, { item: T; urlInfo: GithubUrlInfo }>()
  const out: { item: T; urlInfo: GithubUrlInfo }[] = []
  for (const row of rows) {
    if (!row.urlInfo.root) {
      out.push(row)
      continue
    }
    const key = `${row.urlInfo.owner}/${row.urlInfo.repo}`
    const prev = roots.get(key)
    if (!prev) {
      roots.set(key, {
        item: { ...row.item, url: stripUrl(row.item.url) },
        urlInfo: row.urlInfo,
      })
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

export function matchesKind(urlInfo: GithubUrlInfo, kind: GithubVisitKind): boolean {
  if (kind === 'all') return true
  if (kind === 'repo') return urlInfo.root === true
  if (kind === 'other') return !urlInfo.root && !urlInfo.kind
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
export function parseGithubTitle(title: string, urlInfo: GithubUrlInfo): GithubTitle {
  const t = title.trim()
  if (urlInfo.root && urlInfo.repo) {
    // Match "owner/repo" with optional ": description" (s allows multiline descriptions).
    const groups = /^(?<owner>[^/\s]+)\/(?<repo>[^:\s]+)(?::\s*(?<desc>.*))?$/s.exec(t)?.groups
    if (groups?.repo)
      return {
        name: groups.repo,
        desc: groups.desc?.trim() || undefined,
      }
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
