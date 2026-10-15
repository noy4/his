export interface TopByOptions<T> {
  limit: number
  score: (item: T) => number
  key: (item: T) => string
}

// Keeps the top `limit` by score desc, then key asc.
export function topBy<T>(items: readonly T[], { limit, score, key }: TopByOptions<T>): T[] {
  return [...items]
    .sort((a, b) => score(b) - score(a) || key(a).localeCompare(key(b)))
    .slice(0, limit)
}
