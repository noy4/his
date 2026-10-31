import { matchesHidden, type HistoryItem, type SearchPage } from '@his/core'
import { isoDay } from '@/lib/date'
import { MOCK_DISCOVERED, MOCK_ITEMS, MOCK_SOURCES, MOCK_VISITS } from './data'

// Shared mock kit: fixtures, helpers and the hidden-pattern state, used by the
// core mock (client.ts) and the per-plugin mocks (plugins/<x>/mock.ts).

export { MOCK_DISCOVERED, MOCK_ITEMS, MOCK_SOURCES, MOCK_VISITS }

export const DEFAULT_LIMIT = 50

let hiddenPatterns: string[] = []

export function getHiddenPatterns(): string[] {
  return hiddenPatterns
}

export function setHiddenPatterns(patterns: string[]): void {
  hiddenPatterns = patterns
}

export function hiddenUrlCount(patterns: string[]): number {
  if (patterns.length === 0) return 0
  return MOCK_ITEMS.filter((item) => matchesHidden(item.url, patterns)).length
}

export function visibleItems(): HistoryItem[] {
  if (hiddenPatterns.length === 0) return [...MOCK_ITEMS]
  return MOCK_ITEMS.filter((item) => !matchesHidden(item.url, hiddenPatterns))
}

export function byLastVisitDesc(a: HistoryItem, b: HistoryItem): number {
  return b.lastVisit - a.lastVisit || b.id - a.id
}

// 'YYYY-MM-DD' → ascending daily series
export function sortByDay(byDay: Map<string, number>): { day: string; visits: number }[] {
  return [...byDay]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, visits]) => ({ day, visits }))
}

// month → item narrowed to that month's visits (counts / first / last), or null if unvisited
export function inPeriod(item: HistoryItem, month?: string): HistoryItem | null {
  if (month === undefined) return item
  const visits = (MOCK_VISITS.get(item.id) ?? []).filter((visit) => isoDay(visit.visitTime).slice(0, 7) === month)
  if (visits.length === 0) return null
  const times = visits.map((visit) => visit.visitTime)
  return {
    ...item,
    visitCount: visits.length,
    typedCount: visits.filter((visit) => visit.transition === 'typed').length,
    firstVisit: Math.min(...times),
    lastVisit: Math.max(...times),
  }
}

export function encodeCursor(time: number, id: number): string {
  return btoa(`v1.${time}.${id}`)
}

export function decodeCursor(cursor: string): { time: number; id: number } | null {
  try {
    const m = /^v1\.(\d+)\.(\d+)$/.exec(atob(cursor))
    if (m === null) return null
    return { time: Number(m[1]), id: Number(m[2]) }
  } catch {
    return null
  }
}

// rows must be sorted by byLastVisitDesc; keyset on (lastVisit, id)
export function paginate(rows: HistoryItem[], cursorText?: string, limit = DEFAULT_LIMIT): SearchPage {
  const cursor = cursorText ? decodeCursor(cursorText) : null
  const keyed = cursor
    ? rows.filter((it) => it.lastVisit < cursor.time || (it.lastVisit === cursor.time && it.id < cursor.id))
    : rows
  const page = keyed.slice(0, limit)
  const last = page.at(-1)
  const nextCursor = keyed.length > limit && last
    ? encodeCursor(last.lastVisit, last.id)
    : null
  return { items: page, nextCursor }
}
