import { hostOf } from '../../util/url.ts'

const MAX_PATTERNS = 500

/** trims, lowercases, drops empties, dedupes, caps at 500 */
export function cleanPatterns(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value !== 'string') continue
    const pattern = value.trim().toLowerCase()
    if (pattern) seen.add(pattern)
  }
  return [...seen].slice(0, MAX_PATTERNS)
}

/** true if url matches any pattern (bare host token, `*` glob, or slash path glob) */
export function matchesHidden(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false
  const host = hostOf(url)
  const full = url.toLowerCase()
  const pathUrl = full.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  return patterns.some((pattern) => {
    // slash patterns are globs over the path (scheme stripped unless the pattern has one)
    if (pattern.includes('/'))
      return globToRegExp(pattern).test(pattern.includes('://') ? full : pathUrl)
    // host-only patterns: bare tokens also match subdomains
    if (!pattern.includes('*'))
      return host === pattern || host.endsWith(`.${pattern}`)
    return globToRegExp(pattern).test(host)
  })
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}
