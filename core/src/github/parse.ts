// github.com URL → owner / repo / PR・Issue. Pure (no node:*) so the WebUI can import it.

export type GithubKind = 'pull' | 'issue'
// 'code' = repo pages other than a single PR/Issue
export type GithubVisitKind = 'all' | 'code' | GithubKind

export interface GithubRef {
  owner: string
  repo?: string
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
  const n = num !== undefined && /^\d+$/.test(num) ? Number(num) : undefined
  const kind: GithubKind | undefined =
    n === undefined ? undefined : type === 'pull' ? 'pull' : type === 'issues' ? 'issue' : undefined
  return kind ? { owner, repo, kind, number: n } : { owner, repo }
}

export function matchesKind(ref: GithubRef, k: GithubVisitKind): boolean {
  if (k === 'all') return true
  if (k === 'code') return ref.repo !== undefined && !ref.kind
  return ref.kind === k
}
