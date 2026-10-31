// search-engine URL → { engine, term }

export interface SearchQueryInfo {
  engine: string
  term: string
}

interface EngineDef {
  engine: string
  hosts: Set<string>
  /** required pathname; undefined = any path */
  path?: string
  /** query parameter holding the term */
  param: string
}

const ENGINES: EngineDef[] = [
  { engine: 'google', hosts: new Set(['google.com', 'www.google.com']), path: '/search', param: 'q' },
  { engine: 'bing', hosts: new Set(['bing.com', 'www.bing.com']), path: '/search', param: 'q' },
  { engine: 'duckduckgo', hosts: new Set(['duckduckgo.com', 'www.duckduckgo.com']), param: 'q' },
  { engine: 'brave', hosts: new Set(['search.brave.com']), path: '/search', param: 'q' },
]

export const SEARCH_HOSTS: string[] = ENGINES.flatMap((e) => [...e.hosts])

// 'https://www.google.com/search?q=typescript+generics' → { engine: 'google', term: 'typescript generics' }
// non-search host/path or empty term → null
export function parseSearchQuery(url: string): SearchQueryInfo | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const def = ENGINES.find((e) => e.hosts.has(host) && (e.path === undefined || u.pathname === e.path))
  if (def === undefined) return null
  const term = normalizeTerm(u.searchParams.get(def.param))
  return term === null ? null : { engine: def.engine, term }
}

// trim outer spaces and collapse internal whitespace runs ('+' decodes to a space)
function normalizeTerm(raw: string | null): string | null {
  if (raw === null) return null
  const term = raw.trim().replace(/\s+/g, ' ')
  return term === '' ? null : term
}
