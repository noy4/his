import type { EpochMs, HistoryItem, HistoryVisit } from '../../types.ts'
import type { Page } from '../../db/query/paging.ts'

// Browser-safe history data types (type-only imports; no runtime/DB code).
// The functions live in query.ts / stats.ts (Node-only).

export interface SearchFilter {
  query?: string
  url?: string
  from?: EpochMs
  to?: EpochMs
  cursor?: string
  limit?: number
}

export type SearchPage = Page<HistoryItem>
export type SearchVisitsPage = Page<HistoryVisit>

export interface StatTotals {
  items: number
  visits: number
  domains: number
  firstVisit: EpochMs
  lastVisit: EpochMs
}

export interface Stats {
  totals: StatTotals
  byHour: { hour: number; visits: number }[]
  byDow: { dow: number; visits: number }[]
  byDay: { day: string; visits: number }[]
  topDomains: { domain: string; visits: number }[]
  busiestDays: { day: string; visits: number }[]
}
