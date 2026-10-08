// github.com URL → owner / repo / PR・Issue. Pure (no node:*) so the WebUI can import it.

export type GithubKind = 'pull' | 'issue'
// 'repo' = repo root only · 'code' = other repo pages except PR/Issue · 'issue_pr' = single PR/Issue
export type GithubVisitKind = 'all' | 'repo' | 'code' | 'issue_pr'

export interface GithubRef {
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
export function parseGithubUrl(url: string): GithubRef | null {
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
export function mergeRepoRoots<T extends VisitLike>(rows: { item: T; ref: GithubRef }[]): { item: T; ref: GithubRef }[] {
  const roots = new Map<string, { item: T; ref: GithubRef }>()
  const out: { item: T; ref: GithubRef }[] = []
  for (const row of rows) {
    if (!row.ref.root) {
      out.push(row)
      continue
    }
    const key = `${row.ref.owner}/${row.ref.repo}`
    const prev = roots.get(key)
    if (!prev) {
      roots.set(key, { item: { ...row.item, url: stripUrl(row.item.url) }, ref: row.ref })
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

export function matchesKind(ref: GithubRef, k: GithubVisitKind): boolean {
  if (k === 'all') return true
  if (k === 'repo') return ref.root === true
  if (k === 'code') return ref.repo !== undefined && !ref.root && !ref.kind
  return ref.kind !== undefined
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
export function parseGithubTitle(title: string, ref: GithubRef): GithubTitle {
  const t = title.trim()
  if (ref.root && ref.repo) {
    const m = /^([^/\s]+)\/([^:\s]+)(?::\s*(.*))?$/s.exec(t)
    if (m && m[2]) return { name: m[2], desc: m[3]?.trim() || undefined }
    return { name: ref.repo }
  }
  if (ref.kind) {
    const head = t.split(' · ')[0] ?? t
    const by = ref.kind === 'pull' ? / by (\S+)$/.exec(head) : null
    const name = (by ? head.slice(0, by.index) : head).trim()
    return { name: name || t, meta: by?.[1] }
  }
  return { name: t }
}
