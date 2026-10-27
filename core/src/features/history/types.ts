import type { EpochMs, HistoryItem, HistoryVisit } from '../../types.ts'
import type { Page } from '../../db/query/paging.ts'

export interface StatsParams {
  month?: string
}

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

export interface SearchParams {
  query?: string
  url?: string
  from?: EpochMs
  to?: EpochMs
  cursor?: string
  limit?: number
}

export type SearchPage = Page<HistoryItem>
export type SearchVisitsPage = Page<HistoryVisit>
